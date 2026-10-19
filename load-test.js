/**
 * load-test.js
 * k6 load test script to simulate 1,000,000 users hitting the authentication cluster.
 * Run with: k6 run load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import crypto from 'k6/crypto';

// 1. Test Configuration (Simulates a massive traffic spike)
export const options = {
  scenarios: {
    // 85% Legitimate Users: Complete 3-step handshake + Proof of Work
    legitimate_users: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        { duration: '1m', target: 2000 },  // Ramp to 2,000 VUs
        { duration: '2m', target: 10000 }, // Spike to 10,000 concurrent VUs
        { duration: '2m', target: 10000 }, // Sustain peak load
        { duration: '1m', target: 0 },     // Ramp down
      ],
      gracefulRampDown: '30s',
      exec: 'legitimateLoginScenario',
    },
    // 10% Credential Stuffing Bots: High rate, fail PoW or use leaked dumps
    credential_stuffing_bots: {
      executor: 'constant-arrival-rate',
      rate: 500, // 500 iterations per second
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 500,
      maxVUs: 2000,
      exec: 'stuffingBotScenario',
    },
    // 5% Aggressive Brute Force: Hammer endpoints without handshake
    brute_force_bots: {
      executor: 'constant-arrival-rate',
      rate: 300,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 300,
      maxVUs: 1000,
      exec: 'bruteForceScenario',
    },
  },
  thresholds: {
    // Target Service Level Objectives (SLOs)
    'http_req_duration{scenario:legitimate_users}': ['p(95)<250', 'p(99)<500'],
    'http_req_failed{scenario:legitimate_users}': ['rate<0.01'], // < 1% error rate for legit users
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3456';

/**
 * Solve Proof of Work puzzle in k6
 */
function solvePoW(nonce, difficulty) {
  const targetPrefix = '0'.repeat(difficulty);
  let solution = 0;
  while (solution < 100000) {
    const candidate = `${nonce}:${solution}`;
    const hash = crypto.sha256(candidate, 'hex');
    if (hash.startsWith(targetPrefix)) {
      return solution.toString();
    }
    solution++;
  }
  return '0';
}

/**
 * Scenario A: Legitimate User 3-Step Handshake
 */
export function legitimateLoginScenario() {
  const userId = Math.floor(Math.random() * 1000000);
  const email = `user_${userId}@spotify-clone.com`;
  const password = 'password123';

  // STEP 1: Request Challenge
  const challengeRes = http.post(`${BASE_URL}/api/v1/auth/challenge`, JSON.stringify({}), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(challengeRes, {
    'challenge status is 200': (r) => r.status === 200,
    'has valid nonce': (r) => r.json('challenge.nonce') !== undefined,
  });

  if (challengeRes.status !== 200) return;

  const challenge = challengeRes.json('challenge');
  const startTime = Date.now();

  // STEP 2: Compute PoW
  const powSolution = solvePoW(challenge.nonce, challenge.difficulty);
  const powDurationMs = Date.now() - startTime;

  // STEP 3: Submit Solution & Authenticate
  const loginPayload = JSON.stringify({
    email,
    password,
    challenge,
    powSolution,
    powDurationMs,
    deviceInfo: {
      deviceId: `device_${userId}`,
      platform: 'WebPlayer',
      canvasHash: 'a89f92b7c'
    }
  });

  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'has access token': (r) => r.json('tokens.accessToken') !== undefined,
  });

  sleep(Math.random() * 2 + 1); // User browses tracks
}

/**
 * Scenario B: Credential Stuffing Bot
 */
export function stuffingBotScenario() {
  const randomEmail = `target_${Math.floor(Math.random() * 50000)}@gmail.com`;
  const leakedPassword = 'leakedPassword123';

  // Bot attempts to bypass challenge or sends fake nonce
  const payload = JSON.stringify({
    email: randomEmail,
    password: leakedPassword,
    challenge: { nonce: 'fake_nonce_123', signature: 'bad_sig' },
    powSolution: '9999'
  });

  const res = http.post(`${BASE_URL}/api/v1/auth/login`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'python-requests/2.28.1' // Signature of common stuffing script
    },
  });

  check(res, {
    'bot is rejected (403 or 429)': (r) => r.status === 403 || r.status === 429,
  });
}

/**
 * Scenario C: High-Velocity Brute Force
 */
export function bruteForceScenario() {
  const targetEmail = 'admin@spotify-clone.com';
  const guessedPassword = `guess_${Math.floor(Math.random() * 1000)}`;

  const res = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    email: targetEmail,
    password: guessedPassword
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'blocked or challenged': (r) => r.status === 400 || r.status === 403 || r.status === 429,
  });
}
