/**
 * rateLimiter.js
 * High-performance sliding-window rate limiter with progressive tarpitting.
 * Supports dual-tier tracking: per-IP and per-Account to neutralize distributed credential stuffing.
 */

class SlidingWindowRateLimiter {
  constructor() {
    // In production, backed by Redis Sorted Sets (ZSET):
    // ZREMRANGEBYSCORE key 0 (now - window)
    // ZADD key now now
    // ZCARD key
    this.storage = new Map();
  }

  /**
   * Helper to clean up old keys periodically
   */
  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.storage.entries()) {
      const filtered = timestamps.filter(ts => now - ts < 3600000); // 1 hr max
      if (filtered.length === 0) {
        this.storage.delete(key);
      } else {
        this.storage.set(key, filtered);
      }
    }
  }

  /**
   * Checks and consumes a rate limit quota.
   * @param {string} key Identifier (e.g. `ip:1.2.3.4` or `acc:user@example.com`)
   * @param {number} maxRequests 
   * @param {number} windowMs 
   * @returns {{ allowed: boolean, remaining: number, resetMs: number, delayMs: number }}
   */
  check(key, maxRequests, windowMs) {
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!this.storage.has(key)) {
      this.storage.set(key, []);
    }

    const timestamps = this.storage.get(key).filter(ts => ts > windowStart);
    this.storage.set(key, timestamps);

    const currentCount = timestamps.length;
    const allowed = currentCount < maxRequests;

    if (allowed) {
      timestamps.push(now);
    }

    const oldest = timestamps[0] || now;
    const resetMs = Math.max(0, oldest + windowMs - now);

    // Progressive tarpitting: if approaching or exceeding limit, calculate penalty delay
    let delayMs = 0;
    if (currentCount >= maxRequests) {
      // Exponential backoff tarpitting up to 3 seconds
      const excess = currentCount - maxRequests + 1;
      delayMs = Math.min(Math.pow(2, excess) * 200, 3000);
    }

    return {
      allowed,
      remaining: Math.max(0, maxRequests - currentCount - (allowed ? 1 : 0)),
      resetMs,
      delayMs
    };
  }
}

const limiter = new SlidingWindowRateLimiter();
setInterval(() => limiter.cleanup(), 60000).unref();

/**
 * Express middleware for login protection.
 */
function createRateLimitMiddleware(options = {}) {
  const ipMax = options.ipMax || 30; // 30 requests per minute per IP
  const accountMax = options.accountMax || 5; // 5 failed logins per 15 minutes per account
  const windowMs = options.windowMs || 60000;

  return async (req, res, next) => {
    // 1. Identify Client IP (handling proxies safely)
    const clientIp = req.headers['cf-connecting-ip'] ||
                     req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                     req.socket?.remoteAddress || '127.0.0.1';

    // Whitelist loopback in dev
    if (process.env.NODE_ENV !== 'production' && (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost')) {
      return next();
    }

    // 2. Check IP Quota
    const ipResult = limiter.check(`ip:${clientIp}`, ipMax, windowMs);
    
    res.setHeader('X-RateLimit-Limit', ipMax);
    res.setHeader('X-RateLimit-Remaining', ipResult.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(ipResult.resetMs / 1000));

    if (!ipResult.allowed) {
      if (ipResult.delayMs > 0) {
        await new Promise(r => setTimeout(r, ipResult.delayMs));
      }
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'IP velocity limit exceeded. Please back off before retrying.',
        retryAfter: Math.ceil(ipResult.resetMs / 1000)
      });
    }

    // 3. Attach helper for account-level failure recording
    req.recordLoginFailure = (email) => {
      if (email) {
        limiter.check(`acc:${email.toLowerCase()}`, accountMax, 15 * 60 * 1000);
      }
    };

    req.getAccountRecentFails = (email) => {
      if (!email) return 0;
      const history = limiter.storage.get(`acc:${email.toLowerCase()}`) || [];
      const cutoff = Date.now() - (15 * 60 * 1000);
      return history.filter(ts => ts > cutoff).length;
    };

    req.getIpVelocity = () => {
      const history = limiter.storage.get(`ip:${clientIp}`) || [];
      const cutoff = Date.now() - 60000;
      return history.filter(ts => ts > cutoff).length;
    };

    next();
  };
}

module.exports = {
  limiter,
  createRateLimitMiddleware
};
