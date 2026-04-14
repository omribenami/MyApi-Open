'use strict';

/**
 * AFP Daemon logger — writes to both stdout and ~/.myapi-afp/daemon.log
 * Rotates log at 5 MB. Thread-safe enough for single-process use.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5 MB

function getLogPath() {
  const dir = process.platform === 'win32'
    ? path.join(process.env.APPDATA || os.homedir(), 'MyApi-AFP')
    : path.join(os.homedir(), '.myapi-afp');
  return path.join(dir, 'daemon.log');
}

function ensureLogDir(logPath) {
  const dir = path.dirname(logPath);
  // 0o700: owner read/write/execute only — prevents other local users from reading logs
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function rotatIfNeeded(logPath) {
  try {
    const stat = fs.statSync(logPath);
    if (stat.size > MAX_LOG_BYTES) {
      const rotated = logPath + '.1';
      if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
      fs.renameSync(logPath, rotated);
    }
  } catch (_) {}
}

function write(level, args) {
  const ts  = new Date().toISOString();
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  const line = `[${ts}] [${level}] ${msg}\n`;

  // stdout / stderr
  if (level === 'ERROR') process.stderr.write(line);
  else process.stdout.write(line);

  // file
  try {
    const logPath = getLogPath();
    ensureLogDir(logPath);
    rotatIfNeeded(logPath);
    // 0o640: owner read/write, group read, others none
    fs.appendFileSync(logPath, line, { mode: 0o640 });
  } catch (_) {}
}

const logger = {
  info:  (...args) => write('INFO ', args),
  warn:  (...args) => write('WARN ', args),
  error: (...args) => write('ERROR', args),
  debug: (...args) => { if (process.env.AFP_DEBUG) write('DEBUG', args); },
  getLogPath,
};

module.exports = logger;
