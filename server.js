const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const zlib = require('zlib');

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

// High-speed in-memory static file cache with pre-computed gzip buffers and ETags
const staticCache = new Map();

function getStaticFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;

    const cached = staticCache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached;
    }

    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const isCompressible = ['.html', '.css', '.js', '.json', '.svg'].includes(ext);
    const gzip = isCompressible ? zlib.gzipSync(content, { level: 9 }) : null;
    const etag = '"' + crypto.createHash('md5').update(content).digest('hex') + '"';

    const entry = {
      content,
      gzip,
      etag,
      mime,
      mtimeMs: stat.mtimeMs,
      mtimeUtc: stat.mtime.toUTCString(),
      ext
    };
    staticCache.set(filePath, entry);
    return entry;
  } catch (err) {
    return null;
  }
}

// Warm up static cache on server startup for instantaneous (<0.2ms) initial response
['index.html', 'styles.css', 'app.js', 'manifest.json', 'sw.js'].forEach(fileName => {
  const p = path.join(DIR, fileName);
  if (fs.existsSync(p)) getStaticFile(p);
});

const DATA_DIR = path.join(DIR, 'data');
const LIBRARY_FILE = path.join(DATA_DIR, 'library.json');
const USERS_DB_FILE = path.join(DATA_DIR, 'users.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');

// Ensure database directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getSavedLibrary() {
  try {
    if (fs.existsSync(LIBRARY_FILE)) {
      const data = fs.readFileSync(LIBRARY_FILE, 'utf8');
      return JSON.parse(data || '[]');
    }
  } catch (e) {
    console.error('Error reading library.json:', e.message);
  }
  return [];
}

