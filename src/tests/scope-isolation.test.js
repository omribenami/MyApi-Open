/**
 * Hermetic scope isolation tests.
 *
 * Verifies that guest tokens scoped to a narrow service / skill / KB doc cannot
 * leak into sibling resources. Covers the four fixes landed with this suite:
 *
 *   1. /api/v1/services/preferences routes enforce per-service scope
 *   2. /api/v1/services/categories + /available require auth
 *   3. allowed_resources allow-list is enforced at request time on KB + skills
 *   4. /api/v1/brain/knowledge-base/:id/attachments requires 'knowledge' scope
 */

const request = require('supertest');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = require('../server');
const db = require('../database');
const DeviceFingerprint = require('../utils/deviceFingerprint');
const {
  grantScopes,
  createUser,
  createSkill,
  addKBDocument,
  createServicePreference,
  createApprovedDevice,
} = db;

const TEST_UA = 'jest-scope-isolation/1.0';
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

function seedTestUser() {
  const suffix = crypto.randomBytes(4).toString('hex');
  const user = createUser(
    'scopeiso_' + suffix,
    'Scope Isolation Tester',
    `scopeiso+${suffix}@example.com`,
    'UTC',
    'Password123!'
  );
  return user.id;
}

function insertToken({ ownerId, scopeValue, tokenType = 'guest', label = 'test', allowedResources = null, requiresApproval = 0 }) {
  const raw = 'myapi_test_' + crypto.randomBytes(32).toString('hex');
  const hash = bcrypt.hashSync(raw, 10);
  const id = 'tok_' + crypto.randomBytes(8).toString('hex');
  db.db.prepare(`
    INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, requires_approval, allowed_resources)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    hash,
    ownerId,
    scopeValue,
    label,
    new Date().toISOString(),
    tokenType,
    requiresApproval,
    allowedResources ? JSON.stringify(allowedResources) : null
  );
  return { id, raw };
}

describe('Hermetic scope isolation', () => {
  let userId;
  let masterToken;
  let gmailToken;      // services:gmail:read only
  let kbNarrowToken;   // knowledge + allowed_resources.knowledge_docs = [allowedKbId]
  let skillsNarrowToken; // skills:read + allowed_resources.skills = [allowedSkillId]
  let allowedKbId;
  let blockedKbId;
  let allowedSkillId;
  let blockedSkillId;

  beforeAll(() => {
    userId = seedTestUser();

    // Master token for setup + negative control.
    masterToken = insertToken({ ownerId: userId, scopeValue: 'full', tokenType: 'master', label: 'Scope Iso Master' });

    // Pre-approve the test device for the master token so device-approval
    // middleware doesn't block requests.
    const fpHash = expectedFingerprintHash();
    createApprovedDevice(masterToken.id, userId, fpHash, 'Test Master Device', { os: 'Linux', browser: 'jest' }, TEST_IP);

    // Seed KB documents.
    const allowedDoc = addKBDocument('test', 'Allowed Doc', 'allowed content', null, null, userId);
    const blockedDoc = addKBDocument('test', 'Blocked Doc', 'blocked content', null, null, userId);
    allowedKbId = allowedDoc.id;
    blockedKbId = blockedDoc.id;

    // Seed skills.
    const allowedSkill = createSkill('allowed-skill', 'Allowed', '1.0.0', null, 'custom', 'allowed skill body', null, null, userId);
    const blockedSkill = createSkill('blocked-skill', 'Blocked', '1.0.0', null, 'custom', 'blocked skill body', null, null, userId);
    allowedSkillId = allowedSkill.id;
    blockedSkillId = blockedSkill.id;

    // Seed service preferences for gmail + slack.
    createServicePreference(userId, 'gmail', { fake_key: 'gmail-value' });
    createServicePreference(userId, 'slack', { fake_key: 'slack-value' });

    // Narrow service token: only gmail read. Note: per-service scopes like
    // `services:gmail:read` are enforced by services.js parsing the JSON scope
    // array directly; they are NOT inserted into access_token_scopes (which
    // would require a scope_definitions row per service).
    gmailToken = insertToken({
      ownerId: userId,
      scopeValue: JSON.stringify(['services:gmail:read']),
      label: 'Gmail Only',
    });

    // Narrow KB token: knowledge scope but only one doc via allow-list.
    kbNarrowToken = insertToken({
      ownerId: userId,
      scopeValue: JSON.stringify(['knowledge']),
      label: 'KB Narrow',
      allowedResources: { knowledge_docs: [allowedKbId] },
    });
    grantScopes(kbNarrowToken.id, ['knowledge']);

    // Narrow skills token.
    skillsNarrowToken = insertToken({
      ownerId: userId,
      scopeValue: JSON.stringify(['skills:read']),
      label: 'Skills Narrow',
      allowedResources: { skills: [allowedSkillId] },
    });
    grantScopes(skillsNarrowToken.id, ['skills:read']);
  });

  describe('services: catalog endpoints require auth', () => {
    it('GET /api/v1/services/categories rejects unauthenticated callers', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/services/categories'));
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/services/available rejects unauthenticated callers', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/services/available'));
      expect(res.status).toBe(401);
    });
  });

  describe('services: narrow gmail token cannot read sibling service prefs', () => {
    it('GET /preferences returns only gmail prefs (scope filter)', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/services/preferences'))
        .set('Authorization', `Bearer ${gmailToken.raw}`);
      expect(res.status).toBe(200);
      const names = (res.body.data || []).map(r => r.service_name);
      expect(names).toContain('gmail');
      expect(names).not.toContain('slack');
    });

    it('GET /preferences/slack is forbidden for gmail-scoped token', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/services/preferences/slack'))
        .set('Authorization', `Bearer ${gmailToken.raw}`);
      expect(res.status).toBe(403);
    });

    it('GET /preferences/gmail is allowed for gmail-scoped token', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/services/preferences/gmail'))
        .set('Authorization', `Bearer ${gmailToken.raw}`);
      expect(res.status).toBe(200);
      expect(res.body.data?.service_name).toBe('gmail');
    });

    it('PUT /preferences/slack is forbidden for gmail-scoped token', async () => {
      const res = await withTestHeaders(request(app).put('/api/v1/services/preferences/slack'))
        .set('Authorization', `Bearer ${gmailToken.raw}`)
        .send({ preferences: { hacked: true } });
      expect(res.status).toBe(403);
    });

    it('DELETE /preferences/slack is forbidden for gmail-scoped token', async () => {
      const res = await withTestHeaders(request(app).delete('/api/v1/services/preferences/slack'))
        .set('Authorization', `Bearer ${gmailToken.raw}`);
      expect(res.status).toBe(403);
    });
  });

  describe('knowledge-base: allow-list gating', () => {
    it('GET /brain/knowledge-base returns only the allowed doc', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/brain/knowledge-base'))
        .set('Authorization', `Bearer ${kbNarrowToken.raw}`);
      expect(res.status).toBe(200);
      const ids = (Array.isArray(res.body) ? res.body : res.body.data || []).map(d => d.id);
      expect(ids).toContain(allowedKbId);
      expect(ids).not.toContain(blockedKbId);
    });

    it('GET /brain/knowledge-base/:allowed returns 200', async () => {
      const res = await withTestHeaders(request(app).get(`/api/v1/brain/knowledge-base/${allowedKbId}`))
        .set('Authorization', `Bearer ${kbNarrowToken.raw}`);
      expect(res.status).toBe(200);
    });

    it('GET /brain/knowledge-base/:blocked returns 403', async () => {
      const res = await withTestHeaders(request(app).get(`/api/v1/brain/knowledge-base/${blockedKbId}`))
        .set('Authorization', `Bearer ${kbNarrowToken.raw}`);
      expect(res.status).toBe(403);
    });

    it('GET /brain/knowledge-base/:blocked/attachments returns 403', async () => {
      const res = await withTestHeaders(request(app).get(`/api/v1/brain/knowledge-base/${blockedKbId}/attachments`))
        .set('Authorization', `Bearer ${kbNarrowToken.raw}`);
      expect(res.status).toBe(403);
    });

    it('GET /brain/knowledge-base/:id/attachments without knowledge scope returns 403', async () => {
      // Token with no knowledge scope at all
      const basicToken = insertToken({
        ownerId: userId,
        scopeValue: JSON.stringify(['basic']),
        label: 'Basic Only',
      });
      grantScopes(basicToken.id, ['basic']);
      const res = await withTestHeaders(request(app).get(`/api/v1/brain/knowledge-base/${allowedKbId}/attachments`))
        .set('Authorization', `Bearer ${basicToken.raw}`);
      expect(res.status).toBe(403);
    });

    it('master token sees every KB doc regardless of allow-list', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/brain/knowledge-base'))
        .set('Authorization', `Bearer ${masterToken.raw}`);
      expect(res.status).toBe(200);
      const ids = (Array.isArray(res.body) ? res.body : res.body.data || []).map(d => d.id);
      expect(ids).toContain(allowedKbId);
      expect(ids).toContain(blockedKbId);
    });
  });

  describe('skills: allow-list gating', () => {
    it('GET /skills returns only the allowed skill', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/skills'))
        .set('Authorization', `Bearer ${skillsNarrowToken.raw}`);
      expect(res.status).toBe(200);
      const ids = (res.body.skills || []).map(s => s.id);
      expect(ids).toContain(allowedSkillId);
      expect(ids).not.toContain(blockedSkillId);
    });

    it('GET /skills/:allowed returns 200', async () => {
      const res = await withTestHeaders(request(app).get(`/api/v1/skills/${allowedSkillId}`))
        .set('Authorization', `Bearer ${skillsNarrowToken.raw}`);
      expect(res.status).toBe(200);
    });

    it('GET /skills/:blocked returns 403', async () => {
      const res = await withTestHeaders(request(app).get(`/api/v1/skills/${blockedSkillId}`))
        .set('Authorization', `Bearer ${skillsNarrowToken.raw}`);
      expect(res.status).toBe(403);
    });

    it('GET /skills/:blocked/content returns 403', async () => {
      const res = await withTestHeaders(request(app).get(`/api/v1/skills/${blockedSkillId}/content`))
        .set('Authorization', `Bearer ${skillsNarrowToken.raw}`);
      expect(res.status).toBe(403);
    });

    it('GET /skills/:blocked/skill.md returns 403', async () => {
      const res = await withTestHeaders(request(app).get(`/api/v1/skills/${blockedSkillId}/skill.md`))
        .set('Authorization', `Bearer ${skillsNarrowToken.raw}`);
      expect(res.status).toBe(403);
    });

    it('GET /skills/_batch?id=blocked drops the blocked skill', async () => {
      const res = await withTestHeaders(request(app)
        .get(`/api/v1/skills/_batch?id=${allowedSkillId}&id=${blockedSkillId}`))
        .set('Authorization', `Bearer ${skillsNarrowToken.raw}`);
      expect(res.status).toBe(200);
      const ids = (res.body.skills || []).map(s => s.id);
      expect(ids).toContain(allowedSkillId);
      expect(ids).not.toContain(blockedSkillId);
    });
  });

  describe('export: guest tokens are rejected', () => {
    it('GET /api/v1/export rejects a guest token even with full-looking scopes', async () => {
      const broadGuest = insertToken({
        ownerId: userId,
        scopeValue: JSON.stringify(['knowledge', 'skills:read', 'services:read']),
        label: 'Broad Guest',
      });
      grantScopes(broadGuest.id, ['knowledge', 'skills:read', 'services:read']);
      const res = await withTestHeaders(request(app).get('/api/v1/export'))
        .set('Authorization', `Bearer ${broadGuest.raw}`);
      expect(res.status).toBe(403);
    });

    it('GET /api/v1/export is allowed for a master token', async () => {
      const res = await withTestHeaders(request(app).get('/api/v1/export?format=json'))
        .set('Authorization', `Bearer ${masterToken.raw}`);
      // Export handler may return 200 or 500 depending on downstream deps; the key
      // assertion is that the scope guard does not block the master token.
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
    });
  });
});
