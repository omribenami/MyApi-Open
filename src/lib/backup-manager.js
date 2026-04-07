/**
 * Backup Manager for MyApi
 * Automated database backup with scheduling, retention, and restore
 * Supports local storage, encryption (SOC2 C1), and S3 replication (SOC2 A1).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { URL } = require('url');

// ---------------------------------------------------------------------------
// Backup encryption helpers (SOC2 Phase 2 — C1)
// AES-256-GCM, key derived from VAULT_KEY env var.
// ---------------------------------------------------------------------------
const ENC_ALGORITHM = 'aes-256-gcm';
const ENC_KEY_LENGTH = 32; // bytes

function _getEncryptionKey() {
  const raw = String(process.env.VAULT_KEY || process.env.ENCRYPTION_KEY || '').trim();
  if (!raw) return null;
  // Accept both hex-encoded 64-char keys and plain strings
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  // Derive 32-byte key from arbitrary string via SHA-256
  return crypto.createHash('sha256').update(raw).digest();
}

function _encryptBuffer(plainBuf) {
  const key = _getEncryptionKey();
  if (!key) throw new Error('[Backup] VAULT_KEY or ENCRYPTION_KEY must be set to encrypt backups');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(12) | tag(16) | ciphertext
  return Buffer.concat([iv, tag, ct]);
}

function _decryptBuffer(encBuf) {
  const key = _getEncryptionKey();
  if (!key) throw new Error('[Backup] VAULT_KEY or ENCRYPTION_KEY must be set to decrypt backups');
  const iv = encBuf.slice(0, 12);
  const tag = encBuf.slice(12, 28);
  const ct = encBuf.slice(28);
  const decipher = crypto.createDecipheriv(ENC_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

const DEFAULT_BACKUP_DIR = path.join(__dirname, '../../backups');

// ---------------------------------------------------------------------------
// S3 upload via AWS Signature V4 — no external dependencies (SOC2 A1)
// Required env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, BACKUP_S3_BUCKET
// Optional: BACKUP_S3_REGION (default: us-east-1), BACKUP_S3_PREFIX (default: backups/)
// ---------------------------------------------------------------------------

function _hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function _sigV4SigningKey(secretKey, dateStamp, region, service) {
  const kDate = _hmac('AWS4' + secretKey, dateStamp);
  const kRegion = _hmac(kDate, region);
  const kService = _hmac(kRegion, service);
  return _hmac(kService, 'aws4_request');
}

/**
 * Upload a Buffer to S3 using AWS Signature V4.
 * Returns a Promise that resolves with the ETag on success.
 */
