const express = require('express');
const neo4j = require('neo4j-driver');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://neo4j.railway.internal:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD
  )
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Cache to avoid re-searching same technique+position combo
const videoCache = new Map();

async function searchYouTube(technique, sourcePosition) {
  const query = sourcePosition
    ? `${technique} from ${sourcePosition} BJJ tutorial`
    : `${technique} BJJ tutorial`;
  const cacheKey = query.toLowerCase();
  if (videoCache.has(cacheKey)) return videoCache.get(cacheKey);
  if (!YOUTUBE_API_KEY) return null;

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?q=${encodeURIComponent(query)}&type=video&part=snippet&maxResults=1&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const videoId = data.items?.[0]?.id?.videoId;
    const result = videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
    videoCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

// Simple in-memory rate limiter: 20 requests per IP per hour
const rateLimiter = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const limit = 20;
  const hits = (rateLimiter.get(ip) || []).filter(t => now - t < windowMs);
  if (hits.length >= limit) return true;
  hits.push(now);
  rateLimiter.set(ip, hits);
  return false;
}

const SCHEMA_CONTEXT = `You are a BJJ (Brazilian Jiu-Jitsu) knowledge assistant with access to a Neo4j graph database.

IMPORTANT: All nodes have the label :BJJNode. There are NO other labels.
Node properties: id (snake_case e.g. "closed_guard", "triangle_choke"), name, type, description.
Node types (stored as the 'type' property, NOT as labels):
- position: guard and dominant positions (closed_guard, mount, back_control, worm_guard, fifty_fifty, ashi_garami, dogfight, z_guard, lasso_guard, rubber_guard, reverse_de_la_riva, etc.)
- submission: finishing techniques (armbar, triangle_choke, heel_hook, north_south_choke, clock_choke, ezekiel_choke, gogoplata, twister, kneebar, banana_split, calf_slicer, etc.)
- sweep: techniques to reverse position (scissor_sweep, butterfly_sweep, waiter_sweep, sickle_sweep, lasso_sweep, etc.)
- guard_pass: techniques to pass the guard (torreando_pass, knee_slice_pass, x_pass, cartwheel_pass, smash_pass, long_step_pass, etc.)
- takedown: standing techniques (double_leg_takedown, single_leg_takedown, judo_throw, hip_throw, foot_sweep, firemans_carry)
- escape: defensive techniques to escape bad positions (elbow_knee_escape, shrimp_escape, back_escape_roll, granby_roll, running_man_escape)
- counter: techniques that counter specific attacks (sprawl, posture_up, arm_tuck, stack_defense, frame_and_shrimp)
- technique: setups and entries that don't fit other categories (arm_drag, snap_down, body_lock_takedown, guard_pull)
- concept: fundamental principles (kuzushi, hip_escape_movement, base_and_posture, framing, grips, weight_distribution, bridge_movement)
- competitor: famous BJJ practitioners (marcelo_garcia, gordon_ryan, keenan_cornelius, roger_gracie, mikey_musumeci, bernardo_faria, john_danaher, leandro_lo, romulo_barral, andre_galvao)
- system: named game plans (marcelo_butterfly_back_system, keenan_lapel_guard_system, roger_closed_guard_system, bernardo_half_guard_system, gordon_back_system, dds_leg_lock_system)

Node property gi_requirement: "gi" (gi only), "no_gi" (no-gi focused), "both" (works in both). Default is "both".
Gi-only techniques include: worm_guard, lasso_guard, spider_guard, bow_and_arrow_choke, baseball_bat_choke, clock_choke, ezekiel_choke.

Relationship types (always uppercase):
- ATTACK_WITH: can attack from this position with this technique
- TRANSITION_TO: can move to this position
- SWEEP_WITH: can sweep using this technique
- PASS_WITH: can pass guard using this technique
- FOLLOW_UP: natural follow-up after this technique
- RECOVER_TO: can recover to this position
- ESCAPE_WITH: can escape from this position using this technique
- COUNTERS: this technique counters that technique
- REQUIRES: this technique requires this concept/movement
- DEVELOPED: competitor developed or popularized this system
- CENTERS_ON: system is built around this position
- FEATURES: system prominently uses this technique
- KNOWN_FOR: competitor is known for this technique or position
- COACHED_BY: competitor was coached by this person

Relationship properties: conditions (array of strings), confidence (high/medium/low), difficulty (beginner/intermediate/advanced).

Cypher syntax rules:
- To get a relationship type use type(r), NOT "r type": RETURN type(r) AS relationship_type
- To filter by multiple relationship types use: -[:TYPE_A|TYPE_B]->
- String properties use double quotes: {id: "closed_guard"}
- UNION requires ALL sub-queries to return the exact same column names — if unsure, avoid UNION and use a single MATCH with OR or multiple relationship types instead

Example valid queries:
MATCH (a:BJJNode {id: "closed_guard"})-[r:ATTACK_WITH]->(b:BJJNode) RETURN b, r.difficulty, r.conditions
MATCH (a:BJJNode {id: "mount"})-[:ESCAPE_WITH]->(e:BJJNode) RETURN e
MATCH (a:BJJNode)-[:COUNTERS]->(b:BJJNode {id: "armbar"}) RETURN a
MATCH (c:BJJNode {id: "marcelo_garcia"})-[:KNOWN_FOR|DEVELOPED]->(t:BJJNode) RETURN c.name, t.name, t.type, type(r) AS rel
MATCH (s:BJJNode {type: "system"})-[:CENTERS_ON|FEATURES]->(t:BJJNode) WHERE s.id CONTAINS "marcelo" RETURN s.name, t.name, t.type`;

