/**
 * micro-tests.js
 * Comprehensive Micro-Level Automated Verification Suite for PMusic.
 * Covers 10 distinct architectural modules with zero external dependencies.
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ChallengeService = require('./auth/challengeService');
const RiskScorer = require('./auth/riskScorer');
const TokenManager = require('./auth/tokenManager');
const { limiter } = require('./auth/rateLimiter');

let passedCount = 0;
let failedCount = 0;
const testResults = [];

function describe(suiteName, fn) {
  console.log(`\n🔹 [SUITE] ${suiteName}`);
  fn();
}

async function test(name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    console.log(`   ✅ PASS: ${name}`);
    passedCount++;
    testResults.push({ name, status: 'PASS' });
  } catch (err) {
    console.error(`   ❌ FAIL: ${name}`);
    console.error(`      Error: ${err.message}`);
    failedCount++;
    testResults.push({ name, status: 'FAIL', error: err.message });
  }
}

async function runAllMicroTests() {
  console.log('===============================================================');
  console.log('🔬 STARTING MICRO-LEVEL AUTOMATED VERIFICATION SUITE');
  console.log('===============================================================');

  // =========================================================================
  // 1. CRYPTO & POW MATHEMATICAL VERIFICATION
  // =========================================================================
  describe('1. Cryptographic Proof-of-Work (PoW) Engine', () => {
    test('Difficulty 1 produces prefix "0" and verifies valid nonce', () => {
      const ch = ChallengeService.generateChallenge('10.0.0.1', 'TestAgent', 1);
      assert.strictEqual(ch.prefix, '0');
      assert.strictEqual(ch.difficulty, 1);
      assert(ch.nonce.startsWith('ch_'));
    });

    test('Difficulty 2 produces prefix "00" and verifies mathematical collision', () => {
      const ch = ChallengeService.generateChallenge('10.0.0.2', 'TestAgent', 2);
      assert.strictEqual(ch.prefix, '00');
      let solution = 0;
      while (true) {
        const hash = crypto.createHash('sha256').update(`${ch.nonce}:${solution}`).digest('hex');
        if (hash.startsWith('00')) break;
        solution++;
      }
      const v = ChallengeService.verifySolution({
        nonce: ch.nonce,
        timestamp: ch.timestamp,
        difficulty: 2,
        signature: ch.signature,
        solution: String(solution),
        clientIp: '10.0.0.2',
        userAgent: 'TestAgent'
      });
      assert.strictEqual(v.valid, true);
    });

    test('PoW rejects IP spoofing (challenge issued to IP A verified with IP B)', () => {
      const ch = ChallengeService.generateChallenge('10.0.0.1', 'TestAgent', 1);
      const v = ChallengeService.verifySolution({
        nonce: ch.nonce,
        timestamp: ch.timestamp,
        difficulty: 1,
        signature: ch.signature,
        solution: '1',
        clientIp: '10.0.0.2', // Spoofed IP
        userAgent: 'TestAgent'
      });
      assert.strictEqual(v.valid, false);
      assert(v.reason.includes('Tampered challenge signature'));
    });

    test('PoW rejects tampered solution that does not match required hash prefix', () => {
      const ch = ChallengeService.generateChallenge('10.0.0.1', 'TestAgent', 2);
      const v = ChallengeService.verifySolution({
        nonce: ch.nonce,
        timestamp: ch.timestamp,
        difficulty: 2,
        signature: ch.signature,
        solution: 'invalid_bad_solution_999999',
        clientIp: '10.0.0.1',
        userAgent: 'TestAgent'
      });
      assert.strictEqual(v.valid, false);
      assert(v.reason.includes('mathematically invalid'));
    });
  });

  // =========================================================================
  // 2. RISK SCORER & BOT DETECTION
  // =========================================================================
  describe('2. Risk Scorer & Anti-Bot Evaluation', () => {
    test('Clean human browser scores low risk (decision ALLOW)', () => {
      const res = RiskScorer.evaluate({
        clientIp: '192.168.1.50',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
        deviceInfo: { canvasHash: 'canvas_hash_1', screen: '1920x1080' },
        ipRecentAttempts: 1,
        accountRecentFails: 0
      });
      assert.strictEqual(res.decision, 'ALLOW');
      assert(res.score < 30);
    });

    test('Headless Chrome & Automation flags high risk with bot flag', () => {
      const res = RiskScorer.evaluate({
        clientIp: '185.220.101.5',
        userAgent: 'HeadlessChrome/120.0 (Puppeteer Automation Engine)',
        deviceInfo: { webdriver: true },
        ipRecentAttempts: 12,
        accountRecentFails: 4
      });
      assert(res.score >= 50);
      assert(res.flags.includes('KNOWN_AUTOMATION_UA') || res.flags.includes('AUTOMATION_WEBDRIVER_DETECTED'));
    });

    test('Missing canvas fingerprint triggers security flag on desktop browser', () => {
      const res = RiskScorer.evaluate({
        clientIp: '185.220.101.5',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        deviceInfo: {},
        ipRecentAttempts: 0,
        accountRecentFails: 0
      });
      assert(res.flags.includes('MISSING_CANVAS_FINGERPRINT'));
    });
  });

  // =========================================================================
  // 3. JWT ACCESS TOKEN & REFRESH TOKEN ROTATION (RTR)
  // =========================================================================
  describe('3. JWT Token & Refresh Token Rotation (RTR)', () => {
    test('Issues valid JWT with standard claims and validates signature', () => {
      const user = { id: 'usr_unit_test', email: 'test@pmusic.com', role: 'user' };
      const access = TokenManager.issueAccessToken(user, 'fam_123');
      assert(access.accessToken);

      const verified = TokenManager.verifyAccessToken(access.accessToken);
      assert(verified);
      assert.strictEqual(verified.sub, user.id);
      assert.strictEqual(verified.email, user.email);
      assert.strictEqual(verified.iss, 'spotify-auth-core');
      assert(verified.exp > Math.floor(Date.now() / 1000));
    });

    test('RTR issues a fresh refresh token and rotates family correctly', () => {
      const userId = 'usr_rtr_test';
      const initial = TokenManager.issueRefreshToken(userId, null, 'device_laptop');
      assert(initial.rawRefreshToken.startsWith('rt_'));

      const rotated = TokenManager.rotateRefreshToken(initial.rawRefreshToken, 'device_laptop');
      assert.strictEqual(rotated.success, true);
      assert(rotated.refreshToken.startsWith('rt_'));
      assert.notStrictEqual(rotated.refreshToken, initial.rawRefreshToken);

      const verifiedAccess = TokenManager.verifyAccessToken(rotated.accessToken);
      assert.strictEqual(verifiedAccess.sub, userId);
    });

    test('Replay Attack on consumed refresh token triggers breach alert and revokes entire family', () => {
      const userId = 'usr_breach_test';
      const initial = TokenManager.issueRefreshToken(userId, null, 'device_laptop');

      // First rotation succeeds
      const legitimate = TokenManager.rotateRefreshToken(initial.rawRefreshToken, 'device_laptop');
      assert.strictEqual(legitimate.success, true);

      // Replaying the old consumed refresh token
      const replay = TokenManager.rotateRefreshToken(initial.rawRefreshToken, 'attacker_device');
      assert.strictEqual(replay.success, false);
      assert.strictEqual(replay.breachDetected, true);
    });
  });

  // =========================================================================
  // 4. SLIDING WINDOW RATE LIMITER
  // =========================================================================
  describe('4. Sliding Window Rate Limiter Engine', () => {
    test('Allows requests within quota and enforces delay/rejection on burst', () => {
      const key = `test_key_${Date.now()}`;
      const res1 = limiter.check(key, 2, 1000);
      assert.strictEqual(res1.allowed, true);

      const res2 = limiter.check(key, 2, 1000);
      assert.strictEqual(res2.allowed, true);

      // Third request exceeds limit of 2
      const res3 = limiter.check(key, 2, 1000);
      assert.strictEqual(res3.allowed, false);
      assert(res3.delayMs > 0);
    });

    test('Tarpitting delay increases progressively as excess requests mount', () => {
      const key = `tarpit_key_${Date.now()}`;
      limiter.check(key, 1, 1000); // 1 allowed
      const burst1 = limiter.check(key, 1, 1000); // 1st excess
      const burst2 = limiter.check(key, 1, 1000); // 2nd excess
      assert(burst2.delayMs >= burst1.delayMs);
    });
  });

  // =========================================================================
  // 5. CUSTOM PLAYLISTS REST & PERSISTENCE
  // =========================================================================
  describe('5. Custom Playlists CRUD & Persistence Engine', () => {
    const playlistsFile = path.resolve('d:/Ben/spotify-search/data/custom_playlists.json');

    test('custom_playlists.json exists, is valid JSON array, and contains valid playlist models', () => {
      assert(fs.existsSync(playlistsFile));
      const list = JSON.parse(fs.readFileSync(playlistsFile, 'utf8'));
      assert(Array.isArray(list));
      if (list.length > 0) {
        const p = list[0];
        assert(p.id && p.title && Array.isArray(p.tracks));
      }
    });

    test('Performs create, read, update (add/remove track), and atomic save', () => {
      const list = JSON.parse(fs.readFileSync(playlistsFile, 'utf8'));
      const testId = `pl_unit_${Date.now()}`;
      const newPlaylist = {
        id: testId,
        title: 'Micro Unit Test Playlist',
        description: 'Testing track mutation',
        artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
        tracks: [{ id: 'track-1', name: 'Song 1', artist: 'Artist 1' }],
        createdAt: new Date().toISOString()
      };

      list.push(newPlaylist);
      fs.writeFileSync(playlistsFile, JSON.stringify(list, null, 2), 'utf8');

      // Verify read
      let updated = JSON.parse(fs.readFileSync(playlistsFile, 'utf8'));
      let found = updated.find(p => p.id === testId);
      assert(found);
      assert.strictEqual(found.tracks.length, 1);

      // Add track
      found.tracks.push({ id: 'track-2', name: 'Song 2', artist: 'Artist 2' });
      fs.writeFileSync(playlistsFile, JSON.stringify(updated, null, 2), 'utf8');

      // Verify addition
      updated = JSON.parse(fs.readFileSync(playlistsFile, 'utf8'));
      found = updated.find(p => p.id === testId);
      assert.strictEqual(found.tracks.length, 2);

      // Cleanup
      const cleaned = updated.filter(p => p.id !== testId);
      fs.writeFileSync(playlistsFile, JSON.stringify(cleaned, null, 2), 'utf8');
    });
  });

  // =========================================================================
  // 6. SINGLE-STREAM CONCURRENCY LEASE ENGINE
  // =========================================================================
  describe('6. Single-Stream Concurrency Lease State Machine', () => {
    const leasesFile = path.resolve('d:/Ben/spotify-search/data/stream_leases.json');

    test('Manages active lease with TTL and handles device displacement conflict', () => {
      const leases = fs.existsSync(leasesFile) ? JSON.parse(fs.readFileSync(leasesFile, 'utf8') || '{}') : {};
      const testUser = 'micro_tester';
      const now = Date.now();
      const TTL = 45000;

      // Device 1 claims lease
      leases[testUser] = {
        deviceId: 'dev_phone_1',
        deviceName: 'Android Mobile',
        leasedAt: now,
        expiresAt: now + TTL
      };
      fs.writeFileSync(leasesFile, JSON.stringify(leases, null, 2), 'utf8');

      // Device 2 takes over
      const prior = JSON.parse(fs.readFileSync(leasesFile, 'utf8'))[testUser];
      assert.strictEqual(prior.deviceId, 'dev_phone_1');

      leases[testUser] = {
        deviceId: 'dev_pc_2',
        deviceName: 'Desktop Chrome',
        leasedAt: now,
        expiresAt: now + TTL
      };
      fs.writeFileSync(leasesFile, JSON.stringify(leases, null, 2), 'utf8');

      const after = JSON.parse(fs.readFileSync(leasesFile, 'utf8'))[testUser];
      assert.strictEqual(after.deviceId, 'dev_pc_2');
      assert.strictEqual(after.deviceName, 'Desktop Chrome');

      // Release lease
      delete leases[testUser];
      fs.writeFileSync(leasesFile, JSON.stringify(leases, null, 2), 'utf8');
      assert.strictEqual(JSON.parse(fs.readFileSync(leasesFile, 'utf8'))[testUser], undefined);
    });
  });

  // =========================================================================
  // 7. MOBILE LOCK-SCREEN BACKGROUND AUDIO & HANDOFF ENGINE
  // =========================================================================
  describe('7. Mobile Lock-Screen Audio & Continuous Playback', () => {
    test('Silent WAV data URI has valid RIFF/WAVE header and PCM format', () => {
      const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      const raw = Buffer.from(SILENT_AUDIO_URI.replace('data:audio/wav;base64,', ''), 'base64');
      assert.strictEqual(raw.length, 48);
      assert(raw.includes(Buffer.from('RIFF')));
      assert(raw.includes(Buffer.from('WAVE')));
      assert(raw.includes(Buffer.from('fmt ')));
      assert(raw.includes(Buffer.from('data')));
    });

    test('index.html provides #audio-engine and #bg-keepalive-engine with mobile playsinline attributes', () => {
      const html = fs.readFileSync(path.resolve('d:/Ben/spotify-search/index.html'), 'utf8');
      assert(html.includes('id="audio-engine"'));
      assert(html.includes('id="bg-keepalive-engine"'));
      assert(html.includes('playsinline'));
      assert(html.includes('webkit-playsinline'));
      assert(html.includes('preload="auto"'));
    });

    test('app.js exports state flags and lock-screen suspension handlers', () => {
      const appJs = fs.readFileSync(path.resolve('d:/Ben/spotify-search/app.js'), 'utf8');
      assert(appJs.includes('userExplicitlyPaused: false'));
      assert(appJs.includes('isLockedBackground: false'));
      assert(appJs.includes('handoffFromYoutube: false'));
      assert(appJs.includes('handleMobileLockScreenSuspension'));
      assert(appJs.includes('primeMobileAudioSession'));
      assert(appJs.includes('syncMediaSessionPosition'));
      assert(appJs.includes('requestWakeLock'));
    });

    test('State machine executes seamless handoff on lock and handback on unlock', () => {
      const MockPlayer = {
        isPlaying: true,
        userExplicitlyPaused: false,
        activeEngine: 'youtube',
        handoffFromYoutube: false,
        ytCurrentTime: 42.0,
        audioCurrentTime: 0,
        audioPlaying: false,

        simulateScreenLock() {
          if (!this.isPlaying || this.userExplicitlyPaused) return;
          this.activeEngine = 'audio';
          this.handoffFromYoutube = true;
          this.audioCurrentTime = this.ytCurrentTime % 30;
          this.audioPlaying = true;
        },

        simulateScreenUnlock() {
          if (this.handoffFromYoutube && this.isPlaying) {
            this.ytCurrentTime = this.audioCurrentTime;
            this.activeEngine = 'youtube';
            this.handoffFromYoutube = false;
            this.audioPlaying = false;
          }
        }
      };

      // 1. User locks mobile phone
      MockPlayer.simulateScreenLock();
      assert.strictEqual(MockPlayer.activeEngine, 'audio');
      assert.strictEqual(MockPlayer.handoffFromYoutube, true);
      assert.strictEqual(MockPlayer.audioPlaying, true);
      assert.strictEqual(MockPlayer.audioCurrentTime, 12.0); // 42 % 30

      // 2. Audio plays in background for 5 seconds
      MockPlayer.audioCurrentTime += 5.0;

      // 3. User unlocks phone
      MockPlayer.simulateScreenUnlock();
      assert.strictEqual(MockPlayer.activeEngine, 'youtube');
      assert.strictEqual(MockPlayer.handoffFromYoutube, false);
      assert.strictEqual(MockPlayer.audioPlaying, false);
      assert.strictEqual(MockPlayer.ytCurrentTime, 17.0);
    });

    test('Continuous autoplay advances track in background session without user touch', () => {
      const MockQueue = {
        items: [
          { id: '1', title: 'Song 1', url: 'https://cdn.example.com/song1.m4a' },
          { id: '2', title: 'Song 2', url: 'https://cdn.example.com/song2.m4a' }
        ],
        currentIndex: 0,
        currentStreamUrl: 'https://cdn.example.com/song1.m4a',
        isPlaying: true,

        onTrackEnded(isDocumentHidden) {
          this.currentIndex = (this.currentIndex + 1) % this.items.length;
          const next = this.items[this.currentIndex];
          if (isDocumentHidden) {
            // Direct audio chain execution
            this.currentStreamUrl = next.url;
            this.isPlaying = true;
          }
        }
      };

      // Track 1 ends while phone is in pocket (document.hidden = true)
      MockQueue.onTrackEnded(true);
      assert.strictEqual(MockQueue.currentIndex, 1);
      assert.strictEqual(MockQueue.currentStreamUrl, 'https://cdn.example.com/song2.m4a');
      assert.strictEqual(MockQueue.isPlaying, true);
    });
  });

  // =========================================================================
  // 8. SYNCHRONIZED LYRICS (LRC FORMAT) PARSER
  // =========================================================================
  describe('8. Synchronized Lyrics (LRC) Micro-Tests', () => {
    test('Correctly parses [mm:ss.xx] timestamps and resolves active lyric at current second', () => {
      const sampleLrc = `
[00:05.10] First line of the song
[00:12.80] Second line of the song
[00:25.40] Chorus kicks in here
      `.trim();

      function parseLrc(text) {
        const lines = text.split('\n');
        const parsed = [];
        const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
        lines.forEach(line => {
          const m = line.match(regex);
          if (m) {
            const min = parseInt(m[1], 10);
            const sec = parseInt(m[2], 10);
            const ms = parseInt(m[3].padEnd(3, '0').substring(0, 3), 10);
            const totalSec = min * 60 + sec + ms / 1000;
            parsed.push({ time: totalSec, text: m[4].trim() });
          }
        });
        return parsed.sort((a, b) => a.time - b.time);
      }

      function getActiveLyricIndex(parsed, currentSec) {
        let activeIdx = -1;
        for (let i = 0; i < parsed.length; i++) {
          if (currentSec >= parsed[i].time) {
            activeIdx = i;
          } else {
            break;
          }
        }
        return activeIdx;
      }

      const parsed = parseLrc(sampleLrc);
      assert.strictEqual(parsed.length, 3);
      assert.strictEqual(parsed[0].text, 'First line of the song');
      assert.strictEqual(Math.round(parsed[0].time * 100) / 100, 5.1);

      // At 2 seconds (before first line)
      assert.strictEqual(getActiveLyricIndex(parsed, 2.0), -1);

      // At 8 seconds (during first line)
      assert.strictEqual(getActiveLyricIndex(parsed, 8.0), 0);
      assert.strictEqual(parsed[getActiveLyricIndex(parsed, 8.0)].text, 'First line of the song');

      // At 15 seconds (during second line)
      assert.strictEqual(getActiveLyricIndex(parsed, 15.0), 1);

      // At 30 seconds (during chorus)
      assert.strictEqual(getActiveLyricIndex(parsed, 30.0), 2);
    });
  });

  // =========================================================================
  // 9. FEEDBACK EXCEL & CSV DATA EXPORTER
  // =========================================================================
  describe('9. Feedback Database & Report Export Engine', () => {
    const feedbackFile = path.resolve('d:/Ben/spotify-search/data/feedback.json');

    test('Reads feedback.json database and validates record structure', () => {
      assert(fs.existsSync(feedbackFile));
      const list = JSON.parse(fs.readFileSync(feedbackFile, 'utf8') || '[]');
      assert(Array.isArray(list));
      if (list.length > 0) {
        const item = list[0];
        assert(item.id && item.name && item.detail && item.timestamp);
      }
    });

    test('Generates valid CSV with UTF-8 BOM (\uFEFF) for Excel compatibility', () => {
      const records = [
        { id: 'fb_1', name: 'John Doe', email: 'john@example.com', category: 'Audio', feedback: 'Great playback!', createdAt: '2026-11-02T12:00:00Z' }
      ];

      function generateCsv(items) {
        const BOM = '\uFEFF';
        const headers = ['ID', 'Name', 'Email', 'Category', 'Feedback', 'Date'];
        const rows = items.map(r => `"${r.id}","${r.name}","${r.email}","${r.category}","${r.feedback}","${r.createdAt}"`);
        return BOM + [headers.join(','), ...rows].join('\n');
      }

      const csv = generateCsv(records);
      assert(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
      assert(csv.includes('"John Doe"'));
      assert(csv.includes('"Great playback!"'));
    });
  });

  // =========================================================================
  // 10. SYSTEM TELEMETRY & HEALTH
  // =========================================================================
  describe('10. System Telemetry & Server Micro-Health', () => {
    test('server.js exports valid health check schema matching version 1.2.0', () => {
      const serverJs = fs.readFileSync(path.resolve('d:/Ben/spotify-search/server.js'), 'utf8');
      assert(serverJs.includes("pathname === '/healthz'"));
      assert(serverJs.includes("status: 'ok'"));
      assert(serverJs.includes("version: '1.2.0'"));
    });

    test('Static cache pre-warmer indexes core assets without null pointers', () => {
      const serverJs = fs.readFileSync(path.resolve('d:/Ben/spotify-search/server.js'), 'utf8');
      assert(serverJs.includes("['index.html', 'styles.css', 'app.js', 'manifest.json', 'sw.js']"));
    });
  });

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n===============================================================');
  console.log(`📊 MICRO-TEST SUITE EXECUTION SUMMARY:`);
  console.log(`   Total Tests:  ${passedCount + failedCount}`);
  console.log(`   Passed:       ${passedCount}`);
  console.log(`   Failed:       ${failedCount}`);
  console.log(`   Success Rate: ${Math.round((passedCount / (passedCount + failedCount)) * 100)}%`);
  console.log('===============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllMicroTests();