async function _uploadToS3(buf, s3Key) {
  const accessKeyId = String(process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.AWS_SECRET_ACCESS_KEY || '').trim();
  const bucket = String(process.env.BACKUP_S3_BUCKET || '').trim();
  const region = String(process.env.BACKUP_S3_REGION || 'us-east-1').trim();

  if (!accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and BACKUP_S3_BUCKET must be set for S3 replication');
  }

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const endpoint = `https://${host}/${s3Key}`;
  const url = new URL(endpoint);

  const payloadHash = crypto.createHash('sha256').update(buf).digest('hex');
  const contentType = 'application/octet-stream';

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    'PUT',
    url.pathname,
    '', // query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const signingKey = _sigV4SigningKey(secretAccessKey, dateStamp, region, 's3');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      path: url.pathname,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': buf.length,
        'X-Amz-Date': amzDate,
        'X-Amz-Content-SHA256': payloadHash,
        'Authorization': authHeader,
      },
    }, (res) => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ etag: res.headers.etag, location: endpoint });
        } else {
          reject(new Error(`S3 upload failed: HTTP ${res.statusCode} — ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(buf);
    req.end();
  });
}

class BackupManager {
  constructor(options = {}) {
    this.db = options.db || null;
    this.backupDir = options.backupDir || process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR;
    this.retentionDays = options.retentionDays || parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
    this.maxBackups = options.maxBackups || parseInt(process.env.BACKUP_MAX_COUNT || '50', 10);
    this.dbPath = options.dbPath || process.env.DB_PATH || path.join(__dirname, '../data/myapi.db');
    this._scheduleTimer = null;
  }

  /**
   * Initialize backup directory structure
   */
  init() {
    const dirs = [
      this.backupDir,
      path.join(this.backupDir, 'daily'),
      path.join(this.backupDir, 'manual'),
      path.join(this.backupDir, 'pre-deploy')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    console.log(`[Backup] Backup directory initialized: ${this.backupDir}`);
    return true;
  }

  /**
   * Create a database backup
   * Uses SQLite's backup API via file copy (WAL-safe with checkpoint)
   */
  createBackup(options = {}) {
    const {
      type = 'manual',
      label = '',
      compress = false
    } = options;

    this.init();

    const timestamp = new Date().toISOString()
      .replace(/[-:T]/g, '')
      .replace(/\..+/, '');

    const labelSuffix = label ? `_${label.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
    const filename = `myapi_backup_${timestamp}${labelSuffix}.db`;
    const subDir = type === 'daily' ? 'daily' : type === 'pre-deploy' ? 'pre-deploy' : 'manual';
    const backupPath = path.join(this.backupDir, subDir, filename);

    try {
      // Check source database exists
      if (!fs.existsSync(this.dbPath)) {
        return {
          success: false,
          error: `Source database not found: ${this.dbPath}`
        };
      }

      // Preferred: Use better-sqlite3's native backup API for a consistent
      // point-in-time snapshot that handles WAL properly.
      if (this.db && typeof this.db.backup === 'function') {
        this.db.backup(backupPath);
      } else {
        // Fallback: Force a WAL checkpoint then file copy.
        // This is less safe under concurrent writes but works when the
        // native backup API is unavailable (e.g., DB instance not provided).
        if (this.db) {
          try {
            this.db.pragma('wal_checkpoint(TRUNCATE)');
          } catch {
            // Non-fatal - proceed with copy
          }
        }
        fs.copyFileSync(this.dbPath, backupPath);
      }

      // Checksum of plaintext before optional encryption
      const plainBuf = fs.readFileSync(backupPath);
      const plaintextChecksum = crypto.createHash('sha256').update(plainBuf).digest('hex');

      // Encrypt if VAULT_KEY / ENCRYPTION_KEY is available (SOC2 C1)
      const encKey = _getEncryptionKey();
      let finalPath = backupPath;
      let encrypted = false;
      if (encKey) {
        const encBuf = _encryptBuffer(plainBuf);
        finalPath = backupPath + '.enc';
        fs.writeFileSync(finalPath, encBuf);
        fs.unlinkSync(backupPath); // remove plaintext copy
        encrypted = true;
      }

      const stats = fs.statSync(finalPath);
      const finalFilename = encrypted ? filename + '.enc' : filename;

      // Write metadata
      const metadata = {
        filename: finalFilename,
        path: finalPath,
        type,
        label: label || null,
        createdAt: new Date().toISOString(),
        sizeBytes: stats.size,
        plaintextChecksum,
        encrypted,
        sourceDb: this.dbPath,
        compressed: compress
      };

      const metaPath = finalPath + '.meta.json';
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

      console.log(`[Backup] Created: ${finalFilename} (${(stats.size / 1024 / 1024).toFixed(2)} MB, encrypted=${encrypted})`);

      // Off-site replication to S3 (non-blocking, SOC2 A1)
      const s3Bucket = String(process.env.BACKUP_S3_BUCKET || '').trim();
      if (s3Bucket) {
        const s3Prefix = String(process.env.BACKUP_S3_PREFIX || 'backups/').replace(/\/?$/, '/');
        const s3Key = `${s3Prefix}${subDir}/${finalFilename}`;
        _uploadToS3(fs.readFileSync(finalPath), s3Key)
          .then(({ location }) => {
            console.log(`[Backup] S3 replication succeeded: ${location}`);
          })
          .catch((err) => {
            console.error(`[Backup] S3 replication failed (non-fatal): ${err.message}`);
          });
      }

      return { success: true, ...metadata };
    } catch (error) {
      console.error(`[Backup] Failed to create backup:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Restore from a backup file
   */
  restoreBackup(backupPath, options = {}) {
    const { createPreRestoreBackup = true, verify = true } = options;

    try {
      if (!fs.existsSync(backupPath)) {
        return { success: false, error: `Backup file not found: ${backupPath}` };
      }

      const isEncrypted = backupPath.endsWith('.enc');

      // Verify checksum if metadata exists
      if (verify) {
        const metaPath = backupPath + '.meta.json';
        if (fs.existsSync(metaPath)) {
          const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          if (metadata.plaintextChecksum || metadata.checksum) {
            // For encrypted backups, decrypt first then verify plaintext checksum
            let bufToCheck = fs.readFileSync(backupPath);
            if (isEncrypted) {
              try { bufToCheck = _decryptBuffer(bufToCheck); } catch (decErr) {
                return { success: false, error: `Decryption failed: ${decErr.message}` };
              }
            }
            const actualChecksum = crypto.createHash('sha256').update(bufToCheck).digest('hex');
            const expectedChecksum = metadata.plaintextChecksum || metadata.checksum;
            if (expectedChecksum && expectedChecksum !== actualChecksum) {
              return {
                success: false,
                error: 'Checksum mismatch — backup file may be corrupted',
                expected: expectedChecksum,
                actual: actualChecksum
              };
            }
          }
        }
      }

      // Create pre-restore backup
      if (createPreRestoreBackup && fs.existsSync(this.dbPath)) {
        console.log('[Backup] Creating pre-restore safety backup...');
        const safetyBackup = this.createBackup({
          type: 'manual',
          label: 'pre_restore'
        });
        if (!safetyBackup.success) {
          console.warn('[Backup] Warning: Could not create pre-restore backup');
        }
      }

      // Close any existing connection
      if (this.db) {
        try {
          this.db.pragma('wal_checkpoint(TRUNCATE)');
        } catch {
          // Non-fatal
        }
      }

      // Decrypt if needed, then restore
      if (isEncrypted) {
        const encBuf = fs.readFileSync(backupPath);
        const plainBuf = _decryptBuffer(encBuf);
        fs.writeFileSync(this.dbPath, plainBuf);
      } else {
        fs.copyFileSync(backupPath, this.dbPath);
      }

      const stats = fs.statSync(this.dbPath);
      console.log(`[Backup] Restored from: ${path.basename(backupPath)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

      return {
        success: true,
        restoredFrom: backupPath,
        restoredAt: new Date().toISOString(),
        sizeBytes: stats.size,
        note: 'Database connection must be re-established after restore'
      };
    } catch (error) {
      console.error(`[Backup] Failed to restore:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * List all backups with metadata
   */
  listBackups(options = {}) {
    const { type, limit = 50 } = options;

    this.init();

    const backups = [];
    const subdirs = type ? [type] : ['daily', 'manual', 'pre-deploy'];

    for (const subdir of subdirs) {
      const dir = path.join(this.backupDir, subdir);
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.db') || f.endsWith('.db.enc'))
        .sort()
        .reverse();

      for (const file of files) {
        const filePath = path.join(dir, file);
        const metaPath = filePath + '.meta.json';
        const stats = fs.statSync(filePath);

        let metadata = {};
        if (fs.existsSync(metaPath)) {
          try {
            metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          } catch {
            // Ignore metadata parse errors
          }
        }

        backups.push({
          filename: file,
          path: filePath,
          type: subdir,
          sizeBytes: stats.size,
          sizeMB: (stats.size / 1024 / 1024).toFixed(2),
          createdAt: metadata.createdAt || stats.mtime.toISOString(),
          checksum: metadata.checksum || null,
          label: metadata.label || null
        });
      }
    }

    // Sort by creation time, newest first
    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return backups.slice(0, limit);
  }

  /**
   * Delete a specific backup
   */
  deleteBackup(backupPath) {
    try {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
        // Also delete metadata
        const metaPath = backupPath + '.meta.json';
        if (fs.existsSync(metaPath)) {
          fs.unlinkSync(metaPath);
        }
        console.log(`[Backup] Deleted: ${path.basename(backupPath)}`);
        return { success: true };
      }
      return { success: false, error: 'Backup file not found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Apply retention policy — remove old backups
   */
  applyRetention() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const allBackups = this.listBackups({ limit: 1000 });
    let removed = 0;

    // Group by type
    const byType = {};
    for (const backup of allBackups) {
      if (!byType[backup.type]) byType[backup.type] = [];
      byType[backup.type].push(backup);
    }

    for (const [type, backups] of Object.entries(byType)) {
      // Remove old backups beyond retention period
      for (const backup of backups) {
        const backupDate = new Date(backup.createdAt);
        if (backupDate < cutoffDate) {
          this.deleteBackup(backup.path);
          removed++;
        }
      }

      // Enforce max count per type
      const typeMax = Math.ceil(this.maxBackups / 3);
      if (backups.length > typeMax) {
        const toRemove = backups.slice(typeMax);
        for (const backup of toRemove) {
          if (!this.deleteBackup(backup.path).success) continue;
          removed++;
        }
      }
    }

    if (removed > 0) {
      console.log(`[Backup] Retention: removed ${removed} old backup(s)`);
    }

    return { removed, retentionDays: this.retentionDays };
  }

  /**
   * Verify a backup file integrity
   */
  verifyBackup(backupPath) {
    try {
      if (!fs.existsSync(backupPath)) {
        return { valid: false, error: 'File not found' };
      }

      const stats = fs.statSync(backupPath);
      if (stats.size === 0) {
        return { valid: false, error: 'Empty backup file' };
      }

      const isEncrypted = backupPath.endsWith('.enc');
      let plainBuf;

      if (isEncrypted) {
        try {
          plainBuf = _decryptBuffer(fs.readFileSync(backupPath));
        } catch (decErr) {
          return { valid: false, error: `Decryption failed: ${decErr.message}`, encrypted: true };
        }
      } else {
        plainBuf = fs.readFileSync(backupPath);
      }

      // Check SQLite magic bytes on plaintext
      const sqliteHeader = 'SQLite format 3';
      const isSQLite = plainBuf.slice(0, 15).toString('utf8') === sqliteHeader;
      if (!isSQLite) {
        return { valid: false, error: 'Not a valid SQLite database file', encrypted: isEncrypted };
      }

      // Verify checksum against metadata
      const metaPath = backupPath + '.meta.json';
      let checksumValid = null;
      if (fs.existsSync(metaPath)) {
        const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const expectedChecksum = metadata.plaintextChecksum || metadata.checksum;
        if (expectedChecksum) {
          checksumValid = crypto.createHash('sha256').update(plainBuf).digest('hex') === expectedChecksum;
        }
      }

      return {
        valid: true,
        sizeBytes: stats.size,
        sizeMB: (stats.size / 1024 / 1024).toFixed(2),
        isSQLite: true,
        encrypted: isEncrypted,
        checksumValid
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Start scheduled backups
   */
  startSchedule(intervalHours = 24) {
    if (this._scheduleTimer) {
      this.stopSchedule();
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;

    this._scheduleTimer = setInterval(() => {
      console.log('[Backup] Running scheduled backup...');
      const result = this.createBackup({ type: 'daily', label: 'scheduled' });
      if (result.success) {
        this.applyRetention();
      }
    }, intervalMs);

    console.log(`[Backup] Scheduled backups every ${intervalHours} hours`);
  }

  /**
   * Stop scheduled backups
   */
  stopSchedule() {
    if (this._scheduleTimer) {
      clearInterval(this._scheduleTimer);
      this._scheduleTimer = null;
    }
  }

  /**
   * Get backup system status summary
   */
  getStatus() {
    const backups = this.listBackups({ limit: 1000 });
    const totalSize = backups.reduce((sum, b) => sum + b.sizeBytes, 0);

    return {
      backupDir: this.backupDir,
      retentionDays: this.retentionDays,
      maxBackups: this.maxBackups,
      totalBackups: backups.length,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      latestBackup: backups.length > 0 ? backups[0] : null,
      byType: {
        daily: backups.filter(b => b.type === 'daily').length,
        manual: backups.filter(b => b.type === 'manual').length,
        preDeploy: backups.filter(b => b.type === 'pre-deploy').length
      },
      scheduled: !!this._scheduleTimer
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopSchedule();
  }
}

module.exports = BackupManager;
