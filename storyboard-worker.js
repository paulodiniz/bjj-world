addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('v');
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return new Response('missing or invalid v', { status: 400 });
  }

  const debug = searchParams.get('debug');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cookie': 'CONSENT=YES+cb; SOCS=CAESEwgDEgk2NDMwNTI4ODQaAmVuIAEaBgiA0YeyBg',
  };

  for (const url of [
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://m.youtube.com/watch?v=${videoId}`,
  ]) {
    try {
      const ytRes = await fetch(url, { headers });
      const html = await ytRes.text();

      if (debug === '1') {
        return new Response(JSON.stringify({
          url, status: ytRes.status, size: html.length,
          hasIPR: html.includes('ytInitialPlayerResponse'),
          hasSBSpec: html.includes('playerStoryboardSpecRenderer'),
          snippet: html.slice(0, 500),
        }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }

      if (debug === '2') {
        // Show context around the spec string
        const idx = html.indexOf('playerStoryboardSpecRenderer');
        const context = idx >= 0 ? html.slice(idx, idx + 300) : 'NOT FOUND';
        const match = html.match(/"playerStoryboardSpecRenderer":\{"spec":"([^"]+)"/);
        return new Response(JSON.stringify({
          url, status: ytRes.status, idx, context, regexMatch: match ? match[1].slice(0, 100) : null,
        }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }

      if (!ytRes.ok) continue;

      // Try the direct regex first, then fall back to broader patterns
      let spec = null;
      const m1 = html.match(/"playerStoryboardSpecRenderer":\{"spec":"([^"]+)"/);
      if (m1) spec = m1[1];

      if (!spec) {
        // Some page variants escape the braces differently
        const m2 = html.match(/"spec":"(https:\\?\/\\?\/i\.ytimg\.com[^"]+)"/);
        if (m2) spec = m2[1];
      }

      if (!spec) continue;

      spec = spec.replace(/\\u0026/g, '&').replace(/\\\//g, '/');

      return new Response(JSON.stringify({ spec, source: url }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (e) {
      if (debug) return new Response(JSON.stringify({ error: e.message }), { headers: { 'Content-Type': 'application/json' } });
      continue;
    }
  }

  return new Response('storyboard spec not found', { status: 404 });
}
