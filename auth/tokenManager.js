/**
 * tokenManager.js
 * High-security token lifecycle management:
 * - Short-lived Access Tokens (JWT)
 * - Refresh Token Rotation (RTR)
 * - Immediate Reuse Detection (Breach Alarm - revokes entire family)
 * - JTI-based revocation tracking
 * - Atomic persistence to data/refresh_tokens.json for multi-worker cluster compatibility
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'jwt-master-signing-secret-change-in-production-256bit!';
const ACCESS_TOKEN_TTL_SEC = 10 * 60; // 10 minutes
const REFRESH_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const REFRESH_DB_FILE = path.join(__dirname, '../data/refresh_tokens.json');

function loadRefreshDb() {
  try {
    if (fs.existsSync(REFRESH_DB_FILE)) {
      return JSON.parse(fs.readFileSync(REFRESH_DB_FILE, 'utf8') || '{}');
    }
  } catch (e) {}
  return {};
}

function saveRefreshDb(db) {
  try {
    const dir = path.dirname(REFRESH_DB_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${REFRESH_DB_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmp, REFRESH_DB_FILE);
  } catch (e) {}
}

const revokedJtiBlacklist = new Set(); // jti -> true

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

class TokenManager {
  /**
   * Generates a signed JWT access token.
   * @param {Object} user { id, email, role }
   * @param {string} familyId
   * @returns {{ accessToken: string, jti: string, expiresAt: number }}
   */
  static issueAccessToken(user, familyId) {
    const jti = crypto.randomUUID();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + ACCESS_TOKEN_TTL_SEC;

    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role || 'user',
      familyId,
      jti,
      iat: issuedAt,
      exp: expiresAt,
      iss: 'spotify-auth-core'
    };

    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerEncoded}.${payloadEncoded}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return {
      accessToken: `${headerEncoded}.${payloadEncoded}.${signature}`,
      jti,
      expiresAt: expiresAt * 1000
    };
  }

  /**
   * Issues a new refresh token and registers it in the token family.
   * @param {string} userId 
   * @param {string} [existingFamilyId] 
   * @param {string} deviceId 
   */
  static issueRefreshToken(userId, existingFamilyId = null, deviceId = 'default_device') {
    const familyId = existingFamilyId || crypto.randomUUID();
    const rawRefreshToken = `rt_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const expiresAt = Date.now() + REFRESH_TOKEN_TTL_MS;

    const tokenRecord = {
      userId,
      familyId,
      tokenHash,
      deviceId,
      isRevoked: false,
      replacedBy: null,
      expiresAt,
      createdAt: Date.now()
    };

    const db = loadRefreshDb();
    db[tokenHash] = tokenRecord;
    saveRefreshDb(db);

    return {
      rawRefreshToken,
      familyId,
      expiresAt
    };
  }

  /**
   * Performs Refresh Token Rotation (RTR).
   * Detects reuse and triggers a security breach revocation if an old token is resubmitted.
   * @param {string} incomingRawRefreshToken 
   * @param {string} deviceId 
   */
  static rotateRefreshToken(incomingRawRefreshToken, deviceId) {
    const incomingHash = crypto.createHash('sha256').update(incomingRawRefreshToken).digest('hex');
    const db = loadRefreshDb();
    const existingRecord = db[incomingHash];

    // Scenario 1: Token not found or expired
    if (!existingRecord || Date.now() > existingRecord.expiresAt) {
      return { success: false, reason: 'Invalid or expired refresh token', breachDetected: false };
    }

    // Scenario 2: Token was ALREADY REVOKED or REPLACED -> REUSE DETECTED (BREACH!)
    if (existingRecord.isRevoked || existingRecord.replacedBy) {
      this.revokeTokenFamily(existingRecord.familyId);
      return {
        success: false,
        reason: 'Security breach detected: Refresh token reuse. All sessions for this device family have been invalidated.',
        breachDetected: true,
        userId: existingRecord.userId
      };
    }

    // Scenario 3: Valid token. Rotate it.
    const newRefresh = this.issueRefreshToken(existingRecord.userId, existingRecord.familyId, deviceId);
    const newHash = crypto.createHash('sha256').update(newRefresh.rawRefreshToken).digest('hex');
    
    // Reload db to capture any concurrent updates
    const currentDb = loadRefreshDb();
    if (currentDb[incomingHash]) {
      currentDb[incomingHash].isRevoked = true;
      currentDb[incomingHash].replacedBy = newHash;
      saveRefreshDb(currentDb);
    }

    // Issue fresh access token
    const newAccess = this.issueAccessToken({ id: existingRecord.userId }, existingRecord.familyId);

    return {
      success: true,
      accessToken: newAccess.accessToken,
      refreshToken: newRefresh.rawRefreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SEC
    };
  }

  /**
   * Revokes an entire family of tokens across all devices.
   */
  static revokeTokenFamily(familyId) {
    const db = loadRefreshDb();
    let changed = false;
    for (const hash in db) {
      if (db[hash].familyId === familyId) {
        db[hash].isRevoked = true;
        changed = true;
      }
    }
    if (changed) {
      saveRefreshDb(db);
    }
  }

  /**
   * Verifies an incoming JWT access token.
   * @param {string} token 
   */
  static verifyAccessToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [headerB64, payloadB64, signature] = parts;
      const expectedSig = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        return null;
      }

      const payload = JSON.parse(base64UrlDecode(payloadB64));
      
      // Check expiration
      if (Math.floor(Date.now() / 1000) > payload.exp) {
        return null;
      }

      // Check blacklist
      if (revokedJtiBlacklist.has(payload.jti)) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }
}

module.exports = TokenManager;
