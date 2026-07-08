const crypto = require('crypto');

/**
 * Device Fingerprint Generator
 * Generates deterministic, collision-resistant device identifiers
 */

class DeviceFingerprint {
  /**
   * Generate device fingerprint from request/environment data
   * @param {Object} data - Device identification data
   * @param {string} data.userAgent - Browser user agent
   * @param {string} data.acceptLanguage - Accept-Language header
   * @param {string} data.ipAddress - Client IP address
   * @param {string} data.platform - OS platform (from headers or client)
   * @param {string} data.hostname - Device hostname
   * @param {string} data.macAddress - Device MAC address (if available)
   * @returns {Object} { fingerprint (raw), fingerprintHash (SHA256), summary (human-readable) }
   */
  static generateFingerprint(data = {}) {
    // Normalize input
    const userAgent = (data.userAgent || '').trim();
    const acceptLanguage = (data.acceptLanguage || '').trim();
    const ipAddress = (data.ipAddress || 'unknown').trim();
    const platform = (data.platform || 'unknown').trim();

    // Create component fingerprints
    const components = {
      userAgent: this._hashComponent(userAgent),
      acceptLanguage: this._hashComponent(acceptLanguage),
      platform: this._hashComponent(platform),
    };

    // Hash IP before storing to reduce PII retention while preserving abuse detection.
    // Using a server-side salt (from env or a fixed salt) to prevent rainbow table attacks.
    const ipSalt = process.env.IP_HASH_SALT || 'myapi-ip-salt-v1';
    const hashedIP = ipAddress !== 'unknown'
      ? crypto.createHmac('sha256', ipSalt).update(ipAddress).digest('hex').slice(0, 16)
      : 'unknown';

    // Create comprehensive fingerprint (raw format)
    // Note: ipAddress is hashed (HMAC-SHA256) before storage to reduce PII exposure.
    const rawFingerprint = {
      userAgent,
      acceptLanguage,
      ipAddressHash: hashedIP,  // hashed, not raw IP
      platform,
      timestamp: new Date().toISOString(),
    };

    // Fingerprint hash is informational for dashboard visibility — NOT a security gate.
    // Authorization for OAuth tokens relies on the bearer secret + tokenSecurityMonitor
    // anomaly detection (ASN drift, VPN/Tor, velocity), not on this hash.
    // We dropped req.hostname (server-side, constant) and macAddress (unobservable over HTTP)
    // because they added no entropy and forced UA/platform to dominate, which made the hash
    // flap whenever an AI agent's UA was missing or changed.
    const fingerprintString = JSON.stringify({
      userAgent,
      platform,
    });

    const fingerprintHash = crypto
      .createHash('sha256')
      .update(fingerprintString)
      .digest('hex');

    // Create human-readable summary
    const summary = {
      os: this._parseOS(platform, userAgent),
      browser: this._parseBrowser(userAgent),
      ipAddress,
    };

    return {
      fingerprint: rawFingerprint,
      fingerprintHash,
      components,
      summary,
    };
  }

  /**
   * Extract device fingerprint from HTTP request
   * @param {Object} req - Express request object
   * @param {string} ipAddress - Optional override for IP address
   * @returns {Object} Device fingerprint data
   */
  static fromRequest(req, ipAddress = null) {
    const clientIp = ipAddress ||
                     req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.socket?.remoteAddress ||
                     'unknown';

    const ua = req.headers['user-agent'] || '';
    // Operator-precedence guard: wrap the ternary so `sec-ch-ua-platform || ua.includes(...)`
    // doesn't get coerced to a boolean and flatten everything to 'Windows'.
    const platform = req.headers['sec-ch-ua-platform']
      || (ua.includes('Windows') ? 'Windows'
        : ua.includes('Mac') ? 'macOS'
        : ua.includes('Linux') ? 'Linux'
        : 'Unknown');

    return this.generateFingerprint({
      userAgent: ua,
      acceptLanguage: req.headers['accept-language'] || '',
      ipAddress: clientIp,
      platform,
    });
  }

  /**
   * Verify fingerprint consistency (for validation)
   * @param {string} currentHash - Current device fingerprint hash
   * @param {string} storedHash - Previously stored fingerprint hash
   * @returns {boolean} Whether fingerprints match
   */
  static verifyFingerprint(currentHash, storedHash) {
    if (!currentHash || !storedHash) return false;
    const a = Buffer.from(String(currentHash));
    const b = Buffer.from(String(storedHash));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * Hash a component for additional verification
   * @private
   */
  static _hashComponent(value) {
    if (!value) return null;
    return crypto.createHash('sha256').update(value).digest('hex').substring(0, 16);
  }

  /**
   * Parse OS from user agent and platform headers
   * @private
   */
  static _parseOS(platform, userAgent) {
    if (platform && platform.toLowerCase() !== 'unknown') return platform;
    
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS X')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    
    return 'Unknown';
  }

  /**
   * Parse browser from user agent
   * @private
   */
  static _parseBrowser(userAgent) {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Trident')) return 'Internet Explorer';
    if (userAgent.includes('Opera')) return 'Opera';
    
    return 'Unknown';
  }

  /**
   * Deprecated: UA/IP-based heuristic analysis. Superseded by lib/tokenSecurityMonitor.js
   * which uses ASN org-type drift, VPN/Tor detection, and velocity — signals that don't
   * flap when an AI agent rotates workers or omits a User-Agent. Kept as an inert stub
   * to avoid breaking external callers.
   */
  static analyzeSuspiciousActivity(_fingerprint, previousFingerprints = []) {
    if (!previousFingerprints || previousFingerprints.length === 0) {
      return { suspicious: false, reasons: [], warnings: [], riskLevel: 'new' };
    }
    return { suspicious: false, reasons: [], warnings: [], riskLevel: 'low' };
  }
}

module.exports = DeviceFingerprint;
