const logger = require('../utils/logger');
const NotificationService = require('../services/notificationService');

// Authentication middleware
function authenticate(tokenManager, auditLog) {
  return async (req, res, next) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      
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

      // Attach token data to request
      req.tokenData = tokenData;

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
