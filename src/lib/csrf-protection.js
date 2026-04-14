
// ============================================================================
// SECURITY FIX: CSRF Protection
// CVSS: 6.5-7.5 (High)
// ============================================================================

const crypto = require('crypto');

/**
 * Generate cryptographically secure CSRF tokens
 * CVSS 6.5: Weak CSRF token generation
 */
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate CSRF token with timing-safe comparison
 * Prevents timing attacks on token comparison
 */
function validateCSRFToken(token, sessionToken) {
  if (!token || !sessionToken) {
    return false;
  }
  
  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(sessionToken)
  );
}

/**
 * CSRF Middleware - Protect state-changing operations
 * CVSS 7.2: Missing CSRF protection on POST/PUT/DELETE
 */
function csrfProtectionMiddleware() {
  return (req, res, next) => {
    // Skip GET, HEAD, OPTIONS (safe methods)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    
    // For state-changing operations, require CSRF token
    const token = req.body._csrf || req.headers['x-csrf-token'];
    const sessionToken = req.session?.csrfToken;
    
    if (!sessionToken) {
      req.session.csrfToken = generateCSRFToken();
      return res.status(403).json({ error: 'CSRF token missing, retry request' });
    }
    
    if (!token) {
      return res.status(403).json({ error: 'CSRF token required' });
    }
    
    try {
      if (!validateCSRFToken(token, sessionToken)) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }
    } catch (e) {
      return res.status(403).json({ error: 'CSRF validation failed' });
    }
    
    next();
  };
}

/**
 * Double-submit cookie pattern for CSRF
 * CVSS 6.5: State parameter validation bypass in OAuth
 */
function generateDoubleSubmitCookie() {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    cookieValue: token,
    submitValue: token,
    // Cookie should be HttpOnly=false, Secure=true, SameSite=Strict
  };
}

module.exports = {
  generateCSRFToken,
  validateCSRFToken,
  csrfProtectionMiddleware,
  generateDoubleSubmitCookie
};
