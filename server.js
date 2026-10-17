const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3456;
const HOST = '0.0.0.0';
const DIR = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const resolveCache = new Map();

// High-speed full song YouTube audio resolver
async function resolveFullSong(query) {
  const cacheKey = query.trim().toLowerCase();
  if (resolveCache.has(cacheKey)) {
    return resolveCache.get(cacheKey);
  }

  try {
    const searchUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query + ' official audio');
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const html = await res.text();
    const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (match) {
      const data = { videoId: match[1], query };
      resolveCache.set(cacheKey, data);
      return data;
    }
  } catch (err) {
    console.error('Error resolving full song for:', query, err.message);
  }

  return { videoId: null, query };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Route: Resolve full song to YouTube stream/ID
  if (pathname === '/api/resolve-full-song') {
    const q = parsedUrl.query.q || '';
    if (!q) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing query parameter q' }));
      return;
    }

    const result = await resolveFullSong(q);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // Static files
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(DIR, reqPath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(content);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Spotify server running at http://${HOST}:${PORT}`);
  console.log(`Full-song resolver active at http://${HOST}:${PORT}/api/resolve-full-song?q=`);
});
