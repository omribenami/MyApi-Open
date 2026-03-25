/**
 * Tests for master token persistence across logins.
 *
 * The master token is the API key a user gives to AI agents – it must NEVER
 * change unless the user explicitly regenerates it via
 * POST /tokens/master/regenerate.
 */

const crypto = require('crypto');

describe('Master Token Persistence', () => {
  let dbModule;

  beforeAll(() => {
    // Ensure at least one encryption key is available for the fallback logic
    process.env.ENCRYPTION_KEY =
      process.env.ENCRYPTION_KEY || 'test-encryption-key-must-be-32chars!';

    dbModule = require('../database');
    dbModule.initDatabase();
  });

  afterAll(() => {
    try { dbModule.db.close(); } catch (e) { console.error('Test cleanup error:', e.message); }
  });

  // ---------------------------------------------------------------
  // Helper: create a user so we have a valid owner_id for tokens
  // ---------------------------------------------------------------
  function createTestUser(suffix = '') {
    const unique = crypto.randomBytes(8).toString('hex');
    return dbModule.createUser(
      `testuser${suffix}_${unique}`,
      'Test User',
      `test${suffix}_${unique}@example.com`,
      'UTC',
      'hashedpassword'
    );
  }

  // ---------------------------------------------------------------
  // 1. encryptRawToken / decryptRawToken work with ENCRYPTION_KEY
  //    fallback when VAULT_KEY is not set
  // ---------------------------------------------------------------
  describe('encryption fallback', () => {
    const originalVaultKey = process.env.VAULT_KEY;

    afterEach(() => {
      // Restore
      if (originalVaultKey !== undefined) {
        process.env.VAULT_KEY = originalVaultKey;
      } else {
        delete process.env.VAULT_KEY;
      }
    });

    test('encryptRawToken should succeed using ENCRYPTION_KEY when VAULT_KEY is unset', () => {
      delete process.env.VAULT_KEY;
      // ENCRYPTION_KEY is set in beforeAll
      const raw = 'myapi_' + crypto.randomBytes(32).toString('hex');
      const encrypted = dbModule.encryptRawToken(raw);

      expect(encrypted).not.toBeNull();

      const decrypted = dbModule.decryptRawToken(encrypted);
      expect(decrypted).toBe(raw);
    });

    test('decryptRawToken should recover token encrypted with ENCRYPTION_KEY even when VAULT_KEY is set later', () => {
      delete process.env.VAULT_KEY;
      const raw = 'myapi_' + crypto.randomBytes(32).toString('hex');
      const encrypted = dbModule.encryptRawToken(raw);
      expect(encrypted).not.toBeNull();

      // Simulate setting VAULT_KEY after the token was encrypted
      process.env.VAULT_KEY = 'brand-new-vault-key-for-testing!!';

      // Should still be able to decrypt by trying ENCRYPTION_KEY as fallback
      const decrypted = dbModule.decryptRawToken(encrypted);
      expect(decrypted).toBe(raw);
    });
  });

  // ---------------------------------------------------------------
  // 2. getExistingMasterToken returns the same token across calls
  // ---------------------------------------------------------------
  describe('getExistingMasterToken', () => {
    test('should return the same token on repeated calls', () => {
      const user = createTestUser('persist');
      const raw = 'myapi_' + crypto.randomBytes(32).toString('hex');
      const bcrypt = require('bcrypt');
      const hash = bcrypt.hashSync(raw, 4); // low cost for test speed
      dbModule.createAccessToken(hash, user.id, 'full', 'Master Token', null, null, null, raw);

      const first = dbModule.getExistingMasterToken(user.id);
      const second = dbModule.getExistingMasterToken(user.id);

      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(first.rawToken).toBe(raw);
      expect(second.rawToken).toBe(raw);
      expect(first.tokenId).toBe(second.tokenId);
    });

    test('should return null for a user with no master token', () => {
      const user = createTestUser('empty');
      const result = dbModule.getExistingMasterToken(user.id);
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // 3. Login flow must NOT create or revoke master tokens
  //    (We test the database-level invariant: after a "login", the
  //     set of active full-scope tokens must be unchanged.)
  // ---------------------------------------------------------------
  describe('login must not change master tokens', () => {
    test('active full-scope tokens should be unchanged after simulated login', () => {
      const user = createTestUser('login');
      const raw = 'myapi_' + crypto.randomBytes(32).toString('hex');
      const bcrypt = require('bcrypt');
      const hash = bcrypt.hashSync(raw, 4); // low cost for test speed (production uses 10)
      const tokenId = dbModule.createAccessToken(hash, user.id, 'full', 'Master Token', null, null, null, raw);

      // Snapshot tokens before login
      const before = dbModule.db
        .prepare("SELECT id, revoked_at FROM access_tokens WHERE owner_id = ? AND scope = 'full'")
        .all(user.id);

      // Simulate login: only read, never write
      const existing = dbModule.getExistingMasterToken(user.id);
      expect(existing).not.toBeNull();
      expect(existing.rawToken).toBe(raw);
      expect(existing.tokenId).toBe(tokenId);

      // Snapshot tokens after login
      const after = dbModule.db
        .prepare("SELECT id, revoked_at FROM access_tokens WHERE owner_id = ? AND scope = 'full'")
        .all(user.id);

      // Token set must be identical — no new tokens, no revocations
      expect(after).toEqual(before);
    });
  });
});
