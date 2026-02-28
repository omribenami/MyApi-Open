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
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
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
