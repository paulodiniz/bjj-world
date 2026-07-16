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

const SCHEMA_CONTEXT = `You are a BJJ (Brazilian Jiu-Jitsu) knowledge assistant with access to a graph database.

Node types: position, submission, sweep, guard_pass, takedown.
Node properties: id, name, type, description.

Relationship types:
- ATTACK_WITH: can attack from this position with this technique
- TRANSITION_TO: can move to this position
- SWEEP_WITH: can sweep from this position
- PASS_WITH: can pass guard with this technique
- FOLLOW_UP: natural follow-up after this technique
- RECOVER_TO: can recover to this position

Relationship properties: conditions (array of strings), confidence (high/medium/low), difficulty (beginner/intermediate/advanced).`;

async function generateCypher(question) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: `${SCHEMA_CONTEXT}\n\nGenerate a single Cypher query to answer the user's BJJ question. Return ONLY the Cypher query with no explanation, no markdown, no code blocks.`,
    messages: [{ role: 'user', content: question }]
  });
  return msg.content[0].text.replace(/```cypher?\n?/gi, '').replace(/```/g, '').trim();
}

async function streamAnswer(question, records, onToken) {
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: 'You are a helpful BJJ coach. Answer the user\'s question clearly and concisely based on the graph data provided. Focus on practical advice.',
    messages: [{ role: 'user', content: `Question: ${question}\n\nGraph data: ${JSON.stringify(records, null, 2)}` }]
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      onToken(chunk.delta.text);
    }
  }
}

async function seedDatabase() {
  const session = driver.session();
  try {
    const result = await session.run('MATCH (n:BJJNode) RETURN count(n) as count');
    const count = result.records[0].get('count').toNumber();
    if (count > 0) {
      console.log(`Database already has ${count} nodes, skipping seed`);
      return;
    }

    console.log('Seeding database from graph.json...');
    const graph = JSON.parse(fs.readFileSync(path.join(__dirname, 'graph.json'), 'utf8'));

    await session.run('CREATE CONSTRAINT bjj_node_id IF NOT EXISTS FOR (n:BJJNode) REQUIRE n.id IS UNIQUE');

    for (const node of graph.nodes) {
      await session.run(
        'MERGE (n:BJJNode {id: $id}) SET n.name = $name, n.type = $type, n.description = $description',
        { id: node.id, name: node.name, type: node.type, description: node.description }
      );
    }

    for (const edge of graph.edges) {
      const relType = edge.action.toUpperCase();
      await session.run(
        `MATCH (a:BJJNode {id: $from}), (b:BJJNode {id: $to})
         CREATE (a)-[:${relType} {conditions: $conditions, confidence: $confidence, difficulty: $difficulty}]->(b)`,
        { from: edge.from, to: edge.to, conditions: edge.conditions, confidence: edge.confidence, difficulty: edge.difficulty }
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

  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'question is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (type, payload) => res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);

  try {
    // Step 1: Generate Cypher query
    send('status', { text: 'Generating query...' });
    const cypher = await generateCypher(question);
    send('cypher', { text: cypher });

    // Step 2: Run against Neo4j
    send('status', { text: 'Querying graph...' });
    const session = driver.session();
    let records;
    try {
      const result = await session.run(cypher);
      records = result.records.map(r => r.toObject());
    } finally {
      await session.close();
    }

    // Step 3: Stream the answer
    send('status', { text: 'Answering...' });
    await streamAnswer(question, records, token => send('token', { text: token }));

    send('done', {});
  } catch (err) {
    console.error(err);
    send('error', { text: err.message });
  }

  res.end();
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
