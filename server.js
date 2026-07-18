const express = require('express');
const neo4j = require('neo4j-driver');
const Anthropic = require('@anthropic-ai/sdk');
const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

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

// Stricter limiter for video analysis: 3 per IP per hour
const analysisLimiter = new Map();
function isAnalysisLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const limit = 3;
  const hits = (analysisLimiter.get(ip) || []).filter(t => now - t < windowMs);
  if (hits.length >= limit) return true;
  hits.push(now);
  analysisLimiter.set(ip, hits);
  return false;
}

function extractYouTubeId(text) {
  const m = text.match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?[^\s]*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
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

const INCOMING_LABEL = {
  attack_with:   'Attacked from',
  sweep_with:    'Used as sweep from',
  pass_with:     'Used as pass from',
  transition_to: 'Transitioned to from',
  follow_up:     'Natural follow-up to',
  recover_to:    'Recovered to from',
  escape_with:   'Escape used from',
  counters:      'Countered by',
  known_for:     'Practitioners known for this',
  features:      'Featured in',
  centers_on:    'Center of system',
  developed:     'Developed by',
};

function buildChunks(graph) {
  const edgesByFrom = {};
  const edgesByTo = {};
  for (const edge of graph.edges) {
    (edgesByFrom[edge.from] ??= []).push(edge);
    (edgesByTo[edge.to] ??= []).push(edge);
  }
  const nodeMap = Object.fromEntries(graph.nodes.map(n => [n.id, n]));

  return graph.nodes.map(node => {
    const lines = [`[${node.type}] ${node.name}`];
    if (node.description) lines.push(node.description);

    // Outgoing edges — what this node leads to
    const byAction = {};
    for (const e of edgesByFrom[node.id] ?? []) {
      const target = nodeMap[e.to];
      if (!target) continue;
      const detail = [
        target.name,
        e.difficulty,
        e.conditions?.length ? `(${e.conditions.slice(0, 2).join(', ')})` : null,
      ].filter(Boolean).join(' ');
      (byAction[e.action] ??= []).push(detail);
    }
    for (const [action, targets] of Object.entries(byAction)) {
      lines.push(`${ACTION_LABEL[action] ?? action}: ${targets.join(', ')}`);
    }

    // Incoming edges — what leads to this node
    const byIncoming = {};
    for (const e of edgesByTo[node.id] ?? []) {
      const source = nodeMap[e.from];
      if (!source || !INCOMING_LABEL[e.action]) continue;
      (byIncoming[e.action] ??= []).push(source.name);
    }
    for (const [action, sources] of Object.entries(byIncoming)) {
      lines.push(`${INCOMING_LABEL[action]}: ${sources.join(', ')}`);
    }

    return { id: node.id, name: node.name, type: node.type, text: lines.join('\n') };
  });
}

function chunkHash(chunks) {
  return crypto.createHash('md5').update(chunks.map(c => c.text).join('')).digest('hex');
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
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS bjj_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  const currentHash = chunkHash(ragChunks);
  const { rows: meta } = await pgPool.query("SELECT value FROM bjj_meta WHERE key = 'chunk_hash'");
  if (meta[0]?.value === currentHash) {
    console.log('pgvector: chunks unchanged, skipping re-embed');
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
  await pgPool.query(
    "INSERT INTO bjj_meta (key, value) VALUES ('chunk_hash', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
    [currentHash]
  );
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

  let fullText = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
      onToken(event.delta.text);
    }
  }
  return fullText;
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

// ── Storyboard frame extraction ───────────────────────────────────────────────

function extractJsonFromHtml(html, token) {
  const start = html.indexOf(token);
  if (start === -1) return null;
  const jsonStart = html.indexOf('{', start + token.length);
  if (jsonStart === -1) return null;
  let depth = 0, inStr = false, esc = false, i = jsonStart;
  for (; i < html.length; i++) {
    const ch = html[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (!inStr) {
      if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) break;
    }
  }
  try { return JSON.parse(html.slice(jsonStart, i + 1)); } catch { return null; }
}

async function fetchStoryboardSpec(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      // Bypass GDPR consent gate that strips storyboard data on some server IPs
      'Cookie': 'CONSENT=YES+cb; SOCS=CAESEwgDEgk2NDMwNTI4ODQaAmVuIAEaBgiA0YeyBg',
    }
  });
  if (!res.ok) throw new Error(`YouTube page ${res.status}`);
  const html = await res.text();

  console.log(`[storyboard] page size=${html.length} hasIPR=${html.includes('ytInitialPlayerResponse')} hasSBSpec=${html.includes('playerStoryboardSpecRenderer')}`);

  // Try the two token variants YouTube uses
  for (const token of ['ytInitialPlayerResponse = ', 'ytInitialPlayerResponse=']) {
    const obj = extractJsonFromHtml(html, token);
    const spec = obj?.storyboards?.playerStoryboardSpecRenderer?.spec;
    if (spec) return spec;
  }

  throw new Error('playerStoryboardSpecRenderer not found in page');
}