const FALLBACK_QUERY = 'MATCH (n:BJJNode) RETURN n.name LIMIT 5';

async function generateCypher(question, history = []) {
  const messages = [
    ...history,
    {
      role: 'user',
      content: `Generate a Cypher query for this BJJ question. Output ONLY the Cypher query, nothing else. If the input is not a BJJ question, return: ${FALLBACK_QUERY}\n\nQuestion: ${question}`
    }
  ];
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: SCHEMA_CONTEXT,
    messages
  });
  const raw = msg.content[0].text.replace(/```cypher?\n?/gi, '').replace(/```/g, '');
  const match = raw.match(/(MATCH|WITH|CALL|RETURN)[\s\S]+/i);
  return match ? match[0].trim() : FALLBACK_QUERY;
}

async function streamAnswer(question, records, onToken) {
  const stream = await anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: 'You are a helpful BJJ coach embedded in an app that automatically shows relevant YouTube videos alongside your answers. Never say you cannot show videos — the app handles that. Answer questions clearly and concisely based on the graph data provided. Focus on practical advice.',
    messages: [{ role: 'user', content: `Question: ${question}\n\nGraph data: ${JSON.stringify(records, null, 2)}` }]
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      onToken(chunk.delta.text);
    }
  }
}

async function seedDatabase() {
  const graph = JSON.parse(fs.readFileSync(path.join(__dirname, 'graph.json'), 'utf8'));
  const session = driver.session();
  try {
    const result = await session.run('MATCH (n:BJJNode) RETURN count(n) as count');
    const count = result.records[0].get('count').toNumber();

    const videoResult = await session.run('MATCH (n:BJJNode) WHERE n.video_url IS NOT NULL RETURN count(n) as c');
    const videoCount = videoResult.records[0].get('c').toNumber();
    if (count === graph.nodes.length && videoCount === graph.nodes.length) {
      console.log(`Database up to date with ${count} nodes`);
      return;
    }

    console.log(`Database has ${count} nodes, graph.json has ${graph.nodes.length} — reseeding...`);
    await session.run('MATCH (n) DETACH DELETE n');
    await session.run('CREATE CONSTRAINT bjj_node_id IF NOT EXISTS FOR (n:BJJNode) REQUIRE n.id IS UNIQUE');

    for (const node of graph.nodes) {
      await session.run(
        'MERGE (n:BJJNode {id: $id}) SET n.name = $name, n.type = $type, n.description = $description, n.gi_requirement = $gi_requirement, n.video_url = $video_url',
        { id: node.id, name: node.name, type: node.type, description: node.description, gi_requirement: node.gi_requirement || 'both', video_url: node.video_url || null }
      );
    }

    for (const edge of graph.edges) {
      const relType = edge.action.toUpperCase();
      await session.run(
        `MATCH (a:BJJNode {id: $from}), (b:BJJNode {id: $to})
         WHERE a IS NOT NULL AND b IS NOT NULL
         CREATE (a)-[:${relType} {conditions: $conditions, confidence: $confidence, difficulty: $difficulty}]->(b)`,
        { from: edge.from, to: edge.to, conditions: edge.conditions || [], confidence: edge.confidence, difficulty: edge.difficulty }
      );
    }

    console.log(`Seeded ${graph.nodes.length} nodes and ${graph.edges.length} edges`);
  } finally {
    await session.close();
  }
}

