'use strict';

const fs   = require('fs');
const path = require('path');

const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5 MB

let _logFile = null;

function init(logsPath) {
  _logFile = path.join(logsPath, 'afp.log');
  try { if (!fs.existsSync(logsPath)) fs.mkdirSync(logsPath, { recursive: true }); } catch (_) {}
}

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

function rotateMaybe() {
  if (!_logFile) return;
  try {
    const st = fs.statSync(_logFile);
    if (st.size > MAX_LOG_BYTES) {
      fs.renameSync(_logFile, _logFile + '.1');
    }
  } catch (_) {}
}

function write(level, msg) {
  const line = `[${ts()}] [${level}] ${msg}\n`;
  if (process.env.AFP_DEBUG || level !== 'DEBUG') {
    (level === 'ERROR' ? process.stderr : process.stdout).write(line);
  }
  if (_logFile) {
    rotateMaybe();
    try { fs.appendFileSync(_logFile, line); } catch (_) {}
  }
}

const info  = (m) => write('INFO ', m);
const warn  = (m) => write('WARN ', m);
const error = (m) => write('ERROR', m);
const debug = (m) => write('DEBUG', m);

module.exports = { init, info, warn, error, debug };
