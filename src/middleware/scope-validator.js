const { getTokenScopes, hasPermission, createAuditLog } = require('../database');

/**
 * Scope validation middleware
 * Checks if a token has the required scopes for an endpoint
 * Returns 403 if insufficient scope
 */
function requireScopes(requiredScopes = []) {
  return (req, res, next) => {
    try {
      // If no scopes required, allow access
      if (!requiredScopes || requiredScopes.length === 0) {
        return next();
      }

      // Get token from request (attached by auth middleware)
      const tokenId = req.tokenMeta?.tokenId;
      if (!tokenId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'No token found'
        });
      }

      // Get token scopes from database
      const tokenScopes = getTokenScopes(tokenId);

      // admin:* grants all permissions
      if (tokenScopes.includes('admin:*')) {
        req.tokenScopes = tokenScopes;
        return next();
      }

      // Check if token has required scopes
      if (Array.isArray(requiredScopes)) {
        const hasAllScopes = requiredScopes.every(scope => tokenScopes.includes(scope));
        if (!hasAllScopes) {
          // Log scope violation
          if (typeof createAuditLog === 'function') {
            createAuditLog({
              requesterId: tokenId,
              action: 'scope_violation',
              resource: req.path,
              scope: tokenScopes.join(','),
              ip: req.ip,
              details: {
                method: req.method,
                requiredScopes: requiredScopes,
                tokenScopes: tokenScopes
              }
            });
          }
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Insufficient scope for this endpoint'
          });
        }
      } else if (typeof requiredScopes === 'string') {
        if (!tokenScopes.includes(requiredScopes)) {
          // Log scope violation
          if (typeof createAuditLog === 'function') {
            createAuditLog({
              requesterId: tokenId,
              action: 'scope_violation',
              resource: req.path,
              scope: tokenScopes.join(','),
              ip: req.ip,
              details: {
                method: req.method,
                requiredScope: requiredScopes,
                tokenScopes: tokenScopes
              }
            });
          }
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Insufficient scope for this endpoint'
          });
        }
      }

      // Store scopes in request for later use
      req.tokenScopes = tokenScopes;
      next();
    } catch (error) {
      console.error('Scope validation error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to validate scopes'
      });
    }
  };
}

/**
 * Check scopes in-line (for use in route handlers)
 */
function checkScopes(tokenScopes, requiredScopes) {
  if (!requiredScopes || requiredScopes.length === 0) {
    return true;
  }

  if (tokenScopes.includes('admin:*')) {
    return true;
  }

  if (Array.isArray(requiredScopes)) {
    return requiredScopes.every(scope => tokenScopes.includes(scope));
  }

  return tokenScopes.includes(requiredScopes);
}

module.exports = {
  requireScopes,
  checkScopes
};
