/**
 * Encryption Module - Phase 5: Compliance & Encryption
 * 
 * Handles:
 * - AES-256-GCM encryption/decryption
 * - Encryption key management
 * - Key derivation
 * - Encryption versioning
 * 
 * NOTE: This builds on existing token encryption. We extend it here
 * to apply it to PII, conversations, and documents.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const ENCRYPTION_VERSION = 1;

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
  const saltBuffer = typeof salt === 'string' ? Buffer.from(salt) : salt;
  
  return crypto.pbkdf2Sync(key, saltBuffer, 100000, KEY_LENGTH, 'sha256');
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

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

    // Add AAD if provided
    if (aad) {
      cipher.setAAD(typeof aad === 'string' ? Buffer.from(aad) : aad);
    }

    // Encrypt
    const ciphertext = Buffer.concat([
      cipher.update(plaintextBuffer),
      cipher.final(),
    ]);

    // Get auth tag
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: ciphertext.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      version: ENCRYPTION_VERSION,
      algorithm: ALGORITHM,
    };
  } catch (error) {
    console.error('[Encryption] Encrypt error:', error.message);
    throw new Error(`Encryption failed: ${error.message}`);
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
    const { ciphertext, iv, authTag } = encrypted;
    const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'hex') : key;
    const ciphertextBuffer = Buffer.from(ciphertext, 'hex');
    const ivBuffer = Buffer.from(iv, 'hex');
    const authTagBuffer = Buffer.from(authTag, 'hex');

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, ivBuffer);

    // Add AAD if provided
    if (aad) {
      decipher.setAAD(typeof aad === 'string' ? Buffer.from(aad) : aad);
    }

    // Set auth tag
    decipher.setAuthTag(authTagBuffer);

    // Decrypt
    const plaintext = Buffer.concat([
      decipher.update(ciphertextBuffer),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  } catch (error) {
    console.error('[Encryption] Decrypt error:', error.message);
    throw new Error(`Decryption failed: ${error.message}`);
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
    encrypted.iv &&
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
  IV_LENGTH,
  AUTH_TAG_LENGTH,
  ENCRYPTION_VERSION,
};
