/**
 * challengeService.js
 * Cryptographic challenge and Proof-of-Work (PoW) verification engine.
 * Asymmetric computation: Trivial for server to verify (~0.05ms),
 * but requires deterministic CPU effort from the client (50-200ms),
 * neutralizing distributed automated botnets.
 */

const crypto = require('crypto');

const CHALLENGE_SECRET = process.env.CHALLENGE_HMAC_SECRET || 'dev-challenge-secret-key-32-bytes-long!';
const CHALLENGE_TTL_MS = 60 * 1000; // 60 seconds validity
const activeNonces = new Map(); // In production, backed by Redis: `SET challenge:{nonce} 1 EX 60`

/**
 * Clean up expired nonces from in-memory cache periodically.
 */
setInterval(() => {
  const now = Date.now();
  for (const [nonce, data] of activeNonces.entries()) {
    if (now > data.expiresAt) {
      activeNonces.delete(nonce);
    }
  }
}, 30000).unref();

class ChallengeService {
  /**
   * Generates a signed cryptographic challenge with a PoW target.
   * @param {string} clientIp 
   * @param {string} userAgent 
   * @param {number} difficulty Leading zero hex characters required (default: 3 for ~100-300 hashes)
   */
  static generateChallenge(clientIp, userAgent, difficulty = 3) {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const nonce = `ch_${timestamp}_${randomBytes}`;
    
    // Create an HMAC signature tying nonce, IP, UA, and timestamp
    const signaturePayload = `${nonce}:${timestamp}:${difficulty}:${clientIp}:${userAgent}`;
    const hmac = crypto.createHmac('sha256', CHALLENGE_SECRET)
      .update(signaturePayload)
      .digest('hex');

    const challenge = {
      nonce,
      timestamp,
      difficulty,
      prefix: '0'.repeat(difficulty),
      signature: hmac,
      expiresAt: timestamp + CHALLENGE_TTL_MS
    };

    // Store in active cache to ensure single-use (replay attack prevention)
    activeNonces.set(nonce, {
      expiresAt: challenge.expiresAt,
      used: false,
      clientIp
    });

    return challenge;
  }

  /**
   * Verifies the client's submitted solution.
   * @param {Object} submission { nonce, timestamp, difficulty, signature, solution, clientIp, userAgent }
   * @returns {{ valid: boolean, reason?: string }}
   */
  static verifySolution({ nonce, timestamp, difficulty, signature, solution, clientIp, userAgent }) {
    const now = Date.now();

    // 1. Check expiration
    if (now - timestamp > CHALLENGE_TTL_MS) {
      return { valid: false, reason: 'Challenge expired. Please refresh challenge.' };
    }

    // 2. Verify HMAC integrity
    const expectedPayload = `${nonce}:${timestamp}:${difficulty}:${clientIp}:${userAgent}`;
    const expectedHmac = crypto.createHmac('sha256', CHALLENGE_SECRET)
      .update(expectedPayload)
      .digest('hex');

    try {
      const match = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedHmac, 'hex')
      );
      if (!match) {
        return { valid: false, reason: 'Tampered challenge signature.' };
      }
    } catch {
      return { valid: false, reason: 'Invalid signature encoding.' };
    }

    // 3. Prevent replay attacks (Stateless signed nonce with consumed tracking)
    if (activeNonces.has(nonce) && activeNonces.get(nonce).used) {
      return { valid: false, reason: 'Challenge nonce already consumed.' };
    }
    // Mark nonce as consumed
    activeNonces.set(nonce, { used: true, expiresAt: timestamp + CHALLENGE_TTL_MS });

    // 4. Verify Proof of Work (Hash must begin with required leading zeros)
    const requiredPrefix = '0'.repeat(difficulty);
    const candidateHash = crypto.createHash('sha256')
      .update(`${nonce}:${solution}`)
      .digest('hex');

    if (!candidateHash.startsWith(requiredPrefix)) {
      return { valid: false, reason: 'Proof of work solution is mathematically invalid.' };
    }

    return { valid: true };
  }
}

module.exports = ChallengeService;
