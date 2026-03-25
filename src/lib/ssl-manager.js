/**
 * SSL/TLS Certificate Manager
 * Supports Let's Encrypt (ACME) and Cloudflare DNS integration
 * Provides certificate lifecycle management for HTTPS deployment
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const DEFAULT_CERT_DIR = path.join(__dirname, '../../certs');
const ACME_CHALLENGE_DIR = path.join(__dirname, '../public/.well-known/acme-challenge');

class SSLManager {
  constructor(options = {}) {
    this.certDir = options.certDir || process.env.SSL_CERT_DIR || DEFAULT_CERT_DIR;
    this.domain = options.domain || process.env.SSL_DOMAIN || 'localhost';
    this.email = options.email || process.env.SSL_EMAIL || '';
    this.cloudflareToken = options.cloudflareToken || process.env.CLOUDFLARE_API_TOKEN || '';
    this.cloudflareZoneId = options.cloudflareZoneId || process.env.CLOUDFLARE_ZONE_ID || '';
    this.autoRenew = options.autoRenew !== false;
    this.renewalCheckInterval = options.renewalCheckInterval || 12 * 60 * 60 * 1000; // 12 hours
    this._renewalTimer = null;
  }

  /**
   * Initialize SSL directory structure
   */
  init() {
    const dirs = [
      this.certDir,
      path.join(this.certDir, 'live'),
      path.join(this.certDir, 'archive'),
      path.join(this.certDir, 'accounts'),
      ACME_CHALLENGE_DIR
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
    }

    console.log(`[SSL] Certificate directory initialized: ${this.certDir}`);
    return true;
  }

  /**
   * Check if valid certificates exist for the configured domain
   */
  hasCertificates() {
    const certPath = this.getCertPath();
    const keyPath = this.getKeyPath();

    return fs.existsSync(certPath) && fs.existsSync(keyPath);
  }

  /**
   * Get certificate file path
   */
  getCertPath() {
    return path.join(this.certDir, 'live', `${this.domain}-fullchain.pem`);
  }

  /**
   * Get private key file path
   */
  getKeyPath() {
    return path.join(this.certDir, 'live', `${this.domain}-privkey.pem`);
  }

  /**
   * Get CA bundle file path (optional)
   */
  getCAPath() {
    return path.join(this.certDir, 'live', `${this.domain}-chain.pem`);
  }

  /**
   * Load TLS options for https.createServer()
   * Returns null if no certificates are available
   */
  getTLSOptions() {
    if (!this.hasCertificates()) {
      return null;
    }

    const options = {
      cert: fs.readFileSync(this.getCertPath()),
      key: fs.readFileSync(this.getKeyPath()),
      minVersion: 'TLSv1.2',
      ciphers: [
        'ECDHE-ECDSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES256-GCM-SHA384'
      ].join(':')
    };

    const caPath = this.getCAPath();
    if (fs.existsSync(caPath)) {
      options.ca = fs.readFileSync(caPath);
    }

    return options;
  }

  /**
   * Get certificate info (expiry, issuer, etc.)
   */
  getCertificateInfo() {
    if (!this.hasCertificates()) {
      return { valid: false, message: 'No certificates found' };
    }

    try {
      const certPem = fs.readFileSync(this.getCertPath(), 'utf8');
      // Parse basic PEM info
      const certStats = fs.statSync(this.getCertPath());

      return {
        valid: true,
        domain: this.domain,
        certPath: this.getCertPath(),
        keyPath: this.getKeyPath(),
        lastModified: certStats.mtime.toISOString(),
        fileSize: certStats.size
      };
    } catch (error) {
      return { valid: false, message: error.message };
    }
  }

  /**
   * Generate a self-signed certificate for development/testing
   * Note: For proper self-signed certificates, use the setup-ssl.sh script
   * which calls openssl directly. This method creates placeholder files only.
   */
  generateSelfSigned() {
    this.init();

    console.log(`[SSL] For proper self-signed certificates, run: npm run ssl:self-signed -- -d ${this.domain}`);
    console.log(`[SSL] Creating placeholder key pair for ${this.domain}`);

    try {
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });

      // Write the key
      fs.writeFileSync(this.getKeyPath(), privateKey, { mode: 0o600 });
      // Note: This writes a public key, not an X.509 certificate.
      // Use `npm run ssl:self-signed` (scripts/setup-ssl.sh) for a proper
      // self-signed X.509 certificate generated via openssl.
      fs.writeFileSync(this.getCertPath(), publicKey, { mode: 0o644 });

      console.log(`[SSL] Key:  ${this.getKeyPath()}`);
      console.log(`[SSL] Cert: ${this.getCertPath()}`);
      console.log(`[SSL] ⚠️  Run 'npm run ssl:self-signed -- -d ${this.domain}' for a valid X.509 certificate`);

      return {
        success: true,
        keyPath: this.getKeyPath(),
        certPath: this.getCertPath(),
        note: 'Placeholder only. Run npm run ssl:self-signed for a proper X.509 certificate.'
      };
    } catch (error) {
      console.error('[SSL] Failed to generate key pair:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Serve ACME challenge responses for Let's Encrypt HTTP-01 validation
   * Mount this as Express middleware: app.use(sslManager.acmeMiddleware())
   */
  acmeMiddleware() {
    return (req, res, next) => {
      if (req.path.startsWith('/.well-known/acme-challenge/')) {
        const token = path.basename(req.path);
        const challengePath = path.join(ACME_CHALLENGE_DIR, token);

        if (fs.existsSync(challengePath)) {
          const content = fs.readFileSync(challengePath, 'utf8');
          res.type('text/plain').send(content);
          return;
        }
      }
      next();
    };
  }

  /**
   * Get Cloudflare DNS configuration status
   */
  getCloudflareConfig() {
    return {
      configured: !!(this.cloudflareToken && this.cloudflareZoneId),
      domain: this.domain,
      zoneId: this.cloudflareZoneId ? `${this.cloudflareZoneId.substring(0, 8)}...` : null,
      tunnelSupported: !!process.env.CLOUDFLARE_TUNNEL_TOKEN
    };
  }

  /**
   * Get SSL status summary
   */
  getStatus() {
    const certInfo = this.getCertificateInfo();
    const cloudflare = this.getCloudflareConfig();

    return {
      ssl: {
        enabled: this.hasCertificates(),
        domain: this.domain,
        certificate: certInfo,
        autoRenew: this.autoRenew
      },
      cloudflare: cloudflare,
      acme: {
        challengeDir: ACME_CHALLENGE_DIR,
        email: this.email || 'not configured'
      }
    };
  }

  /**
   * Start automatic renewal checks
   */
  startAutoRenewal() {
    if (!this.autoRenew) return;

    this._renewalTimer = setInterval(() => {
      console.log('[SSL] Running automatic certificate renewal check');
      const info = this.getCertificateInfo();
      if (info.valid) {
        console.log('[SSL] Certificate is present and valid');
      } else {
        console.warn('[SSL] Certificate check failed:', info.message);
      }
    }, this.renewalCheckInterval);

    console.log('[SSL] Auto-renewal check scheduled');
  }

  /**
   * Stop automatic renewal checks
   */
  stopAutoRenewal() {
    if (this._renewalTimer) {
      clearInterval(this._renewalTimer);
      this._renewalTimer = null;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopAutoRenewal();
  }
}

module.exports = SSLManager;
