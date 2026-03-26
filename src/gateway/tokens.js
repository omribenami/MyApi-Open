const { getDatabase } = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class TokenManager {
  constructor() {
    this.db = getDatabase();
    this.saltRounds = 10;
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
      // Fallback: token_prefix column may not exist yet (pre-migration)
      const fallbackStmt = this.db.prepare(`
        SELECT id, name, type, token_hash, scope, created_at, expires_at, revoked, metadata
        FROM tokens
        WHERE revoked = 0
      `);
      candidates = fallbackStmt.all();
    }

    for (const tokenRecord of candidates) {
      const isValid = await bcrypt.compare(token, tokenRecord.token_hash);
      
      if (isValid) {
        // Check expiration
        if (tokenRecord.expires_at && Date.now() > tokenRecord.expires_at) {
          logger.warn('Token expired', { id: tokenRecord.id });
          return null;
        }

        return {
          id: tokenRecord.id,
          name: tokenRecord.name,
          type: tokenRecord.type,
          scope: JSON.parse(tokenRecord.scope),
          createdAt: tokenRecord.created_at,
          expiresAt: tokenRecord.expires_at,
          metadata: tokenRecord.metadata ? JSON.parse(tokenRecord.metadata) : {}
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
