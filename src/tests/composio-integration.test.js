/**
 * Composio integration tests.
 *
 * Covers:
 *   1. validateScope accepts per-service pattern scopes for Composio virtual services
 *   2. /api/v1/services merges the Composio catalog (root + connected toolkits)
 *   3. Per-service scopes are standalone grants on the execute path:
 *      - services:composio__github:read can execute GET on that service only
 *      - read-level scope cannot execute write verbs
 *      - other services stay inaccessible
 *
 * The Composio HTTP API is mocked at the global fetch level so the real
 * composio-integration module logic (sync, grouping, proxy) is exercised.
 */

process.env.COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY || 'test-composio-key';
process.env.COMPOSIO_AUTH_CONFIG_ID = process.env.COMPOSIO_AUTH_CONFIG_ID || 'test-auth-config';
// Seed per-toolkit auth configs via the env override so the tests don't depend
// on the shipped catalog carrying real authConfigIds (MyApi Open ships them blank).
process.env.COMPOSIO_AUTH_CONFIGS = process.env.COMPOSIO_AUTH_CONFIGS || JSON.stringify({
  slack: 'ac-test-slack',
  openai: 'ac-test-openai',
  gmail: 'ac-test-gmail',
  github: 'ac-test-github',
});

const request = require('supertest');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Mock Composio backend before the server (and its routes) load.
const realFetch = global.fetch;
global.fetch = jest.fn(async (url, opts = {}) => {
  const href = String(url);
  if (href.includes('backend.composio.dev')) {
    let payload = {};
    if (href.includes('/connected_accounts/link')) {
      payload = { redirect_url: 'https://backend.composio.dev/connect/mock' };
    } else if ((opts.method || 'GET') === 'POST' && /\/connected_accounts$/.test(href.split('?')[0])) {
      // API-key connection create: returns an immediately-ACTIVE account.
      payload = { id: 'ca_apikey_mock', status: 'ACTIVE', connectionData: { authScheme: 'API_KEY', val: { status: 'ACTIVE' } } };
    } else if (href.includes('/connected_accounts')) {
      payload = {
        items: [
          {
            id: 'acc_test_1',
            user_id: 'any',
            status: 'ACTIVE',
            toolkit: { slug: 'github', name: 'GitHub' },
            auth_config_id: 'test-auth-config',
          },
        ],
      };
    } else if (href.includes('/tools/execute/proxy')) {
      payload = { status_code: 200, data: { proxied: true } };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
    };
  }
  return realFetch ? realFetch(url, opts) : Promise.reject(new Error(`Unexpected fetch in test: ${href}`));
});

const app = require('../server');
const db = require('../database');
const DeviceFingerprint = require('../utils/deviceFingerprint');
const { validateScope, createUser, createApprovedDevice } = db;

const TEST_UA = 'jest-composio/1.0';
const TEST_IP = '127.0.0.1';

function withTestHeaders(req) {
  return req
    .set('User-Agent', TEST_UA)
    .set('X-Forwarded-For', TEST_IP)
    .set('Accept-Language', 'en-US');
}

function expectedFingerprintHash() {
  return DeviceFingerprint.fromRequest({
    headers: {
      'user-agent': TEST_UA,
      'accept-language': 'en-US',
      'x-forwarded-for': TEST_IP,
    },
    hostname: '127.0.0.1',
    socket: { remoteAddress: TEST_IP },
  }).fingerprintHash;
}

