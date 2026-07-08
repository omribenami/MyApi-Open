/**
 * Home Assistant service integration.
 *
 * Runs a mock HA instance on 127.0.0.1 and exercises the full path:
 *   connect (probe validation) → proxy calls with the stored instance
 *   URL + token → entity sub-scope enforcement → resource lister → disconnect.
 * ALLOW_PRIVATE_SERVICE_HOSTS=1 lets the gateway talk to the loopback mock.
 */

const http = require('http');
const request = require('supertest');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = require('../server');
const db = require('../database');
const DeviceFingerprint = require('../utils/deviceFingerprint');
const { createUser, createApprovedDevice } = db;

const TEST_UA = 'jest-homeassistant/1.0';
const TEST_IP = '127.0.0.1';
const HA_TOKEN = 'llat_' + crypto.randomBytes(16).toString('hex');

let haServer;
let haBaseUrl;
const haRequests = [];

function startMockHA() {
  return new Promise((resolve) => {
    haServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        haRequests.push({ method: req.method, url: req.url, auth: req.headers.authorization });
        const send = (code, payload) => {
          res.writeHead(code, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(payload));
        };
        // Like real HA: anything outside /api is the SPA frontend — 200 HTML, no auth.
        if (!req.url.startsWith('/api')) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          return res.end('<!DOCTYPE html><html><body>Home Assistant</body></html>');
        }
        if (req.headers.authorization !== `Bearer ${HA_TOKEN}`) return send(401, { message: 'Unauthorized' });
        if (req.url === '/api/' || req.url === '/api') return send(200, { message: 'API running.' });
        if (req.url === '/api/states') {
          return send(200, [
            { entity_id: 'light.living_room', state: 'on', attributes: { friendly_name: 'Living Room' } },
            { entity_id: 'light.bedroom', state: 'off', attributes: { friendly_name: 'Bedroom' } },
            { entity_id: 'sensor.temperature', state: '22.4', attributes: { friendly_name: 'Temperature' } },
          ]);
        }
        if (req.url === '/api/states/light.living_room') {
          return send(200, { entity_id: 'light.living_room', state: 'on', attributes: { friendly_name: 'Living Room' } });
        }
        if (req.url === '/api/services') {
          return send(200, [{ domain: 'light', services: {} }, { domain: 'switch', services: {} }]);
        }
        if (req.url === '/api/services/light/turn_on' && req.method === 'POST') {
          return send(200, [{ entity_id: JSON.parse(body || '{}').entity_id, state: 'on' }]);
        }
        return send(404, { message: 'Not found' });
      });
    });
    haServer.listen(0, '127.0.0.1', () => {
      haBaseUrl = `http://127.0.0.1:${haServer.address().port}`;
      resolve();
    });
  });
}

function withTestHeaders(req) {
  return req.set('User-Agent', TEST_UA).set('X-Forwarded-For', TEST_IP).set('Accept-Language', 'en-US');
}

function expectedFingerprintHash() {
  return DeviceFingerprint.fromRequest({
    headers: { 'user-agent': TEST_UA, 'accept-language': 'en-US', 'x-forwarded-for': TEST_IP },
    hostname: '127.0.0.1',
    socket: { remoteAddress: TEST_IP },
  }).fingerprintHash;
}

