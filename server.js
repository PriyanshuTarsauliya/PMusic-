const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const zlib = require('zlib');
const cluster = require('cluster');
const os = require('os');
const ChallengeService = require('./auth/challengeService');
const RiskScorer = require('./auth/riskScorer');
const TokenManager = require('./auth/tokenManager');

const PORT = process.env.PORT || 3456;
const HOST = '0.0.0.0';
const DIR = __dirname;

// ==========================================================================
// MULTI-CORE LOAD BALANCER (Node.js Cluster SCHED_RR)
// ==========================================================================

const isClusterMode = process.env.ENABLE_CLUSTER === 'true' ||
                      process.argv.includes('--cluster') ||
                      (process.env.NODE_ENV === 'production' && !process.env.NO_CLUSTER);

if (isClusterMode && cluster.isPrimary) {
  const numWorkers = process.env.WORKERS ? parseInt(process.env.WORKERS, 10) : Math.min(os.cpus().length, 4);
  console.log(`=======================================================`);
  console.log(`🚀 PMusic Multi-Core Load Balancer initialized (PID: ${process.pid})`);
  console.log(`⚡ Scheduling Algorithm: Round-Robin (SCHED_RR)`);
  console.log(`👥 Spawning ${numWorkers} worker processes across ${os.cpus().length} CPUs...`);
  console.log(`🌐 Master Load Balancer listening on http://${HOST}:${PORT}`);
  console.log(`=======================================================`);

  // Round-Robin TCP load balancing
  cluster.schedulingPolicy = cluster.SCHED_RR;

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('online', (worker) => {
    console.log(`[LoadBalancer] Worker #${worker.id} (PID ${worker.process.pid}) is online and accepting traffic.`);
  });

  // Zero-downtime auto-healing / failover
  cluster.on('exit', (worker, code, signal) => {
    console.warn(`[LoadBalancer] ⚠️ Worker #${worker.id} (PID ${worker.process.pid}) exited (${signal || code}). Auto-healing: spawning replacement...`);
    const newWorker = cluster.fork();
    console.log(`[LoadBalancer] 🔄 Replacement Worker #${newWorker.id} online.`);
  });

  const handleShutdown = () => {
    console.log('\n[LoadBalancer] Gracefully shutting down worker processes...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill('SIGTERM');
    }
    process.exit(0);
  };
  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  return; // Stop master execution here; only workers initialize the HTTP server
}

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
const STREAM_LEASES_FILE = path.join(DATA_DIR, 'stream_leases.json');
const CUSTOM_PLAYLISTS_FILE = path.join(DATA_DIR, 'custom_playlists.json');

function getSavedPlaylists() {
  try {
    if (fs.existsSync(CUSTOM_PLAYLISTS_FILE)) {
      return JSON.parse(fs.readFileSync(CUSTOM_PLAYLISTS_FILE, 'utf8') || '[]');
    }
  } catch (e) {
    console.error('Error reading custom_playlists.json:', e.message);
  }
  return [];
}

function savePlaylists(playlists) {
  return safeWriteJson(CUSTOM_PLAYLISTS_FILE, playlists);
}

function getStreamLeasesDb() {
  try {
    if (fs.existsSync(STREAM_LEASES_FILE)) {
      return JSON.parse(fs.readFileSync(STREAM_LEASES_FILE, 'utf8') || '{}');
    }
  } catch (e) {}
  return {};
}

function saveStreamLeasesDb(db) {
  return safeWriteJson(STREAM_LEASES_FILE, db);
}

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

function safeWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const tempFile = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`);
  try {
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, filePath);
    return true;
  } catch (e) {
    try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (_) {}
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error(`Error saving ${path.basename(filePath)}:`, err.message);
      return false;
    }
  }
}

function saveLibrary(tracks) {
  return safeWriteJson(LIBRARY_FILE, tracks);
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
  return safeWriteJson(FEEDBACK_FILE, list);
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
  return safeWriteJson(USERS_DB_FILE, db);
}

// ==========================================================================
// VIBE SECURITY HARDENED AUTHENTICATION & CRYPTO SYSTEM
// Checklist: PBKDF2 100k rounds, Timing-Safe verification, Session TTL, Rate Limiting
// ==========================================================================

const PBKDF2_ROUNDS = 100000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30-day session expiry
const MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KB payload guard against memory-exhaustion DoS

function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ROUNDS, 64, 'sha512').toString('hex');
  return { hash, salt, rounds: PBKDF2_ROUNDS };
}

function verifyPassword(password, hash, salt, rounds = PBKDF2_ROUNDS) {
  if (!password || !hash || !salt) return false;
  try {
    const calc = crypto.pbkdf2Sync(password, salt, rounds || PBKDF2_ROUNDS, 64, 'sha512').toString('hex');
    const calcBuf = Buffer.from(calc, 'hex');
    const hashBuf = Buffer.from(hash, 'hex');
    if (calcBuf.length === hashBuf.length && crypto.timingSafeEqual(calcBuf, hashBuf)) {
      return true;
    }

    // Backwards compatibility check for legacy 1000 rounds
    if (rounds !== 1000) {
      const calcLegacy = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
      const calcLegacyBuf = Buffer.from(calcLegacy, 'hex');
      if (calcLegacyBuf.length === hashBuf.length && crypto.timingSafeEqual(calcLegacyBuf, hashBuf)) {
        return true;
      }
    }
  } catch (err) {
    return false;
  }
  return false;
}

// Persistent HMAC-signed token authentication with fast in-memory caching and TTL
const SESSION_SECRET = process.env.SESSION_SECRET || 'pmusic_super_secret_session_key_v1';
const activeSessions = new Map();
const revokedTokens = new Set();
const activeStreamLeases = new Map(); // userId -> { deviceId, deviceName, leasedAt, expiresAt }

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

  // 1. Check if token is a high-security v1 JWT access token
  const jwtPayload = TokenManager.verifyAccessToken(token);
  if (jwtPayload && jwtPayload.sub) {
    const userKey = (jwtPayload.email || jwtPayload.sub).toLowerCase();
    const user = db[userKey] || db[jwtPayload.sub];
    if (user) return user;
    // Fallback minimal user object if not in flat file
    return { username: jwtPayload.email || jwtPayload.sub, id: jwtPayload.sub, library: [], likedTracks: [] };
  }

  // 2. Check in-memory session cache
  if (activeSessions.has(token)) {
    const sess = activeSessions.get(token);
    if (Date.now() - sess.createdAt > SESSION_TTL_MS) {
      activeSessions.delete(token);
      return null;
    }
    return db[sess.username] || null;
  }

  if (token.startsWith('pm_')) {
    try {
      const parts = token.slice(3).split('.');
      if (parts.length === 3) {
        const [payload, ts, signature] = parts;
        const tsNum = Number(ts);

        // Session TTL expiration verification
        if (isNaN(tsNum) || Date.now() - tsNum > SESSION_TTL_MS) {
          return null;
        }

        const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(`${payload}.${ts}`).digest('hex');
        const sigBuf = Buffer.from(signature, 'hex');
        const expBuf = Buffer.from(expectedSig, 'hex');

        if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
          const username = Buffer.from(payload, 'base64').toString('utf8');
          const user = db[username];
          if (user) {
            activeSessions.set(token, { username, createdAt: tsNum });
            return user;
          }
        }
      }
    } catch (e) {}
  }
  return null;
}

// ==========================================================================
// LOAD BALANCER & REVERSE PROXY AWARE CLIENT IP RESOLUTION
// Supports Cloudflare, AWS ALB, Render, Nginx, Docker, & Direct
// ==========================================================================

function isLoopbackIp(ip) {
  if (!ip) return true;
  const clean = ip.replace(/^::ffff:/, '').trim().toLowerCase();
  return clean === '127.0.0.1' ||
         clean === '::1' ||
         clean === 'localhost' ||
         clean.startsWith('192.168.') ||
         clean.startsWith('10.') ||
         clean === 'unknown';
}

function getClientIp(req) {
  // 1. Cloudflare Load Balancer
  if (req.headers['cf-connecting-ip']) {
    return req.headers['cf-connecting-ip'].trim();
  }
  // 2. True-Client-IP (Cloudflare Enterprise, Akamai)
  if (req.headers['true-client-ip']) {
    return req.headers['true-client-ip'].trim();
  }
  // 3. Standard Reverse Proxy / Load Balancer (Render, AWS ALB, Nginx)
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'].trim();
  }
  // 4. X-Forwarded-For chain: client, proxy1, proxy2...
  if (req.headers['x-forwarded-for']) {
    const list = req.headers['x-forwarded-for'].split(',');
    if (list.length > 0 && list[0].trim()) {
      return list[0].trim();
    }
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// In-Memory IP Rate Limiter with Sliding Window and Localhost/Dev Exemption
const ipRateLimit = new Map();

// Periodic cleanup every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of ipRateLimit.entries()) {
    if (now > record.resetAt + 60000) {
      ipRateLimit.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function checkRateLimit(ip, bucket, maxRequests, windowMs) {
  // In development mode or on local/private loopback, exempt from rate limits to prevent dev lockout
  if (process.env.NODE_ENV !== 'production' || isLoopbackIp(ip)) {
    return {
      allowed: true,
      remaining: 9999,
      resetInSec: 0
    };
  }

  const key = `${ip}:${bucket}`;
  const now = Date.now();
  const record = ipRateLimit.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }
  record.count++;
  ipRateLimit.set(key, record);
  return {
    allowed: record.count <= maxRequests,
    remaining: Math.max(0, maxRequests - record.count),
    resetInSec: Math.ceil((record.resetAt - now) / 1000)
  };
}

function readJsonBody(req, maxBytes = MAX_PAYLOAD_BYTES) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytesReceived = 0;
    req.on('data', chunk => {
      bytesReceived += chunk.length;
      if (bytesReceived > maxBytes) {
        req.destroy();
        reject(new Error('Payload Too Large'));
        return;
      }
      body += chunk;
    });
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

// ==========================================================================
// CURATED RECOMMENDATIONS & BROWSE CATEGORIES CATALOG
// ==========================================================================

const BROWSE_CATEGORIES_CATALOG = [
  { id: 'music', title: 'Music', color: '#dc148c', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&auto=format&fit=crop&q=80' },
  { id: 'podcasts', title: 'Podcasts', color: '#006450', image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&auto=format&fit=crop&q=80' },
  { id: 'live-events', title: 'Live Events', color: '#8400e7', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&auto=format&fit=crop&q=80' },
  { id: 'made-for-you', title: 'Made For You', color: '#1e3264', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&auto=format&fit=crop&q=80' },
  { id: 'new-releases', title: 'New Releases', color: '#e8115b', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&auto=format&fit=crop&q=80' },
  { id: 'pop', title: 'Pop', color: '#148a08', image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200&auto=format&fit=crop&q=80' },
  { id: 'hip-hop', title: 'Hip-Hop', color: '#bc5900', image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=200&auto=format&fit=crop&q=80' },
  { id: 'rock', title: 'Rock', color: '#e91429', image: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=200&auto=format&fit=crop&q=80' },
  { id: 'latin', title: 'Latin', color: '#e1118c', image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&auto=format&fit=crop&q=80' },
  { id: 'dance', title: 'Dance / Electronic', color: '#d84000', image: 'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=200&auto=format&fit=crop&q=80' },
  { id: 'workout', title: 'Workout', color: '#777777', image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=200&auto=format&fit=crop&q=80' },
  { id: 'chill', title: 'Chill', color: '#477d95', image: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=200&auto=format&fit=crop&q=80' }
];

const CURATED_CATALOG = [
  {
    id: 'track-1',
    name: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    albumYear: '2020',
    duration: 200,
    durationFormatted: '3:20',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a4/bc/58/a4bc5824-2c67-6869-79a0-2f10b28498f3/20UMGIM10357.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/bc/c7/24/bcc724f1-6a2c-7357-61c3-caef795610ea/mzaf_10793132646399080649.plus.aac.p.m4a',
    youtubeId: 'fHI8X4OXluQ',
    popularity: 98
  },
  {
    id: 'track-2',
    name: 'Starboy',
    artist: 'The Weeknd ft. Daft Punk',
    album: 'Starboy',
    albumYear: '2016',
    duration: 230,
    durationFormatted: '3:50',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/91/9f/bf/919fbfec-3044-8fa2-6800-4b2a47290f84/16UMGIM60447.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a',
    youtubeId: '34Na4j8AVgA',
    popularity: 95
  },
  {
    id: 'track-3',
    name: 'Cruel Summer',
    artist: 'Taylor Swift',
    album: 'Lover',
    albumYear: '2019',
    duration: 178,
    durationFormatted: '2:58',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/49/3d/ab/493dab54-f920-9043-6181-80993b8116c9/19UMGIM53909.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/af/81/44af8168-9609-1b85-5048-ada08dceacf3/mzaf_1341699644335558812.plus.aac.p.m4a',
    youtubeId: 'ic8j13piAhQ',
    popularity: 97
  },
  {
    id: 'track-4',
    name: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    albumYear: '1975',
    duration: 355,
    durationFormatted: '5:55',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/8b/0a/ea/8b0aea60-6f4a-195b-5958-cdf459c2333b/602527644271.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/17/fc/1e/17fc1eba-946d-84a9-710b-a0e88ea64209/mzaf_3049006317693088799.plus.aac.p.m4a',
    youtubeId: 'fJ9rUzIMcZQ',
    popularity: 98
  },
  {
    id: 'track-5',
    name: 'Get Lucky',
    artist: 'Daft Punk ft. Pharrell Williams',
    album: 'Random Access Memories',
    albumYear: '2013',
    duration: 370,
    durationFormatted: '6:10',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/57/a5/85/57a585aa-f1bc-7619-881b-f8a04a5541d5/mzaf_6906185026678279401.plus.aac.p.m4a',
    youtubeId: '5NV6Rdv1a3w',
    popularity: 91
  },
  {
    id: 'track-6',
    name: 'BIRDS OF A FEATHER',
    artist: 'Billie Eilish',
    album: 'HIT ME HARD AND SOFT',
    albumYear: '2024',
    duration: 210,
    durationFormatted: '3:30',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/92/9f/69/929f69f1-9977-3a44-d674-11f70c852d1b/24UMGIM36186.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/34/31/d3/3431d34e-847f-5d66-df83-0bce688d997e/mzaf_18106743962423782018.plus.aac.p.m4a',
    youtubeId: 'V9PVRfjEBTI',
    popularity: 99
  },
  {
    id: 'track-7',
    name: 'Lose Yourself',
    artist: 'Eminem',
    album: '8 Mile',
    albumYear: '2002',
    duration: 322,
    durationFormatted: '5:22',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/08/23/fc/0823fcd9-cb44-695b-32bf-b3bf51d9f800/00606949351229.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/13/5a/61/135a6154-8ca2-0523-1fa2-f4ac0ea9e1e7/mzaf_13242749689945681184.plus.aac.p.m4a',
    youtubeId: '_Yhyp-_hX2s',
    popularity: 98
  },
  {
    id: 'track-8',
    name: 'Shape of You',
    artist: 'Ed Sheeran',
    album: '÷ (Deluxe)',
    albumYear: '2017',
    duration: 234,
    durationFormatted: '3:54',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/15/e6/e8/15e6e8a4-4190-6a8b-86c3-ab4a51b88288/190295851286.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/c7/4f/44c74f0d-72dc-6143-d4d0-ba14d661ca0d/mzaf_9566898362556366703.plus.aac.p.m4a',
    youtubeId: 'JGwWNGJdvx8',
    popularity: 95
  },
  {
    id: 'track-9',
    name: 'Levitating',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    albumYear: '2020',
    duration: 204,
    durationFormatted: '3:24',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/6c/11/d6/6c11d681-aa3a-d59e-4c2e-f77e181026ab/190295092665.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/59/dc/4d/59dc4dda-93ff-8f1c-c536-f005f6ea6af5/mzaf_3066686759813252385.plus.aac.p.m4a',
    youtubeId: 'TUVcZfQe-Kw',
    popularity: 97
  },
  {
    id: 'track-10',
    name: 'Sunflower',
    artist: 'Post Malone & Swae Lee',
    album: 'Spider-Man: Into the Spider-Verse',
    albumYear: '2018',
    duration: 158,
    durationFormatted: '2:38',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/4b/30/2c/4b302cb6-7a14-5464-4e97-0577e9d0be49/18UMGIM82277.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/98/f0/d6/98f0d67e-f8bf-762d-cac7-1c6b3b6b35dd/mzaf_4543283896248560946.plus.aac.p.m4a',
    youtubeId: 'BnoxtZ11vQ0',
    popularity: 97
  },
  {
    id: 'track-11',
    name: 'As It Was',
    artist: 'Harry Styles',
    album: "Harry's House",
    albumYear: '2022',
    duration: 167,
    durationFormatted: '2:47',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2a/19/fb/2a19fb85-2f70-9e44-f2a9-82abe679b88e/886449990061.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/67/10/16/67101606-3869-ca44-6c03-e13d6322cb51/mzaf_1135399237022217274.plus.aac.p.m4a',
    youtubeId: 'H5v3kku4y6Q',
    popularity: 94
  },
  {
    id: 'track-12',
    name: 'Flowers',
    artist: 'Miley Cyrus',
    album: 'Endless Summer Vacation',
    albumYear: '2023',
    duration: 201,
    durationFormatted: '3:21',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/8c/67/ff/8c67ff91-31c3-3fef-1884-ce3ec89f3af4/196589946874.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/68/9e/f7/689ef7fe-14fe-a846-c87f-7d3b2d6344b1/mzaf_4167137058064023087.plus.aac.p.m4a',
    youtubeId: 'G7KNmW9a75Y',
    popularity: 94
  },
  {
    id: 'track-13',
    name: 'Believer',
    artist: 'Imagine Dragons',
    album: 'Evolve',
    albumYear: '2017',
    duration: 204,
    durationFormatted: '3:24',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/11/7a/b8/117ab805-6811-8929-18b9-0fad7baf0c25/17UMGIM98210.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c0/3f/36/c03f367a-b66b-fd0a-a54c-30f8250c4410/mzaf_12768434238801682952.plus.aac.p.m4a',
    youtubeId: '7wtfhZwyrcc',
    popularity: 93
  },
  {
    id: 'track-14',
    name: 'Someone You Loved',
    artist: 'Lewis Capaldi',
    album: 'Divinely Uninspired',
    albumYear: '2019',
    duration: 182,
    durationFormatted: '3:02',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/92/d7/8f/92d78fb1-df3d-049e-c81d-7022808b151f/19UMGIM02973.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/e5/c8/17/e5c817e2-7830-091f-8686-d6276d5beaeb/mzaf_5586826958480073790.plus.aac.p.m4a',
    youtubeId: 'zABLecsR5UE',
    popularity: 93
  },
  {
    id: 'track-15',
    name: 'Counting Stars',
    artist: 'OneRepublic',
    album: 'Native',
    albumYear: '2013',
    duration: 257,
    durationFormatted: '4:17',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/25/46/a7/2546a71a-b2bb-b4c9-4c52-a4daa3ae23ca/13UMGIM15076.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b0/db/7f/b0db7fbe-f8ff-1f67-fe72-ca8185ffbca2/mzaf_15298650366584767800.plus.aac.p.m4a',
    youtubeId: 'hT_nvWreIhg',
    popularity: 92
  },
  {
    id: 'track-16',
    name: 'Viva La Vida',
    artist: 'Coldplay',
    album: 'Viva La Vida',
    albumYear: '2008',
    duration: 241,
    durationFormatted: '4:01',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/52/aa/85/52aa851f-15b7-6322-f91f-df84b15b7b19/190295978044.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/a3/30/8e/a3308eed-d8b7-e0b3-f09d-5e1b0f4d660a/mzaf_8517946447501075134.plus.aac.p.m4a',
    youtubeId: 'dvgZkm1xWPE',
    popularity: 94
  }
];

// In-memory lyrics cache
const lyricsCache = new Map();

// Real-time lyrics fetcher from LRCLIB (supports synced and plain lyrics)
async function fetchLyrics(track, artist) {
  const cacheKey = `${artist || ''} - ${track || ''}`.trim().toLowerCase();
  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey);
  }

  try {
    const qTrack = encodeURIComponent(track || '');
    const qArtist = encodeURIComponent(artist || '');
    const apiUrl = `https://lrclib.net/api/get?track_name=${qTrack}&artist_name=${qArtist}`;
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'PMusic-Server/1.0 (https://github.com/PriyanshuTarsauliya/PMusic-)'
      }
    });

    if (res.ok) {
      const data = await res.json();
      const result = {
        found: true,
        trackName: data.trackName || track,
        artistName: data.artistName || artist,
        plainLyrics: data.plainLyrics || null,
        syncedLyrics: data.syncedLyrics || null,
        instrumental: !!data.instrumental
      };
      lyricsCache.set(cacheKey, result);
      return result;
    }

    // Fallback search if exact match doesn't hit
    const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(`${artist || ''} ${track || ''}`)}`, {
      headers: {
        'User-Agent': 'PMusic-Server/1.0 (https://github.com/PriyanshuTarsauliya/PMusic-)'
      }
    });
    if (searchRes.ok) {
      const list = await searchRes.json();
      if (Array.isArray(list) && list.length > 0) {
        const first = list[0];
        const result = {
          found: true,
          trackName: first.trackName || track,
          artistName: first.artistName || artist,
          plainLyrics: first.plainLyrics || null,
          syncedLyrics: first.syncedLyrics || null,
          instrumental: !!first.instrumental
        };
        lyricsCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    console.error('Error fetching lyrics:', err.message);
  }

  const notFound = { found: false, plainLyrics: null, syncedLyrics: null, instrumental: false };
  lyricsCache.set(cacheKey, notFound);
  return notFound;
}

// In-memory server search cache
const serverSearchCache = new Map();

// Server-side iTunes Search proxy with caching and format normalization
async function proxySearch(term, limit = 50) {
  const cacheKey = `${term.trim().toLowerCase()}_${limit}`;
  if (serverSearchCache.has(cacheKey)) {
    return serverSearchCache.get(cacheKey);
  }

  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song,album,musicArtist&limit=${limit}`;
    const res = await fetch(itunesUrl, {
      headers: {
        'User-Agent': 'PMusic-Server/1.0',
        'Accept': 'application/json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      const tracks = [];
      const artists = [];
      const albums = [];

      (data.results || []).forEach(item => {
        if (item.wrapperType === 'track') {
          const totalSec = Math.round((item.trackTimeMillis || 180000) / 1000);
          const mins = Math.floor(totalSec / 60);
          const secs = String(totalSec % 60).padStart(2, '0');
          tracks.push({
            id: `track-${item.trackId}`,
            name: item.trackName,
            artist: item.artistName,
            album: item.collectionName || 'Single',
            albumYear: (item.releaseDate || '').substring(0, 4),
            duration: totalSec,
            durationFormatted: `${mins}:${secs}`,
            artwork: (item.artworkUrl100 || '').replace('100x100bb', '400x400bb'),
            previewUrl: item.previewUrl,
            youtubeId: null,
            type: 'track'
          });
        } else if (item.wrapperType === 'artist') {
          artists.push({
            id: `artist-${item.artistId}`,
            name: item.artistName,
            genre: item.primaryGenreName || 'Artist',
            followers: 'Verified Artist',
            image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
            type: 'artist'
          });
        } else if (item.wrapperType === 'collection') {
          albums.push({
            id: `album-${item.collectionId}`,
            title: item.collectionName,
            artist: item.artistName,
            year: (item.releaseDate || '').substring(0, 4),
            artwork: (item.artworkUrl100 || '').replace('100x100bb', '400x400bb'),
            trackCount: item.trackCount || 10,
            type: 'album'
          });
        }
      });

      const responseData = {
        success: true,
        query: term,
        total: tracks.length + artists.length + albums.length,
        tracks,
        artists,
        albums
      };

      serverSearchCache.set(cacheKey, responseData);
      return responseData;
    }
  } catch (err) {
    console.error('Error in proxySearch:', err.message);
  }

  return { success: false, query: term, tracks: [], artists: [], albums: [] };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Standard Web App Security Headers (Vibe Security Checklist Section 9)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Route: Register new user account (Vibe Security Checklist Section 1, 6, 14)
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    const clientIp = getClientIp(req);
    const rate = checkRateLimit(clientIp, 'register', 60, 60 * 1000);
    if (!rate.allowed) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(rate.resetInSec) });
      res.end(JSON.stringify({ error: `Too many registration attempts. Please try again in ${rate.resetInSec} seconds.` }));
      return;
    }

    try {
      const payload = await readJsonBody(req);
      const username = (payload.username || '').trim();
      const password = (payload.password || '').trim();
      const initialLibrary = Array.isArray(payload.library) && payload.library.length > 0
        ? payload.library
        : getSavedLibrary();

      if (!username || !/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Username must be 3-32 characters long and contain only letters, numbers, hyphens or underscores.' }));
        return;
      }
      if (!password || password.length < 4 || password.length > 128) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Password must be between 4 and 128 characters long.' }));
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

  // API Route: Log in existing user (Vibe Security Checklist Section 1 & 14)
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const clientIp = getClientIp(req);
    const rate = checkRateLimit(clientIp, 'login', 20, 60 * 1000);
    if (!rate.allowed) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(rate.resetInSec) });
      res.end(JSON.stringify({ error: `Too many login attempts. Please try again in ${rate.resetInSec} seconds.` }));
      return;
    }

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

  // ==========================================================================
  // HYPERSCALE 3-STEP HANDSHAKE & TOKEN AUTHENTICATION ENDPOINTS (v1)
  // ==========================================================================

  // Step 1: Request Challenge
  if ((pathname === '/api/v1/auth/challenge' || pathname === '/api/auth/challenge') && (req.method === 'GET' || req.method === 'POST')) {
    const clientIp = getClientIp(req);
    const rate = checkRateLimit(clientIp, 'challenge', 60, 60 * 1000);
    if (!rate.allowed) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(rate.resetInSec) });
      res.end(JSON.stringify({ error: `Too many challenge requests. Please retry in ${rate.resetInSec}s.` }));
      return;
    }

    const userAgent = req.headers['user-agent'] || 'unknown';
    const difficulty = isLoopbackIp(clientIp) ? 2 : 3;
    const challenge = ChallengeService.generateChallenge(clientIp, userAgent, difficulty);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      challenge: {
        nonce: challenge.nonce,
        timestamp: challenge.timestamp,
        difficulty: challenge.difficulty,
        prefix: challenge.prefix,
        signature: challenge.signature,
        expiresAt: challenge.expiresAt
      }
    }));
    return;
  }

  // Step 2 & 3: Submit Solution, Verify Credentials & Issue Rotating Tokens
  if ((pathname === '/api/v1/auth/login' || pathname === '/api/v1/auth/verify') && req.method === 'POST') {
    const clientIp = getClientIp(req);
    const rate = checkRateLimit(clientIp, 'v1_login', 30, 60 * 1000);
    if (!rate.allowed) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(rate.resetInSec) });
      res.end(JSON.stringify({ error: `Rate limit exceeded. Please back off for ${rate.resetInSec}s.` }));
      return;
    }

    try {
      const payload = await readJsonBody(req);
      const email = (payload.email || payload.username || '').trim();
      const password = (payload.password || '').trim();
      const { challenge = {}, powSolution, powDurationMs = 0, deviceInfo = {} } = payload;

      if (!email || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Username/Email and password are required.' }));
        return;
      }

      // 1. Verify 3-Step Handshake Challenge (Proof of Work) if provided
      if (challenge.nonce && powSolution) {
        const userAgent = req.headers['user-agent'] || 'unknown';
        const challengeResult = ChallengeService.verifySolution({
          nonce: challenge.nonce,
          timestamp: challenge.timestamp,
          difficulty: challenge.difficulty,
          signature: challenge.signature,
          solution: powSolution,
          clientIp,
          userAgent
        });

        if (!challengeResult.valid) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Security challenge failed',
            code: 'POW_INVALID',
            reason: challengeResult.reason
          }));
          return;
        }
      }

      // 2. Risk Assessment
      const risk = RiskScorer.evaluate({
        clientIp,
        userAgent: req.headers['user-agent'] || '',
        deviceInfo,
        powDurationMs
      });

      if (risk.decision === 'BLOCK') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Access blocked by automated security policy',
          code: 'HIGH_RISK_DETECTED',
          flags: risk.flags
        }));
        return;
      }

      // 3. User verification against database
      const db = getUsersDb();
      const userKey = email.toLowerCase();
      const user = db[userKey];

      if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid credentials.' }));
        return;
      }

      // 4. Issue Rotating Tokens
      const userId = userKey;
      const deviceId = deviceInfo.deviceId || `dev_${crypto.randomBytes(8).toString('hex')}`;
      const refreshSession = TokenManager.issueRefreshToken(userId, null, deviceId);
      const accessSession = TokenManager.issueAccessToken({ id: userId, email: userKey }, refreshSession.familyId);

      // Set Refresh Token in secure cookie
      const isProd = process.env.NODE_ENV === 'production';
      res.setHeader('Set-Cookie', `spotify_rt=${refreshSession.rawRefreshToken}; HttpOnly; Path=/api/v1/auth; Max-Age=${14 * 24 * 3600}; SameSite=Lax${isProd ? '; Secure' : ''}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        user: {
          username: user.username,
          library: user.library || [],
          likedTracks: user.likedTracks || []
        },
        tokens: {
          accessToken: accessSession.accessToken,
          expiresAt: accessSession.expiresAt,
          tokenType: 'Bearer',
          refreshToken: refreshSession.rawRefreshToken
        },
        riskScore: risk.score,
        requiresStepUp: risk.decision === 'CHALLENGE'
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request data: ' + err.message }));
    }
    return;
  }

  // Refresh Token Rotation (RTR) Endpoint with Reuse Detection
  if (pathname === '/api/v1/auth/refresh' && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      let rawRefreshToken = payload.refreshToken;
      if (!rawRefreshToken && req.headers['cookie']) {
        const match = req.headers['cookie'].match(/spotify_rt=([^;]+)/);
        if (match) rawRefreshToken = match[1];
      }

      if (!rawRefreshToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Refresh token missing.' }));
        return;
      }

      const deviceId = payload.deviceId || 'unknown_device';
      const result = TokenManager.rotateRefreshToken(rawRefreshToken, deviceId);

      if (!result.success) {
        if (result.breachDetected) {
          res.setHeader('Set-Cookie', 'spotify_rt=; HttpOnly; Path=/api/v1/auth; Max-Age=0');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Token reuse detected',
            code: 'SECURITY_ALERT_BREACH',
            message: result.reason
          }));
          return;
        }

        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.reason }));
        return;
      }

      const isProd = process.env.NODE_ENV === 'production';
      res.setHeader('Set-Cookie', `spotify_rt=${result.refreshToken}; HttpOnly; Path=/api/v1/auth; Max-Age=${14 * 24 * 3600}; SameSite=Lax${isProd ? '; Secure' : ''}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid refresh request.' }));
    }
    return;
  }

  // Spotify-Style Single Active Stream Lease Enforcement
  if (pathname === '/api/v1/stream/lease' && (req.method === 'POST' || req.method === 'GET')) {
    const token = extractToken(req, parsedUrl);
    const user = getSessionUser(token);

    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Authentication required for stream lease.' }));
      return;
    }

    const userId = user.username ? user.username.toLowerCase() : user.id;

    const leases = getStreamLeasesDb();

    if (req.method === 'GET') {
      const lease = leases[userId];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ active: !!lease && lease.expiresAt > Date.now(), lease: lease || null }));
      return;
    }

    try {
      const payload = await readJsonBody(req);
      const { deviceId = 'web_player', deviceName = 'Web Browser' } = payload;
      const now = Date.now();
      const LEASE_TTL_MS = 25000;

      const currentLease = leases[userId];

      // If another device is actively playing and has not timed out
      if (currentLease && currentLease.deviceId !== deviceId && currentLease.expiresAt > now) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'displaced',
          message: `Audio playback paused. You are listening on ${currentLease.deviceName}.`,
          playingOn: currentLease.deviceName
        }));
        return;
      }

      // Grant / Renew lease
      leases[userId] = {
        deviceId,
        deviceName,
        leasedAt: now,
        expiresAt: now + LEASE_TTL_MS
      };
      saveStreamLeasesDb(leases);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'granted',
        leaseDurationSec: 25,
        heartbeatIntervalSec: 10
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid stream lease request.' }));
    }
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

  // Cloud Health Checks & Monitoring (Render Ready)
  if (pathname === '/healthz' || pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      service: 'PMusic Search & Playback Engine',
      version: '1.2.0'
    }));
    return;
  }

  // API Route: Server Statistics
  if (pathname === '/api/stats') {
    const users = getUsersDb();
    const feedbacks = getFeedbackDb();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      userCount: Object.keys(users).length,
      activeSessions: activeSessions.size,
      feedbackCount: feedbacks.length,
      cachedSearches: serverSearchCache.size,
      cachedSongs: resolveCache.size,
      cachedLyrics: lyricsCache.size,
      memory: process.memoryUsage()
    }));
    return;
  }

  // API Route: Load Balancer Health & Distribution Telemetry
  if (pathname === '/api/load-balancer' || pathname === '/api/cluster') {
    const clientIp = getClientIp(req);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      balancer: isClusterMode ? 'Cluster (SCHED_RR)' : 'Single Node Engine',
      isClustered: isClusterMode,
      workerId: cluster.isWorker ? cluster.worker.id : 'standalone',
      workerPid: process.pid,
      totalCPUs: os.cpus().length,
      uptimeSeconds: Math.floor(process.uptime()),
      clientIp: clientIp,
      proxyHeaders: {
        'cf-connecting-ip': req.headers['cf-connecting-ip'] || null,
        'true-client-ip': req.headers['true-client-ip'] || null,
        'x-real-ip': req.headers['x-real-ip'] || null,
        'x-forwarded-for': req.headers['x-forwarded-for'] || null,
        'x-forwarded-proto': req.headers['x-forwarded-proto'] || null
      },
      memory: process.memoryUsage()
    }));
    return;
  }

  // API Route: Emergency Rate Limit Reset
  if (pathname === '/api/security/reset-rate-limit' && req.method === 'POST') {
    ipRateLimit.clear();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'All rate limits reset successfully.' }));
    return;
  }

  // API Route: Live Search Proxy (iTunes / Apple Music + Caching)
  if (pathname === '/api/search') {
    const q = (parsedUrl.query.q || parsedUrl.query.term || '').trim();
    const limit = Math.min(Math.max(Number(parsedUrl.query.limit) || 50, 1), 100);
    if (!q) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing search query parameter q or term' }));
      return;
    }

    const result = await proxySearch(q, limit);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // API Route: Recommendations & Browse Categories
  if (pathname === '/api/recommendations' || pathname === '/api/curated') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      count: CURATED_CATALOG.length,
      curated: CURATED_CATALOG,
      categories: BROWSE_CATEGORIES_CATALOG
    }));
    return;
  }

  // API Route: Real-Time Lyrics Resolver (LRCLIB synced & plain)
  if (pathname === '/api/lyrics') {
    const track = (parsedUrl.query.track || parsedUrl.query.song || parsedUrl.query.q || '').trim();
    const artist = (parsedUrl.query.artist || '').trim();
    if (!track) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing track parameter' }));
      return;
    }

    const lyricsData = await fetchLyrics(track, artist);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(lyricsData));
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

  // API Route: Custom User Playlists
  if (pathname === '/api/user/playlists' && req.method === 'GET') {
    const playlists = getSavedPlaylists();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ playlists }));
    return;
  }

  if (pathname === '/api/user/playlists' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const playlists = getSavedPlaylists();
      if (body.action === 'create') {
        const newPl = {
          id: 'user-pl-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5),
          title: (body.title || '').trim() || ('My Playlist #' + (playlists.length + 1)),
          description: (body.description || '').trim() || 'Created by user',
          artwork: body.artwork || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
          curator: body.curator || 'You',
          createdAt: Date.now(),
          tracks: Array.isArray(body.tracks) ? body.tracks : []
        };
        playlists.unshift(newPl);
        savePlaylists(playlists);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, playlist: newPl }));
        return;
      } else if (body.action === 'addTrack') {
        const pl = playlists.find(p => p.id === body.playlistId);
        if (!pl) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Playlist not found' }));
          return;
        }
        if (!pl.tracks) pl.tracks = [];
        if (!pl.tracks.some(t => t.id === body.track.id)) {
          pl.tracks.push(body.track);
          savePlaylists(playlists);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, playlist: pl }));
        return;
      } else if (body.action === 'removeTrack') {
        const pl = playlists.find(p => p.id === body.playlistId);
        if (pl && pl.tracks) {
          pl.tracks = pl.tracks.filter(t => t.id !== body.trackId);
          savePlaylists(playlists);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, playlist: pl }));
        return;
      }
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
      return;
    }
  }

  if (pathname.startsWith('/api/user/playlists/') && req.method === 'DELETE') {
    const id = pathname.replace('/api/user/playlists/', '');
    let playlists = getSavedPlaylists();
    playlists = playlists.filter(p => p.id !== id);
    savePlaylists(playlists);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // API Route: Submit new user feedback (Rate-limited anti-spam)
  if (pathname === '/api/feedback' && req.method === 'POST') {
    const clientIp = getClientIp(req);
    const rate = checkRateLimit(clientIp, 'feedback', 10, 5 * 60 * 1000);
    if (!rate.allowed) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(rate.resetInSec) });
      res.end(JSON.stringify({ error: 'Feedback rate limit reached. Please wait before submitting more feedback.' }));
      return;
    }

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
  // Vibe Security Checklist Section 2 & 6: Path traversal prevention
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  let decodedPath = '';
  try {
    decodedPath = decodeURIComponent(reqPath);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }

  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.resolve(DIR, '.' + path.sep + normalizedPath);

  // Strict jail directory boundary check
  if (!filePath.startsWith(DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

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
