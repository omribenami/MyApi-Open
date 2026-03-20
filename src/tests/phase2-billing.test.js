const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../server');
const db = require('../database');
const { resolveWorkspaceCurrentPlan } = require('../lib/billing');

describe('Phase 2 Billing & Usage', () => {
  const tokenRaw = `phase2_token_${Date.now()}`;
  let workspace;
  let user;

  beforeAll(() => {
    user = db.createUser(`p2_${Date.now()}`, 'Phase2 User', 'phase2@example.com', 'UTC', 'password123');
    workspace = db.createWorkspace(`Phase2 Workspace ${Date.now()}`, user.id);

    const hash = bcrypt.hashSync(tokenRaw, 10);
    db.createAccessToken(hash, user.id, 'full', 'Phase2 Test Token');
  });

  test('plan resolution falls back to free when subscription missing', () => {
    const plan = resolveWorkspaceCurrentPlan(null);
    expect(plan.id).toBe('free');
  });

  test('GET /api/v1/billing/current returns workspace-scoped current shape', async () => {
    const res = await request(app)
      .get('/api/v1/billing/current')
      .set('Authorization', `Bearer ${tokenRaw}`)
      .set('X-Workspace-ID', workspace.id);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.workspaceId).toBe(workspace.id);
    expect(res.body.data.plan).toBeDefined();
    expect(typeof res.body.data.billingConfigured).toBe('boolean');
  });

  test('GET /api/v1/billing/usage returns expected shape', async () => {
    const res = await request(app)
      .get('/api/v1/billing/usage?range=7d')
      .set('Authorization', `Bearer ${tokenRaw}`)
      .set('X-Workspace-ID', workspace.id);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.workspaceId).toBe(workspace.id);
    expect(res.body.data.range).toBe('7d');
    expect(res.body.data.totals).toBeDefined();
    expect(res.body.data.limits).toBeDefined();
    expect(Array.isArray(res.body.data.daily)).toBe(true);
  });
});
