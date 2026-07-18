#!/usr/bin/env node
// Usage: node scripts/expand-graph.js "leg lock system" [--dry-run]

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const topic = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!topic) {
  console.error('Usage: node scripts/expand-graph.js "<topic>" [--dry-run]');
  process.exit(1);
}

const GRAPH_PATH = path.join(__dirname, '..', 'graph.json');
const graph = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));

const VALID_TYPES = ['position', 'submission', 'sweep', 'guard_pass', 'takedown', 'escape', 'counter', 'technique', 'concept', 'competitor', 'system'];
const VALID_ACTIONS = ['attack_with', 'transition_to', 'sweep_with', 'pass_with', 'follow_up', 'recover_to', 'escape_with', 'counters', 'requires', 'developed', 'centers_on', 'features', 'known_for', 'coached_by'];
const VALID_GI = ['gi', 'no_gi', 'both'];
const VALID_CONFIDENCE = ['high', 'medium', 'low'];
const VALID_DIFFICULTY = ['beginner', 'intermediate', 'advanced'];

const existingIds = new Set(graph.nodes.map(n => n.id));

const SYSTEM_PROMPT = `You are a BJJ knowledge graph expert. You will be given an existing BJJ knowledge graph and a topic to expand it with.

Node schema:
{
  "id": "snake_case_unique_id",
  "name": "Human Readable Name",
  "type": one of: ${VALID_TYPES.join(', ')},
  "description": "1-2 sentence description focusing on practical application",
  "gi_requirement": one of: ${VALID_GI.join(', ')},
  "video_url": null
}

Edge schema:
{
  "from": "existing_or_new_node_id",
  "to": "existing_or_new_node_id",
  "action": one of: ${VALID_ACTIONS.join(', ')},
  "conditions": ["short condition strings, max 3"],
  "confidence": one of: ${VALID_CONFIDENCE.join(', ')},
  "difficulty": one of: ${VALID_DIFFICULTY.join(', ')}
}

Rules:
- Node IDs must be unique snake_case strings
- Only reference node IDs that exist in the graph or are in your new nodes list
- Be specific and accurate — this is a teaching tool for real BJJ practitioners
- Focus on practical, commonly used techniques
- Edges must be directional and semantically correct (e.g. a position ATTACK_WITH a submission)
- Return ONLY valid JSON, no explanation`;

async function expand() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log(`Expanding graph with topic: "${topic}"`);
  console.log(`Current graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
  console.log('Calling Claude...\n');

  const existingNodesSummary = graph.nodes.map(n => `${n.id} (${n.type}: ${n.name})`).join('\n');

  const msg = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 8096,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Expand this BJJ knowledge graph with nodes and edges about: "${topic}"

Existing node IDs (do not duplicate these):
${existingNodesSummary}

Generate 8-12 new nodes and 15-25 new edges that enrich the graph around this topic. Connect new nodes to existing ones where it makes sense.

IMPORTANT for coached_by edges: "from" is the student, "to" is the coach/teacher. Both must be competitor node IDs.

Respond with ONLY this JSON structure, no trailing text:
{
  "nodes": [...],
  "edges": [...]
}`
    }]
  });

  const raw = msg.content[0].text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Claude did not return valid JSON');
    process.exit(1);
  }

  let generated;
  try {
    generated = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Failed to parse Claude response:', e.message);
    console.error(raw);
    process.exit(1);
  }

  // Validate nodes
  const errors = [];
  const newIds = new Set();

  for (const node of generated.nodes ?? []) {
    if (!node.id || !/^[a-z0-9_]+$/.test(node.id)) errors.push(`Invalid id: "${node.id}"`);
    if (existingIds.has(node.id)) errors.push(`Duplicate id (already exists): "${node.id}"`);
    if (newIds.has(node.id)) errors.push(`Duplicate id (within new nodes): "${node.id}"`);
    if (!VALID_TYPES.includes(node.type)) errors.push(`Invalid type "${node.type}" on node "${node.id}"`);
    if (node.gi_requirement && !VALID_GI.includes(node.gi_requirement)) errors.push(`Invalid gi_requirement on node "${node.id}"`);
    newIds.add(node.id);
  }

  const allIds = new Set([...existingIds, ...newIds]);

  for (const edge of generated.edges ?? []) {
    if (!allIds.has(edge.from)) errors.push(`Edge references unknown from: "${edge.from}"`);
    if (!allIds.has(edge.to)) errors.push(`Edge references unknown to: "${edge.to}"`);
    if (!VALID_ACTIONS.includes(edge.action)) errors.push(`Invalid action "${edge.action}"`);
    if (edge.confidence && !VALID_CONFIDENCE.includes(edge.confidence)) errors.push(`Invalid confidence "${edge.confidence}"`);
    if (edge.difficulty && !VALID_DIFFICULTY.includes(edge.difficulty)) errors.push(`Invalid difficulty "${edge.difficulty}"`);
  }

  if (errors.length > 0) {
    console.error('Validation errors:');
    errors.forEach(e => console.error(' -', e));
    process.exit(1);
  }

  // Preview
  console.log(`New nodes (${generated.nodes.length}):`);
  for (const n of generated.nodes) {
    console.log(`  + [${n.type}] ${n.name} (${n.id})`);
    console.log(`    ${n.description}`);
  }

  console.log(`\nNew edges (${generated.edges.length}):`);
  for (const e of generated.edges) {
    console.log(`  ${e.from} --[${e.action}]--> ${e.to} (${e.difficulty ?? 'n/a'})`);
  }

  if (dryRun) {
    console.log('\nDry run — graph.json not modified.');
    return;
  }

  // Merge
  const merged = {
    nodes: [...graph.nodes, ...generated.nodes],
    edges: [...graph.edges, ...generated.edges],
  };

  fs.writeFileSync(GRAPH_PATH, JSON.stringify(merged, null, 2));
  console.log(`\ngraph.json updated: ${merged.nodes.length} nodes, ${merged.edges.length} edges`);
  console.log('Run `git diff graph.json` to review, then commit and push to deploy.');
}

expand().catch(err => {
  console.error(err.message);
  process.exit(1);
});
