const { getDatabase } = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Dummy hash used to equalize timing when no token candidates are found.
// Pre-computed at module load so it doesn't add latency on first request.
// This prevents timing attacks from distinguishing "prefix not found" from "prefix found but hash mismatch".
const DUMMY_HASH = '$2b$12$invalidhashvaluethatnevermatchesanyrealtoken00000000000';

class TokenManager {
  constructor() {
    this.db = getDatabase();
    this.saltRounds = 12;
  }

  // Generate a secure random token
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create a new token
  async createToken(name, type, scope, expiresInDays = null, metadata = {}) {
    if (!['personal', 'guest'].includes(type)) {
      throw new Error('Token type must be personal or guest');
    }

    const id = uuidv4();
    const token = this.generateToken();
    const tokenHash = await bcrypt.hash(token, this.saltRounds);
    const createdAt = Date.now();
    const expiresAt = expiresInDays ? createdAt + (expiresInDays * 24 * 60 * 60 * 1000) : null;

    const tokenPrefix = token.substring(0, 8);
    const stmt = this.db.prepare(`
      INSERT INTO tokens (id, name, type, token_hash, token_prefix, scope, created_at, expires_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      name,
      type,
      tokenHash,
      tokenPrefix,
      JSON.stringify(scope),
      createdAt,
      expiresAt,
      JSON.stringify(metadata)
    );

    logger.info('Token created', { id, name, type, scope });

    return {
      id,
      token, // Only returned once during creation
      name,
      type,
      scope,
      createdAt,
      expiresAt
    };
  }

  // Validate a token and return its details
  async validateToken(token) {
    // Optimization: use token prefix for fast lookup to avoid O(n) bcrypt comparisons
    const tokenPrefix = token.substring(0, 8);
    let candidates;
    try {
      const prefixStmt = this.db.prepare(`
        SELECT id, name, type, token_hash, scope, created_at, expires_at, revoked, metadata
        FROM tokens
        WHERE revoked = 0 AND token_prefix = ?
      `);
      candidates = prefixStmt.all(tokenPrefix);
    } catch (e) {
      // token_prefix column missing — migration not applied. Fail closed rather than
      // loading all tokens (O(n) bcrypt + timing leak). Run migrations to fix.
      logger.error('Token validation aborted: token_prefix column missing — run migrations', { error: e.message });
      return null;
    }

    // Timing equalization: always run at least one bcrypt.compare to prevent
    // timing-based prefix enumeration (distinguishing "not found" from "found, wrong hash").
    if (candidates.length === 0) {
      await bcrypt.compare(token, DUMMY_HASH); // result always false, but equalizes timing
      return null;
    }

    for (const tokenRecord of candidates) {
      const isValid = await bcrypt.compare(token, tokenRecord.token_hash);
      
      if (isValid) {
        // Check expiration
        if (tokenRecord.expires_at && Date.now() > tokenRecord.expires_at) {
          logger.warn('Token expired', { id: tokenRecord.id });
          return null;
        }

        let scope, metadata;
        try {
          scope = JSON.parse(tokenRecord.scope);
          // SECURITY FIX (HIGH - CVSS 7.3): Validate scope structure
          // Ensure scope is an array to prevent privilege escalation via malformed scope claims
          if (!Array.isArray(scope)) {
            logger.error('Invalid scope type in token record — treating as invalid', { id: tokenRecord.id, scopeType: typeof scope });
            return null;
          }
          // Validate each scope string
          if (!scope.every(s => typeof s === 'string' && /^[a-zA-Z0-9_:*\-]+$/.test(s))) {
            logger.error('Invalid scope format in token record — treating as invalid', { id: tokenRecord.id });
            return null;
          }
        } catch (e) {
          logger.error('Invalid scope JSON in token record — treating as invalid', { id: tokenRecord.id, error: e.message });
          return null;
        }
        try {
          metadata = tokenRecord.metadata ? JSON.parse(tokenRecord.metadata) : {};
        } catch {
          metadata = {};
        }
        return {
          id: tokenRecord.id,
          name: tokenRecord.name,
          type: tokenRecord.type,
          scope,
          createdAt: tokenRecord.created_at,
          expiresAt: tokenRecord.expires_at,
          metadata
        };
      }
    }

    return null;
  }

  // Revoke a token
  revokeToken(tokenId) {
    const stmt = this.db.prepare(`
      UPDATE tokens
      SET revoked = 1, revoked_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(Date.now(), tokenId);
    
    if (result.changes > 0) {
      logger.info('Token revoked', { tokenId });
      return true;
    }

    return false;
  }

  // List all tokens (without the actual token value)
  listTokens(includeRevoked = false) {
    const query = includeRevoked
      ? 'SELECT id, name, type, scope, created_at, expires_at, revoked, revoked_at, metadata FROM tokens'
      : 'SELECT id, name, type, scope, created_at, expires_at, revoked, revoked_at, metadata FROM tokens WHERE revoked = 0';
    
    const stmt = this.db.prepare(query);
    const tokens = stmt.all();

    return tokens.map(token => ({
      id: token.id,
      name: token.name,
      type: token.type,
      scope: JSON.parse(token.scope),
      createdAt: token.created_at,
      expiresAt: token.expires_at,
      revoked: token.revoked === 1,
      revokedAt: token.revoked_at,
      metadata: token.metadata ? JSON.parse(token.metadata) : {}
    }));
  }

  // Get token by ID (without hash)
  getTokenById(tokenId) {
    const stmt = this.db.prepare(`
      SELECT id, name, type, scope, created_at, expires_at, revoked, revoked_at, metadata
      FROM tokens
      WHERE id = ?
    `);

    const token = stmt.get(tokenId);
    
    if (!token) return null;

    return {
      id: token.id,
      name: token.name,
      type: token.type,
      scope: JSON.parse(token.scope),
      createdAt: token.created_at,
      expiresAt: token.expires_at,
      revoked: token.revoked === 1,
      revokedAt: token.revoked_at,
      metadata: token.metadata ? JSON.parse(token.metadata) : {}
    };
  }
}

module.exports = TokenManager;
