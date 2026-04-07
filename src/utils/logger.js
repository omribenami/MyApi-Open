const fs = require('fs');
const path = require('path');

class Logger {
  constructor(logDir = './logs') {
    this.logDir = logDir;
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
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
    const { getCurrentRequestId } = require('../lib/request-context');
    const requestId = getCurrentRequestId();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(requestId ? { requestId } : {}),
      ...normMeta
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    const logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
    
    fs.appendFileSync(logFile, logLine);
    
    // Also console log in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, meta);
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
