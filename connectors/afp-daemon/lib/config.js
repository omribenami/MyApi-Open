'use strict';

/**
 * Config file management for the AFP Daemon.
 *
 * Config is stored at:
 *   Linux/Mac  → ~/.myapi-afp/config.json
 *   Windows    → %APPDATA%\MyApi-AFP\config.json
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

function getConfigDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || os.homedir(), 'MyApi-AFP');
  }
  return path.join(os.homedir(), '.myapi-afp');
}

function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

function load() {
  const file = getConfigPath();
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

function save(config) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf8');
}

function clear() {
  const file = getConfigPath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

module.exports = { load, save, clear, getConfigDir, getConfigPath };
