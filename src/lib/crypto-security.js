
// ============================================================================
// SECURITY FIX: Cryptography & Storage Security
// CVSS: 6.2-7.5 (High)
// ============================================================================

const crypto = require('crypto');
const fs = require('fs');

/**
 * Encrypt sensitive data at rest
 * CVSS 6.2: Plaintext OAuth token storage
 */
class EncryptionManager {
  constructor(masterKey) {
    if (!masterKey || masterKey.length < 32) {
      throw new Error('Master key must be at least 32 bytes');
    }
    this.masterKey = Buffer.from(masterKey, 'hex');
  }
  
  encrypt(plaintext) {
    // Use AES-256-GCM for authenticated encryption
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return IV:authTag:ciphertext for decryption
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }
  
  decrypt(ciphertext) {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

/**
 * Secure file permissions
 * CVSS 4.3: Weak file permissions on private keys
 */
function setSecureFilePermissions(filepath, mode = 0o600) {
  try {
    fs.chmodSync(filepath, mode);
    // Verify permissions were set correctly
    const stats = fs.statSync(filepath);
    if ((stats.mode & 0o777) !== mode) {
      throw new Error(`Failed to set file permissions: ${filepath}`);
    }
  } catch (e) {
    throw new Error(`Cannot secure file permissions: ${e.message}`);
  }
}

/**
 * Secure key generation
 * CVSS 6.2: Weak token generation
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash password with bcrypt - properly configured
 * CVSS 5.9: Weak password hashing
 */
async function hashPassword(password) {
  const bcrypt = require('bcrypt');
  
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  
  // Use cost factor 12 (minimum recommended: 10, target 2^10 iterations = 1024)
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify password
 */
async function verifyPassword(password, hash) {
  const bcrypt = require('bcrypt');
  return bcrypt.compare(password, hash);
}

/**
 * HMAC for integrity checking
 * CVSS 6.5: Missing message authentication codes
 */
function createHMAC(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

function verifyHMAC(data, secret, signature) {
  const computed = createHMAC(data, secret);
  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(signature)
  );
}

module.exports = {
  EncryptionManager,
  setSecureFilePermissions,
  generateSecureToken,
  hashPassword,
  verifyPassword,
  createHMAC,
  verifyHMAC
};
