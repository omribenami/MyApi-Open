'use strict';

/**
 * PID file management for AFP Daemon.
 * Lets users check status, view logs, and stop the daemon via CLI flags.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

function getPidPath() {
  const dir = process.platform === 'win32'
    ? path.join(process.env.APPDATA || os.homedir(), 'MyApi-AFP')
    : path.join(os.homedir(), '.myapi-afp');
  return path.join(dir, 'daemon.pid');
}

function write() {
  const pidPath = getPidPath();
  const dir = path.dirname(pidPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(pidPath, String(process.pid), 'utf8');
}

function clear() {
  try { fs.unlinkSync(getPidPath()); } catch (_) {}
}

function read() {
  try { return parseInt(fs.readFileSync(getPidPath(), 'utf8').trim(), 10); } catch (_) { return null; }
}

function isAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (_) { return false; }
}

// ── CLI handlers (called before daemon starts) ────────────────────────────────

function handleStatusFlag(logger) {
  const pid = read();
  if (pid && isAlive(pid)) {
    console.log(`AFP Daemon is RUNNING  (PID ${pid})`);
    console.log(`Log file: ${require('./logger').getLogPath()}`);
  } else {
    console.log('AFP Daemon is NOT running.');
    if (pid) {
      clear(); // stale PID
      console.log('(Stale PID file removed.)');
    }
  }
  process.exit(0);
}

function handleStopFlag() {
  const pid = read();
  if (!pid || !isAlive(pid)) {
    console.log('AFP Daemon is not running.');
    process.exit(0);
  }
  try {
    process.kill(pid, 'SIGTERM');
    console.log(`Sent SIGTERM to PID ${pid}. Daemon will stop.`);
    clear();
  } catch (e) {
    console.error(`Failed to stop daemon: ${e.message}`);
    process.exit(1);
  }
  process.exit(0);
}

function handleLogsFlag() {
  const logPath = require('./logger').getLogPath();
  if (!fs.existsSync(logPath)) {
    console.log(`No log file found at: ${logPath}`);
    process.exit(0);
  }
  // Print last 100 lines
  const content = fs.readFileSync(logPath, 'utf8');
  const lines   = content.split('\n').filter(Boolean);
  const tail    = lines.slice(-100);
  console.log(`=== Last ${tail.length} log entries from ${logPath} ===\n`);
  tail.forEach(l => console.log(l));
  process.exit(0);
}

module.exports = { write, clear, read, isAlive, getPidPath, handleStatusFlag, handleStopFlag, handleLogsFlag };
