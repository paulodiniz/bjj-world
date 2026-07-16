const fs = require('fs');
const path = require('path');

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) { console.error('Set YOUTUBE_API_KEY env var'); process.exit(1); }

const GRAPH_PATH = path.join(__dirname, '../graph.json');
const graph = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));

const SEARCH_TERMS = {
  position: n => `${n.name} BJJ position tutorial`,
  submission: n => `${n.name} BJJ submission tutorial`,
  sweep: n => `${n.name} BJJ sweep tutorial`,
  guard_pass: n => `${n.name} BJJ guard pass tutorial`,
  takedown: n => `${n.name} BJJ takedown tutorial`,
  escape: n => `${n.name} BJJ escape tutorial`,
  counter: n => `${n.name} BJJ counter technique`,
  concept: n => `${n.name} BJJ concept explained`,
  competitor: n => `${n.name} BJJ highlights submission`,
  system: n => `${n.name.replace("'s", "")} BJJ system explained`,
};

async function searchYouTube(query) {
  const url = `https://www.googleapis.com/youtube/v3/search?q=${encodeURIComponent(query)}&type=video&part=snippet&maxResults=1&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const item = data.items?.[0];
  return item ? `https://www.youtube.com/watch?v=${item.id.videoId}` : null;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  let updated = 0, skipped = 0, failed = 0;

  for (const node of graph.nodes) {
    if (node.video_url) { skipped++; continue; }

    const queryFn = SEARCH_TERMS[node.type];
    if (!queryFn) { skipped++; continue; }

    const query = queryFn(node);
    try {
      const url = await searchYouTube(query);
      if (url) {
        node.video_url = url;
        console.log(`✓ ${node.name} → ${url}`);
        updated++;
      } else {
        console.log(`✗ ${node.name} — no result`);
        failed++;
      }
    } catch (err) {
      console.error(`✗ ${node.name} — ${err.message}`);
      failed++;
    }

    await sleep(200); // stay well under quota
  }

  fs.writeFileSync(GRAPH_PATH, JSON.stringify(graph, null, 2));
  console.log(`\nDone: ${updated} updated, ${skipped} skipped, ${failed} failed`);
  console.log('graph.json saved — review and commit when happy');
}

run();
