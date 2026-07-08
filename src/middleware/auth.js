const crypto = require('crypto');
const logger = require('../utils/logger');
const NotificationService = require('../services/notificationService');
const { getDatabase } = require('../config/database');
const { checkRequest: securityCheck } = require('../lib/tokenSecurityMonitor');

function tryAscOnlyAuth(req) {
  try {
    const pubKeyB64 = req.headers['x-agent-publickey'];
    const sigB64    = req.headers['x-agent-signature'];
    const tsHeader  = req.headers['x-agent-timestamp'];
    if (!pubKeyB64 || !sigB64 || !tsHeader) return null;

    const ts = parseInt(tsHeader, 10);
    if (isNaN(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 60) return null;

    // Normalize to the raw 32-byte Ed25519 key so the fingerprint matches the one
    // computed at registration / in the live auth path (index.js). A 44-byte SPKI
    // key must have its 12-byte header stripped first; anything else is invalid.
    let rawPub = Buffer.from(pubKeyB64, 'base64');
    if (rawPub.length === 44) rawPub = rawPub.slice(12);
    if (rawPub.length !== 32) return null;
    const fingerprint = crypto.createHash('sha256').update(rawPub).digest('hex').substring(0, 32);

    const db = getDatabase();
    const { getApprovedDeviceByKeyFingerprintGlobal } = require('../database');
    const device = getApprovedDeviceByKeyFingerprintGlobal(fingerprint);
    if (!device) return null;

    const spki   = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), rawPub]);
    const keyObj = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
    const msg    = Buffer.from(`${tsHeader}:${fingerprint}`);
    const valid  = crypto.verify(null, msg, keyObj, Buffer.from(sigB64, 'base64'));
    if (!valid) return null;

    // Scoped ASC keys carry the registering token's scope (JSON array only);
    // legacy 'read'/'full' device values keep their original semantics.
    const boundScope = typeof device.scope === 'string' && device.scope.startsWith('[') ? device.scope : null;
    return {
      id:      `asc_${fingerprint}`,
      tokenId: fingerprint,
      ownerId: String(device.user_id),
      userId:  String(device.user_id),
      type:    'asc',
      tokenType: boundScope ? 'guest' : 'master',
      scope:   boundScope || 'full',
      name:    device.device_name || 'ASC Agent',
    };
  } catch {
    return null;
  }
}

// Authentication middleware
function authenticate(tokenManager, auditLog) {
  return async (req, res, next) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;

      // ASC-only path: no bearer token but valid signed ASC headers from an approved key
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const ascMeta = tryAscOnlyAuth(req);
        if (ascMeta) {
          req.tokenData = ascMeta;
          req.tokenMeta = ascMeta;
          req.userId    = ascMeta.userId;
          return next();
        }
      }

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        auditLog.log({
          action: 'auth_failed',
          endpoint: req.path,
          method: req.method,
          status: 401,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          details: { reason: 'Missing or invalid authorization header' }
        });
        
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header'
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Validate token
      const tokenData = await tokenManager.validateToken(token);

      if (!tokenData) {
        auditLog.log({
          action: 'auth_failed',
          endpoint: req.path,
          method: req.method,
          status: 401,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          details: { reason: 'Invalid or expired token' }
        });
        
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired token'
        });
      }

      // Check suspension before doing anything else
      try {
        const db = getDatabase();
        const suspension =
          db.prepare(`SELECT suspended_at, suspension_reason FROM access_tokens WHERE id = ? AND suspended_at IS NOT NULL`).get(tokenData.id) ||
          db.prepare(`SELECT suspended_at, suspension_reason FROM tokens WHERE id = ? AND suspended_at IS NOT NULL AND suspended_at != 0`).get(tokenData.id);
        if (suspension) {
          return res.status(403).json({
            error: 'Token Suspended',
            message: 'This token was suspended due to suspicious activity. Check your notifications to review and re-approve.',
            code: 'TOKEN_SUSPENDED',
            reason: suspension.suspension_reason,
          });
        }
      } catch (e) {
        logger.error('[Auth] Suspension check DB error — failing closed:', e.message);
        return res.status(500).json({ error: 'Internal server error', message: 'Authentication failed' });
      }

      // Attach token data to request (both names — auth.js uses tokenData, routes use tokenMeta)
      req.tokenData = tokenData;
      req.tokenMeta = tokenData;

      // Security anomaly detection — blocks current request if suspicious
      try {
        const secResult = await securityCheck(req, tokenData.id, tokenData.type);
        if (secResult.blocked) {
          auditLog.log({
            tokenId: tokenData.id,
            tokenType: tokenData.type,
            action: 'token_security_blocked',
            endpoint: req.path,
            method: req.method,
            status: 403,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            details: { reasons: secResult.reasons },
          });
          return res.status(403).json({
            error: 'Token Suspended',
            message: secResult.message,
            code: 'TOKEN_SUSPENDED',
            approvalId: secResult.approvalId,
          });
        }
      } catch (e) {
        logger.error('[Auth] Security check error:', e.message);
      }

      // Log successful authentication
      auditLog.log({
        tokenId: tokenData.id,
        tokenType: tokenData.type,
        requester: tokenData.name,
        action: 'auth_success',
        endpoint: req.path,
        method: req.method,
        scope: tokenData.scope,
        status: 200,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      // Emit guest token usage notification if this is a guest token
      if (tokenData.type === 'guest' && tokenData.ownerId) {
        NotificationService.logActivity(tokenData.ownerId, 'guest_token_used', 'guest_token', {
          resourceId: tokenData.id,
          resourceName: tokenData.name,
          actorType: 'guest_token',
          actorId: tokenData.id,
          details: { endpoint: req.path, method: req.method },
          result: 'success',
          ipAddress: req.ip,
        }).catch(err => logger.error('Failed to log guest token activity:', err));
      }

      next();
    } catch (error) {
      logger.error('Authentication error', { error: error.message });
      
      auditLog.log({
        action: 'auth_error',
        endpoint: req.path,
        method: req.method,
        status: 500,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: { error: 'Authentication processing error' }
      });
      
      res.status(500).json({
        error: 'Internal server error',
        message: 'Authentication failed'
      });
    }
  };
}

// Require personal token
function requirePersonal(req, res, next) {
  if (req.tokenData.type !== 'personal') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This endpoint requires a personal token'
    });
  }
  next();
}

// Require specific scope
function requireScope(scopeKey) {
  return (req, res, next) => {
    const { scope } = req.tokenData;
    
    if (!scope[scopeKey]) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This endpoint requires '${scopeKey}' scope`
      });
    }
    
    next();
  };
}

module.exports = {
  authenticate,
  requirePersonal,
  requireScope
};
