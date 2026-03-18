/**
 * Environment Setup
 * Runs BEFORE jest loads any modules
 * This ensures environment variables are set before Vault/Encryption are initialized
 */

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.PORT = '3001';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-must-be-32chars!';
