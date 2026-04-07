#!/usr/bin/env node
/**
 * MyApi AFP OAuth Daemon — myapiai.com edition
 *
 * Authenticates via OAuth PKCE (no token pasting).
 * On first run: opens a browser (or prints a URL) → user logs in → credentials stored.
 * Subsequent runs: uses stored credentials and auto-reconnects.
 *
 * Stored at: ~/.myapi/afp-credentials.json
 */

'use strict';

const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const http     = require('http');
const https    = require('https');
const crypto   = require('crypto');
const { spawn, execSync } = require('child_process');
const WebSocket = require('ws');

// ─── Config ──────────────────────────────────────────────────────────────────

const MYAPI_URL    = (process.env.MYAPI_URL || 'https://myapiai.com').replace(/\/$/, '');
const AFP_ROOT     = process.env.AFP_ROOT || null;           // optional path jail
const DEVICE_NAME  = process.env.DEVICE_NAME || os.hostname();
const CREDS_DIR    = path.join(os.homedir(), '.myapi');
const CREDS_FILE   = path.join(CREDS_DIR, 'afp-credentials.json');
const CLIENT_ID    = 'myapi-afp';
const OAUTH_SCOPE  = 'full';

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(level, msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] [${level}] ${msg}`);
}
const info  = (m) => log('INFO ', m);
const warn  = (m) => log('WARN ', m);
const error = (m) => log('ERROR', m);

// ─── Credentials ─────────────────────────────────────────────────────────────

function loadCredentials() {
  try {
    if (fs.existsSync(CREDS_FILE)) {
      return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
    }
  } catch (_) {}
  return null;
}

function saveCredentials(creds) {
  if (!fs.existsSync(CREDS_DIR)) fs.mkdirSync(CREDS_DIR, { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

// ─── PKCE helpers ────────────────────────────────────────────────────────────

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ─── Open browser ────────────────────────────────────────────────────────────

function openBrowser(url) {
  try {
    const platform = process.platform;
    if (platform === 'darwin') execSync(`open "${url}"`);
    else if (platform === 'win32') execSync(`start "" "${url}"`);
    else execSync(`xdg-open "${url}"`);
    return true;
  } catch (_) {
    return false;
  }
}

// ─── Find a free local port ───────────────────────────────────────────────────

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpRequest(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
    };
    const req = lib.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (_) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function httpForm(url, formData, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = new URLSearchParams(formData).toString();
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    };
    const req = lib.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (_) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── OAuth PKCE flow ──────────────────────────────────────────────────────────

async function runOAuthFlow() {
  const port = await getFreePort();
  const redirectUri = `http://localhost:${port}/callback`;
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString('hex');

  const authUrl = new URL(`${MYAPI_URL}/api/v1/oauth-server/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', OAUTH_SCOPE);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  info('Starting OAuth login...');
  const opened = openBrowser(authUrl.toString());
  if (opened) {
    info('Browser opened. Please sign in to MyApi and authorize the AFP daemon.');
  } else {
    console.log('\n──────────────────────────────────────────────────────────────');
    console.log('  Open this URL in your browser to sign in:');
    console.log(`\n  ${authUrl.toString()}\n`);
    console.log('──────────────────────────────────────────────────────────────\n');
  }

  // Wait for callback
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      const receivedCode = url.searchParams.get('code');
      const receivedState = url.searchParams.get('state');
      const err = url.searchParams.get('error');

      if (err) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Authorization denied.</h2><p>You can close this window.</p></body></html>');
        server.close();
        reject(new Error(`OAuth denied: ${err}`));
        return;
      }

      if (!receivedCode || receivedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Invalid callback.</h2></body></html>');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html><body style="font-family:sans-serif;text-align:center;padding-top:80px">
        <h2 style="color:#22c55e">✓ Authorized!</h2>
        <p>MyApi AFP Daemon is now connected.</p>
        <p style="color:#94a3b8;font-size:14px">You can close this window.</p>
      </body></html>`);
      server.close();
      resolve(receivedCode);
    });
    server.listen(port, '127.0.0.1');
    server.on('error', reject);
    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('OAuth timeout — no response within 5 minutes'));
    }, 5 * 60 * 1000);
  });

  info('Authorization code received. Exchanging for token...');

  // Exchange code for access token
  const tokenRes = await httpForm(`${MYAPI_URL}/api/v1/oauth-server/token`, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  });

  if (tokenRes.status !== 200 || !tokenRes.body.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(tokenRes.body)}`);
  }

  const accessToken = tokenRes.body.access_token;
  info('Token obtained. Registering device...');

  // Register device with MyApi
  const regRes = await httpRequest(
    'POST',
    `${MYAPI_URL}/api/v1/afp/devices/register`,
    {
      deviceName: DEVICE_NAME,
      hostname: os.hostname(),
      platform: process.platform,
      arch: process.arch,
      capabilities: ['fs', 'exec'],
    },
    { Authorization: `Bearer ${accessToken}` }
  );

  if (regRes.status !== 200 || !regRes.body.deviceId) {
    throw new Error(`Device registration failed: ${JSON.stringify(regRes.body)}`);
  }

  const { deviceId, deviceToken } = regRes.body;
  info(`Device registered: ${deviceId}`);

  const creds = { accessToken, deviceId, deviceToken, registeredAt: new Date().toISOString() };
  saveCredentials(creds);
  info(`Credentials saved to ${CREDS_FILE}`);

  return creds;
}

// ─── Path safety ──────────────────────────────────────────────────────────────

function resolveSafe(inputPath) {
  if (AFP_ROOT) {
    const resolved = path.resolve(AFP_ROOT, inputPath.replace(/^[/\\]/, ''));
    if (!resolved.startsWith(path.resolve(AFP_ROOT))) throw new Error('Path escape detected');
    return resolved;
  }
  return path.resolve(inputPath);
}

// ─── File / exec operations ───────────────────────────────────────────────────

async function dispatch(op, params) {
  switch (op) {
    case 'ls': {
      const p = resolveSafe(params.path || '.');
      const entries = await fs.promises.readdir(p, { withFileTypes: true });
      return Promise.all(entries.map(async (e) => {
        try {
          const st = await fs.promises.stat(path.join(p, e.name));
          return { name: e.name, type: e.isDirectory() ? 'dir' : 'file', size: st.size, modified: st.mtime.toISOString() };
        } catch (_) {
          return { name: e.name, type: e.isDirectory() ? 'dir' : 'file', size: 0, modified: null };
        }
      }));
    }
    case 'read': {
      const p = resolveSafe(params.path);
      const buf = await fs.promises.readFile(p);
      const isBinary = buf.includes(0);
      return { content: isBinary ? buf.toString('base64') : buf.toString('utf8'), encoding: isBinary ? 'base64' : 'utf8' };
    }
    case 'write': {
      const p = resolveSafe(params.path);
      await fs.promises.mkdir(path.dirname(p), { recursive: true });
      await fs.promises.writeFile(p, params.content, params.encoding || 'utf8');
      return { ok: true };
    }
    case 'rm': {
      const p = resolveSafe(params.path);
      await fs.promises.rm(p, { recursive: params.recursive || false, force: true });
      return { ok: true };
    }
    case 'mkdir': {
      const p = resolveSafe(params.path);
      await fs.promises.mkdir(p, { recursive: params.recursive !== false });
      return { ok: true };
    }
    case 'stat': {
      const p = resolveSafe(params.path);
      const st = await fs.promises.stat(p);
      return { size: st.size, isDir: st.isDirectory(), isFile: st.isFile(), modified: st.mtime.toISOString(), mode: st.mode };
    }
    case 'exec': {
      return execOp(params);
    }
    default:
      throw new Error(`Unknown op: ${op}`);
  }
}

function execOp({ cmd, cwd, timeout = 30000 }) {
  return new Promise((resolve, reject) => {
    const hardLimit = Math.min(timeout, 60000);
    const proc = spawn(cmd, [], { shell: true, cwd });
    let stdout = '', stderr = '';
    const MAX_OUT = 1024 * 1024;
    proc.stdout.on('data', (d) => { stdout += d; if (stdout.length > MAX_OUT) proc.kill('SIGTERM'); });
    proc.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => { proc.kill('SIGTERM'); reject(new Error('Exec timeout')); }, hardLimit);
    proc.on('close', (code) => { clearTimeout(timer); resolve({ stdout, stderr, exitCode: code }); });
    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

// ─── WebSocket connection ─────────────────────────────────────────────────────

let backoff = 1000;

function connect(creds) {
  const wsUrl = MYAPI_URL.replace(/^http/, 'ws') + '/ws';
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    backoff = 1000;
    ws.send(JSON.stringify({
      type: 'afp:register',
      deviceId: creds.deviceId,
      deviceToken: creds.deviceToken,
      hostname: os.hostname(),
      platform: process.platform,
      arch: process.arch,
    }));
  });

  ws.on('message', (raw) => handleMessage(ws, raw));

  ws.on('close', () => {
    info(`Disconnected. Reconnecting in ${backoff / 1000}s...`);
    setTimeout(() => connect(creds), backoff);
    backoff = Math.min(backoff * 2, 30000);
  });

  ws.on('error', (err) => error(err.message));
}

async function handleMessage(ws, raw) {
  let data;
  try { data = JSON.parse(raw); } catch (_) { return; }

  if (data.type === 'afp:registered') {
    info(`Registered on server as ${data.deviceId}`);
    return;
  }
  if (data.type === 'afp:error') {
    error(`Server error: ${data.message}`);
    return;
  }
  if (data.type !== 'afp:command') return;

  const start = Date.now();
  try {
    const result = await dispatch(data.op, data.params);
    ws.send(JSON.stringify({ type: 'afp:result', requestId: data.requestId, ok: true, data: result, durationMs: Date.now() - start }));
  } catch (err) {
    ws.send(JSON.stringify({ type: 'afp:result', requestId: data.requestId, ok: false, error: err.message, durationMs: Date.now() - start }));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  info(`MyApi AFP OAuth Daemon starting — device: ${DEVICE_NAME}, server: ${MYAPI_URL}`);
  if (AFP_ROOT) info(`Path jail: ${AFP_ROOT}`);

  let creds = loadCredentials();

  if (!creds) {
    info('No credentials found — starting OAuth login flow...');
    try {
      creds = await runOAuthFlow();
    } catch (err) {
      error(`OAuth failed: ${err.message}`);
      process.exit(1);
    }
  } else {
    info(`Using stored credentials (device: ${creds.deviceId})`);
    info('To re-authenticate, delete ~/.myapi/afp-credentials.json and restart.');
  }

  info('Connecting to MyApi server...');
  connect(creds);
}

main().catch((err) => { error(err.message); process.exit(1); });
