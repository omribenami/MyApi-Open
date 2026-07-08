const logger = require('../utils/logger');
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
  peekOAuthServerAuthCode,
  createAccessToken,
  revokeAccessTokensForClient,
  createOAuthServerRefreshToken,
  getOAuthServerRefreshTokenById,
  touchOAuthServerRefreshToken,
  revokeOAuthServerRefreshToken,
  recordOAuthServerGrant,
  hasOAuthServerGrant,
} = require('../database');

// Advertised access-token lifetime. The token does not actually expire
// server-side, but advertising expires_in + issuing a refresh_token lets ChatGPT
// renew via grant_type=refresh_token instead of re-running the consent flow.
const ACCESS_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Throwaway bcrypt hash computed at startup (never a real credential). Used only
// to equalize timing on the refresh-token miss path so an attacker can't tell an
// unknown token id from a known id with a wrong secret. Generated at runtime so
// no secret-shaped literal lives in source.
const DUMMY_REFRESH_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

// Mint a MyApi access token for an OAuth-server delegation and a refresh token to
// renew it. Returns the standard OAuth token response body.
async function issueTokenSet({ userId, scope, client }) {
  const rawToken = 'myapi_' + crypto.randomBytes(32).toString('hex');
  const hash = await bcrypt.hash(rawToken, 10);
  const label = `${client.client_name} (OAuth)`;
  const newTokenId = createAccessToken(
    hash, userId, scope || 'full', label,
    null, null, null, rawToken, 'guest',
    client.client_id
  );

  // Keep exactly ONE active token per (user, client): revoke any earlier tokens for
  // this client. ChatGPT re-issues on every authorization AND every refresh, so
  // without this a single client piles up dozens of live tokens (and device rows).
  try {
    const revoked = revokeAccessTokensForClient(String(userId), client.client_id, newTokenId);
    if (revoked) console.log(`[OAuth] Superseded ${revoked} prior token(s) for client ${client.client_id}`);
  } catch (e) {
    console.error('[OAuth] Failed to revoke prior client tokens:', e.message);
  }

  // Refresh token format: rt_<id>.<secret>. We store only bcrypt(secret) keyed by
  // id, so a stolen DB cannot reconstruct usable refresh tokens.
  const rtId = 'rt_' + crypto.randomBytes(16).toString('hex');
  const rtSecret = crypto.randomBytes(32).toString('hex');
  const rtHash = await bcrypt.hash(rtSecret, 10);
  createOAuthServerRefreshToken({
    id: rtId, tokenHash: rtHash, clientId: client.client_id, userId: String(userId), scope: scope || 'full',
  });

  return {
    access_token: rawToken,
    token_type: 'bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: `${rtId}.${rtSecret}`,
    scope: scope || 'full',
  };
}

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
  logger.info('[OAuthServer] GET /authorize hit — query:', JSON.stringify(req.query), '| session user:', req.session?.user?.id || 'none');
  const { response_type, client_id, redirect_uri, state, scope, code_challenge, code_challenge_method } = req.query;

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

  // Remembered consent: if this user already authorized this client AND has an
  // active session here, auto-issue the code and skip the consent screen. This is
  // what makes re-authorization invisible instead of "approve again every time".
  const sessionUserId = req.session?.user?.id;
  if (sessionUserId && hasOAuthServerGrant(client_id, sessionUserId)) {
    const code = crypto.randomBytes(32).toString('hex');
    createOAuthServerAuthCode({
      code,
      clientId: client_id,
      userId: String(sessionUserId),
      redirectUri: redirect_uri,
      scope: scope || 'full',
      codeChallenge: code_challenge || null,
    });
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);
    return res.redirect(redirectUrl.toString());
  }

  // Always redirect to the React consent page — it uses Bearer token auth (not session
  // cookies) so it works in cross-site popup contexts (e.g. ChatGPT opening from
  // chat.openai.com). The React page also avoids the CSP form-action issue that the
  // server-rendered HTML form has when the redirect chain crosses origins.
  const base = (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4500}`).replace(/\/$/, '');
  const consentParams = new URLSearchParams({
    response_type, client_id, redirect_uri,
    state: state || '', scope: scope || 'full',
    client_name: client.client_name,
  });
  if (code_challenge) consentParams.set('code_challenge', code_challenge);
  if (code_challenge_method) consentParams.set('code_challenge_method', code_challenge_method);
  return res.redirect(`${base}/dashboard/authorize?${consentParams.toString()}`);
});

// POST /api/v1/oauth-server/authorize — user approves consent
router.post('/authorize', express.urlencoded({ extended: false }), (req, res) => {
  const { client_id, redirect_uri, state, scope, code_challenge } = req.body;

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

  // Remember the grant so subsequent re-authorizations are auto-approved.
  try { recordOAuthServerGrant({ clientId: client_id, userId: req.session.user.id, scope }); } catch (_) {}

  const code = crypto.randomBytes(32).toString('hex');
  createOAuthServerAuthCode({
    code,
    clientId: client_id,
    userId: String(req.session.user.id),
    redirectUri: redirect_uri,
    scope: scope || 'full',
    codeChallenge: code_challenge || null,
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
async function handleTokenExchange(params, res, req) {
  const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier, refresh_token } = params;

  const client = getOAuthServerClient(client_id);
  if (!client) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  // ── Refresh grant: renew silently, no consent ───────────────────────────────
  // This is what stops ChatGPT from re-prompting the user on every sign-in.
  if (grant_type === 'refresh_token') {
    const rt = String(refresh_token || '');
    const dot = rt.indexOf('.');
    if (dot < 0) return res.status(400).json({ error: 'invalid_grant' });
    const rtId = rt.slice(0, dot);
    const rtSecret = rt.slice(dot + 1);

    const record = getOAuthServerRefreshTokenById(rtId);
    // Constant-ish work even on miss to avoid distinguishing invalid id vs secret.
    const ok = record
      ? (record.client_id === client.client_id && await bcrypt.compare(rtSecret, record.token_hash))
      : await bcrypt.compare(rtSecret || 'x', DUMMY_REFRESH_HASH);
    if (!record || !ok) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'invalid or expired refresh token' });
    }

    // Confidential clients must still present their secret on refresh. PKCE-only
    // public clients (no secret provided at exchange) are credentialed by the
    // refresh token itself.
    if (client_secret) {
      const secretMatch = await bcrypt.compare(String(client_secret), client.client_secret_hash);
      if (!secretMatch) return res.status(401).json({ error: 'invalid_client' });
    }

    touchOAuthServerRefreshToken(rtId);
    const tokenSet = await issueTokenSet({ userId: record.user_id, scope: record.scope, client });
    // Rotate the refresh token: revoke the one just used.
    revokeOAuthServerRefreshToken(rtId);
    return res.json(tokenSet);
  }

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  // PKCE: verify code_verifier instead of client_secret
  if (code_verifier) {
    const authCodeForPkce = peekOAuthServerAuthCode(code);
    if (!authCodeForPkce?.code_challenge) {
      return res.status(401).json({ error: 'invalid_client', error_description: 'PKCE not initiated for this code' });
    }
    const expected = crypto.createHash('sha256').update(code_verifier).digest('base64url');
    if (expected !== authCodeForPkce.code_challenge) {
      return res.status(401).json({ error: 'invalid_client', error_description: 'code_verifier mismatch' });
    }
  } else {
    const secretMatch = await bcrypt.compare(String(client_secret || ''), client.client_secret_hash);
    if (!secretMatch) {
      return res.status(401).json({ error: 'invalid_client' });
    }
  }

  const authCode = consumeOAuthServerAuthCode(code);
  if (!authCode) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  if (!isRedirectUriAllowed(client.redirectUris, authCode.redirect_uri)) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  // Remember this grant so future re-authorizations skip the consent screen.
  try { recordOAuthServerGrant({ clientId: client.client_id, userId: authCode.user_id, scope: authCode.scope }); } catch (_) {}

  // Generate a new MyApi access token + refresh token scoped to this user.
  // Token identity = bearer secret + oauth_client_id. We do NOT bind the token to the
  // exchanging device's fingerprint: OAuth is a server-to-server delegation, AI agents
  // legitimately rotate IPs/UAs, and binding produced false-positive "suspicious device"
  // alerts. lib/tokenSecurityMonitor.js handles real anomaly detection (ASN drift, VPN/Tor,
  // velocity) per request.
  const tokenSet = await issueTokenSet({ userId: authCode.user_id, scope: authCode.scope, client });
  res.json(tokenSet);
}

// POST /api/v1/oauth-server/token — standard OAuth token exchange
router.post('/token', express.urlencoded({ extended: false }), express.json(), async (req, res) => {
  logger.info('[OAuthServer] POST /token body:', JSON.stringify(req.body));
  try {
    const params = { ...req.body };
    if (!params.grant_type && params.code) params.grant_type = 'authorization_code';
    await handleTokenExchange(params, res, req);
  } catch (err) {
    logger.error('[OAuthServer] POST /token unhandled error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'server_error', error_description: err.message });
  }
});

// GET /api/v1/oauth-server/token — some clients (ChatGPT) use GET with query params
router.get('/token', async (req, res) => {
  logger.info('[OAuthServer] GET /token params:', JSON.stringify(req.query));
  // ChatGPT may omit grant_type — infer it when code is present
  try {
    const params = { ...req.query };
    if (!params.grant_type && params.code) params.grant_type = 'authorization_code';
    await handleTokenExchange(params, res, req);
  } catch (err) {
    logger.error('[OAuthServer] GET /token unhandled error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'server_error', error_description: err.message });
  }
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

  const { client_id, redirect_uri, state, scope, code_challenge } = req.body;

  const client = getOAuthServerClient(client_id);
  if (!client) {
    return res.status(400).json({ error: 'invalid_client' });
  }

  if (!isRedirectUriAllowed(client.redirectUris, redirect_uri)) {
    return res.status(400).json({ error: 'invalid_redirect_uri' });
  }

  // Remember the grant so subsequent re-authorizations are auto-approved.
  try { recordOAuthServerGrant({ clientId: client_id, userId, scope }); } catch (_) {}

  const code = crypto.randomBytes(32).toString('hex');
  createOAuthServerAuthCode({
    code,
    clientId: client_id,
    userId: String(userId),
    redirectUri: redirect_uri,
    scope: scope || 'full',
    codeChallenge: code_challenge || null,
  });

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);

  res.json({ redirectUrl: redirectUrl.toString() });
});

// GET /api/v1/oauth-server/openapi.yaml — serves the ChatGPT OpenAPI schema.
// The `servers:` URL is rewritten to the deployment's public base so the spec
// is correct on dev (dev.myapiai.com) and prod (www.myapiai.com) alike, and so
// a self-hosted MyApi never ships a spec pointing at the wrong host.
router.get('/openapi.yaml', (req, res) => {
  const specPath = path.join(__dirname, '../../connectors/openai/openapi.yaml');
  if (!fs.existsSync(specPath)) {
    return res.status(404).send('not found');
  }
  const base = (process.env.PUBLIC_URL || `https://${req.headers.host || 'www.myapiai.com'}`).replace(/\/$/, '');
  let spec = fs.readFileSync(specPath, 'utf8');
  spec = spec.replace(/^(servers:\s*\n\s*- url:\s*).*$/m, `$1${base}`);
  res.setHeader('Content-Type', 'text/yaml');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(spec);
});

module.exports = router;
