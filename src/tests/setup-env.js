/**
 * Environment Setup
 * Runs BEFORE jest loads any modules
 * This ensures environment variables are set before Vault/Encryption are initialized
 */

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.PORT = '3001';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-must-be-32chars!';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-for-jest';
process.env.VAULT_KEY = process.env.VAULT_KEY || 'test-vault-key-must-be-32-chars!';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-jest';

// EPIPE is expected during jest --forceExit teardown: the HTTP server is killed
// mid-write when Jest closes open handles. Suppress it so it doesn't surface as
// a CI failure after tests have already passed.
process.on('uncaughtException', (err) => {
  if (err.code === 'EPIPE') return;
  throw err;
});
