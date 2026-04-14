
// ============================================================================
// SECURITY FIX: Data Exposure & Logging Security
// CVSS: 4.3-6.5 (Medium)
// ============================================================================

/**
 * Sensitive data redaction in logs
 * CVSS 6.5: Sensitive data exposure in logs
 */
const SENSITIVE_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  apiKey: /api[_-]?key[:\s=]*[a-zA-Z0-9_-]{20,}/gi,
  token: /token[:\s=]*[a-zA-Z0-9._-]{20,}/gi,
  password: /password[:\s=]*[^\s,}]+/gi,
  creditCard: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
  ssn: /\d{3}-\d{2}-\d{4}/g,
  secret: /secret[:\s=]*[a-zA-Z0-9_-]{20,}/gi
};

function redactSensitiveData(text) {
  if (!text || typeof text !== 'string') return text;
  
  let redacted = text;
  
  // Redact emails: user@example.com → u***@example.com
  redacted = redacted.replace(SENSITIVE_PATTERNS.email, (match) => {
    const [user, domain] = match.split('@');
    return `${user.charAt(0)}***@${domain}`;
  });
  
  // Redact API keys: sk_live_abc123... → sk_live_***
  redacted = redacted.replace(SENSITIVE_PATTERNS.apiKey, (match) => {
    const prefix = match.split(/[:\s=]+/)[0];
    return `${prefix}=***`;
  });
  
  // Redact tokens: ***
  redacted = redacted.replace(SENSITIVE_PATTERNS.token, '***REDACTED_TOKEN***');
  
  // Redact passwords: ***
  redacted = redacted.replace(SENSITIVE_PATTERNS.password, '***REDACTED_PASSWORD***');
  
  // Redact credit cards: ****-****-****-1234
  redacted = redacted.replace(SENSITIVE_PATTERNS.creditCard, (match) => {
    const last4 = match.replace(/\D/g, '').slice(-4);
    return `****-****-****-${last4}`;
  });
  
  // Redact SSNs: ***-**-1234
  redacted = redacted.replace(SENSITIVE_PATTERNS.ssn, (match) => {
    const last4 = match.slice(-4);
    return `***-**-${last4}`;
  });
  
  // Redact secrets
  redacted = redacted.replace(SENSITIVE_PATTERNS.secret, '***REDACTED_SECRET***');
  
  return redacted;
}

/**
 * Safe logger that automatically redacts sensitive data
 * CVSS 6.5: OAuth token logging
 */
class SafeLogger {
  constructor(originalLogger) {
    this.logger = originalLogger;
  }
  
  log(level, message, meta = {}) {
    // Redact message
    const cleanMessage = redactSensitiveData(message);
    
    // Redact metadata
    const cleanMeta = this._redactObject(meta);
    
    // Never log auth headers, tokens, passwords
    delete cleanMeta.authorization;
    delete cleanMeta['x-api-key'];
    delete cleanMeta.password;
    delete cleanMeta.token;
    delete cleanMeta.secret;
    
    this.logger[level](cleanMessage, cleanMeta);
  }
  
  _redactObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const copy = { ...obj };
    
    Object.keys(copy).forEach(key => {
      const lowerKey = key.toLowerCase();
      
      // Skip sensitive keys entirely
      if (lowerKey.includes('secret') || 
          lowerKey.includes('token') || 
          lowerKey.includes('password') ||
          lowerKey.includes('key') ||
          lowerKey.includes('credential')) {
        delete copy[key];
      } else if (typeof copy[key] === 'string') {
        copy[key] = redactSensitiveData(copy[key]);
      }
    });
    
    return copy;
  }
  
  info(msg, meta) { this.log('info', msg, meta); }
  warn(msg, meta) { this.log('warn', msg, meta); }
  error(msg, meta) { this.log('error', msg, meta); }
  debug(msg, meta) { this.log('debug', msg, meta); }
}

/**
 * Prevent information disclosure in error messages
 * CVSS 6.1: Error message information disclosure
 */
function sanitizeErrorResponse(error, isDevelopment = false) {
  // In production, never expose internal details
  if (!isDevelopment) {
    return {
      error: 'An error occurred',
      code: error.code || 'INTERNAL_ERROR'
    };
  }
  
  // In development, provide more detail but still redact sensitive data
  return {
    error: redactSensitiveData(error.message),
    code: error.code,
    stack: isDevelopment ? error.stack : undefined
  };
}

/**
 * HTML injection prevention in email templates
 * CVSS 6.1: Email template injection
 */
function sanitizeEmailContent(template, variables = {}) {
  if (!template || typeof template !== 'string') return '';
  
  let result = template;
  
  // Replace variables safely
  Object.entries(variables).forEach(([key, value]) => {
    // Escape HTML entities in variable values
    const escaped = escapeHTML(String(value));
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), escaped);
  });
  
  return result;
}

function escapeHTML(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, char => map[char]);
}

module.exports = {
  redactSensitiveData,
  SafeLogger,
  sanitizeErrorResponse,
  sanitizeEmailContent,
  SENSITIVE_PATTERNS
};