// Spec format: "{urlTemplate}|{w}#{h}#{count}#{cols}#{rows}#{intervalMs}#{nameTpl}#{sigh}|..."
// urlTemplate uses $L (level index) and $N (replaced by nameTpl with $M = sprite index)
function parseStoryboardSpec(spec) {
  const parts = spec.split('|');
  const urlTemplate = parts[0];
  const levels = [];
  for (let i = 1; i < parts.length; i++) {
    const f = parts[i].split('#');
    if (f.length < 6) continue;
    levels.push({
      frameW:     parseInt(f[0]),
      frameH:     parseInt(f[1]),
      totalFrames: parseInt(f[2]),
      cols:       parseInt(f[3]),
      rows:       parseInt(f[4]),
      intervalMs: parseInt(f[5]),
      nameTpl:    f[6] || 'M$M',
      sigh:       f[7] || '',
    });
  }
  return { urlTemplate, levels };
}

async function fetchStoryboardFrames(videoId, durationSecs) {
  let specStr;
  try {
    specStr = await fetchStoryboardSpec(videoId);
  } catch (e) {
    console.warn('Storyboard spec fetch failed:', e.message);
    return [];
  }

  const { urlTemplate, levels } = parseStoryboardSpec(specStr);

  // Try best levels first (highest resolution with M$M name template)
  const orderedLevels = [...levels.keys()]
    .filter(i => levels[i].nameTpl.includes('$M'))
    .sort((a, b) => b - a); // descending: try highest level first

  for (const levelIdx of orderedLevels) {
    try {
      const level = levels[levelIdx];
      const frames = await fetchStoryboardLevel(urlTemplate, levelIdx, level);
      if (frames.length >= 5) {
        console.log(`Storyboard L${levelIdx} (${level.frameW}×${level.frameH}): ${frames.length} frames`);
        return frames;
      }
    } catch (e) {
      console.warn(`Storyboard L${levelIdx} failed:`, e.message);
    }
  }
  return [];
}

