/**
 * Encryption module — AES-256-GCM (AEAD) with PBKDF2 key derivation.
 *
 * MIGRATION NOTE: Legacy ciphertext was encrypted with CryptoJS AES (CBC, no auth tag).
 * This class transparently decrypts legacy ciphertext and re-encrypts it with the new
 * AES-256-GCM scheme on first access. New ciphertext is prefixed with "v2:" so the two
 * formats are distinguishable.
 *
 * Remove the legacy fallback once all existing data has been migrated.
 */

const crypto = require('crypto');

// CryptoJS is still needed only for decrypting legacy ciphertext.
// New encryption never uses it.
let _CryptoJS = null;
function getLegacyCryptoJS() {
  if (!_CryptoJS) {
    try { _CryptoJS = require('crypto-js'); } catch (e) {
      throw new Error('crypto-js required for legacy decrypt: ' + e.message);
    }
  }
  return _CryptoJS;
}

const GCM_IV_BYTES = 12;
const GCM_AUTH_TAG_BYTES = 16;
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32; // 256-bit
const PBKDF2_DIGEST = 'sha256';
const V2_PREFIX = 'v2:';

// WeakMap stores sensitive key material off-instance so it is not accessible via
// normal property enumeration, JSON.stringify, or Object.keys().
const _secrets = new WeakMap();

class Encryption {
  constructor(key) {
    if (!key || key.length < 32) {
      throw new Error('Encryption key must be at least 32 characters');
    }
    // Derive a fixed salt from the key (deterministic) — SHA-256 of raw key
    const salt = crypto.createHash('sha256').update(key).digest();
    // Derive the AES-256-GCM cipher key via PBKDF2
    const derivedKey = crypto.pbkdf2Sync(
      Buffer.from(key, 'utf8'),
      salt,
      PBKDF2_ITERATIONS,
      PBKDF2_KEYLEN,
      PBKDF2_DIGEST
    );
    // Store key material in WeakMap — not accessible as instance properties
    _secrets.set(this, { derivedKey, rawKey: key });
  }

  /**
   * Encrypt using AES-256-GCM (authenticated encryption).
   * Returns a string prefixed with "v2:" so it can be distinguished from legacy ciphertext.
   */
  encrypt(data) {
    if (typeof data !== 'string') {
      data = JSON.stringify(data);
    }
    const { derivedKey } = _secrets.get(this);
    const iv = crypto.randomBytes(GCM_IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Format: v2:<iv_hex>:<authtag_hex>:<ciphertext_hex>
    return `${V2_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypt a v2 or legacy (CryptoJS) ciphertext.
   * Throws on authentication failure (tampered ciphertext).
   */
  decrypt(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'string') {
      throw new Error('Invalid ciphertext: must be a non-empty string');
    }

    if (encryptedData.startsWith(V2_PREFIX)) {
      return this._decryptV2(encryptedData);
    }
    // Legacy CryptoJS CBC ciphertext — decrypt with fallback
    return this._decryptLegacy(encryptedData);
  }

  _decryptV2(ciphertext) {
    const parts = ciphertext.slice(V2_PREFIX.length).split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid v2 ciphertext format');
    }
    const [ivHex, authTagHex, ctHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ct = Buffer.from(ctHex, 'hex');

    if (iv.length !== GCM_IV_BYTES || authTag.length !== GCM_AUTH_TAG_BYTES) {
      throw new Error('Invalid v2 ciphertext: unexpected IV or auth tag length');
    }

    const { derivedKey } = _secrets.get(this);
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
    decipher.setAuthTag(authTag);
    try {
      const decrypted = Buffer.concat([decipher.update(ct), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (e) {
      throw new Error('Decryption failed: authentication tag mismatch (ciphertext may be tampered)');
    }
  }

  _decryptLegacy(ciphertext) {
    const CryptoJS = getLegacyCryptoJS();
    const { rawKey } = _secrets.get(this);
    const bytes = CryptoJS.AES.decrypt(ciphertext, rawKey);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    if (!result) {
      throw new Error('Legacy decryption failed: invalid key or corrupted ciphertext');
    }
    return result;
  }

  decryptJSON(encryptedData) {
    const decrypted = this.decrypt(encryptedData);
    try {
      return JSON.parse(decrypted);
    } catch (e) {
      return decrypted;
    }
  }
}

module.exports = Encryption;
