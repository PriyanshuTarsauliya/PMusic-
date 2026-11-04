/**
 * PMusic Comprehensive Login Feature Test Suite
 * Tests Standard Auth, V1 Zero-Trust PoW Auth, Refresh Token Rotation,
 * Android Demo Credential Validation, Error Handling, and Rate Limiting.
 */

const http = require('http');
const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const { spawn } = require('child_process');

const TEST_PORT = 3459;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const TEST_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36';

let serverProcess = null;

function makeRequest({ path, method = 'GET', headers = {} }, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { 'User-Agent': TEST_UA, ...headers };
    let reqBody = null;

    if (body !== null) {
      reqBody = typeof body === 'string' ? body : JSON.stringify(body);
      if (!reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
      reqHeaders['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const req = http.request(url, {
      method,
      headers: reqHeaders,
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out: ${method} ${path}`));
    });

    if (reqBody) req.write(reqBody);
    req.end();
  });
}

function startTestServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, 'server.js');
    serverProcess = spawn('node', [serverPath], {
      env: {
        ...process.env,
        PORT: TEST_PORT,
        HOST: '127.0.0.1',
        NODE_ENV: 'production',
        ADMIN_KEY: 'test_admin_key_login_suite'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    serverProcess.stdout.on('data', chunk => {
      stdout += chunk.toString();
      if (stdout.includes('Spotify server running')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', chunk => {
      console.error('[Server Error]:', chunk.toString());
    });

    serverProcess.on('error', reject);
    serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Server exited prematurely with code ${code}`));
      }
    });

    setTimeout(() => resolve(), 2500);
  });
}

function stopTestServer() {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch (e) {}
  }
}