function insertToken({ ownerId, scopeValue, tokenType = 'guest', label = 'ha-test', allowedResources = null }) {
  const raw = 'myapi_test_' + crypto.randomBytes(32).toString('hex');
  const hash = bcrypt.hashSync(raw, 10);
  const id = 'tok_' + crypto.randomBytes(8).toString('hex');
  db.db.prepare(`
    INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, requires_approval, allowed_resources)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, hash, ownerId, scopeValue, label, new Date().toISOString(), tokenType,
    allowedResources ? JSON.stringify(allowedResources) : null);
  return { id, raw };
}

describe('Home Assistant service', () => {
  let userId;
  let master;

  beforeAll(async () => {
    process.env.ALLOW_PRIVATE_SERVICE_HOSTS = '1';
    await startMockHA();
    const suffix = crypto.randomBytes(4).toString('hex');
    const user = createUser('hatest_' + suffix, 'HA Tester', `hatest+${suffix}@example.com`, 'UTC', 'Password123!');
    userId = user.id;
    master = insertToken({ ownerId: userId, scopeValue: 'full', tokenType: 'master', label: 'HA Master' });
    createApprovedDevice(master.id, userId, expectedFingerprintHash(), 'HA Test Device', { os: 'Linux', browser: 'jest' }, TEST_IP);
  });

  afterAll((done) => {
    delete process.env.ALLOW_PRIVATE_SERVICE_HOSTS;
    haServer ? haServer.close(done) : done();
  });

  test('connect rejects an invalid URL', async () => {
    const res = await withTestHeaders(request(app).post('/api/v1/services/homeassistant/connect'))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({ base_url: 'not a url::', token: 'x' });
    expect(res.status).toBe(400);
  });

  test('connect rejects a wrong token (probe fails)', async () => {
    const res = await withTestHeaders(request(app).post('/api/v1/services/homeassistant/connect'))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({ base_url: haBaseUrl, token: 'wrong-token' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/token/i);
  });

  test('connect rejects private hosts when the escape hatch is off', async () => {
    delete process.env.ALLOW_PRIVATE_SERVICE_HOSTS;
    const res = await withTestHeaders(request(app).post('/api/v1/services/homeassistant/connect'))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({ base_url: haBaseUrl, token: HA_TOKEN });
    process.env.ALLOW_PRIVATE_SERVICE_HOSTS = '1';
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/private/i);
  });

  test('connect with a pasted UI deep link falls back to the instance origin', async () => {
    // Users paste the page where they created the token (/profile/security).
    // The frontend answers 200 HTML there, so the probe must reject it and the
    // route must retry at the origin.
    const res = await withTestHeaders(request(app).post('/api/v1/services/homeassistant/connect'))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({ base_url: `${haBaseUrl}/profile/security`, token: HA_TOKEN });
    expect(res.status).toBe(200);
    expect(res.body.data.instance_url).toBe(haBaseUrl);
  });

  test('connect rejects a URL that only serves the SPA frontend (no REST API)', async () => {
    // A server that answers 200 HTML everywhere (e.g. wrong host entirely)
    // must not pass the probe on status code alone.
    const spa = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><body>Not an API</body></html>');
    });
    await new Promise((r) => spa.listen(0, '127.0.0.1', r));
    try {
      const res = await withTestHeaders(request(app).post('/api/v1/services/homeassistant/connect'))
        .set('Authorization', `Bearer ${master.raw}`)
        .send({ base_url: `http://127.0.0.1:${spa.address().port}`, token: HA_TOKEN });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/web page|REST API/i);
    } finally {
      await new Promise((r) => spa.close(r));
    }
  });

  test('connect validates against the instance and stores the connection', async () => {
    const res = await withTestHeaders(request(app).post('/api/v1/services/homeassistant/connect'))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({ base_url: haBaseUrl, token: HA_TOKEN });
    expect(res.status).toBe(200);
    expect(res.body.data.connected).toBe(true);
    expect(res.body.data.instance_url).toBe(haBaseUrl);
  });

  test('proxy reaches the instance with the stored token', async () => {
    const res = await withTestHeaders(request(app).post('/api/v1/services/homeassistant/proxy'))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({ path: '/states', method: 'GET' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.map((s) => s.entity_id)).toContain('light.living_room');
    // The gateway must have used the stored long-lived token upstream.
    expect(haRequests.some((r) => r.url === '/api/states' && r.auth === `Bearer ${HA_TOKEN}`)).toBe(true);
  });

  test('service call proxies through (POST /services/light/turn_on)', async () => {
    const res = await withTestHeaders(request(app).post('/api/v1/services/homeassistant/proxy'))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({ path: '/services/light/turn_on', method: 'POST', body: { entity_id: 'light.living_room' } });
    expect(res.status).toBe(200);
    expect(res.body.data[0].state).toBe('on');
  });

  test('entity sub-scope: out-of-list entity denied, allowed entity passes, no-target fails closed', async () => {
    const scoped = insertToken({
      ownerId: userId,
      scopeValue: JSON.stringify(['services:homeassistant:write']),
      label: 'HA Scoped',
      allowedResources: { service_resources: { homeassistant: { entities: ['light.living_room'] } } },
    });

    const denied = await withTestHeaders(request(app).post('/api/v1/services/homeassistant/proxy'))
      .set('Authorization', `Bearer ${scoped.raw}`)
      .send({ path: '/services/light/turn_on', method: 'POST', body: { entity_id: 'light.bedroom' } });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe('resource_restricted');

    const noTarget = await withTestHeaders(request(app).post('/api/v1/services/homeassistant/proxy'))
      .set('Authorization', `Bearer ${scoped.raw}`)
      .send({ path: '/services/light/turn_on', method: 'POST', body: {} });
    expect(noTarget.status).toBe(403);

    const bulkStates = await withTestHeaders(request(app).post('/api/v1/services/homeassistant/proxy'))
      .set('Authorization', `Bearer ${scoped.raw}`)
      .send({ path: '/states', method: 'GET' });
    expect(bulkStates.status).toBe(403);

    const allowed = await withTestHeaders(request(app).post('/api/v1/services/homeassistant/proxy'))
      .set('Authorization', `Bearer ${scoped.raw}`)
      .send({ path: '/services/light/turn_on', method: 'POST', body: { entity_id: 'light.living_room' } });
    expect(allowed.status).toBe(200);
  });

  test('resource lister enumerates entities and domains', async () => {
    const res = await withTestHeaders(request(app).get('/api/v1/services/homeassistant/resources'))
      .set('Authorization', `Bearer ${master.raw}`);
    expect(res.status).toBe(200);
    const { resources } = res.body.data;
    expect(resources.entities.items.map((i) => i.id)).toContain('light.living_room');
    expect(resources.domains.items.map((i) => i.id)).toContain('light');
  });

  test('disconnect removes the connection', async () => {
    const res = await withTestHeaders(request(app).delete('/api/v1/services/homeassistant/connect'))
      .set('Authorization', `Bearer ${master.raw}`);
    expect(res.status).toBe(200);

    const after = await withTestHeaders(request(app).post('/api/v1/services/homeassistant/proxy'))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({ path: '/states', method: 'GET' });
    expect(after.status).toBe(403);
    expect(after.body.error).toMatch(/not connected/i);
  });
});