function saveLibrary(tracks) {
  try {
    fs.writeFileSync(LIBRARY_FILE, JSON.stringify(tracks, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error writing library.json:', e.message);
    return false;
  }
}

// ==========================================================================
// FEEDBACK DATABASE & EXCEL SPREADSHEET EXPORTER
// ==========================================================================

function getFeedbackDb() {
  try {
    if (fs.existsSync(FEEDBACK_FILE)) {
      const data = fs.readFileSync(FEEDBACK_FILE, 'utf8');
      return JSON.parse(data || '[]');
    }
  } catch (e) {
    console.error('Error reading feedback.json:', e.message);
  }
  return [];
}

function saveFeedbackDb(list) {
  try {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(list, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error writing feedback.json:', e.message);
    return false;
  }
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Generate native XML Spreadsheet 2003 (.xls) - opens in Microsoft Excel with styling, green header, column widths
function generateExcelXml(feedbackList) {
  let rows = '';
  feedbackList.forEach((item, index) => {
    rows += `
   <Row ss:Height="22">
    <Cell><Data ss:Type="Number">${index + 1}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(item.id)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(item.dateFormatted || item.timestamp)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(item.name)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(item.category || 'General Feedback')}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(item.detail)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(item.client || 'Web App')}</Data></Cell>
   </Row>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>PMusic Feedback Report</Title>
  <Author>PMusic System</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#10863A"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1ED760" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Feedback Submissions">
  <Table ss:ExpandedColumnCount="7" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="20">
   <Column ss:AutoFitWidth="0" ss:Width="45"/>
   <Column ss:AutoFitWidth="0" ss:Width="110"/>
   <Column ss:AutoFitWidth="0" ss:Width="160"/>
   <Column ss:AutoFitWidth="0" ss:Width="160"/>
   <Column ss:AutoFitWidth="0" ss:Width="140"/>
   <Column ss:AutoFitWidth="0" ss:Width="420"/>
   <Column ss:AutoFitWidth="0" ss:Width="100"/>
   <Row ss:Height="28" ss:StyleID="HeaderStyle">
    <Cell><Data ss:Type="String">#</Data></Cell>
    <Cell><Data ss:Type="String">Feedback ID</Data></Cell>
    <Cell><Data ss:Type="String">Date &amp; Time</Data></Cell>
    <Cell><Data ss:Type="String">User Name</Data></Cell>
    <Cell><Data ss:Type="String">Category</Data></Cell>
    <Cell><Data ss:Type="String">Feedback Details</Data></Cell>
    <Cell><Data ss:Type="String">Platform</Data></Cell>
   </Row>
   ${rows}
  </Table>
 </Worksheet>
</Workbook>`;
}

// Generate Excel-compatible CSV with UTF-8 BOM
function generateExcelCsv(feedbackList) {
  const BOM = '\uFEFF';
  const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
  const header = ['#', 'Feedback ID', 'Date & Time', 'Name', 'Category', 'Details', 'Platform'].map(escapeCsv).join(',');
  const lines = feedbackList.map((item, index) => [
    index + 1,
    escapeCsv(item.id),
    escapeCsv(item.dateFormatted || item.timestamp),
    escapeCsv(item.name),
    escapeCsv(item.category || 'General Feedback'),
    escapeCsv(item.detail),
    escapeCsv(item.client || 'Web App')
  ].join(','));
  return BOM + [header, ...lines].join('\r\n');
}

// ==========================================================================
// USER DATABASE & AUTHENTICATION SYSTEM
// ==========================================================================

function getUsersDb() {
  try {
    if (fs.existsSync(USERS_DB_FILE)) {
      const data = fs.readFileSync(USERS_DB_FILE, 'utf8');
      return JSON.parse(data || '{}');
    }
  } catch (e) {
    console.error('Error reading users.json:', e.message);
  }
  return {};
}

function saveUsersDb(db) {
  try {
    fs.writeFileSync(USERS_DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error writing users.json:', e.message);
    return false;
  }
}

function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  if (!password || !hash || !salt) return false;
  const result = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return result === hash;
}

// Persistent HMAC-signed token authentication with fast in-memory caching
const SESSION_SECRET = process.env.SESSION_SECRET || 'pmusic_super_secret_session_key_v1';
const activeSessions = new Map();
const revokedTokens = new Set();

function createSession(username) {
  const ts = Date.now();
  const payload = Buffer.from(username.toLowerCase()).toString('base64');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(`${payload}.${ts}`).digest('hex');
  const token = `pm_${payload}.${ts}.${signature}`;
  activeSessions.set(token, { username: username.toLowerCase(), createdAt: ts });
  return token;
}

function getSessionUser(token) {
  if (!token || revokedTokens.has(token)) return null;
  const db = getUsersDb();
  if (activeSessions.has(token)) {
    const sess = activeSessions.get(token);
    return db[sess.username] || null;
  }
  if (token.startsWith('pm_')) {
    try {
      const parts = token.slice(3).split('.');
      if (parts.length === 3) {
        const [payload, ts, signature] = parts;
        const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(`${payload}.${ts}`).digest('hex');
        if (signature === expectedSig) {
          const username = Buffer.from(payload, 'base64').toString('utf8');
          const user = db[username];
          if (user) {
            activeSessions.set(token, { username, createdAt: Number(ts) });
            return user;
          }
        }
      }
    } catch (e) {}
  }
  return null;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function extractToken(req, parsedUrl) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return parsedUrl.query.token || null;
}

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
    const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/) || html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Route: Register new user account
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      const username = (payload.username || '').trim();
      const password = (payload.password || '').trim();
      const initialLibrary = Array.isArray(payload.library) && payload.library.length > 0
        ? payload.library
        : getSavedLibrary();

      if (!username || username.length < 3) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Username must be at least 3 characters long.' }));
        return;
      }
      if (!password || password.length < 4) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Password must be at least 4 characters long.' }));
        return;
      }

      const db = getUsersDb();
      const userKey = username.toLowerCase();
      if (db[userKey]) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Username already exists. Please log in.' }));
        return;
      }

      const { hash, salt } = hashPassword(password);
      db[userKey] = {
        username,
        passwordHash: hash,
        salt,
        createdAt: Date.now(),
        library: initialLibrary,
        likedTracks: (initialLibrary || []).map(t => t.id)
      };
      saveUsersDb(db);

      const token = createSession(userKey);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        token,
        user: {
          username: db[userKey].username,
          library: db[userKey].library,
          likedTracks: db[userKey].likedTracks
        }
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid registration data.' }));
    }
    return;
  }

  // API Route: Log in existing user
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      const username = (payload.username || '').trim();
      const password = (payload.password || '').trim();

      const db = getUsersDb();
      const userKey = username.toLowerCase();
      const user = db[userKey];

      if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid username or password.' }));
        return;
      }

      const token = createSession(userKey);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        token,
        user: {
          username: user.username,
          library: user.library || [],
          likedTracks: user.likedTracks || []
        }
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid login request.' }));
    }
    return;
  }

  // API Route: Get current authenticated user
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const token = extractToken(req, parsedUrl);
    const user = getSessionUser(token);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not authenticated' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      user: {
        username: user.username,
        library: user.library || [],
        likedTracks: user.likedTracks || []
      }
    }));
    return;
  }

  // API Route: Log out user
  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const token = extractToken(req, parsedUrl);
    if (token) {
      activeSessions.delete(token);
      revokedTokens.add(token);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // API Route: Sync user's library in database
  if (pathname === '/api/user/library' && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      const token = extractToken(req, parsedUrl) || payload.token;
      let user = getSessionUser(token);
      let userKey = null;

      if (!user && payload.username) {
        userKey = payload.username.trim().toLowerCase();
        const db = getUsersDb();
        user = db[userKey];
      }

      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Please log in to save to your personal account library.' }));
        return;
      }

      const tracks = Array.isArray(payload.tracks) ? payload.tracks : [];
      const db = getUsersDb();
      userKey = userKey || user.username.toLowerCase();
      if (db[userKey]) {
        db[userKey].library = tracks;
        db[userKey].likedTracks = tracks.map(t => t.id);
        db[userKey].updatedAt = Date.now();
        saveUsersDb(db);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: tracks.length, username: user.username }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to update user library.' }));
    }
    return;
  }

  // API Route: Get user's library from database
  if (pathname === '/api/user/library' && req.method === 'GET') {
    const token = extractToken(req, parsedUrl);
    let user = getSessionUser(token);
    if (!user && parsedUrl.query.username) {
      const db = getUsersDb();
      user = db[parsedUrl.query.username.trim().toLowerCase()];
    }

    if (!user) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ username: user.username, tracks: user.library || [] }));
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

  // API Route: Fallback guest permanent library
  if (pathname === '/api/library' && req.method === 'GET') {
    const lib = getSavedLibrary();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tracks: lib }));
    return;
  }

  // API Route: Fallback guest save library
  if (pathname === '/api/library' && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      const tracks = Array.isArray(payload) ? payload : (payload.tracks || []);
      saveLibrary(tracks);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: tracks.length }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
    }
    return;
  }

  // API Route: Submit new user feedback
  if (pathname === '/api/feedback' && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      const name = (payload.name || '').trim();
      const detail = (payload.detail || payload.details || '').trim();
      const category = (payload.category || 'General Feedback').trim();
      const client = (payload.client || 'Web App').trim();

      if (!name || !detail) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Name and feedback details are required.' }));
        return;
      }

      const now = new Date();
      const entry = {
        id: `FB-${Date.now().toString(36).toUpperCase()}`,
        name,
        detail,
        category,
        client,
        timestamp: now.toISOString(),
        dateFormatted: now.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      };

      const list = getFeedbackDb();
      list.unshift(entry);
      saveFeedbackDb(list);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Feedback recorded successfully.',
        feedback: entry,
        totalCount: list.length
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid feedback submission.' }));
    }
    return;
  }

  // API Route: Get all feedback list
  if (pathname === '/api/feedback' && req.method === 'GET') {
    const list = getFeedbackDb();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: list.length, feedbacks: list }));
    return;
  }

  // API Route: Export feedback directly to Excel (.xls XML spreadsheet with styling)
  if ((pathname === '/api/feedback/export' || pathname === '/api/feedback/export.xls' || pathname === '/api/feedback/export-excel') && req.method === 'GET') {
    const list = getFeedbackDb();
    const xml = generateExcelXml(list);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.ms-excel; charset=UTF-8',
      'Content-Disposition': 'attachment; filename="PMusic_Feedback_Report.xls"',
      'Cache-Control': 'no-cache'
    });
    res.end(xml);
    return;
  }

  // API Route: Export feedback to CSV (.csv with UTF-8 BOM for Excel)
  if (pathname === '/api/feedback/export.csv' && req.method === 'GET') {
    const list = getFeedbackDb();
    const csv = generateExcelCsv(list);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="PMusic_Feedback_Report.csv"',
      'Cache-Control': 'no-cache'
    });
    res.end(csv);
    return;
  }

  // Static files with sub-millisecond in-memory cache, gzip compression, and 304 validation
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(DIR, safePath);

  const fileData = getStaticFile(filePath);
  if (!fileData) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  // 304 Not Modified fast-path
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch && ifNoneMatch === fileData.etag) {
    res.writeHead(304, {
      'ETag': fileData.etag,
      'Last-Modified': fileData.mtimeUtc,
      'Cache-Control': fileData.ext === '.html' ? 'public, max-age=0, must-revalidate' : 'public, max-age=86400, stale-while-revalidate=604800'
    });
    res.end();
    return;
  }

  const acceptEncoding = req.headers['accept-encoding'] || '';
  const canGzip = fileData.gzip && acceptEncoding.includes('gzip');

  const headers = {
    'Content-Type': fileData.mime,
    'ETag': fileData.etag,
    'Last-Modified': fileData.mtimeUtc,
    'Vary': 'Accept-Encoding'
  };

  if (fileData.ext === '.html') {
    headers['Cache-Control'] = 'public, max-age=0, must-revalidate';
  } else {
    headers['Cache-Control'] = 'public, max-age=86400, stale-while-revalidate=604800';
  }

  if (canGzip) {
    headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = fileData.gzip.length;
    res.writeHead(200, headers);
    res.end(fileData.gzip);
  } else {
    headers['Content-Length'] = fileData.content.length;
    res.writeHead(200, headers);
    res.end(fileData.content);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Spotify server running at http://${HOST}:${PORT}`);
  console.log(`Full-song resolver active at http://${HOST}:${PORT}/api/resolve-full-song?q=`);
});
