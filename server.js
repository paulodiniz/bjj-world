const express = require('express');
const neo4j = require('neo4j-driver');
const Anthropic = require('@anthropic-ai/sdk');
const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const multer = require('multer');
ffmpeg.setFfmpegPath(ffmpegPath);

const upload = multer({ dest: '/tmp/', limits: { fileSize: 500 * 1024 * 1024 } });

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


// ── Direct video frame extraction ────────────────────────────────────────────

function normalizeVideoUrl(url) {
  // Dropbox: force direct download
  url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/[?&]dl=0/, '');
  // Google Drive: convert share link to direct download
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) url = `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  return url;
}

async function extractFramesFromVideo(rawUrl, targetFrames = 35) {
  const url = normalizeVideoUrl(rawUrl);
  const tmpDir = `/tmp/bjj-direct-${Date.now()}`;
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const isRemote = url.startsWith('http://') || url.startsWith('https://');
    await new Promise((resolve, reject) => {
      const cmd = ffmpeg(url);
      if (isRemote) cmd.inputOptions(['-headers', 'User-Agent: Mozilla/5.0\r\n']);
      cmd.outputOptions([
          '-vf', `fps=1/10,scale=640:-2`,
          '-vframes', String(targetFrames),
          '-q:v', '3',
        ])
        .output(`${tmpDir}/%04d.jpg`)
        .on('end', resolve)
        .on('error', err => reject(new Error(`ffmpeg: ${err.message}`)))
        .run();
    });

    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.jpg')).sort();
    return files.map((file, i) => ({
      timestamp: i * 10,
      label: formatTimestamp(i * 10),
      data: fs.readFileSync(path.join(tmpDir, file)).toString('base64'),
    }));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ── Shared fight analysis (Claude vision call + event streaming) ──────────────

function buildVisionContent(frames, title, durationSecs, chapters) {
  const knownTechniques = ragChunks
    .filter(c => ['position','submission','sweep','guard_pass','takedown','escape','counter'].includes(c.type))
    .map(c => c.name).slice(0, 80).join(', ');

  const chapterText = chapters.length > 0
    ? `\nChapter markers:\n${chapters.map(c => `  ${c.label} — ${c.name}`).join('\n')}`
    : '';

  const isSprites = frames[0]?.cols != null;
  const firstSheet = frames[0];

  const content = [];
  for (const frame of frames) {
    if (isSprites) {
      content.push({ type: 'text', text: `Sprite sheet [${frame.label}] — ${frame.cols}×${frame.rows} grid, left→right top→bottom, ${frame.secPerFrame}s/cell` });
    } else {
      content.push({ type: 'text', text: `[${frame.label}]` });
    }
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: frame.data } });
  }

  const frameInstructions = isSprites
    ? `Each image is a sprite sheet: a ${firstSheet.cols}×${firstSheet.rows} grid of frames, read left→right top→bottom. The caption gives the time range; first cell = start time, each subsequent cell = ${firstSheet.secPerFrame}s later. Scan every cell and emit events where positions change.`
    : `Each image is a single frame labeled [M:SS] — use that timestamp exactly.`;

  const frameCount = isSprites
    ? frames.reduce((n, s) => n + s.cols * s.rows, 0)
    : frames.length;

  content.push({
    type: 'text',
    text: `Video: "${title}" (~${Math.round(durationSecs / 60)} min)
${chapterText}

Known BJJ positions and techniques (use these exact names when applicable):
${knownTechniques}

${frameInstructions}

You have ${frameCount} frames above. Analyse them and emit an event ONLY when something meaningful happens:
- A position CHANGES (e.g. guard to side control, standing to guard pull)
- A submission attempt starts or ends
- A sweep, pass, takedown, or escape occurs
- A scramble resolves into a new position

Do NOT emit an event if the position from the previous frame is unchanged.

Rules:
- Use fighter names from the video title.
- Never write vague phrases like "grappling continues", "ground work", or "technical exchange". Always name the specific position and who holds it.
- Use the EXACT timestamp from the frame label (e.g. if label is [1:20], timestamp is 80).

