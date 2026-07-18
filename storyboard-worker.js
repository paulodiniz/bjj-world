addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('v');
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return new Response('missing or invalid v', { status: 400 });
  }

  // Full Chrome desktop headers — bare headers trigger YouTube bot detection
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
      if (!ytRes.ok) continue;
      const html = await ytRes.text();
      const match = html.match(/"playerStoryboardSpecRenderer":\{"spec":"([^"]+)"/);
      if (!match) continue;
      const spec = match[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
      return new Response(JSON.stringify({ spec, source: url }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (e) {
      continue;
    }
  }

  return new Response('storyboard spec not found', { status: 404 });
}
