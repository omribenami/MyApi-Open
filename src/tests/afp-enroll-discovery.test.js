/**
 * AFP one-line install enrollment + agent discoverability.
 *
 * 1. Enrollment: POST /afp/enroll-code (auth) → POST /afp/enroll (public,
 *    code-gated) returns device credentials; codes are single-use and expire.
 * 2. install.sh is publicly served and embeds the right base URL.
 * 3. Discovery: with a registered device, agents find AFP via GET /services,
 *    GET /services/afp, GET /services/afp/methods, and gateway/context — the
 *    exact paths the agent in the field tried and got 404s on.
 */

const request = require('supertest');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = require('../server');
const db = require('../database');
const DeviceFingerprint = require('../utils/deviceFingerprint');

const TEST_UA = 'jest-afp/1.0';
const TEST_IP = '127.0.0.1';

function withTestHeaders(req) {
  return req.set('User-Agent', TEST_UA).set('X-Forwarded-For', TEST_IP).set('Accept-Language', 'en-US');
}

function testFingerprintHash() {
  return DeviceFingerprint.fromRequest({
    headers: { 'user-agent': TEST_UA, 'accept-language': 'en-US', 'x-forwarded-for': TEST_IP },
    hostname: '127.0.0.1',
    socket: { remoteAddress: TEST_IP },
  }).fingerprintHash;
}

describe('AFP enrollment + discovery', () => {
  let user, token, raw;

  beforeAll(() => {
    const sfx = crypto.randomBytes(4).toString('hex');
    user = db.createUser('afp_' + sfx, 'AFP Tester', `afp+${sfx}@example.com`, 'UTC', 'Password123!');
    db.db.prepare('UPDATE users SET plan = ? WHERE id = ?').run('pro', user.id);

    raw = 'myapi_test_' + crypto.randomBytes(32).toString('hex');
    const id = 'tok_' + crypto.randomBytes(8).toString('hex');
    db.db.prepare(`
      INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, requires_approval)
      VALUES (?, ?, ?, 'full', 'AFP Test Token', ?, 'master', 0)
    `).run(id, bcrypt.hashSync(raw, 10), user.id, new Date().toISOString());
    token = { id, raw };
    db.createApprovedDevice(id, user.id, testFingerprintHash(), 'AFP Test Device', { os: 'Linux' }, TEST_IP);
  });

  it('serves the public install script with the request host baked in', async () => {
    const res = await request(app).get('/api/v1/afp/install.sh').set('Host', 'unit.test.host');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/shellscript|x-sh|text/);
    expect(res.text).toContain('https://unit.test.host');
    expect(res.text).toContain('/api/v1/afp/enroll');
    expect(res.text).toContain('systemctl enable --now myapi-afp');
  });

  let enrollCode;
  it('creates an enrollment code with a copy-paste command', async () => {
    const res = await withTestHeaders(request(app).post('/api/v1/afp/enroll-code'))
      .set('Authorization', `Bearer ${token.raw}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toMatch(/^AFP-[0-9A-F]{8}-[0-9A-F]{8}$/);
    expect(res.body.command).toContain('install.sh | sudo bash -s --');
    expect(res.body.command).toContain(res.body.code);
    enrollCode = res.body.code;
  });

  let deviceId;
  it('exchanges the code for device credentials (no auth needed)', async () => {
    const res = await request(app).post('/api/v1/afp/enroll').send({
      code: enrollCode,
      deviceName: 'jest-server',
      hostname: 'jest-host-1',
      platform: 'linux',
      arch: 'x86_64',
    });
    expect(res.status).toBe(201);
    expect(res.body.deviceId).toBeTruthy();
    expect(res.body.deviceToken).toMatch(/^afpd_/);
    deviceId = res.body.deviceId;
  });

  it('rejects code reuse and garbage codes', async () => {
    const reuse = await request(app).post('/api/v1/afp/enroll').send({ code: enrollCode, deviceName: 'x' });
    expect(reuse.status).toBe(403);
    const garbage = await request(app).post('/api/v1/afp/enroll').send({ code: 'AFP-DEADBEEF-DEADBEEF', deviceName: 'x' });
    expect(garbage.status).toBe(403);
  });

  it('GET /services lists afp once a device is registered', async () => {
    const res = await withTestHeaders(request(app).get('/api/v1/services'))
      .set('Authorization', `Bearer ${token.raw}`);
    expect(res.status).toBe(200);
    const afp = (res.body.data || []).find((s) => s.id === 'afp');
    expect(afp).toBeTruthy();
    expect(afp.devices.some((d) => d.deviceId === deviceId)).toBe(true);
    expect(afp.description).toMatch(/exec/);
  });

  it('GET /services/afp returns the device list (the exact call the agent made)', async () => {
    const res = await withTestHeaders(request(app).get('/api/v1/services/afp'))
      .set('Authorization', `Bearer ${token.raw}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('afp');
    expect(res.body.data.devices.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /services/afp/methods documents exec/ls/read with real device ids', async () => {
    const res = await withTestHeaders(request(app).get('/api/v1/services/afp/methods'))
      .set('Authorization', `Bearer ${token.raw}`);
    expect(res.status).toBe(200);
    const names = res.body.data.map((m) => m.name);
    expect(names).toEqual(expect.arrayContaining(['exec', 'fs.ls', 'fs.read', 'devices.list']));
    expect(res.body.example.request.url).toContain('/api/v1/afp/');
    expect(res.body.example.request.body.cmd).toMatch(/docker/);
  });

  it('gateway/context includes afp with devices and exec action', async () => {
    const res = await withTestHeaders(request(app).get('/api/v1/gateway/context'))
      .set('Authorization', `Bearer ${token.raw}`);
    expect(res.status).toBe(200);
    const afp = (res.body.data.connected_services || []).find((s) => s.service === 'afp');
    expect(afp).toBeTruthy();
    expect(afp.devices.some((d) => d.deviceId === deviceId)).toBe(true);
    expect(afp.actions.some((a) => a.path.includes('/exec'))).toBe(true);
    const manifest = res.body.data.endpoints.map((e) => e.path);
    expect(manifest).toContain('/api/v1/afp/devices');
  });

  it('hides afp from non-master tokens (services list + detail)', async () => {
    const guestRaw = 'myapi_test_' + crypto.randomBytes(32).toString('hex');
    const gid = 'tok_' + crypto.randomBytes(8).toString('hex');
    db.db.prepare(`
      INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, requires_approval)
      VALUES (?, ?, ?, ?, 'AFP Guest', ?, 'guest', 0)
    `).run(gid, bcrypt.hashSync(guestRaw, 10), user.id, JSON.stringify(['services:read']), new Date().toISOString());

    const list = await withTestHeaders(request(app).get('/api/v1/services'))
      .set('Authorization', `Bearer ${guestRaw}`);
    expect(list.status).toBe(200);
    expect((list.body.data || []).some((s) => s.id === 'afp')).toBe(false);

    const detail = await withTestHeaders(request(app).get('/api/v1/services/afp'))
      .set('Authorization', `Bearer ${guestRaw}`);
    expect(detail.status).toBe(404);
  });
});