app.post('/api/chat', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }

  const { question, history = [] } = req.body;
  if (!question) return res.status(400).json({ error: 'question is required' });

  console.log(`[${new Date().toISOString()}] ip=${ip} question="${question}"`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (type, payload) => res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);

  try {
    // Detect video-only requests — search YouTube from history context instead of querying graph
    const isVideoRequest = /\b(video|videos|show me|watch|youtube)\b/i.test(question);
    if (isVideoRequest && YOUTUBE_API_KEY && history.length > 0) {
      send('status', { text: 'Finding videos...' });
      const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
      if (lastAssistant) {
        const videoSession = driver.session();
        try {
          const allNames = await videoSession.run('MATCH (n:BJJNode) RETURN n.name AS name');
          const knownNames = allNames.records.map(r => r.get('name'));
          const mentioned = knownNames.filter(n => lastAssistant.content.includes(n));
          const videos = (await Promise.all(
            mentioned.slice(0, 3).map(async name => {
              const url = await searchYouTube(name, null);
              return url ? { name, url } : null;
            })
          )).filter(Boolean);
          if (videos.length) send('videos', { videos });
        } finally {
          await videoSession.close();
        }
      }
      send('token', { text: 'Here are the videos for the techniques we just discussed.' });
      send('done', {});
      return;
    }

    // Step 1: Generate Cypher query
    send('status', { text: 'Generating query...' });
    const cypher = await generateCypher(question, history);
    send('cypher', { text: cypher });

    // Step 2: Run against Neo4j (with one retry on syntax error)
    send('status', { text: 'Querying graph...' });
    let records;
    let finalCypher = cypher;
    for (let attempt = 0; attempt < 2; attempt++) {
      const session = driver.session();
      try {
        const result = await session.run(finalCypher);
        records = result.records.map(r => r.toObject());
        break;
      } catch (err) {
        await session.close();
        if (attempt === 1) throw err;
        // Ask Claude to fix the broken query
        const fixed = await generateCypher(
          `The following Cypher query failed with this error: "${err.message}"\n\nBroken query:\n${finalCypher}\n\nFix the query. Original question: ${question}`,
          history
        );
        finalCypher = fixed;
        send('cypher', { text: finalCypher });
      } finally {
        try { await session.close(); } catch {}
      }
    }

    // Step 3: Stream the answer
    send('status', { text: 'Answering...' });
    await streamAnswer(question, records, token => send('token', { text: token }));

    // Context-aware YouTube search — skip if fallback query was used
    if (YOUTUBE_API_KEY && finalCypher !== FALLBACK_QUERY) {
      const sourceMatch = finalCypher.match(/\{id:\s*["'](\w+)["']\}/);
      const sourceId = sourceMatch ? sourceMatch[1] : null;

      const sourceSession = driver.session();
      let sourceName = null;
      try {
        if (sourceId) {
          const r = await sourceSession.run('MATCH (n:BJJNode {id: $id}) RETURN n.name AS name', { id: sourceId });
          sourceName = r.records[0]?.get('name') || null;
        }
      } finally {
        await sourceSession.close();
      }

      const techniqueNames = [...new Set(
        records.flatMap(r => Object.values(r)).filter(v => typeof v === 'string' && v.length > 3)
      )];

      const videoSession = driver.session();
      try {
        const matchResult = await videoSession.run(
          'MATCH (n:BJJNode) WHERE n.name IN $names RETURN n.name AS name',
          { names: techniqueNames }
        );
        const validNames = matchResult.records.map(r => r.get('name')).slice(0, 3);
        const videos = (await Promise.all(
          validNames.map(async name => {
            const url = await searchYouTube(name, sourceName);
            return url ? { name, url } : null;
          })
        )).filter(Boolean);
        if (videos.length) send('videos', { videos });
      } finally {
        await videoSession.close();
      }
    }

    send('done', {});
  } catch (err) {
    console.error(err);
    send('error', { text: err.message });
  }

  res.end();
});

app.get('/api/positions', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (n:BJJNode) WHERE n.type IN ['position','submission','sweep','guard_pass','takedown','escape','counter','concept','competitor','system']
       RETURN n.id AS id, n.name AS name, n.type AS type ORDER BY n.type, n.name`
    );
    res.json(result.records.map(r => ({ id: r.get('id'), name: r.get('name'), type: r.get('type') })));
  } finally {
    await session.close();
  }
});

app.get('/api/path', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (start:BJJNode {id: $from}), (end:BJJNode {id: $to})
       MATCH p = shortestPath((start)-[*..12]->(end))
       RETURN [n IN nodes(p) | {id: n.id, name: n.name, type: n.type}] AS steps,
              [r IN relationships(p) | type(r)] AS transitions`,
      { from, to }
    );

    if (result.records.length === 0) {
      return res.json({ found: false });
    }

    const record = result.records[0];
    res.json({ found: true, steps: record.get('steps'), transitions: record.get('transitions') });
  } finally {
    await session.close();
  }
});


async function start() {
  try {
    await seedDatabase();
  } catch (err) {
    console.error('Seed failed (DB may not be ready yet):', err.message);
  }

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`BJJ Chat running on port ${port}`));
}

start();
