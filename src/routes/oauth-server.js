/**
 * OAuth 2.0 Authorization Server
 * Allows external AI clients (ChatGPT, Claude, etc.) to authenticate with MyApi
 * using the standard OAuth 2.0 Authorization Code flow.
 */

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const {
  getOAuthServerClient,
  upsertOAuthServerClient,
  createOAuthServerAuthCode,
  consumeOAuthServerAuthCode,
  createAccessToken,
} = require('../database');

// ─── Redirect URI validation ──────────────────────────────────────────────────
// Supports exact URIs and simple glob patterns (* matches any non-slash segment)
// e.g. "https://chatgpt.com/aip/g-*/oauth/callback" matches any GPT ID

function isRedirectUriAllowed(configuredUris, incomingUri) {
  for (const pattern of configuredUris) {
    if (pattern === incomingUri) return true;
    if (pattern.includes('*')) {
      // Escape regex special chars (excluding *), then replace * with [^/]+
      const regexStr = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]+');
      if (new RegExp(`^${regexStr}$`).test(incomingUri)) return true;
    }
  }
  return false;
}

// ─── Consent page HTML ────────────────────────────────────────────────────────

function renderConsentPage({ clientName, username, clientId, redirectUri, state, scope, error }) {
  const encodedState = encodeURIComponent(state || '');
  const encodedRedirect = encodeURIComponent(redirectUri || '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize — MyApi</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #020617;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 1rem;
      padding: 2.5rem;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 25px 50px rgba(0,0,0,.5);
    }
    .logo { display: flex; align-items: center; gap: .75rem; margin-bottom: 2rem; }
    .logo-dot {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    }
    .logo-text { font-size: 1.25rem; font-weight: 700; color: #f1f5f9; }
    h1 { font-size: 1.5rem; font-weight: 700; color: #f1f5f9; margin-bottom: .5rem; }
    .subtitle { color: #94a3b8; font-size: .9rem; margin-bottom: 1.5rem; }
    .user-badge {
      background: #1e293b; border: 1px solid #334155; border-radius: .5rem;
      padding: .75rem 1rem; font-size: .875rem; color: #cbd5e1; margin-bottom: 1.5rem;
      display: flex; align-items: center; gap: .5rem;
    }
    .user-badge span { color: #f1f5f9; font-weight: 600; }
    .permission-list {
      background: #0d1117; border: 1px solid #1e293b; border-radius: .5rem;
      padding: 1rem; margin-bottom: 1.5rem; list-style: none;
    }
    .permission-list li {
      display: flex; align-items: center; gap: .5rem;
      padding: .375rem 0; font-size: .875rem; color: #94a3b8;
    }
    .permission-list li::before { content: "✓"; color: #22c55e; font-weight: 700; }
    .actions { display: flex; gap: .75rem; }
    button, .deny-btn {
      flex: 1; padding: .75rem 1rem; border-radius: .5rem;
      font-size: .9rem; font-weight: 600; cursor: pointer; border: none; transition: opacity .15s;
    }
    button:hover, .deny-btn:hover { opacity: .85; }
    .authorize-btn { background: #3b82f6; color: white; }
    .deny-btn {
      background: #1e293b; color: #94a3b8; border: 1px solid #334155;
      text-decoration: none; text-align: center;
      display: flex; align-items: center; justify-content: center;
    }
    .error-box {
      background: #450a0a; border: 1px solid #7f1d1d; border-radius: .5rem;
      padding: .75rem 1rem; font-size: .875rem; color: #fca5a5; margin-bottom: 1rem;
    }
    .not-logged-in { text-align: center; padding: 1rem 0; }
    .login-link {
      display: inline-flex; align-items: center; gap: .5rem;
      margin-top: 1rem; padding: .75rem 1.5rem;
      background: #3b82f6; color: white; border-radius: .5rem;
      text-decoration: none; font-weight: 600; font-size: .9rem;
    }
    .login-link:hover { opacity: .85; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-dot"></div>
      <span class="logo-text">MyApi</span>
    </div>

    ${error ? `<div class="error-box">${error}</div>` : ''}

    ${username ? `
    <h1>Authorize ${clientName}</h1>
    <p class="subtitle">${clientName} is requesting access to your MyApi account.</p>

    <div class="user-badge">
      Authorizing as <span>${username}</span>
    </div>

    <ul class="permission-list">
      <li>Read your identity and profile data</li>
      <li>Access your services and API connections</li>
      <li>Read your personas and knowledge base</li>
    </ul>

    <form method="POST" action="/api/v1/oauth-server/authorize">
      <input type="hidden" name="client_id" value="${clientId}">
      <input type="hidden" name="redirect_uri" value="${redirectUri}">
      <input type="hidden" name="state" value="${state || ''}">
      <input type="hidden" name="scope" value="${scope || 'full'}">
      <div class="actions">
        <a href="/api/v1/oauth-server/deny?redirect_uri=${encodedRedirect}&state=${encodedState}" class="deny-btn">Deny</a>
        <button type="submit" class="authorize-btn">Authorize</button>
      </div>
    </form>
    ` : `
    <h1>Sign in to authorize</h1>
    <p class="subtitle">${clientName} wants to connect to your MyApi account. Sign in first to continue.</p>
    <div class="not-logged-in">
      <a href="/api/v1/oauth/authorize/google?mode=login&forcePrompt=0&returnTo=${encodeURIComponent(`/api/v1/oauth-server/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state || '')}&scope=${scope || 'full'}`)}&redirect=1" class="login-link">
        Sign in with Google
      </a>
    </div>
    `}
  </div>
</body>
</html>`;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/v1/oauth-server/authorize
router.get('/authorize', (req, res) => {
  console.log('[OAuthServer] GET /authorize hit — query:', JSON.stringify(req.query), '| session user:', req.session?.user?.id || 'none');
  const { response_type, client_id, redirect_uri, state, scope } = req.query;

  if (response_type !== 'code') {
    return res.status(400).send('unsupported_response_type');
  }

  const client = getOAuthServerClient(client_id);
  if (!client) {
    return res.status(400).send('invalid_client');
  }

  if (!isRedirectUriAllowed(client.redirectUris, redirect_uri)) {
    return res.status(400).send('invalid_redirect_uri');
  }

  // Always redirect to the React consent page — it uses Bearer token auth (not session
  // cookies) so it works in cross-site popup contexts (e.g. ChatGPT opening from
  // chat.openai.com). The React page also avoids the CSP form-action issue that the
  // server-rendered HTML form has when the redirect chain crosses origins.
  const base = (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4500}`).replace(/\/$/, '');
  return res.redirect(
    `${base}/dashboard/authorize?response_type=${encodeURIComponent(response_type)}&client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${encodeURIComponent(state || '')}&scope=${encodeURIComponent(scope || 'full')}&client_name=${encodeURIComponent(client.client_name)}`
  );
});

// POST /api/v1/oauth-server/authorize — user approves consent
router.post('/authorize', express.urlencoded({ extended: false }), (req, res) => {
  const { client_id, redirect_uri, state, scope } = req.body;

  if (!req.session?.user?.id) {
    const client = getOAuthServerClient(client_id);
    return res.status(401).send(renderConsentPage({
      clientName: client?.client_name || client_id,
      username: null,
      clientId: client_id,
      redirectUri: redirect_uri,
      state,
      scope,
      error: 'Session expired. Please sign in again.',
    }));
  }

  const client = getOAuthServerClient(client_id);
  if (!client || !isRedirectUriAllowed(client.redirectUris, redirect_uri)) {
    return res.status(400).send('invalid_client');
  }

  const code = crypto.randomBytes(32).toString('hex');
  createOAuthServerAuthCode({
    code,
    clientId: client_id,
    userId: String(req.session.user.id),
    redirectUri: redirect_uri,
    scope: scope || 'full',
  });

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);

  res.redirect(redirectUrl.toString());
});

// GET /api/v1/oauth-server/deny — user denied consent
router.get('/deny', (req, res) => {
  const { redirect_uri, state } = req.query;
  if (!redirect_uri) return res.status(400).send('missing redirect_uri');
  try {
    const url = new URL(redirect_uri);
    url.searchParams.set('error', 'access_denied');
    if (state) url.searchParams.set('state', state);
    return res.redirect(url.toString());
  } catch {
    return res.status(400).send('invalid redirect_uri');
  }
});

// Token exchange handler — shared by POST and GET
async function handleTokenExchange(params, res) {
  const { grant_type, code, redirect_uri, client_id, client_secret } = params;

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  const client = getOAuthServerClient(client_id);
  if (!client) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const secretMatch = await bcrypt.compare(String(client_secret || ''), client.client_secret_hash);
  if (!secretMatch) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const authCode = consumeOAuthServerAuthCode(code);
  if (!authCode) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  if (!isRedirectUriAllowed(client.redirectUris, authCode.redirect_uri)) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  // Generate a new MyApi access token scoped to this user
  const rawToken = 'myapi_' + crypto.randomBytes(32).toString('hex');
  const hash = await bcrypt.hash(rawToken, 10);
  const label = `${client.client_name} (OAuth)`;

  createAccessToken(hash, authCode.user_id, authCode.scope || 'full', label, null, null, null, rawToken, 'guest');

  res.json({
    access_token: rawToken,
    token_type: 'bearer',
    scope: authCode.scope || 'full',
  });
}

// POST /api/v1/oauth-server/token — standard OAuth token exchange
router.post('/token', express.urlencoded({ extended: false }), express.json(), async (req, res) => {
  console.log('[OAuthServer] POST /token body:', JSON.stringify(req.body));
  const params = { ...req.body };
  if (!params.grant_type && params.code) params.grant_type = 'authorization_code';
  await handleTokenExchange(params, res);
});

// GET /api/v1/oauth-server/token — some clients (ChatGPT) use GET with query params
router.get('/token', async (req, res) => {
  console.log('[OAuthServer] GET /token params:', JSON.stringify(req.query));
  // ChatGPT may omit grant_type — infer it when code is present
  const params = { ...req.query };
  if (!params.grant_type && params.code) params.grant_type = 'authorization_code';
  await handleTokenExchange(params, res);
});

// GET /api/v1/oauth-server/credentials — returns OAuth setup info for the dashboard
router.get('/credentials', (req, res) => {
  if (!req.session?.user && !req.tokenMeta) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const clientId = process.env.CHATGPT_OAUTH_CLIENT_ID || 'chatgpt';
  const client = getOAuthServerClient(clientId);
  if (!client) {
    return res.status(404).json({ error: 'not_configured' });
  }

  const base = (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4500}`).replace(/\/$/, '');

  res.json({
    client_id: client.client_id,
    authorization_url: `${base}/api/v1/oauth-server/authorize`,
    token_url: `${base}/api/v1/oauth-server/token`,
    scope: 'full',
    client_name: client.client_name,
  });
});

// POST /api/v1/oauth-server/authorize-token
// Called by the React dashboard (Bearer auth) to approve an OAuth consent request.
// Returns a redirect URL that the frontend should navigate to.
router.post('/authorize-token', express.json(), (req, res) => {
  const userId = req.session?.user?.id
    || req.tokenMeta?.ownerId
    || req.tokenMeta?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { client_id, redirect_uri, state, scope } = req.body;

  const client = getOAuthServerClient(client_id);
  if (!client) {
    return res.status(400).json({ error: 'invalid_client' });
  }

  if (!isRedirectUriAllowed(client.redirectUris, redirect_uri)) {
    return res.status(400).json({ error: 'invalid_redirect_uri' });
  }

  const code = crypto.randomBytes(32).toString('hex');
  createOAuthServerAuthCode({
    code,
    clientId: client_id,
    userId: String(userId),
    redirectUri: redirect_uri,
    scope: scope || 'full',
  });

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);

  res.json({ redirectUrl: redirectUrl.toString() });
});

// GET /api/v1/oauth-server/openapi.yaml — serves the ChatGPT OpenAPI schema
router.get('/openapi.yaml', (req, res) => {
  const specPath = path.join(__dirname, '../../connectors/openai/openapi.yaml');
  if (!fs.existsSync(specPath)) {
    return res.status(404).send('not found');
  }
  res.setHeader('Content-Type', 'text/yaml');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(fs.readFileSync(specPath, 'utf8'));
});

module.exports = router;
