/**
 * Composio per-toolkit disconnect.
 *
 * Regression: disconnecting one Composio service (e.g. googlecalendar) deleted
 * EVERY connected account — disconnectComposioForUser nuked all of them, and the
 * disconnect route/frontend routed every composio service to that all-or-nothing
 * path. disconnectComposioToolkit must remove ONLY the targeted toolkit's
 * accounts and leave the rest connected.
 */

const crypto = require('crypto');

process.env.COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY || 'test-composio-key';
process.env.COMPOSIO_AUTH_CONFIG_ID = process.env.COMPOSIO_AUTH_CONFIG_ID || 'test-auth-config';

// Mock Composio backend with TWO connected toolkits; track DELETEs so we can
// assert exactly which accounts were removed.
const deleted = new Set();
const ACCOUNTS = [
  { id: 'acc_gcal', user_id: 'u', status: 'ACTIVE', toolkit: { slug: 'googlecalendar', name: 'Google Calendar' }, auth_config_id: 'ac1' },
  { id: 'acc_gmail', user_id: 'u', status: 'ACTIVE', toolkit: { slug: 'gmail', name: 'Gmail' }, auth_config_id: 'ac2' },
];
const realFetch = global.fetch;
global.fetch = jest.fn(async (url, opts = {}) => {
  const href = String(url);
  const method = (opts.method || 'GET').toUpperCase();
  if (href.includes('backend.composio.dev')) {
    // DELETE /connected_accounts/{id}
    const delMatch = href.match(/\/connected_accounts\/(acc_[a-z]+)/i);
    if (method === 'DELETE' && delMatch) {
      deleted.add(delMatch[1]);
      return { ok: true, status: 200, text: async () => '{}' };
    }
    if (href.includes('/connected_accounts')) {
      const live = ACCOUNTS.filter((a) => !deleted.has(a.id));
      return { ok: true, status: 200, text: async () => JSON.stringify({ items: live }) };
    }
    return { ok: true, status: 200, text: async () => '{}' };
  }
  return realFetch ? realFetch(url, opts) : Promise.reject(new Error('unexpected fetch ' + href));
});

require('../server'); // initializes DB + migrations
const db = require('../database');
const composio = require('../services/composio-integration');

describe('Composio per-toolkit disconnect', () => {
  let userId;

  beforeAll(() => {
    const sfx = crypto.randomBytes(4).toString('hex');
    const user = db.createUser('cdisc_' + sfx, 'Disc Tester', `cdisc+${sfx}@example.com`, 'UTC', 'Password123!');
    userId = String(user.id);
    // Rewrite mock account user ids to this user so the sync filter matches.
    ACCOUNTS.forEach((a) => { a.user_id = userId; });
  });

  beforeEach(() => { deleted.clear(); });

  it('removes only the targeted toolkit, leaving the others connected', async () => {
    const result = await composio.disconnectComposioToolkit(userId, 'googlecalendar');
    expect(result.ok).toBe(true);
    expect(result.removed).toBe(1);

    // Only the googlecalendar account was deleted.
    expect(deleted.has('acc_gcal')).toBe(true);
    expect(deleted.has('acc_gmail')).toBe(false);

    // gmail is still connected in the resulting state.
    const slugs = (result.services || []).map((s) => s.toolkitSlug);
    expect(slugs).toContain('gmail');
    expect(slugs).not.toContain('googlecalendar');
  });

  it('accepts the prefixed form (composio__googlecalendar) too', async () => {
    const result = await composio.disconnectComposioToolkit(userId, 'composio__gmail');
    expect(result.ok).toBe(true);
    expect(deleted.has('acc_gmail')).toBe(true);
    expect(deleted.has('acc_gcal')).toBe(false);
  });

  it('disconnectComposioForUser still removes everything (root disconnect)', async () => {
    await composio.disconnectComposioForUser(userId);
    expect(deleted.has('acc_gcal')).toBe(true);
    expect(deleted.has('acc_gmail')).toBe(true);
  });

  afterAll(() => { global.fetch = realFetch; });
});
