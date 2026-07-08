const request = require('supertest');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { app } = require('../index');
const {
  upsertOAuthServerClient,
  getOAuthServerClient,
} = require('../database');

// Fixtures generated at runtime — no static credential literals in source.
const rand = crypto.randomBytes(12).toString('hex');
const clientSecret = `cs_${rand}`;
const testPassword = `Aa1!${rand}`; // satisfies password-strength rules

// Exercises the OAuth-server delegation flow that ChatGPT uses, focused on the
// behavior that stops repeated sign-in prompts: a refresh_token is issued and can
// be exchanged for a fresh access token without re-consent, and a remembered
// grant auto-approves re-authorization.
describe('OAuth server — refresh token & remembered consent', () => {
  const clientId = 'test_chatgpt_client';
  const redirectUri = 'https://chatgpt.com/aip/g-testgpt/oauth/callback';
  let agent;

  beforeAll(async () => {
    upsertOAuthServerClient({
      clientId,
      clientSecretHash: await bcrypt.hash(clientSecret, 10),
      clientName: 'Test ChatGPT',
      redirectUris: [redirectUri, 'https://chatgpt.com/aip/g-*/oauth/callback'],
      ownerId: null,
    });
    expect(getOAuthServerClient(clientId)).toBeTruthy();

    agent = request.agent(app);
    const user = `oauthrt_${Date.now()}`;
    const email = `${user}@example.com`;
    const reg = await agent.post('/api/v1/auth/register').send({ username: user, password: testPassword, email });
    expect([200, 201]).toContain(reg.status);
    const login = await agent.post('/api/v1/auth/login').send({ email, password: testPassword });
    expect(login.status).toBe(200);
  });

  it('issues a refresh_token + expires_in, then renews via refresh grant without consent', async () => {
    // Approve consent via the dashboard (Bearer/session) endpoint → get a code.
    const approve = await agent.post('/api/v1/oauth-server/authorize-token').send({
      client_id: clientId,
      redirect_uri: redirectUri,
      state: 'xyz',
      scope: 'full',
    });
    expect(approve.status).toBe(200);
    const code = new URL(approve.body.redirectUrl).searchParams.get('code');
    expect(code).toBeTruthy();

    // Exchange the code → must include a refresh_token and expires_in.
    const tok = await request(app).post('/api/v1/oauth-server/token').send({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });
    expect(tok.status).toBe(200);
    expect(tok.body.access_token).toMatch(/^myapi_/);
    expect(tok.body.refresh_token).toBeTruthy();
    expect(tok.body.expires_in).toBeGreaterThan(0);

    // Renew with the refresh token — no user interaction, brand new access token.
    const refreshed = await request(app).post('/api/v1/oauth-server/token').send({
      grant_type: 'refresh_token',
      refresh_token: tok.body.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.access_token).toMatch(/^myapi_/);
    expect(refreshed.body.access_token).not.toBe(tok.body.access_token);
    expect(refreshed.body.refresh_token).toBeTruthy();

    // Refresh tokens are single-use (rotated): the old one no longer works.
    const reused = await request(app).post('/api/v1/oauth-server/token').send({
      grant_type: 'refresh_token',
      refresh_token: tok.body.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    });
    expect(reused.status).toBe(400);
    expect(reused.body.error).toBe('invalid_grant');
  });

  it('keeps exactly ONE active token per client (re-auth + refresh supersede old ones)', async () => {
    const db = require('../database');
    const activeBefore = db.db.prepare(
      "SELECT COUNT(*) c FROM access_tokens WHERE oauth_client_id = ? AND revoked_at IS NULL"
    ).get(clientId).c;
    // One authorization_code exchange + one refresh = 2 issue calls, but only the
    // newest token stays active.
    const approve = await agent.post('/api/v1/oauth-server/authorize-token').send({
      client_id: clientId, redirect_uri: redirectUri, state: 's2', scope: 'full',
    });
    const code = new URL(approve.body.redirectUrl).searchParams.get('code');
    const tok = await request(app).post('/api/v1/oauth-server/token').send({
      grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret,
    });
    await request(app).post('/api/v1/oauth-server/token').send({
      grant_type: 'refresh_token', refresh_token: tok.body.refresh_token, client_id: clientId, client_secret: clientSecret,
    });
    const active = db.db.prepare(
      "SELECT COUNT(*) c FROM access_tokens WHERE oauth_client_id = ? AND revoked_at IS NULL"
    ).get(clientId).c;
    expect(active).toBe(1);
    expect(activeBefore).toBeGreaterThanOrEqual(1);
  });

  it('auto-approves re-authorization once consent is remembered (no consent screen)', async () => {
    // The first test already recorded a grant for this user+client. A fresh GET
    // /authorize with the live session should now redirect straight to the
    // callback with a code instead of the consent page.
    const res = await agent
      .get('/api/v1/oauth-server/authorize')
      .query({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state: 'abc' })
      .redirects(0);
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.location);
    expect(`${loc.origin}${loc.pathname}`).toBe(redirectUri);
    expect(loc.searchParams.get('code')).toBeTruthy();
    expect(loc.searchParams.get('state')).toBe('abc');
  });

  it('rejects an invalid refresh token with invalid_grant (not 500)', async () => {
    const res = await request(app).post('/api/v1/oauth-server/token').send({
      grant_type: 'refresh_token',
      refresh_token: 'rt_deadbeef.notreal',
      client_id: clientId,
      client_secret: clientSecret,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_grant');
  });
});
