
// ============================================================================
// SECURITY FIX: Miscellaneous Security Issues
// CVSS: 3.7-6.5 (Medium/Low)
// ============================================================================

/**
 * Account enumeration prevention
 * CVSS 5.3: Account enumeration via OAuth signup
 */
function preventAccountEnumeration(existingUser, nonExistingUser) {
  // Return identical response whether user exists or not
  return {
    message: 'If account exists, check your email for next steps',
    email: '***@***.***', // Don't reveal whether email was found
    timestamp: Date.now()
  };
}

/**
 * Weak device token generation fix
 * CVSS 4.3: Predictable device tokens
 */
const crypto = require('crypto');

function generateStrongDeviceToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Dynamic code execution prevention
 * CVSS 8.1: Code injection in migrations or role assignment
 */
class SafeCodeExecutor {
  constructor() {
    // Whitelist of allowed function names that can be "executed"
    this.whitelist = [
      'addRole',
      'removeRole',
      'updatePermission',
      'grantAccess',
      'revokeAccess'
    ];
  }
  
  execute(functionName, args) {
    // Never use eval() or Function constructor
    if (!this.whitelist.includes(functionName)) {
      throw new Error(`Function not allowed: ${functionName}`);
    }
    
    // Call functions by name from a safe map, never dynamically
    const handlers = {
      'addRole': (user, role) => this._addRole(user, role),
      'removeRole': (user, role) => this._removeRole(user, role),
      'updatePermission': (role, perm, allowed) => this._updatePermission(role, perm, allowed),
      'grantAccess': (user, resource) => this._grantAccess(user, resource),
      'revokeAccess': (user, resource) => this._revokeAccess(user, resource)
    };
    
    const handler = handlers[functionName];
    if (!handler) {
      throw new Error(`No handler for: ${functionName}`);
    }
    
    return handler(...args);
  }
  
  _addRole(user, role) { /* implementation */ }
  _removeRole(user, role) { /* implementation */ }
  _updatePermission(role, perm, allowed) { /* implementation */ }
  _grantAccess(user, resource) { /* implementation */ }
  _revokeAccess(user, resource) { /* implementation */ }
}

/**
 * Rate limiting for brute force prevention
 * CVSS 6.5: No rate limiting on authentication attempts
 */
class RateLimiter {
  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.attempts = new Map();
  }
  
  isLimited(identifier) {
    const now = Date.now();
    // Atomic read-modify-write: read current state, compute new state, write atomically.
    // Node.js is single-threaded so this is safe without a mutex for in-process use.
    const current = this.attempts.get(identifier) || [];

    // Remove attempts outside the sliding window
    const recentAttempts = current.filter(time => now - time < this.windowMs);

    if (recentAttempts.length >= this.maxAttempts) {
      // Write back the pruned list (don't add this attempt — already limited)
      this.attempts.set(identifier, recentAttempts);
      return true;
    }

    // Record this attempt and write back atomically
    recentAttempts.push(now);
    this.attempts.set(identifier, recentAttempts);

    return false;
  }
  
  reset(identifier) {
    this.attempts.delete(identifier);
  }
}

/**
 * Input validation framework
 * CVSS 6.5+: Various input-based attacks
 */
class InputValidator {
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  static validateUsername(username) {
    // Alphanumeric, underscore, hyphen only, 3-30 chars
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    return usernameRegex.test(username);
  }
  
  static validateURL(urlString) {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  }
  
  static validateJSON(jsonString) {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  }
  
  static validateInteger(value, min = 0, max = 999999) {
    const num = parseInt(value, 10);
    return !isNaN(num) && num >= min && num <= max;
  }
  
  static validateUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}

/**
 * Secure default settings
 * CVSS 4.3: Weak default configuration
 */
const SECURE_DEFAULTS = {
  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    maxAge: 3600000, // 1 hour
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  },
  
  // Password requirements
  password: {
    minLength: 12,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecial: true
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
  },
  
  // CORS — credentials:true requires an explicit origin allowlist (never '*')
  cors: {
    origin: (origin, callback) => {
      const allowed = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];
      // Allow requests with no origin (same-origin, server-to-server)
      if (!origin) return callback(null, true);
      if (allowed.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin not allowed: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
};

module.exports = {
  preventAccountEnumeration,
  generateStrongDeviceToken,
  SafeCodeExecutor,
  RateLimiter,
  InputValidator,
  SECURE_DEFAULTS
};
