const fs = require('fs');
const path = require('path');

// Sensitive field names — values are redacted before logging
const LOG_SENSITIVE_FIELDS = new Set([
  'password', 'password_hash', 'token', 'secret', 'hash', 'authorization',
  'access_token', 'refresh_token', 'api_key', 'private_key', 'client_secret',
  'session_token', 'cookie', 'credential', 'credentials', 'auth', 'bearer'
]);

/**
 * Recursively redact sensitive keys from a meta object before logging.
 */
function redactMeta(obj, depth = 0) {
  if (depth > 5 || obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => redactMeta(item, depth + 1));
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = LOG_SENSITIVE_FIELDS.has(k.toLowerCase()) ? '[REDACTED]' : redactMeta(v, depth + 1);
  }
  return result;
}

/**
 * Strip newline/control characters from log message string to prevent log injection.
 */
function sanitizeLogMessage(msg) {
  if (typeof msg !== 'string') return String(msg);
  return msg.replace(/[\r\n\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
}

class Logger {
  constructor(logDir = './logs') {
    this.logDir = logDir;
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true, mode: 0o750 });
    }
  }

  _write(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    // Normalise meta: if a non-object was passed (string, number, Error) wrap it
    let normMeta = meta;
    if (meta instanceof Error) {
      normMeta = { error: meta.message, stack: meta.stack };
    } else if (typeof meta !== 'object' || meta === null) {
      normMeta = { detail: meta };
    }
    // Redact sensitive fields from meta before logging
    normMeta = redactMeta(normMeta);

    const { getCurrentRequestId } = require('../lib/request-context');
    const requestId = getCurrentRequestId();
    const logEntry = {
      timestamp,
      level,
      message: sanitizeLogMessage(message),
      ...(requestId ? { requestId } : {}),
      ...normMeta
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    const logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);

    // Write with restricted permissions (owner read/write, group read, others none)
    fs.appendFileSync(logFile, logLine, { mode: 0o640 });

    // Also console log in development — but still redact sensitive fields
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${timestamp}] ${level.toUpperCase()}: ${sanitizeLogMessage(message)}`);
    }
  }

  info(message, meta) {
    this._write('info', message, meta);
  }

  warn(message, meta) {
    this._write('warn', message, meta);
  }

  error(message, meta) {
    this._write('error', message, meta);
  }

  debug(message, meta) {
    this._write('debug', message, meta);
  }
}

module.exports = new Logger();