function insertToken({ ownerId, scopeValue, tokenType = 'guest', label = 'test' }) {
  const raw = 'myapi_test_' + crypto.randomBytes(32).toString('hex');
  const hash = bcrypt.hashSync(raw, 10);
  const id = 'tok_' + crypto.randomBytes(8).toString('hex');
  db.db.prepare(`
    INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, requires_approval)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(id, hash, ownerId, scopeValue, label, new Date().toISOString(), tokenType);
  return { id, raw };
}

describe('Composio integration', () => {
  let userId;
  let masterToken;
  let composioReadToken;  // services:composio__github:read only

  beforeAll(() => {
    const suffix = crypto.randomBytes(4).toString('hex');
    const user = createUser(
      'composio_' + suffix,
      'Composio Tester',
      `composio+${suffix}@example.com`,
      'UTC',
      'Password123!'
    );
    userId = user.id;

    masterToken = insertToken({ ownerId: userId, scopeValue: 'full', tokenType: 'master', label: 'Composio Master' });
    createApprovedDevice(masterToken.id, userId, expectedFingerprintHash(), 'Test Device', { os: 'Linux', browser: 'jest' }, TEST_IP);

    composioReadToken = insertToken({
      ownerId: userId,
      scopeValue: JSON.stringify(['services:github:read']),
      label: 'Composio GitHub Read',
    });
  });

  describe('scope validation', () => {
    it('accepts per-service scopes for Composio virtual services', () => {
      expect(validateScope('services:composio__github:read')).toBe(true);
      expect(validateScope('services:composio__github:write')).toBe(true);
      expect(validateScope('services:composio__github:*')).toBe(true);
    });

    it('rejects malformed service scopes', () => {
      expect(validateScope('services:Composio__GitHub:read')).toBe(false);
      expect(validateScope('services:composio__github:admin')).toBe(false);
    });
  });

  describe('services catalog', () => {
    it('includes connected virtual services but NOT the root composio connector', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/services'))
        .set('Authorization', `Bearer ${masterToken.raw}`);
      expect(res.status).toBe(200);
      const names = (res.body.data || []).map((s) => s.name);
      expect(names).not.toContain('composio');
      expect(names).toContain('github');
      const virtual = res.body.data.find((s) => s.name === 'github');
      expect(virtual.byComposio).toBe(true);
      expect(virtual.label).toBe('GitHub');
      expect(virtual.status).toBe('connected');
      expect(virtual.icon).toContain('logos.composio.dev');
    });

    it('lists configured but not-yet-connected toolkits as available', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/services'))
        .set('Authorization', `Bearer ${masterToken.raw}`);
      expect(res.status).toBe(200);
      const slack = res.body.data.find((s) => s.name === 'slack');
      expect(slack).toBeTruthy();
      expect(slack.byComposio).toBe(true);
      expect(slack.status).toBe('available');
      expect(slack.connectToolkit).toBe('slack');
    });

    it('never exposes the composio__ prefix and dedupes native services shadowed by a toolkit', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/services'))
        .set('Authorization', `Bearer ${masterToken.raw}`);
      expect(res.status).toBe(200);
      const names = (res.body.data || []).map((s) => String(s.id || s.name));
      // No leaked prefix anywhere in the catalog.
      expect(names.some((n) => n.startsWith('composio__'))).toBe(false);
      // github exists once (the Composio one wins); the native duplicate is gone.
      expect(names.filter((n) => n === 'github')).toHaveLength(1);
      const github = res.body.data.find((s) => s.name === 'github');
      expect(github.byComposio).toBe(true);
    });
  });

  describe('connection-aware routing helper', () => {
    const composio = require('../services/composio-integration');

    it('reports a toolkit connected via Composio (drives "Composio wins")', async () => {
      expect(await composio.isComposioConnectedService(userId, 'github')).toBe(true);
      expect(await composio.isComposioConnectedService(userId, 'composio__github')).toBe(true);
    });

    it('reports false for a configured-but-not-connected toolkit (falls back to native)', async () => {
      // slack is an available toolkit but the mocked account list only has github
      expect(await composio.isComposioConnectedService(userId, 'slack')).toBe(false);
    });

    it('reports false for a non-Composio (native-only) service', async () => {
      expect(await composio.isComposioConnectedService(userId, 'twitter')).toBe(false);
      expect(await composio.isComposioConnectedService(userId, 'google')).toBe(false);
    });
  });

  describe('multi-toolkit connect links', () => {
    it('uses the per-toolkit auth_config_id when starting OAuth for a specific toolkit', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/oauth/authorize/composio?json=1&toolkit=slack'))
        .set('Authorization', `Bearer ${masterToken.raw}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const linkCall = global.fetch.mock.calls.find(([url]) => String(url).includes('/connected_accounts/link'));
      expect(linkCall).toBeTruthy();
      const body = JSON.parse(linkCall[1].body);
      expect(body.auth_config_id).not.toBe('test-auth-config');
      expect(typeof body.auth_config_id).toBe('string');
      expect(body.auth_config_id.length).toBeGreaterThan(0);
    });

    it('rejects connect link requests for an unconfigured toolkit', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/oauth/authorize/composio?json=1&toolkit=not-a-real-toolkit'))
        .set('Authorization', `Bearer ${masterToken.raw}`);
      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/not configured/i);
    });
  });

  describe('API-key connect (OpenAI/Anthropic/... via Composio)', () => {
    it('connects an api_key toolkit by posting the key and returns ACTIVE', async () => {
      const res = await withTestHeaders(request(app).post('/api/v1/oauth/composio/connect-key'))
        .set('Authorization', `Bearer ${masterToken.raw}`)
        .send({ toolkit: 'openai', fields: { generic_api_key: 'sk-test-123' } });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.service).toBe('openai');
      expect(res.body.status).toBe('ACTIVE');

      const createCall = global.fetch.mock.calls.find(([url, opts]) =>
        (opts?.method || 'GET') === 'POST' && /\/connected_accounts$/.test(String(url).split('?')[0]));
      expect(createCall).toBeTruthy();
      const body = JSON.parse(createCall[1].body);
      expect(body.auth_config.id).toBeTruthy();
      expect(body.connection.data.generic_api_key).toBe('sk-test-123');
    });

    it('rejects when a required field is missing', async () => {
      const res = await withTestHeaders(request(app).post('/api/v1/oauth/composio/connect-key'))
        .set('Authorization', `Bearer ${masterToken.raw}`)
        .send({ toolkit: 'openai', fields: {} });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });

    it('rejects an api-key connect for an OAuth-only toolkit', async () => {
      const res = await withTestHeaders(request(app).post('/api/v1/oauth/composio/connect-key'))
        .set('Authorization', `Bearer ${masterToken.raw}`)
        .send({ toolkit: 'gmail', fields: { generic_api_key: 'x' } });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/OAuth/i);
    });
  });

  describe('execute path: per-service scope is a standalone grant', () => {
    it('allows GET execution with only services:composio__github:read', async () => {
      const res = await withTestHeaders(request(app).post('/api/v1/services/github/execute'))
        .set('Authorization', `Bearer ${composioReadToken.raw}`)
        .send({ method: 'default_request', params: { endpoint: '/user', httpMethod: 'GET' } });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('executed');
      expect(res.body.data.response.meta.toolkitSlug).toBe('github');
    });

    it('denies write verbs with only a read-level per-service scope', async () => {
      const res = await withTestHeaders(request(app).post('/api/v1/services/github/execute'))
        .set('Authorization', `Bearer ${composioReadToken.raw}`)
        .send({ method: 'default_request', params: { endpoint: '/user/repos', httpMethod: 'POST' } });
      expect(res.status).toBe(403);
    });

    it('denies other services for the narrowly scoped token', async () => {
      const res = await withTestHeaders(request(app).post('/api/v1/services/slack/execute'))
        .set('Authorization', `Bearer ${composioReadToken.raw}`)
        .send({ method: 'default_request', params: { endpoint: '/users.list', httpMethod: 'GET' } });
      expect(res.status).toBe(403);
    });

    it('rejects executing the root composio connector directly', async () => {
      const res = await withTestHeaders(request(app).post('/api/v1/services/composio/execute'))
        .set('Authorization', `Bearer ${masterToken.raw}`)
        .send({ method: 'default_request', params: { endpoint: '/x', httpMethod: 'GET' } });
      expect(res.status).toBe(400);
    });
  });

  describe('agent discovery: gateway/context surfaces Composio services', () => {
    it('includes composio__ services in connected_services for master tokens', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/gateway/context'))
        .set('Authorization', `Bearer ${masterToken.raw}`);
      expect(res.status).toBe(200);

      const connected = res.body.data.connected_services || [];
      const composioGithub = connected.find((s) => s.service === 'github');
      expect(composioGithub).toBeTruthy();
      expect(composioGithub.provider).toBe('composio');
      expect(composioGithub.proxy_endpoint).toBe('/api/v1/services/github/proxy');
      expect(composioGithub.proxy_note).toMatch(/\{path, method, body, query\}/);

      const endpointPaths = (res.body.data.endpoints || []).map((e) => e.path);
      expect(endpointPaths).toContain('/api/v1/services');
      expect(endpointPaths).toContain('/api/v1/services/:name/methods');
      expect(endpointPaths).toContain('/api/v1/services/:name/proxy');
    });

    it('shows a per-service-scoped token its own Composio service in gateway/context', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/gateway/context'))
        .set('Authorization', `Bearer ${composioReadToken.raw}`);
      expect(res.status).toBe(200);

      const connected = res.body.data.connected_services || [];
      const names = connected.map((s) => s.service);
      expect(names).toContain('github');
      // Narrow token must not see services it is not scoped for
      expect(names).not.toContain('slack');
    });
  });

  describe('agent discovery: narrow per-service tokens can find their service', () => {
    it('GET /services returns only the scoped service for a per-service token', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/services'))
        .set('Authorization', `Bearer ${composioReadToken.raw}`);
      expect(res.status).toBe(200);
      const names = (res.body.data || []).map((s) => s.name);
      expect(names).toContain('github');
      expect(names).not.toContain('slack');
    });

    it('GET /services/:name detail works with only a per-service scope', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/services/github'))
        .set('Authorization', `Bearer ${composioReadToken.raw}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('github');
    });

    it('GET /services/:name/methods documents the Composio proxy call shape', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/services/github/methods'))
        .set('Authorization', `Bearer ${composioReadToken.raw}`);
      expect(res.status).toBe(200);
      expect(res.body.provider).toBe('composio');
      expect(res.body.toolkitSlug).toBe('github');
      const proxyMethod = (res.body.data || []).find((m) => m.name === 'proxy.request');
      expect(proxyMethod).toBeTruthy();
      expect(proxyMethod.endpoint).toBe('/services/github/proxy');
      expect(res.body.note).toMatch(/proxy/i);
    });

    it('still 404s methods for an unknown composio service', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/services/composio__nope/methods'))
        .set('Authorization', `Bearer ${masterToken.raw}`);
      expect(res.status).toBe(404);
    });

    it('documents methods for a configured-but-not-connected toolkit (underscore slug)', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/services/composio__google_search_console/methods'))
        .set('Authorization', `Bearer ${masterToken.raw}`);
      expect(res.status).toBe(200);
      expect(res.body.provider).toBe('composio');
      expect(res.body.status).toBe('available');
      const proxyMethod = (res.body.data || []).find((m) => m.name === 'proxy.request');
      expect(proxyMethod.endpoint).toBe('/services/composio__google_search_console/proxy');
      expect(proxyMethod.scope).toContain('services:composio__google_search_console:read|write');
    });
  });
});
