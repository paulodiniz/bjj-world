const express = require('express');
const neo4j = require('neo4j-driver');
const Anthropic = require('@anthropic-ai/sdk');
const { Pool } = require('pg');
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
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama.railway.internal:11434';

const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

// Video cache
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

// Rate limiter: 20 requests per IP per hour
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

// ── RAG ──────────────────────────────────────────────────────────────────────

let ragChunks = []; // { id, name, type, text } — always in memory for keyword fallback

const ACTION_LABEL = {
  attack_with:   'Attacks',
  sweep_with:    'Sweeps',
  pass_with:     'Guard passes',
  transition_to: 'Transitions to',
  follow_up:     'Follow-ups',
  recover_to:    'Recovers to',
  escape_with:   'Escapes',
  counters:      'Counters',
  requires:      'Requires',
  developed:     'Developed',
  centers_on:    'Centers on',
  features:      'Features',
  known_for:     'Known for',
  coached_by:    'Coached by',
};

function buildChunks(graph) {
  const edgesByFrom = {};
  for (const edge of graph.edges) {
    (edgesByFrom[edge.from] ??= []).push(edge);
  }
  const nodeMap = Object.fromEntries(graph.nodes.map(n => [n.id, n]));

  return graph.nodes.map(node => {
    const lines = [`[${node.type}] ${node.name}`];
    if (node.description) lines.push(node.description);

    const byAction = {};
    for (const e of edgesByFrom[node.id] ?? []) {
      const target = nodeMap[e.to];
      if (!target) continue;
      const label = `${target.name}${e.difficulty ? ` (${e.difficulty})` : ''}`;
      (byAction[e.action] ??= []).push(label);
    }

    for (const [action, targets] of Object.entries(byAction)) {
      lines.push(`${ACTION_LABEL[action] ?? action}: ${targets.join(', ')}`);
    }

    return { id: node.id, name: node.name, type: node.type, text: lines.join('\n') };
  });
}

async function ollamaEmbed(texts) {
  const results = [];
  for (const text of texts) {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
    });
    const data = await res.json();
    results.push(data.embedding);
  }
  return results;
}


let ragReady = false;

async function retrieve(question, k = 7) {
  if (!ragReady) {
    // Embeddings still loading — fall back to keyword search
    const words = question.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    return ragChunks
      .map(chunk => {
        const t = chunk.text.toLowerCase();
        const score = words.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0) / (words.length || 1);
        return { ...chunk, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
  const [qEmb] = await ollamaEmbed([question]);
  const { rows } = await pgPool.query(
    `SELECT id, name, type, chunk AS text, 1 - (embedding <=> $1::vector) AS score
     FROM bjj_embeddings
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [JSON.stringify(qEmb), k]
  );
  return rows;
}

async function initRAG() {
  const graph = JSON.parse(fs.readFileSync(path.join(__dirname, 'graph.json'), 'utf8'));
  ragChunks = buildChunks(graph);
  console.log(`Built ${ragChunks.length} RAG chunks`);

  // Ensure the embedding model is available
  console.log('Pulling nomic-embed-text...');
  await fetch(`${OLLAMA_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'nomic-embed-text', stream: false }),
  });
  console.log('nomic-embed-text ready');

  await pgPool.query('CREATE EXTENSION IF NOT EXISTS vector');
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS bjj_embeddings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      chunk TEXT NOT NULL,
      embedding vector(768)
    )
  `);

  const { rows } = await pgPool.query('SELECT COUNT(*) AS count FROM bjj_embeddings');
  if (parseInt(rows[0].count) === ragChunks.length) {
    console.log(`pgvector: ${rows[0].count} embeddings already stored, skipping`);
    ragReady = true;
    return;
  }

  console.log('Computing and storing embeddings...');
  await pgPool.query('TRUNCATE bjj_embeddings');

  const embeddings = await ollamaEmbed(ragChunks.map(c => c.text));
  for (let i = 0; i < ragChunks.length; i++) {
    const c = ragChunks[i];
    await pgPool.query(
      'INSERT INTO bjj_embeddings (id, name, type, chunk, embedding) VALUES ($1, $2, $3, $4, $5)',
      [c.id, c.name, c.type, c.text, JSON.stringify(embeddings[i])]
    );
  }
  console.log(`Stored ${ragChunks.length} embeddings in pgvector`);
  ragReady = true;
}

// ── Answer streaming ──────────────────────────────────────────────────────────

async function streamAnswer(question, chunks, history, onToken) {
  const context = chunks.map(c => c.text).join('\n\n---\n\n');

  const stream = await anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: 'You are a helpful BJJ coach embedded in an app that automatically shows relevant YouTube videos alongside your answers. Never say you cannot show videos — the app handles that. Answer questions clearly and concisely based on the knowledge provided. Focus on practical advice.',
    messages: [
      ...history,
      { role: 'user', content: `Question: ${question}\n\nRelevant BJJ knowledge:\n${context}` },
    ],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      onToken(event.delta.text);
    }
  }
}

// ── Database seeding ──────────────────────────────────────────────────────────

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

// ── Routes ────────────────────────────────────────────────────────────────────

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
    // Video-only requests — match names from last answer
    const isVideoRequest = /\b(video|videos|show me|watch|youtube)\b/i.test(question);
    if (isVideoRequest && YOUTUBE_API_KEY && history.length > 0) {
      send('status', { text: 'Finding videos...' });
      const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
      if (lastAssistant) {
        const mentioned = ragChunks
          .filter(c => lastAssistant.content.includes(c.name))
          .slice(0, 3);
        const videos = (await Promise.all(
          mentioned.map(async c => {
            const url = await searchYouTube(c.name, null);
            return url ? { name: c.name, url } : null;
          })
        )).filter(Boolean);
        if (videos.length) send('videos', { videos });
      }
      send('token', { text: 'Here are the videos for the techniques we just discussed.' });
      send('done', {});
      return;
    }

    // Retrieve relevant chunks
    send('status', { text: 'Searching knowledge base...' });
    const chunks = await retrieve(question);

    // Stream answer
    send('status', { text: 'Answering...' });
    await streamAnswer(question, chunks, history, token => send('token', { text: token }));

    // YouTube search against retrieved chunks
    if (YOUTUBE_API_KEY && chunks.length > 0) {
      const sourceName = chunks[0].name;
      const videos = (await Promise.all(
        chunks.slice(0, 3).map(async c => {
          const url = await searchYouTube(c.name, sourceName !== c.name ? sourceName : null);
          return url ? { name: c.name, url } : null;
        })
      )).filter(Boolean);
      if (videos.length) send('videos', { videos });
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

    if (result.records.length === 0) return res.json({ found: false });

    const record = result.records[0];
    res.json({ found: true, steps: record.get('steps'), transitions: record.get('transitions') });
  } finally {
    await session.close();
  }
});

// ── Startup ───────────────────────────────────────────────────────────────────

async function start() {
  try {
    await seedDatabase();
  } catch (err) {
    console.error('Seed failed (DB may not be ready yet):', err.message);
  }

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`BJJ Chat running on port ${port}`));

  // Run RAG init in background so the server is ready immediately
  initRAG().catch(err => console.error('RAG init failed:', err.message));
}

start();
