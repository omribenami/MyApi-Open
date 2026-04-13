const { getTokenScopes, hasPermission, createAuditLog, createComplianceAuditLog } = require('../database');
const alerting = require('../lib/alerting');

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

      // SECURITY FIX (CRITICAL - CVSS 9.8): Privilege Escalation via Wildcard Scope
      // Removed support for 'admin:*' wildcard scope. All scopes must be explicitly granted.
      // Wildcard scopes are deprecated and dangerous as they can grant unintended permissions.
      // Use explicit scope lists like ['admin:read', 'admin:write'] instead.
      if (tokenScopes.includes('admin:*')) {
        // Log wildcard scope usage for security audit
        if (typeof createAuditLog === 'function') {
          createAuditLog({
            requesterId: tokenId,
            action: 'wildcard_scope_detected',
            resource: req.path,
            scope: tokenScopes.join(','),
            ip: req.ip,
            severity: 'CRITICAL',
            details: {
              message: 'Token uses deprecated admin:* wildcard scope',
              method: req.method,
              timestamp: new Date().toISOString()
            }
          });
        }
        try {
          createComplianceAuditLog(
            req.headers?.['x-workspace-id'] || 'system', null,
            'wildcard_scope_violation', 'token', tokenId,
            JSON.stringify({ path: req.path, method: req.method, message: 'admin:* wildcard detected' }),
            req.ip, req.get('user-agent')
          );
        } catch (_) {}
        alerting.trackScopeViolation(req.ip);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Wildcard scopes are not permitted. Use explicit scope grants.'
        });
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
          try {
            createComplianceAuditLog(
              req.headers?.['x-workspace-id'] || 'system', null,
              'scope_violation', 'token', tokenId,
              JSON.stringify({ path: req.path, method: req.method, required: requiredScopes }),
              req.ip, req.get('user-agent')
            );
          } catch (_) {}
          alerting.trackScopeViolation(req.ip);
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
          try {
            createComplianceAuditLog(
              req.headers?.['x-workspace-id'] || 'system', null,
              'scope_violation', 'token', tokenId,
              JSON.stringify({ path: req.path, method: req.method, required: requiredScopes }),
              req.ip, req.get('user-agent')
            );
          } catch (_) {}
          alerting.trackScopeViolation(req.ip);
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
 * SECURITY: Wildcard scopes (admin:*) are NOT permitted
 */
function checkScopes(tokenScopes, requiredScopes) {
  if (!requiredScopes || requiredScopes.length === 0) {
    return true;
  }

  // SECURITY FIX (CRITICAL): Reject tokens with wildcard scopes
  if (tokenScopes.includes('admin:*')) {
    return false; // Wildcard scopes must be explicitly rejected
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
