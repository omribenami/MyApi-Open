'use strict';

const fs   = require('fs');
const path = require('path');

let _credsDir  = null;
let _credsFile = null;

// Called once from main.js after app.getPath('userData') is available
function init(userDataPath) {
  _credsDir  = userDataPath;
  _credsFile = path.join(userDataPath, 'afp-credentials.json');
}

function load() {
  if (!_credsFile) return null;
  try {
    if (fs.existsSync(_credsFile)) return JSON.parse(fs.readFileSync(_credsFile, 'utf8'));
  } catch (_) {}
  return null;
}

function save(creds) {
  if (!_credsDir) throw new Error('credentials.init() not called');
  if (!fs.existsSync(_credsDir)) fs.mkdirSync(_credsDir, { recursive: true });
  fs.writeFileSync(_credsFile, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

function clear() {
  try { if (_credsFile && fs.existsSync(_credsFile)) fs.unlinkSync(_credsFile); } catch (_) {}
}

module.exports = { init, load, save, clear };
