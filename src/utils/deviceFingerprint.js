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
    const hostname = (data.hostname || 'unknown').trim();
    const macAddress = (data.macAddress || 'unknown').trim();

    // Create component fingerprints
    const components = {
      userAgent: this._hashComponent(userAgent),
      acceptLanguage: this._hashComponent(acceptLanguage),
      platform: this._hashComponent(platform),
      hostname: this._hashComponent(hostname),
      macAddress: this._hashComponent(macAddress),
    };

    // Create comprehensive fingerprint (raw format)
    const rawFingerprint = {
      userAgent,
      acceptLanguage,
      ipAddress,
      platform,
      hostname,
      macAddress,
      timestamp: new Date().toISOString(),
    };

    // SHA256 hash for collision resistance
    const fingerprintString = JSON.stringify({
      userAgent,
      platform,
      hostname,
      macAddress,
    });

    const fingerprintHash = crypto
      .createHash('sha256')
      .update(fingerprintString)
      .digest('hex');

    // Create human-readable summary
    const summary = {
      os: this._parseOS(platform, userAgent),
      browser: this._parseBrowser(userAgent),
      hostname,
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

    return this.generateFingerprint({
      userAgent: req.headers['user-agent'] || '',
      acceptLanguage: req.headers['accept-language'] || '',
      ipAddress: clientIp,
      platform: req.headers['sec-ch-ua-platform'] || 
                req.headers['user-agent']?.includes('Windows') ? 'Windows' :
                req.headers['user-agent']?.includes('Mac') ? 'macOS' :
                req.headers['user-agent']?.includes('Linux') ? 'Linux' :
                'Unknown',
      hostname: req.hostname || 'unknown',
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
   * Check if fingerprint shows suspicious activity
   * @param {Object} fingerprint - Fingerprint object
   * @param {Array} previousFingerprints - Historical fingerprints for comparison
   * @returns {Object} { suspicious, reasons, riskLevel }
   */
  static analyzeSuspiciousActivity(fingerprint, previousFingerprints = []) {
    const suspicious = [];
    const warnings = [];

    if (!previousFingerprints || previousFingerprints.length === 0) {
      return { suspicious: false, reasons: [], warnings, riskLevel: 'new' };
    }

    // Check for OS changes
    const osChanged = previousFingerprints.some(pf => pf.summary?.os !== fingerprint.summary?.os);
    if (osChanged) {
      warnings.push('Operating system changed from last known device');
    }

    // Check for browser changes
    const browserChanged = previousFingerprints.some(pf => pf.summary?.browser !== fingerprint.summary?.browser);
    if (browserChanged) {
      warnings.push('Browser changed from last known device');
    }

    // Check for multiple IPs in short time
    if (previousFingerprints.length >= 3) {
      const recentIPs = previousFingerprints
        .slice(-3)
        .map(pf => pf.fingerprint?.ipAddress)
        .filter(Boolean);
      
      if (new Set(recentIPs).size === recentIPs.length) {
        warnings.push('Multiple different IP addresses detected');
      }
    }

    const isSuspicious = suspicious.length > 0;
    const riskLevel = isSuspicious ? 'high' : warnings.length > 0 ? 'medium' : 'low';

    return { suspicious: isSuspicious, reasons: suspicious, warnings, riskLevel };
  }
}

module.exports = DeviceFingerprint;
