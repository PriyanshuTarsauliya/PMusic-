/**
 * security-tests.js
 * Comprehensive automated security & feature test suite for PMusic.
 * Verifies defensive remediations for FND-SEC-01 through FND-SEC-08,
 * and confirms that standard authentication, registration, playback,
 * and streaming leases continue to work without regression.
 */

const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = 3457; // Dedicated test port
process.env.PORT = String(PORT);
process.env.NODE_ENV = 'test';
process.env.NO_CLUSTER = 'true';
process.env.ADMIN_KEY = 'test_admin_key_123';

// Require the server instance
const server = require('./server');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      ...options
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
    if (postData) {
      req.write(typeof postData === 'object' ? JSON.stringify(postData) : postData);
    }
    req.end();
  });
}

async function runSecuritySuite() {
  console.log('===============================================================');
  console.log('🔒 RUNNING PMUSIC SECURITY & FEATURE REGRESSION TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    return fn()
      .then(() => {
        console.log(`   ✅ PASS: ${name}`);
        passed++;
      })
      .catch((err) => {
        console.error(`   ❌ FAIL: ${name}`);
        console.error(`      Error: ${err.message}`);
      });
  }

  // 1. Static File Route Jail Tests (FND-SEC-01)
  console.log('🔹 [SUITE] 1. Static File Route Jail & Sensitive Data Protection');
  
  await test('Blocks direct access to /data/users.json (HTTP 403 Forbidden)', async () => {
    const res = await makeRequest({ path: '/data/users.json', method: 'GET' });
    assert.strictEqual(res.statusCode, 403, `Expected 403, got ${res.statusCode}`);
    assert.strictEqual(res.body, 'Forbidden');
  });

  await test('Blocks direct access to /data/refresh_tokens.json (HTTP 403 Forbidden)', async () => {
    const res = await makeRequest({ path: '/data/refresh_tokens.json', method: 'GET' });
    assert.strictEqual(res.statusCode, 403, `Expected 403, got ${res.statusCode}`);
  });

  await test('Blocks direct access to /server.js source code (HTTP 403 Forbidden)', async () => {
    const res = await makeRequest({ path: '/server.js', method: 'GET' });
    assert.strictEqual(res.statusCode, 403, `Expected 403, got ${res.statusCode}`);
  });

  await test('Blocks direct access to /package.json (HTTP 403 Forbidden)', async () => {
    const res = await makeRequest({ path: '/package.json', method: 'GET' });
    assert.strictEqual(res.statusCode, 403, `Expected 403, got ${res.statusCode}`);
  });

  await test('Allows legitimate web asset /index.html (HTTP 200 OK)', async () => {
    const res = await makeRequest({ path: '/index.html', method: 'GET' });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.includes('<!DOCTYPE html>'), 'Body should contain HTML');
  });

  await test('Allows legitimate web asset /manifest.json (HTTP 200 OK)', async () => {
    const res = await makeRequest({ path: '/manifest.json', method: 'GET' });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  });

  // 2. Personal Library Sync Authorization Tests (FND-SEC-03)
  console.log('\n🔹 [SUITE] 2. Personal Library Authorization & BOLA Prevention');

  await test('Rejects unauthenticated POST /api/user/library with username (HTTP 401)', async () => {
    const res = await makeRequest({
      path: '/api/user/library',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'testuser', tracks: [] });
    assert.strictEqual(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);
  });

  await test('Rejects unauthenticated GET /api/user/library?username=test (HTTP 401)', async () => {
    const res = await makeRequest({ path: '/api/user/library?username=testuser', method: 'GET' });
    assert.strictEqual(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);
  });

  // 3. Operational Rate Limit Reset Protection (FND-SEC-04)
  console.log('\n🔹 [SUITE] 3. Operational Security & Rate Limit Endpoint Protection');

  await test('Rejects unauthenticated POST /api/security/reset-rate-limit (HTTP 403)', async () => {
    const res = await makeRequest({ path: '/api/security/reset-rate-limit', method: 'POST' });
    assert.strictEqual(res.statusCode, 403, `Expected 403, got ${res.statusCode}`);
  });

  await test('Accepts POST /api/security/reset-rate-limit with valid ADMIN_KEY (HTTP 200)', async () => {
    const res = await makeRequest({
      path: '/api/security/reset-rate-limit',
      method: 'POST',
      headers: { 'Authorization': 'Bearer test_admin_key_123' }
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
  });

  // 4. Custom Playlist Sanitization & Stored XSS Prevention (FND-SEC-02)
  console.log('\n🔹 [SUITE] 4. Custom Playlist Sanitization & XSS Prevention');

  await test('Sanitizes HTML/script tags from playlist title on creation', async () => {
    const res = await makeRequest({
      path: '/api/user/playlists',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      action: 'create',
      title: '<script>alert(1)</script>Rock Hits',
      description: '<b>Best</b> rock'
    });
    assert.strictEqual(res.statusCode, 201, `Expected 201, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.success);
    assert.strictEqual(json.playlist.title, 'scriptalert(1)/scriptRock Hits', 'HTML angle brackets must be stripped');
    assert.strictEqual(json.playlist.description, 'bBest/b rock');
  });

  // 5. CSV Formula Injection Neutralization (FND-SEC-08)
  console.log('\n🔹 [SUITE] 5. Feedback Export & CSV Formula Neutralization');

  await test('Submits feedback containing formula prefix (=, +, @)', async () => {
    const res = await makeRequest({
      path: '/api/feedback',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: '=SUM(1+1)',
      detail: '@CMD|calc!A0',
      category: '+Bug'
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  });

  await test('Exports CSV with formula trigger characters prefixed with single quote', async () => {
    const res = await makeRequest({ path: '/api/feedback/export.csv', method: 'GET' });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    // Check that "=SUM(1+1)" is escaped as "'=SUM(1+1)"
    assert(res.body.includes("\"'=SUM(1+1)\""), 'Formula = must be prefixed with single quote');
    assert(res.body.includes("\"'@CMD|calc!A0\""), 'Formula @ must be prefixed with single quote');
    assert(res.body.includes("\"'+Bug\""), 'Formula + must be prefixed with single quote');
  });

  // 6. User Authentication, Registration & Session Lifecycle
  console.log('\n🔹 [SUITE] 6. End-to-End User Authentication & Feature Flow');

  const testUsername = `user_${Date.now().toString(36)}`;
  let authToken = null;

  await test('Registers new user account successfully', async () => {
    const res = await makeRequest({
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      username: testUsername,
      password: 'StrongPassword123!',
      library: [{ id: 'track-1', name: 'Test Song' }]
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
    assert(json.token, 'Should receive session token');
    authToken = json.token;
  });

  await test('Logs in with registered user credentials', async () => {
    const res = await makeRequest({
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      username: testUsername,
      password: 'StrongPassword123!'
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
    assert(json.token);
    authToken = json.token;
  });

  await test('Fetches authenticated user profile via /api/auth/me', async () => {
    const res = await makeRequest({
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.user.username, testUsername);
  });

  await test('Syncs user library with authenticated session token', async () => {
    const res = await makeRequest({
      path: '/api/user/library',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    }, {
      tracks: [
        { id: 'track-101', name: 'Saved Song 1' },
        { id: 'track-102', name: 'Saved Song 2' }
      ]
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.count, 2);
  });

  await test('Retrieves saved library with authenticated session token', async () => {
    const res = await makeRequest({
      path: '/api/user/library',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.username, testUsername);
    assert.strictEqual(json.tracks.length, 2);
    assert.strictEqual(json.tracks[0].name, 'Saved Song 1');
  });

  await test('Logs out and verifies token revocation', async () => {
    const res = await makeRequest({
      path: '/api/auth/logout',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);

    // Verify token is revoked
    const checkRes = await makeRequest({
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.strictEqual(checkRes.statusCode, 401, 'Revoked token must return 401');
  });

  // 7. Stream Lease Single Active Device State Machine
  console.log('\n🔹 [SUITE] 7. Single Active Stream Lease State Machine');

  await test('Claims and heartbeats single active stream lease', async () => {
    // Re-login to get fresh token
    const loginRes = await makeRequest({
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: testUsername, password: 'StrongPassword123!' });
    const freshToken = JSON.parse(loginRes.body).token;

    // Claim lease on Device A
    const claimRes = await makeRequest({
      path: '/api/v1/stream/lease/claim',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${freshToken}`
      }
    }, { deviceId: 'device_a', deviceName: 'Laptop Chrome' });
    assert.strictEqual(claimRes.statusCode, 200);
    assert.strictEqual(JSON.parse(claimRes.body).status, 'granted');

    // Heartbeat lease on Device A
    const hbRes = await makeRequest({
      path: '/api/v1/stream/lease/heartbeat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${freshToken}`
      }
    }, { deviceId: 'device_a' });
    assert.strictEqual(hbRes.statusCode, 200);
    assert.strictEqual(JSON.parse(hbRes.body).leaseValid, true);

    // Device B attempts to claim -> conflict displacement (409)
    const conflictRes = await makeRequest({
      path: '/api/v1/stream/lease/claim',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${freshToken}`
      }
    }, { deviceId: 'device_b', deviceName: 'Mobile Pixel' });
    assert.strictEqual(conflictRes.statusCode, 409, 'Should return 409 conflict when another device holds lease');

    // Release lease on Device A
    const relRes = await makeRequest({
      path: '/api/v1/stream/lease/release',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${freshToken}`
      }
    }, { deviceId: 'device_a' });
    assert.strictEqual(relRes.statusCode, 200);

    // Device B can now claim lease
    const claimBRes = await makeRequest({
      path: '/api/v1/stream/lease/claim',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${freshToken}`
      }
    }, { deviceId: 'device_b', deviceName: 'Mobile Pixel' });
    assert.strictEqual(claimBRes.statusCode, 200);
    assert.strictEqual(JSON.parse(claimBRes.body).status, 'granted');
  });

  console.log('\n===============================================================');
  console.log('📊 SECURITY & FEATURE SUITE EXECUTION SUMMARY:');
  console.log(`   Total Tests:  ${total}`);
  console.log(`   Passed:       ${passed}`);
  console.log(`   Failed:       ${total - passed}`);
  console.log(`   Success Rate: ${Math.round((passed / total) * 100)}%`);
  console.log('===============================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

// Start test execution
runSecuritySuite()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error('Fatal test error:', e);
    process.exit(1);
  });
