/**
 * Beta inactive-user lifecycle: warn → grace → delete → waitlist backfill.
 * Exercises lib/userLifecycle.sweepInactiveUsers directly against the test DB.
 */

process.env.BETA = 'true';
process.env.INACTIVITY_WARN_DAYS = '7';
process.env.INACTIVITY_GRACE_DAYS = '4';

require('../server'); // boots the app + database
const db = require('../database');
const { sweepInactiveUsers } = require('../lib/userLifecycle');

const suffix = Date.now();

function makeUser(name, { daysOld = 10 } = {}) {
  const u = db.createUser(`${name}_${suffix}`, name, `${name}_${suffix}@example.com`, 'UTC', 'test-password-only');
  const createdAt = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
  db.db.prepare('UPDATE users SET created_at = ? WHERE id = ?').run(createdAt, u.id);
  return u;
}

function notice(userId) {
  return db.db.prepare('SELECT * FROM inactivity_notices WHERE user_id = ?').get(userId);
}

describe('inactive-user lifecycle sweep', () => {
  it('warns inactive users older than the warn window, once', () => {
    const lazy = makeUser('lc_lazy');
    const fresh = makeUser('lc_fresh', { daysOld: 2 });

    const r1 = sweepInactiveUsers();
    expect(r1.warned).toContain(lazy.email);
    expect(r1.warned).not.toContain(fresh.email);

    const n = notice(lazy.id);
    expect(n).toBeTruthy();
    expect(n.cancelled_at).toBeNull();
    // grace window respected (~4 days out)
    const graceMs = new Date(n.delete_after) - new Date(n.warned_at);
    expect(Math.round(graceMs / 86400000)).toBe(4);

    // in-app notification created
    const notif = db.db.prepare(
      "SELECT * FROM notifications WHERE user_id = ? AND type = 'inactivity_warning'"
    ).get(lazy.id);
    expect(notif).toBeTruthy();

    // second sweep does not double-warn or delete before the grace expires
    const r2 = sweepInactiveUsers();
    expect(r2.warned).not.toContain(lazy.email);
    expect(r2.deleted).not.toContain(lazy.email);
  });

  it('cancels the notice when a warned user becomes active', () => {
    const redeemed = makeUser('lc_redeemed');
    sweepInactiveUsers();
    expect(notice(redeemed.id)).toBeTruthy();

    // user connects a service → active
    db.db.prepare(`
      INSERT INTO oauth_tokens (id, service_name, user_id, access_token, created_at, updated_at)
      VALUES (?, 'github', ?, 'x', datetime('now'), datetime('now'))
    `).run(`oauth_lc_${suffix}`, redeemed.id);

    const r = sweepInactiveUsers();
    expect(r.cancelled).toContain(redeemed.email);
    expect(notice(redeemed.id).cancelled_at).toBeTruthy();

    // still exists, never deleted even after the grace elapses
    db.db.prepare('UPDATE inactivity_notices SET delete_after = ? WHERE user_id = ?')
      .run(new Date(Date.now() - 1000).toISOString(), redeemed.id);
    const r2 = sweepInactiveUsers();
    expect(r2.deleted).not.toContain(redeemed.email);
    expect(db.getUserById(redeemed.id)).toBeTruthy();
  });

  it('deletes users whose grace expired and notifies the waitlist', () => {
    const doomed = makeUser('lc_doomed');
    sweepInactiveUsers();

    const wlEmail = `lc_waiting_${suffix}@example.com`;
    db.addToWaitlist(wlEmail);

    // force the grace window into the past
    db.db.prepare('UPDATE inactivity_notices SET delete_after = ? WHERE user_id = ?')
      .run(new Date(Date.now() - 1000).toISOString(), doomed.id);

    const r = sweepInactiveUsers();
    expect(r.deleted).toContain(doomed.email);
    expect(r.waitlistNotified).toContain(wlEmail);

    expect(db.getUserById(doomed.id)).toBeFalsy();
    const wl = db.db.prepare('SELECT status FROM waitlist WHERE email = ?').get(wlEmail);
    expect(wl.status).toBe('invited');
  });

  it('dry run reports without mutating', () => {
    const ghost = makeUser('lc_ghost');
    const r = sweepInactiveUsers({ dryRun: true });
    expect(r.warned).toContain(ghost.email);
    expect(notice(ghost.id)).toBeFalsy();
    expect(db.getUserById(ghost.id)).toBeTruthy();
  });
});
