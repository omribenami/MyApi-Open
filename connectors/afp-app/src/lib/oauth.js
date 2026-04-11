'use strict';

const http   = require('http');
const crypto = require('crypto');
const os     = require('os');
const { httpRequest, httpForm } = require('./http');

const CLIENT_ID   = 'myapi-afp';
const OAUTH_SCOPE = 'full';

function generateCodeVerifier()          { return crypto.randomBytes(32).toString('base64url'); }
function generateCodeChallenge(verifier) { return crypto.createHash('sha256').update(verifier).digest('base64url'); }

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => resolve(p)); });
    srv.on('error', reject);
  });
}

/**
 * @param {object} opts
 * @param {string}   opts.serverUrl   - e.g. 'https://myapiai.com'
 * @param {string}   opts.deviceName  - shown in success page + registered on server
 * @param {string|null} opts.afpRoot  - optional path jail
 * @param {Function} opts.openUrl     - (url: string) => void  (Electron: shell.openExternal)
 * @returns {Promise<{ accessToken, deviceId, deviceToken, deviceName, serverUrl, afpRoot, registeredAt }>}
 */
async function runOAuthFlow({ serverUrl, deviceName, afpRoot, openUrl }) {
  const base        = serverUrl.replace(/\/$/, '');
  const port        = await getFreePort();
  const redirectUri = `http://localhost:${port}/callback`;
  const verifier    = generateCodeVerifier();
  const challenge   = generateCodeChallenge(verifier);
  const state       = crypto.randomBytes(16).toString('hex');
  const name        = deviceName || os.hostname();

  const authUrl = new URL(`${base}/api/v1/oauth-server/authorize`);
  authUrl.searchParams.set('response_type',         'code');
  authUrl.searchParams.set('client_id',             CLIENT_ID);
  authUrl.searchParams.set('redirect_uri',          redirectUri);
  authUrl.searchParams.set('scope',                 OAUTH_SCOPE);
  authUrl.searchParams.set('state',                 state);
  authUrl.searchParams.set('code_challenge',        challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  openUrl(authUrl.toString());

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      const receivedCode  = url.searchParams.get('code');
      const receivedState = url.searchParams.get('state');
      const err           = url.searchParams.get('error');

      if (err) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Authorization denied.</h2><p>You can close this window.</p></body></html>');
        server.close();
        return reject(new Error(`OAuth denied: ${err}`));
      }
      if (!receivedCode || receivedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Invalid callback.</h2></body></html>');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MyApi — Authorized</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#020817;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
  .card{background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:40px;max-width:400px;width:100%;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,.5)}
  .logo{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:28px}
  .dot{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#a855f7)}
  .brand{font-size:18px;font-weight:700;color:#f1f5f9}
  .icon{width:56px;height:56px;border-radius:50%;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
  .checkmark{color:#22c55e;font-size:26px;line-height:1}
  h1{font-size:22px;font-weight:700;color:#f1f5f9;margin-bottom:8px}
  p{font-size:14px;color:#94a3b8;line-height:1.6}
  .device{margin-top:16px;background:rgba(255,255,255,.03);border:1px solid #1e293b;border-radius:8px;padding:10px 14px;font-size:13px;color:#64748b}
  .device span{color:#cbd5e1;font-weight:600}
  .back{display:inline-block;margin-top:24px;padding:10px 20px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.25);border-radius:8px;color:#60a5fa;font-size:13px;font-weight:500;text-decoration:none;transition:background .15s}
  .back:hover{background:rgba(59,130,246,.2)}
</style>
</head>
<body>
  <div class="card">
    <div class="logo"><div class="dot"></div><span class="brand">MyApi</span></div>
    <div class="icon"><div class="checkmark">&#10003;</div></div>
    <h1>Authorized!</h1>
    <p>AFP is now connected to your MyApi account.<br>You can close this window.</p>
    <div class="device">Device: <span>${name}</span></div>
    <a href="${base}/dashboard/" class="back">Go to MyApi Dashboard</a>
  </div>
</body></html>`);
      server.close();
      resolve(receivedCode);
    });

    server.listen(port, '127.0.0.1');
    server.on('error', reject);
    setTimeout(() => {
      server.close();
      reject(new Error('OAuth timeout — no response within 5 minutes'));
    }, 5 * 60 * 1000);
  });

  // Exchange code for access token
  const tokenRes = await httpForm(`${base}/api/v1/oauth-server/token`, {
    grant_type:    'authorization_code',
    code,
    redirect_uri:  redirectUri,
    client_id:     CLIENT_ID,
    code_verifier: verifier,
  });
  if (!tokenRes.body?.access_token) {
    throw new Error(`Token exchange failed (HTTP ${tokenRes.status}): ${JSON.stringify(tokenRes.body)}`);
  }
  const accessToken = tokenRes.body.access_token;

  // Register device
  const regRes = await httpRequest(
    'POST',
    `${base}/api/v1/afp/devices/register`,
    { deviceName: name, hostname: os.hostname(), platform: process.platform, arch: process.arch, capabilities: ['fs', 'exec'] },
    { Authorization: `Bearer ${accessToken}` }
  );
  if (!regRes.body?.deviceId) {
    throw new Error(`Device registration failed (HTTP ${regRes.status}): ${JSON.stringify(regRes.body)}`);
  }

  return {
    accessToken,
    deviceId:    regRes.body.deviceId,
    deviceToken: regRes.body.deviceToken,
    deviceName:  name,
    serverUrl:   base,
    afpRoot:     afpRoot || null,
    registeredAt: new Date().toISOString(),
  };
}

module.exports = { runOAuthFlow };
