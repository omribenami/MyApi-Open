/**
 * Notification pipeline — end-to-end regression tests.
 *
 * Pins down the bugs that made notifications "not work":
 *   1. initDatabase() dropped the notifications table on EVERY startup, wiping
 *      all notifications at each server restart.
 *   2. Per-type settings saved by the Settings UI (type_settings) were never
 *      read by either emit path — toggling a type off did nothing.
 *   3. notification_queue rows were inserted 'pending' and never processed.
 *   4. Failed OAuth refreshes died silently — now emit oauth_reconnect_required.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

const TMP_DB = path.join(os.tmpdir(), `notif-test-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = TMP_DB;

const db = require('../database');
const NotificationService = require('../services/notificationService');
const NotificationDispatcher = require('../lib/notificationDispatcher');

const USER_ID = 'user_notif_test';
let WS_ID;

function setChannel(channel, enabled) {
  db.updateNotificationPreferences(WS_ID, USER_ID, channel, { enabled, frequency: 'immediate' });
}

beforeAll(() => {
  db.initDatabase();
  const now = new Date().toISOString();
  db.db.prepare(`INSERT OR IGNORE INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, 'x', ?)`)
    .run(USER_ID, 'notif-test', 'notif-test@example.com', now);
  // Resolves (and creates) the user's workspace + default channel prefs
  const settings = db.getOrCreateNotificationSettings(null, USER_ID);
  WS_ID = settings.inApp.workspace_id;
});

afterAll(() => {
  for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) {
    try { fs.unlinkSync(f); } catch (_) {}
  }
});

describe('notifications survive server restarts', () => {
  it('initDatabase() re-run does not wipe existing notifications', () => {
    const id = db.createNotification(WS_ID, USER_ID, 'token_revoked', 'Survives', 'restart test');
    db.initDatabase(); // simulates a server restart
    const row = db.db.prepare('SELECT id FROM notifications WHERE id = ?').get(id);
    expect(row).toBeTruthy();
  });
});

describe('per-type settings are enforced (NotificationService)', () => {
  beforeEach(() => {
    setChannel('in-app', true);
    setChannel('email', false);
  });

  it('creates an in-app notification when type is enabled (default)', async () => {
    const result = await NotificationService.emitNotification(USER_ID, 'token_created', 'T1', 'enabled type');
    expect(result.notificationId).toBeTruthy();
    const row = db.db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.notificationId);
    expect(row.type).toBe('token_created');
  });

  it('suppresses in-app notification when the type is toggled off', async () => {
    db.updateNotificationTypeSettings(WS_ID, USER_ID, 'in-app', 'skill_liked', false);
    const result = await NotificationService.emitNotification(USER_ID, 'skill_liked', 'T2', 'disabled type');
    expect(result.notificationId).toBeNull();
    db.updateNotificationTypeSettings(WS_ID, USER_ID, 'in-app', 'skill_liked', true);
  });

  it('queues an email only when channel AND type are enabled', async () => {
    setChannel('email', true);
    db.updateNotificationTypeSettings(WS_ID, USER_ID, 'email', 'token_revoked', false);
    await NotificationService.emitNotification(USER_ID, 'token_revoked', 'T3', 'email type off');
    let emails = db.db.prepare(`SELECT * FROM email_queue WHERE user_id = ? AND subject LIKE '%T3%'`).all(USER_ID);
    expect(emails.length).toBe(0);

    db.updateNotificationTypeSettings(WS_ID, USER_ID, 'email', 'token_revoked', true);
    await NotificationService.emitNotification(USER_ID, 'token_revoked', 'T4', 'email type on');
    emails = db.db.prepare(`SELECT * FROM email_queue WHERE user_id = ? AND subject LIKE '%T4%'`).all(USER_ID);
    expect(emails.length).toBe(1);
  });

  it('security_alert is always delivered in-app, even with the channel disabled', async () => {
    setChannel('in-app', false);
    const result = await NotificationService.emitNotification(USER_ID, 'security_alert', 'Token Suspended', 'compromise');
    expect(result.notificationId).toBeTruthy();
    setChannel('in-app', true);
  });
});

describe('per-type settings are enforced (NotificationDispatcher)', () => {
  beforeEach(() => {
    setChannel('in-app', true);
    setChannel('email', false);
  });

  it('dispatches when type enabled, suppresses when toggled off', async () => {
    const id1 = await NotificationDispatcher.dispatch(WS_ID, USER_ID, 'oauth_connected', 'GitHub Connected', 'linked');
    expect(id1).toBeTruthy();

    db.updateNotificationTypeSettings(WS_ID, USER_ID, 'in-app', 'oauth_connected', false);
    const id2 = await NotificationDispatcher.dispatch(WS_ID, USER_ID, 'oauth_connected', 'GitHub Connected', 'linked again');
    expect(id2).toBeUndefined();
    db.updateNotificationTypeSettings(WS_ID, USER_ID, 'in-app', 'oauth_connected', true);
  });

  it('does not default the email channel to enabled (converged with service model)', async () => {
    const before = db.db.prepare(`SELECT COUNT(*) c FROM email_queue WHERE user_id = ?`).get(USER_ID).c;
    await NotificationDispatcher.dispatch(WS_ID, USER_ID, 'billing_quota_warning', 'Quota', '80% used', { percentageUsed: 80 });
    const after = db.db.prepare(`SELECT COUNT(*) c FROM email_queue WHERE user_id = ?`).get(USER_ID).c;
    expect(after).toBe(before); // email channel disabled → no email queued
  });
});

describe('notification_queue lifecycle', () => {
  it('in-app rows are recorded as delivered immediately', () => {
    const nid = db.createNotification(WS_ID, USER_ID, 'skill_used', 'Q1', 'queue test');
    db.queueNotificationForDelivery(nid, ['in-app']);
    const row = db.db.prepare(`SELECT * FROM notification_queue WHERE notification_id = ?`).get(nid);
    expect(row.status).toBe('delivered');
    expect(row.sent_at).toBeTruthy();
  });

  it('email rows are closed when markEmailAsSent fires', () => {
    const nid = db.createNotification(WS_ID, USER_ID, 'skill_used', 'Q2', 'queue email test');
    db.queueNotificationForDelivery(nid, ['email']);
    const emailId = db.queueEmail(USER_ID, 'notif-test@example.com', 'Q2', 'body', { notificationId: nid });
    db.markEmailAsSent(emailId);
    const row = db.db.prepare(`SELECT * FROM notification_queue WHERE notification_id = ? AND channel = 'email'`).get(nid);
    expect(row.status).toBe('delivered');
  });
});

describe('oauth_reconnect_required on failed token refresh', () => {
  it('emits a notification when refresh fails, deduped within 24h', async () => {
    setChannel('in-app', true);
    const past = new Date(Date.now() - 3600 * 1000).toISOString();
    db.storeOAuthToken('github', USER_ID, 'expired-access', 'some-refresh-token', past, 'repo');

    // 127.0.0.1:9 → connection refused → terminal refresh failure
    const r1 = await db.refreshOAuthToken('github', USER_ID, 'http://127.0.0.1:9/token', 'cid', 'csec');
    expect(r1.ok).toBe(false);
    // emitNotification is fire-and-forget inside the failure path — let it settle
    await new Promise(r => setTimeout(r, 100));

    const rows = db.db.prepare(`SELECT * FROM notifications WHERE user_id = ? AND type = 'oauth_reconnect_required'`).all(USER_ID);
    expect(rows.length).toBe(1);
    expect(rows[0].title).toMatch(/Github Needs Reconnection/i);

    // Second failure within 24h → no duplicate
    await db.refreshOAuthToken('github', USER_ID, 'http://127.0.0.1:9/token', 'cid', 'csec');
    await new Promise(r => setTimeout(r, 100));
    const rows2 = db.db.prepare(`SELECT * FROM notifications WHERE user_id = ? AND type = 'oauth_reconnect_required'`).all(USER_ID);
    expect(rows2.length).toBe(1);
  });
});
