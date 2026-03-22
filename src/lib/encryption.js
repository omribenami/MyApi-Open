/**
 * Encryption Module - Phase 5: Compliance & Encryption
 * 
 * Security-Critical Implementation:
 * - AES-256-GCM with authenticated encryption
 * - PBKDF2 key derivation (NIST SP 800-132 compliant)
 * - Random nonce for EVERY encryption (IV reuse prevention)
 * - Constant-time comparisons to prevent timing attacks
 * - Generic error messages (no key material leakage)
 * 
 * CRITICAL REQUIREMENTS:
 * ✓ Never reuse IV/nonce with same key
 * ✓ Always verify authentication tag before decryption
 * ✓ Use PBKDF2 with ≥600k iterations (NIST standard)
 * ✓ Random salt (≥16 bytes) for key derivation
 * ✓ No key material in error messages
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits for AES-256
const NONCE_LENGTH = 12; // 96 bits (GCM standard, NOT 16)
const AUTH_TAG_LENGTH = 16; // 128 bits
const ENCRYPTION_VERSION = 1;

// PBKDF2 Parameters (NIST SP 800-132 compliant)
const PBKDF2_ITERATIONS = 600000; // ≥600k per NIST standard
const PBKDF2_SALT_LENGTH = 32; // 256 bits
const PBKDF2_DIGEST = 'sha256';

// Security limits
const MAX_PLAINTEXT_SIZE = 100 * 1024 * 1024; // 100MB max
const MAX_CIPHERTEXT_SIZE = 100 * 1024 * 1024; // 100MB max

/**
 * Generate a new encryption key
 * @returns {Buffer} 32-byte encryption key
 */