Good event descriptions:
  "Marcelo pulls guard, establishes closed guard — Kron on top"
  "Kron passes to side control on Marcelo's left"
  "Marcelo takes the back, both hooks in"
  "Marcelo attacks guillotine from guard — Kron defends, postures up"
  "Scramble — both return to standing"
  "Kron attempts arm lock from top half guard — Marcelo defends"

Return ONLY valid JSON, no markdown fences:
{
  "summary": "2-3 sentence factual summary of the match including result and score if known",
  "fighter_a": "first fighter full name",
  "fighter_b": "second fighter full name",
  "events": [
    {
      "timestamp": 80,
      "label": "1:20",
      "type": "position|transition|submission_attempt|submission|sweep|guard_pass|takedown|escape",
      "description": "specific one sentence: who does what, who ends up where"
    }
  ]
}

Timestamps must be integers (seconds). Aim for 15–40 events covering the meaningful moments of the match.`,
  });

  return content;
}

async function streamAnalysis(frames, title, durationSecs, chapters, send) {
  const visionContent = buildVisionContent(frames, title, durationSecs, chapters);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: visionContent }],
  });

  const rawText = response.content[0]?.text || '';
  let analysis;
  try {
    const cleaned = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    analysis = JSON.parse(cleaned);
  } catch {
    send('analysis-text', { text: rawText });
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
      description: ev.description || '',
    });
    await new Promise(r => setTimeout(r, 40));
  }
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

// ── Direct video analysis ─────────────────────────────────────────────────────

app.post('/api/analyze-video', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  if (isAnalysisLimited(ip)) {
    return res.status(429).json({ error: 'Analysis limit reached. Try again in an hour.' });
  }

  const { url, title: userTitle } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  console.log(`[${new Date().toISOString()}] ip=${ip} analyze-video url="${url.slice(0, 80)}"`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (type, payload) => res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);

  try {
    const title = userTitle || url.split('/').pop().replace(/\.[^.]+$/, '') || 'BJJ Match';
    send('video-info', { videoId: null, title, thumbnail: null });
    send('status', { text: 'Extracting frames from video…' });

    const frames = await extractFramesFromVideo(url);
    if (frames.length === 0) throw new Error('Could not extract frames. Check the URL is a direct video link.');

    for (const f of frames) send('frame', { timestamp: f.timestamp, label: f.label, data: f.data });
    send('status', { text: `Analysing ${frames.length} frames (~1 per 10s)…` });
    await streamAnalysis(frames, title, frames.length * 10, [], send);
    send('done', {});
  } catch (err) {
    console.error('analyze-video error:', err.message);
    send('error', { text: err.message });
  }

  res.end();
});

// ── File upload analysis ──────────────────────────────────────────────────────

app.post('/api/analyze-upload', upload.single('video'), async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  if (isAnalysisLimited(ip)) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(429).json({ error: 'Analysis limit reached. Try again in an hour.' });
  }
  if (!req.file) return res.status(400).json({ error: 'No video file provided' });

  const filePath = req.file.path;
  const title = req.file.originalname.replace(/\.[^.]+$/, '') || 'BJJ Match';
  console.log(`[${new Date().toISOString()}] ip=${ip} analyze-upload "${req.file.originalname}" ${(req.file.size / 1e6).toFixed(1)}MB`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (type, payload) => res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);

  try {
    send('video-info', { videoId: null, title, thumbnail: null });
    send('status', { text: 'Extracting frames…' });

    const frames = await extractFramesFromVideo(filePath);
    if (frames.length === 0) throw new Error('Could not extract frames from this video file.');

    for (const f of frames) send('frame', { timestamp: f.timestamp, label: f.label, data: f.data });
    send('status', { text: `Analysing ${frames.length} frames (~1 per 10s)…` });
    await streamAnalysis(frames, title, frames.length * 10, [], send);
    send('done', {});
  } catch (err) {
    console.error('analyze-upload error:', err.message);
    send('error', { text: err.message });
  } finally {
    try { fs.unlinkSync(filePath); } catch {}
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