async function fetchStoryboardLevel(urlTemplate, levelIdx, level) {
  const { frameW, frameH, totalFrames, cols, rows, intervalMs, nameTpl, sigh } = level;
  const framesPerSprite = cols * rows;
  const numSprites = Math.ceil(totalFrames / framesPerSprite);

  const sprites = [];
  for (let n = 0; n < numSprites; n++) {
    const spriteName = nameTpl.replace('$M', String(n));
    let url = urlTemplate
      .replace('$L', String(levelIdx))
      .replace('$N', spriteName);
    if (sigh) url += '&sigh=' + sigh;
    try {
      const res = await fetch(url);
      if (!res.ok) break;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 2000) break;
      sprites.push(buf);
    } catch { break; }
  }
  if (sprites.length === 0) return [];

  // Subsample to max 50 frames
  const step = Math.max(1, Math.ceil(totalFrames / 50));
  const secPerFrame = intervalMs / 1000;

  const frames = [];
  for (let s = 0; s < sprites.length; s++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = s * framesPerSprite + r * cols + c;
        if (idx >= totalFrames) continue;
        if (idx % step !== 0) continue;
        const ts = Math.round(idx * secPerFrame);

        const buf = await sharp(sprites[s])
          .extract({ left: c * frameW, top: r * frameH, width: frameW, height: frameH })
          .jpeg({ quality: 90 })
          .toBuffer();

        frames.push({ timestamp: ts, label: formatTimestamp(ts), data: buf.toString('base64') });
      }
    }
  }
  return frames;
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/api/nodes', (req, res) => {
  res.json(ragChunks.map(c => ({ id: c.id, name: c.name, type: c.type })));
});

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
    const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
    const isVideoRequest = /\b(video|videos|watch|youtube)\b/i.test(question);
    if (isVideoRequest && YOUTUBE_API_KEY && lastAssistant) {
      send('status', { text: 'Finding videos...' });
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
      send('token', { text: 'Here are the videos for the techniques we just discussed.' });
      send('done', {});
      return;
    }

    // Retrieve relevant chunks
    send('status', { text: 'Searching knowledge base...' });
    const chunks = await retrieve(question);

    // Stream answer
    send('status', { text: 'Answering...' });
    const answerText = await streamAnswer(question, chunks, history, token => send('token', { text: token }));

    // YouTube search — re-embed the answer to find the most relevant techniques
    if (YOUTUBE_API_KEY && answerText) {
      const answerChunks = await retrieve(answerText, 2);
      const videos = (await Promise.all(
        answerChunks.map(async c => {
          const url = await searchYouTube(c.name, null);
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

// ── Fight analysis ────────────────────────────────────────────────────────────

app.post('/api/analyze-fight', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  if (isAnalysisLimited(ip)) {
    return res.status(429).json({ error: 'Analysis limit reached. Try again in an hour.' });
  }

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const videoId = extractYouTubeId(url);
  if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

  console.log(`[${new Date().toISOString()}] ip=${ip} analyze-fight videoId="${videoId}"`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (type, payload) => res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);

  try {
    // ── 1. Fetch video metadata ──────────────────────────────
    let title = 'BJJ Match';
    let description = '';
    let thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    let durationSecs = 0;

    if (YOUTUBE_API_KEY) {
      try {
        const metaUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${YOUTUBE_API_KEY}`;
        const metaRes = await fetch(metaUrl);
        const metaData = await metaRes.json();
        const item = metaData.items?.[0];
        if (item) {
          title = item.snippet.title;
          description = item.snippet.description || ''; // full description for chapter parsing
          thumbnail = item.snippet.thumbnails?.high?.url || thumbnail;
          // Parse ISO 8601 duration e.g. PT5M30S
          const dur = item.contentDetails?.duration || '';
          const dm = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          if (dm) durationSecs = (parseInt(dm[1]||0)*3600) + (parseInt(dm[2]||0)*60) + parseInt(dm[3]||0);
        }
      } catch (e) {
        console.warn('YouTube metadata fetch failed:', e.message);
      }
    }

    send('video-info', { videoId, title, thumbnail });

    // ── 2. Parse description for chapter timestamps ───────────
    const chapterRe = /(?:^|\n)(?:(\d+):)?(\d+):(\d+)\s+(.+)/gm;
    const chapters = [];
    let cm;
    while ((cm = chapterRe.exec(description)) !== null) {
      const secs = (parseInt(cm[1] || 0) * 3600) + (parseInt(cm[2]) * 60) + parseInt(cm[3]);
      chapters.push({ timestamp: secs, label: formatTimestamp(secs), name: cm[4].trim() });
    }

    // ── 3. Fetch storyboard frames ────────────────────────────
    send('status', { text: 'Fetching video frames…' });
    let frames = await fetchStoryboardFrames(videoId, durationSecs);

    if (frames.length === 0) {
      // Fallback: YouTube thumbnail frames at 25/50/75%
      const thumbUrls = [
        { url: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, label: 'thumbnail' },
        { url: `https://img.youtube.com/vi/${videoId}/1.jpg`, label: '~25% mark' },
        { url: `https://img.youtube.com/vi/${videoId}/2.jpg`, label: '~50% mark' },
        { url: `https://img.youtube.com/vi/${videoId}/3.jpg`, label: '~75% mark' },
      ];
      frames = (await Promise.all(thumbUrls.map(async ({ url, label }) => {
        try {
          const r = await fetch(url);
          if (!r.ok) return null;
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length < 2000) return null;
          return { timestamp: null, label, data: buf.toString('base64') };
        } catch { return null; }
      }))).filter(Boolean);
    }

    if (frames.length === 0) throw new Error('Could not fetch any frames from this video. It may be private or unavailable.');

    const approxInterval = durationSecs && frames.length > 1
      ? Math.round(durationSecs / frames.length)
      : null;

    send('status', { text: `Analysing ${frames.length} frames${approxInterval ? ` (~1 per ${approxInterval}s)` : ''}…` });

    // ── 4. Build vision message ───────────────────────────────
    const knownTechniques = ragChunks
      .filter(c => ['position','submission','sweep','guard_pass','takedown','escape','counter'].includes(c.type))
      .map(c => c.name)
      .slice(0, 80)
      .join(', ');

    const chapterText = chapters.length > 0
      ? `\nChapter markers:\n${chapters.map(c => `  ${c.label} — ${c.name}`).join('\n')}`
      : '';

    const visionContent = [];
    for (const frame of frames) {
      visionContent.push({ type: 'text', text: `[${frame.label}]` });
      visionContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: frame.data } });
    }

    visionContent.push({
      type: 'text',
      text: `Video: "${title}" (~${Math.round(durationSecs / 60)} min)
${chapterText}

Known BJJ positions and techniques (use these exact names when applicable):
${knownTechniques}

You have ${frames.length} frames, each labeled [M:SS] — that timestamp IS the event time.

YOUR TASK: For each frame, identify exactly what is happening on the mat. Be specific:
- Who has positional advantage (top/bottom, which fighter)?
- What named position or technique is shown?
- Is anyone attacking, defending, transitioning?

Generate one event per frame. If the position is identical to the previous frame, still emit it but mark type "position". Only skip a frame if it shows literally nothing (camera cut, celebration, etc.).

Use the fighter names from the video title. Never use vague language like "grappling continues" or "technical exchange" — always name the specific position.

Examples of good descriptions:
  "Marcelo pulls guard, establishes closed guard"
  "Kron passes to side control on Marcelo's left"
  "Marcelo takes the back, both hooks in"
  "Marcelo attacks rear naked choke, Kron defends chin"

Return ONLY valid JSON, no markdown fences:
{
  "summary": "2-3 sentence factual summary with result",
  "fighter_a": "first fighter name",
  "fighter_b": "second fighter name",
  "events": [
    {
      "timestamp": 45,
      "label": "0:45",
      "type": "position|transition|submission_attempt|submission|escape|takedown",
      "position": "exact name from known list or null",
      "from_position": "only for transitions — starting position",
      "to_position": "only for transitions — ending position",
      "description": "SPECIFIC one sentence: who does what to whom"
    }
  ]
}

Timestamps must be integers (seconds). Aim for one event per frame.`,
    });

    // ── 5. Claude Vision call ────────────────────────────────
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: visionContent }],
    });

    // ── 6. Parse and stream events ───────────────────────────
    const rawText = response.content[0]?.text || '';
    let analysis;
    try {
      const cleaned = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
      analysis = JSON.parse(cleaned);
    } catch (e) {
      console.warn('JSON parse failed:', e.message, rawText.slice(0, 200));
      send('analysis-text', { text: rawText });
      send('done', {});
      res.end();
      return;
    }

    send('analysis-summary', {
      summary: analysis.summary || '',
      fighter_a: analysis.fighter_a || 'Fighter A',
      fighter_b: analysis.fighter_b || 'Fighter B',
    });

    for (const ev of (analysis.events || [])) {
      send('analysis-event', {
        timestamp: ev.timestamp || 0,
        label: ev.label || formatTimestamp(ev.timestamp || 0),
        type: ev.type || 'position',
        position: ev.position || null,
        from_position: ev.from_position || null,
        to_position: ev.to_position || null,
        description: ev.description || '',
      });
      await new Promise(r => setTimeout(r, 40));
    }

    send('done', {});
  } catch (err) {
    console.error('analyze-fight error:', err);
    // Best-effort cleanup of any temp frames
    try {
      const tmpBase = `/tmp`;
      fs.readdirSync(tmpBase)
        .filter(f => f.startsWith(`bjj-${videoId}-`))
        .forEach(d => fs.rmSync(path.join(tmpBase, d), { recursive: true, force: true }));
    } catch {}
    send('error', { text: err.message });
  }

  res.end();
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