// Client PoW Solver for V1 Handshake
function solvePoW(nonce, prefix) {
  let counter = 0;
  while (true) {
    const candidate = `${nonce}:${counter}`;
    const hash = crypto.createHash('sha256').update(candidate).digest('hex');
    if (hash.startsWith(prefix)) {
      return { solution: String(counter), iterations: counter };
    }
    counter++;
    if (counter > 1000000) throw new Error('PoW solving timeout');
  }
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`   ✅ PASS: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`   ❌ FAIL: ${name}`);
    console.error(`      Error: ${err.message}`);
  }
}

async function run() {
  console.log('===============================================================');
  console.log('🔐 RUNNING COMPREHENSIVE LOGIN & AUTHENTICATION TEST SUITE');
  console.log('===============================================================');

  try {
    await startTestServer();
  } catch (err) {
    console.error('Failed to start test server:', err);
    process.exit(1);
  }

  // 1. Standard Registration Validation
  console.log('\n🔹 [SUITE] 1. Standard Registration & Validation');

  const freshUser = `login_test_${Date.now().toString(36)}`;
  const freshPass = 'SuperSecret123!';

  await test('Registers a valid new user account', async () => {
    const res = await makeRequest({ path: '/api/auth/register', method: 'POST' }, {
      username: freshUser,
      password: freshPass,
      library: [{ id: 'test-1', name: 'Song One', artist: 'Artist One' }]
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
    assert(json.token, 'Should return authentication token');
    assert.strictEqual(json.user.username, freshUser);
    assert.strictEqual(json.user.library.length, 1);
  });

  await test('Rejects registration with duplicate username (HTTP 400)', async () => {
    const res = await makeRequest({ path: '/api/auth/register', method: 'POST' }, {
      username: freshUser,
      password: freshPass
    });
    assert.strictEqual(res.statusCode, 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.includes('already exists'));
  });

  await test('Rejects registration with password shorter than 4 characters (HTTP 400)', async () => {
    const res = await makeRequest({ path: '/api/auth/register', method: 'POST' }, {
      username: `short_pass_${Date.now().toString(36)}`,
      password: '123'
    });
    assert.strictEqual(res.statusCode, 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.includes('between 4 and 128 characters'));
  });

  await test('Rejects registration with empty or missing username (HTTP 400)', async () => {
    const res = await makeRequest({ path: '/api/auth/register', method: 'POST' }, {
      username: '   ',
      password: 'ValidPassword123'
    });
    assert.strictEqual(res.statusCode, 400, `Expected 400, got ${res.statusCode}`);
  });

  // 2. Standard Login Verification
  console.log('\n🔹 [SUITE] 2. Standard Login Credentials & Session Verification');

  let sessionToken = null;

  await test('Logs in successfully with valid credentials (HTTP 200)', async () => {
    const res = await makeRequest({ path: '/api/auth/login', method: 'POST' }, {
      username: freshUser,
      password: freshPass
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
    assert(json.token, 'Should return session token');
    sessionToken = json.token;
    assert.strictEqual(json.user.username, freshUser);
    assert.strictEqual(json.user.library.length, 1);
  });

  await test('Rejects login with incorrect password (HTTP 401)', async () => {
    const res = await makeRequest({ path: '/api/auth/login', method: 'POST' }, {
      username: freshUser,
      password: 'WrongPassword999!'
    });
    assert.strictEqual(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.error, 'Invalid username or password.');
  });

  await test('Rejects login with nonexistent username (HTTP 401)', async () => {
    const res = await makeRequest({ path: '/api/auth/login', method: 'POST' }, {
      username: 'nonexistent_ghost_user_9999',
      password: 'SomePassword123'
    });
    assert.strictEqual(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.error, 'Invalid username or password.');
  });

  await test('Rejects login with malformed/empty payload (HTTP 400 or 401)', async () => {
    const res = await makeRequest({ path: '/api/auth/login', method: 'POST' }, {});
    assert(res.statusCode === 400 || res.statusCode === 401, `Expected 400 or 401, got ${res.statusCode}`);
  });

  // 3. Authenticated Session Retrieval & Logout
  console.log('\n🔹 [SUITE] 3. Session Profile Retrieval & Token Revocation');

  await test('Retrieves user profile via /api/auth/me with valid Bearer token (HTTP 200)', async () => {
    assert(sessionToken, 'Must have active session token');
    const res = await makeRequest({
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.user.username, freshUser);
    assert(Array.isArray(json.user.library));
  });

  await test('Rejects /api/auth/me with missing Authorization header (HTTP 401)', async () => {
    const res = await makeRequest({ path: '/api/auth/me', method: 'GET' });
    assert.strictEqual(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);
  });

  await test('Rejects /api/auth/me with forged or invalid token (HTTP 401)', async () => {
    const res = await makeRequest({
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': 'Bearer forged_fake_token_12345' }
    });
    assert.strictEqual(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);
  });

  await test('Logs out and revokes active session token (HTTP 200)', async () => {
    const res = await makeRequest({
      path: '/api/auth/logout',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  });

  await test('Rejects /api/auth/me after logout with revoked token (HTTP 401)', async () => {
    const res = await makeRequest({
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    assert.strictEqual(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);
  });

  // 4. Android Native Quick Test Credentials Verification
  console.log('\n🔹 [SUITE] 4. Android Demo Credentials Verification (ben_spotify_premium@spotify.com)');

  await test('Authenticates seeded Android demo user (ben_spotify_premium@spotify.com / Spotify2026!)', async () => {
    const res = await makeRequest({ path: '/api/auth/login', method: 'POST' }, {
      username: 'ben_spotify_premium@spotify.com',
      password: 'Spotify2026!'
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
    assert(json.token, 'Demo user should receive session token');
    assert.strictEqual(json.user.username.toLowerCase(), 'ben_spotify_premium@spotify.com');
  });

  await test('Rejects Android demo user with incorrect password (HTTP 401)', async () => {
    const res = await makeRequest({ path: '/api/auth/login', method: 'POST' }, {
      username: 'ben_spotify_premium@spotify.com',
      password: 'WrongPassword2026'
    });
    assert.strictEqual(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);
  });

  // 5. Zero-Trust Anti-Bot V1 Handshake & Refresh Token Rotation
  console.log('\n🔹 [SUITE] 5. Zero-Trust Anti-Bot V1 Handshake & Refresh Token Rotation');

  let v1Challenge = null;
  let v1PoWSolution = null;
  let v1Tokens = null;

  await test('Issues cryptographic PoW challenge from /api/v1/auth/challenge (HTTP 200)', async () => {
    const res = await makeRequest({
      path: '/api/v1/auth/challenge',
      method: 'POST',
      headers: { 'User-Agent': TEST_UA }
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
    assert(json.challenge.nonce, 'Challenge must provide nonce');
    assert(json.challenge.prefix, 'Challenge must provide target prefix');
    v1Challenge = json.challenge;
  });

  await test('Solves cryptographic PoW puzzle with required prefix', async () => {
    const solved = solvePoW(v1Challenge.nonce, v1Challenge.prefix);
    assert(solved.solution, 'Must compute valid solution string');
    v1PoWSolution = solved.solution;
  });

  await test('Authenticates via /api/v1/auth/login with valid PoW & credentials (HTTP 200)', async () => {
    const res = await makeRequest({
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'User-Agent': TEST_UA,
        'Content-Type': 'application/json'
      }
    }, {
      email: 'scale_user_1',
      password: 'password123',
      challenge: v1Challenge,
      powSolution: v1PoWSolution,
      powDurationMs: 65,
      deviceInfo: {
        userAgent: TEST_UA,
        canvasFingerprint: 'valid_canvas_hash_123',
        screenRes: '1920x1080',
        timezoneOffset: -330
      }
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
    assert(json.tokens && json.tokens.accessToken, 'Must return JWT access token');
    assert(json.tokens.refreshToken, 'Must return refresh token');
    v1Tokens = json.tokens;
  });

  await test('Rejects /api/v1/auth/login with invalid PoW solution (HTTP 403)', async () => {
    const chRes = await makeRequest({
      path: '/api/v1/auth/challenge',
      method: 'POST',
      headers: { 'User-Agent': TEST_UA }
    });
    const chJson = JSON.parse(chRes.body);

    const res = await makeRequest({
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'User-Agent': TEST_UA }
    }, {
      email: 'scale_user_1',
      password: 'password123',
      challenge: chJson.challenge,
      powSolution: 'fake_nonce:999999999',
      powDurationMs: 10
    });
    assert.strictEqual(res.statusCode, 403, `Expected 403 for tampered PoW, got ${res.statusCode}`);
  });

  let nextRefreshToken = null;

  await test('Rotates refresh token via /api/v1/auth/refresh (HTTP 200)', async () => {
    assert(v1Tokens && v1Tokens.refreshToken, 'Requires v1 refresh token');
    const res = await makeRequest({ path: '/api/v1/auth/refresh', method: 'POST' }, {
      refreshToken: v1Tokens.refreshToken
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
    assert(json.accessToken, 'Must issue new access token');
    assert(json.refreshToken, 'Must issue fresh refresh token');
    assert.notStrictEqual(json.refreshToken, v1Tokens.refreshToken, 'Refresh token must rotate');
    nextRefreshToken = json.refreshToken;
  });

  await test('Detects refresh token replay attack and revokes family (HTTP 401)', async () => {
    // Replay the already-consumed v1Tokens.refreshToken
    const res = await makeRequest({ path: '/api/v1/auth/refresh', method: 'POST' }, {
      refreshToken: v1Tokens.refreshToken
    });
    assert.strictEqual(res.statusCode, 401, `Expected 401 on token reuse, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.code, 'SECURITY_ALERT_BREACH');

    // Verify nextRefreshToken was also invalidated due to family revocation
    const retryRes = await makeRequest({ path: '/api/v1/auth/refresh', method: 'POST' }, {
      refreshToken: nextRefreshToken
    });
    assert.strictEqual(retryRes.statusCode, 401, 'Subsequent tokens in family must also be revoked');
  });

  // 6. Login Brute-Force Rate Limiting Protection
  console.log('\n🔹 [SUITE] 6. Login Brute-Force Rate Limiting');

  await test('Enforces rate limiting after repeated login attempts (HTTP 429)', async () => {
    let hitRateLimit = false;
    const testIp = '198.51.100.88'; // External public IP
    for (let i = 0; i < 25; i++) {
      const res = await makeRequest({
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'X-Forwarded-For': testIp }
      }, {
        username: 'victim_user',
        password: `bad_guess_${i}`
      });
      if (res.statusCode === 429) {
        hitRateLimit = true;
        assert(res.headers['retry-after'], 'Should include Retry-After header');
        break;
      }
    }
    assert.strictEqual(hitRateLimit, true, 'Rate limiter must trigger HTTP 429 on burst login attempts');
  });

  // Reset rate limits for test environment cleanliness
  await makeRequest({
    path: '/api/security/reset-rate-limit',
    method: 'POST',
    headers: { 'Authorization': 'Bearer test_admin_key_login_suite' }
  });

  console.log('\n===============================================================');
  console.log('📊 LOGIN TEST SUITE EXECUTION SUMMARY:');
  console.log(`   Total Tests:  ${totalTests}`);
  console.log(`   Passed:       ${passedTests}`);
  console.log(`   Failed:       ${failedTests}`);
  console.log(`   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  console.log('===============================================================');

  stopTestServer();
  process.exit(failedTests === 0 ? 0 : 1);
}

run().catch(err => {
  console.error('Fatal test error:', err);
  stopTestServer();
  process.exit(1);
});