function generateEncryptionKey() {
  return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Derive a key from master key and salt
 * @param {Buffer|string} masterKey - Master key
 * @param {Buffer|string} salt - Salt for derivation
 * @returns {Buffer} Derived key
 */
function deriveKey(masterKey, salt) {
  const key = typeof masterKey === 'string' ? Buffer.from(masterKey, 'hex') : masterKey;
  const saltBuffer = typeof salt === 'string' ? Buffer.from(salt, 'hex') : salt;

  if (!Buffer.isBuffer(key) || key.length < 16) {
    throw new Error('Encryption failed');
  }

  if (!Buffer.isBuffer(saltBuffer) || saltBuffer.length < 16) {
    throw new Error('Encryption failed');
  }

  return crypto.pbkdf2Sync(
    key,
    saltBuffer,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    PBKDF2_DIGEST
  );
}

/**
 * Encrypt data using AES-256-GCM
 * @param {string|Buffer} plaintext - Data to encrypt
 * @param {Buffer|string} key - Encryption key (32 bytes)
 * @param {string} aad - Additional authenticated data (optional)
 * @returns {Object} {ciphertext, iv, authTag, version, algorithm}
 */
function encrypt(plaintext, key, aad = null) {
  try {
    const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'hex') : key;
    const plaintextBuffer = typeof plaintext === 'string'
      ? Buffer.from(plaintext, 'utf8')
      : plaintext;

    if (!Buffer.isBuffer(keyBuffer) || keyBuffer.length !== KEY_LENGTH) {
      throw new Error('Encryption failed');
    }

    if (!Buffer.isBuffer(plaintextBuffer) || plaintextBuffer.length > MAX_PLAINTEXT_SIZE) {
      throw new Error('Encryption failed');
    }

    // Nonce must be random and unique per operation for GCM.
    const nonce = crypto.randomBytes(NONCE_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, nonce);

    if (aad) {
      cipher.setAAD(typeof aad === 'string' ? Buffer.from(aad, 'utf8') : aad);
    }

    const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    if (ciphertext.length > MAX_CIPHERTEXT_SIZE) {
      throw new Error('Encryption failed');
    }

    return {
      ciphertext: ciphertext.toString('hex'),
      nonce: nonce.toString('hex'),
      authTag: authTag.toString('hex'),
      version: ENCRYPTION_VERSION,
      algorithm: ALGORITHM,
      kdf: {
        name: 'pbkdf2',
        digest: PBKDF2_DIGEST,
        iterations: PBKDF2_ITERATIONS,
      },
    };
  } catch {
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt data using AES-256-GCM
 * @param {Object} encrypted - {ciphertext, iv, authTag} (hex strings)
 * @param {Buffer|string} key - Encryption key (32 bytes)
 * @param {string} aad - Additional authenticated data (optional)
 * @returns {string} Decrypted plaintext
 */
function decrypt(encrypted, key, aad = null) {
  try {
    const nonceHex = encrypted?.nonce || encrypted?.iv; // backward-compatible read
    const { ciphertext, authTag } = encrypted || {};
    const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'hex') : key;

    if (!ciphertext || !nonceHex || !authTag) {
      throw new Error('Decryption failed');
    }

    if (!Buffer.isBuffer(keyBuffer) || keyBuffer.length !== KEY_LENGTH) {
      throw new Error('Decryption failed');
    }

    const ciphertextBuffer = Buffer.from(ciphertext, 'hex');
    const nonceBuffer = Buffer.from(nonceHex, 'hex');
    const authTagBuffer = Buffer.from(authTag, 'hex');

    if (ciphertextBuffer.length > MAX_CIPHERTEXT_SIZE || nonceBuffer.length !== NONCE_LENGTH || authTagBuffer.length !== AUTH_TAG_LENGTH) {
      throw new Error('Decryption failed');
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, nonceBuffer);

    if (aad) {
      decipher.setAAD(typeof aad === 'string' ? Buffer.from(aad, 'utf8') : aad);
    }

    decipher.setAuthTag(authTagBuffer);

    const plaintext = Buffer.concat([decipher.update(ciphertextBuffer), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    throw new Error('Decryption failed');
  }
}

/**
 * Hash a key for indexing (never expose actual key)
 * @param {Buffer|string} key - Key to hash
 * @returns {string} SHA-256 hash (hex)
 */
function hashKey(key) {
  const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'hex') : key;
  return crypto.createHash('sha256').update(keyBuffer).digest('hex');
}

function generateSalt() {
  return crypto.randomBytes(PBKDF2_SALT_LENGTH);
}

/**
 * Encrypt object to JSON
 * @param {Object} obj - Object to encrypt
 * @param {Buffer|string} key - Encryption key
 * @returns {string} JSON string with encrypted data
 */
function encryptObject(obj, key) {
  const json = JSON.stringify(obj);
  const encrypted = encrypt(json, key);
  return JSON.stringify(encrypted);
}

/**
 * Decrypt object from JSON
 * @param {string} json - Encrypted JSON string
 * @param {Buffer|string} key - Encryption key
 * @returns {Object} Decrypted object
 */
function decryptObject(json, key) {
  const encrypted = JSON.parse(json);
  const decrypted = decrypt(encrypted, key);
  return JSON.parse(decrypted);
}

/**
 * Check if encryption version is current
 * @param {number} version - Encryption version to check
 * @returns {boolean} True if current
 */
function isCurrentVersion(version) {
  return version === ENCRYPTION_VERSION;
}

/**
 * Get encryption version
 * @returns {number} Current encryption version
 */
function getCurrentVersion() {
  return ENCRYPTION_VERSION;
}

/**
 * Validate encryption format
 * @param {Object} encrypted - Encrypted object to validate
 * @returns {boolean} True if valid
 */
function isValidEncrypted(encrypted) {
  return (
    encrypted &&
    typeof encrypted === 'object' &&
    encrypted.ciphertext &&
    (encrypted.nonce || encrypted.iv) &&
    encrypted.authTag &&
    typeof encrypted.version === 'number'
  );
}

/**
 * Key rotation helper: re-encrypt with new key
 * @param {string} oldData - Data encrypted with old key
 * @param {Buffer|string} oldKey - Old encryption key
 * @param {Buffer|string} newKey - New encryption key
 * @returns {Object} New encrypted data
 */
function rotateKey(oldData, oldKey, newKey) {
  try {
    const oldEncrypted = typeof oldData === 'string' ? JSON.parse(oldData) : oldData;
    const plaintext = decrypt(oldEncrypted, oldKey);
    return encrypt(plaintext, newKey);
  } catch (error) {
    console.error('[Encryption] Key rotation error:', error.message);
    throw new Error(`Key rotation failed: ${error.message}`);
  }
}

module.exports = {
  // Key management
  generateEncryptionKey,
  generateSalt,
  deriveKey,
  hashKey,

  // Encrypt/decrypt
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,

  // Version management
  getCurrentVersion,
  isCurrentVersion,
  isValidEncrypted,

  // Key rotation
  rotateKey,

  // Constants
  ALGORITHM,
  KEY_LENGTH,
  NONCE_LENGTH,
  AUTH_TAG_LENGTH,
  ENCRYPTION_VERSION,
  PBKDF2_ITERATIONS,
  PBKDF2_SALT_LENGTH,
  MAX_PLAINTEXT_SIZE,
  MAX_CIPHERTEXT_SIZE,
};
