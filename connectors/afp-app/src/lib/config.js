'use strict';

const fs   = require('fs');
const path = require('path');

let _cfgDir  = null;
let _cfgFile = null;

// Called once from main.js after app.getPath('userData') is available
function init(userDataPath) {
  _cfgDir  = userDataPath;
  _cfgFile = path.join(userDataPath, 'config.json');
}

function load() {
  if (!_cfgFile) return null;
  try {
    if (fs.existsSync(_cfgFile)) return JSON.parse(fs.readFileSync(_cfgFile, 'utf8'));
  } catch (_) {}
  return null;
}

function save(cfg) {
  if (!_cfgDir) throw new Error('config.init() not called');
  if (!fs.existsSync(_cfgDir)) fs.mkdirSync(_cfgDir, { recursive: true });
  fs.writeFileSync(_cfgFile, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

function clear() {
  try { if (_cfgFile && fs.existsSync(_cfgFile)) fs.unlinkSync(_cfgFile); } catch (_) {}
}

module.exports = { init, load, save, clear };
