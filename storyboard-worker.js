addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('v');
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return new Response('missing or invalid v', { status: 400 });
  }

  const ytRes = await fetch(`https://m.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': 'CONSENT=YES+cb; SOCS=CAESEwgDEgk2NDMwNTI4ODQaAmVuIAEaBgiA0YeyBg',
    },
  });

  if (!ytRes.ok) {
    return new Response('YouTube returned ' + ytRes.status, { status: 502 });
  }

  const html = await ytRes.text();
  const match = html.match(/"playerStoryboardSpecRenderer":\{"spec":"([^"]+)"/);
  if (!match) {
    return new Response('storyboard spec not found', { status: 404 });
  }

  const spec = match[1]
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/');

  return new Response(JSON.stringify({ spec }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
