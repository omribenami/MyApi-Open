#!/usr/bin/env node
/**
 * MyApi Agent Auth — myapiai.com
 *
 * Zero-dependency OAuth PKCE installer for AI agents.
 * Compatible with Node.js >= 10. Works on macOS, Linux, and Windows.
 *
 * Usage:
 *   node index.js                    # Interactive — opens browser, prints token
 *   node index.js --json             # Machine-readable JSON output
 *   node index.js --save             # Save token to ~/.myapi/agent-token.json
 *
 * Or run directly from the platform:
 *   curl -sL https://www.myapiai.com/api/v1/agent-auth/install.js | node
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const http   = require('http');
const https  = require('https');
const crypto = require('crypto');
const cp     = require('child_process');

// ─── Config ──────────────────────────────────────────────────────────────────

const MYAPI_URL  = (process.env.MYAPI_URL || 'https://www.myapiai.com').replace(/\/$/, '');
const CLIENT_ID  = 'myapi-agent';
const SCOPE      = 'full';
const CREDS_DIR  = path.join(os.homedir(), '.myapi');
const CREDS_FILE = path.join(CREDS_DIR, 'agent-token.json');

const args       = process.argv.slice(2);
const FLAG_JSON  = args.includes('--json');
const FLAG_SAVE  = args.includes('--save');
const FLAG_QUIET = args.includes('--quiet');

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(msg)   { if (!FLAG_JSON && !FLAG_QUIET) process.stderr.write(msg + '\n'); }
function banner(msg){ if (!FLAG_JSON && !FLAG_QUIET) process.stderr.write('\n' + msg + '\n'); }

// ─── Base64url (Node >= 10 compatible — no 'base64url' encoding needed) ──────

function toBase64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ─── PKCE ────────────────────────────────────────────────────────────────────

function pkce() {
  const verifierBuf = crypto.randomBytes(96);
  const verifier    = toBase64url(verifierBuf);
  const challenge   = toBase64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

// ─── Browser opener ──────────────────────────────────────────────────────────

function openBrowser(url) {
  // Use spawn (not execSync) so the browser process is detached and doesn't
  // block the Node event loop or inherit stdin from the curl pipe.
  const cmds = {
    darwin:  ['open',     [url]],
    win32:   ['cmd',      ['/c', 'start', '', url]],
    linux:   ['xdg-open', [url]],
  };
  const entry = cmds[process.platform] || cmds.linux;
  try {
    cp.spawn(entry[0], entry[1], { detached: true, stdio: 'ignore' }).unref();
    return true;
  } catch (_) {
    // Try common Mac paths if $PATH is minimal (e.g. inside cursor/IDE terminal)
    if (process.platform === 'darwin') {
      try {
        cp.spawn('/usr/bin/open', [url], { detached: true, stdio: 'ignore' }).unref();
        return true;
      } catch (_2) {}
    }
    return false;
  }
}

// ─── Free port ───────────────────────────────────────────────────────────────

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => resolve(p)); });
    srv.on('error', reject);
  });
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpPost(url, form) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const data   = Object.entries(form).map(([k, v]) =>
      encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + (parsed.search || ''),
      method:   'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
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

// ─── Callback HTML pages ──────────────────────────────────────────────────────

const SUCCESS_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MyApi — Authorized</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#020817;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
.card{background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:40px;
  max-width:400px;width:100%;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,.5)}
.dot{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#a855f7);margin:0 auto 24px}
.icon{width:56px;height:56px;border-radius:50%;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);
  display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:26px;color:#22c55e}
h1{font-size:22px;font-weight:700;color:#f1f5f9;margin-bottom:8px}
p{font-size:14px;color:#94a3b8;line-height:1.6;margin-top:8px}
</style>
</head>
<body>
  <div class="card">
    <div class="dot"></div>
    <div class="icon">&#10003;</div>
    <h1>Authorized!</h1>
    <p>Your AI agent now has a dedicated MyApi access token.</p>
    <p style="margin-top:16px;font-size:13px;color:#475569">You can close this window and return to your terminal.</p>
  </div>
</body></html>`;

const DENIED_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>MyApi — Denied</title>
<style>body{background:#020817;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;
  justify-content:center;min-height:100vh} .card{background:#0f172a;border:1px solid #7f1d1d;
  border-radius:16px;padding:40px;max-width:400px;text-align:center}</style></head>
<body><div class="card"><h1 style="color:#fca5a5">Authorization Denied</h1>
<p style="color:#94a3b8;margin-top:8px">You can close this window.</p></div></body></html>`;

// ─── OAuth PKCE flow ──────────────────────────────────────────────────────────

async function runOAuthFlow() {
  const port        = await getFreePort();
  const redirectUri = `http://localhost:${port}/callback`;
  const { verifier, challenge } = pkce();
  const state       = toBase64url(crypto.randomBytes(16));

  // Build auth URL manually to avoid URL class differences across Node versions
  const authUrl = MYAPI_URL + '/api/v1/oauth-server/authorize'
    + '?response_type=code'
    + '&client_id=' + encodeURIComponent(CLIENT_ID)
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&scope=' + encodeURIComponent(SCOPE)
    + '&state=' + encodeURIComponent(state)
    + '&code_challenge=' + encodeURIComponent(challenge)
    + '&code_challenge_method=S256';

  banner([
    '─────────────────────────────────────────────────────────────',
    '  MyApi Agent Auth',
    '─────────────────────────────────────────────────────────────',
  ].join('\n'));

  const opened = openBrowser(authUrl);
  if (opened) {
    log('✓ Browser opened — sign in to MyApi and click Authorize.');
    log('  If the browser did not open, copy this URL manually:\n');
    log('  ' + authUrl);
  } else {
    log('  Open this URL in your browser to authorize:\n');
    log('  ' + authUrl + '\n');
  }

  // Local HTTP server to receive the OAuth callback
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // Only handle /callback — ignore favicon, etc.
      if (!req.url || !req.url.startsWith('/callback')) {
        res.writeHead(404);
        res.end();
        return;
      }

      // Parse query string manually for Node 10 compat
      const qs   = req.url.split('?')[1] || '';
      const params = {};
      qs.split('&').forEach(p => {
        const [k, v] = p.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });

      const code = params['code'];
      const err  = params['error'];

      if (err || !code || params['state'] !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(DENIED_HTML);
        server.close();
        reject(new Error(err ? ('Authorization denied: ' + err) : 'Invalid callback (state mismatch or missing code)'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(SUCCESS_HTML);
      server.close();
      resolve(code);
    });

    server.listen(port, '127.0.0.1', () => {
      log('  Waiting for browser authorization (timeout: 5 min)...');
    });

    server.on('error', (e) => {
      reject(new Error('Could not start local callback server: ' + e.message));
    });

    setTimeout(() => {
      server.close();
      reject(new Error('Timeout: no browser response within 5 minutes'));
    }, 5 * 60 * 1000);
  });

  log('\n✓ Authorization received — exchanging for token...');

  const resp = await httpPost(MYAPI_URL + '/api/v1/oauth-server/token', {
    grant_type:    'authorization_code',
    code,
    redirect_uri:  redirectUri,
    client_id:     CLIENT_ID,
    code_verifier: verifier,
  });

  if (!resp.body || !resp.body.access_token) {
    throw new Error('Token exchange failed (' + resp.status + '): ' + JSON.stringify(resp.body));
  }

  return resp.body.access_token;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Node version check — require >= 10
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 10) {
    process.stderr.write('Error: Node.js >= 10 required (you have ' + process.versions.node + ')\n');
    process.stderr.write('Upgrade: https://nodejs.org/en/download\n');
    process.exit(1);
  }

  let token;
  try {
    token = await runOAuthFlow();
  } catch (err) {
    process.stderr.write('\nError: ' + err.message + '\n');
    process.exit(1);
  }

  if (FLAG_SAVE) {
    try {
      if (!fs.existsSync(CREDS_DIR)) fs.mkdirSync(CREDS_DIR, { recursive: true });
      fs.writeFileSync(CREDS_FILE, JSON.stringify({ token, savedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
      log('✓ Token saved to ' + CREDS_FILE);
    } catch (e) {
      process.stderr.write('Warning: could not save token: ' + e.message + '\n');
    }
  }

  if (FLAG_JSON) {
    process.stdout.write(JSON.stringify({ token }) + '\n');
  } else {
    process.stdout.write([
      '',
      '╔══════════════════════════════════════════════════════════════╗',
      '║            Your MyApi Agent Token                           ║',
      '╚══════════════════════════════════════════════════════════════╝',
      '',
      '  ' + token,
      '',
      '  Use it as:  Authorization: Bearer <token>',
      FLAG_SAVE
        ? '  Saved to:   ' + CREDS_FILE
        : '  Tip: re-run with --save to store in ~/.myapi/agent-token.json',
      '',
    ].join('\n'));
  }
}

main();
