/**
 * riskScorer.js
 * Multi-signal risk assessment engine (0 - 100 score).
 * Evaluates device signals, network velocity, and behavioral anomalies.
 */

class RiskScorer {
  /**
   * Calculates a consolidated risk score for a login attempt.
   * @param {Object} context
   * @param {string} context.clientIp
   * @param {string} context.userAgent
   * @param {Object} context.deviceInfo
   * @param {number} context.ipRecentAttempts - Attempts from this IP in last 60s
   * @param {number} context.accountRecentFails - Failed attempts for this account in last 15m
   * @param {Object} [context.lastLogin] - { country, timestamp }
   * @param {string} [context.currentCountry]
   * @returns {{ score: number, flags: string[], decision: 'ALLOW' | 'CHALLENGE' | 'BLOCK' }}
   */
  static evaluate(context) {
    let score = 0;
    const flags = [];

    const {
      clientIp,
      userAgent = '',
      deviceInfo = {},
      ipRecentAttempts = 0,
      accountRecentFails = 0,
      lastLogin = null,
      currentCountry = null,
      powDurationMs = 0
    } = context;

    // 1. IP Velocity Analysis
    if (ipRecentAttempts > 20) {
      score += 40;
      flags.push('HIGH_IP_VELOCITY');
    } else if (ipRecentAttempts > 8) {
      score += 20;
      flags.push('MODERATE_IP_VELOCITY');
    }

    // 2. Account-Level Attack History
    if (accountRecentFails >= 5) {
      score += 30;
      flags.push('ACCOUNT_UNDER_ATTACK');
    } else if (accountRecentFails >= 3) {
      score += 15;
      flags.push('MULTIPLE_RECENT_FAILURES');
    }

    // 3. Headless Browser & User-Agent Anomalies
    const ua = userAgent.toLowerCase();
    const isBotUa = ua.includes('headlesschrome') ||
                    ua.includes('phantomjs') ||
                    ua.includes('selenium') ||
                    ua.includes('puppeteer') ||
                    ua.includes('python-requests') ||
                    ua.includes('curl') ||
                    ua.includes('postman');

    if (isBotUa) {
      score += 50;
      flags.push('KNOWN_AUTOMATION_UA');
    }

    // Device fingerprint heuristics
    if (deviceInfo.webdriver === true) {
      score += 45;
      flags.push('AUTOMATION_WEBDRIVER_DETECTED');
    }

    if (!deviceInfo.canvasHash && !ua.includes('android') && !ua.includes('mobile')) {
      score += 15;
      flags.push('MISSING_CANVAS_FINGERPRINT');
    }

    // 4. Proof of Work Latency Anomaly
    // Solved in < 3ms implies either trivial difficulty or hardware farm pre-computation
    if (powDurationMs > 0 && powDurationMs < 3) {
      score += 20;
      flags.push('SUSPICIOUS_INSTANT_POW');
    }

    // 5. Impossible Geo-Velocity (Impossible Travel)
    if (lastLogin && currentCountry && lastLogin.country && lastLogin.country !== currentCountry) {
      const elapsedHours = (Date.now() - new Date(lastLogin.timestamp).getTime()) / (1000 * 60 * 60);
      if (elapsedHours < 2) {
        score += 40;
        flags.push('IMPOSSIBLE_TRAVEL_DETECTED');
      }
    }

    // Clamp score to 100
    const finalScore = Math.min(score, 100);

    // Decision tiers
    let decision = 'ALLOW';
    if (finalScore >= 75) {
      decision = 'BLOCK';
    } else if (finalScore >= 40) {
      decision = 'CHALLENGE'; // Step-up: Turnstile, WebAuthn, or OTP
    }

    return {
      score: finalScore,
      flags,
      decision
    };
  }
}

module.exports = RiskScorer;
