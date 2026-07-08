'use strict';

// Inactive-user lifecycle for the beta.
//
// Beta seats are capped (see lib/betaMode). Users who never actually use the
// platform — no service connected, no API call through a token, no automation
// created — hold a seat that an active waitlist user could take. Policy:
//
//   1. WARN:   `INACTIVITY_WARN_DAYS` (default 7) after registration a still-
//              inactive free-plan user gets an in-app notification + email:
//              become active or the account is removed after the grace period.
//   2. DELETE: `INACTIVITY_GRACE_DAYS` (default 4) after the warning, if the
//              user is *still* inactive, the account is deleted (goodbye email
//              included) and one pending waitlist entry is emailed that a spot
//              opened up.
//   3. CANCEL: a warned user who becomes active at any point has the pending
//              notice cancelled — nothing further happens.
//
// The sweep only runs while BETA mode is on, never touches non-free plans or
// the power-user account, and is idempotent: each phase is keyed off the
// `inactivity_notices` table.

const betaMode = require('./betaMode');

const WARN_AFTER_DAYS = intEnv('INACTIVITY_WARN_DAYS', 7);
const GRACE_DAYS = intEnv('INACTIVITY_GRACE_DAYS', 4);

function intEnv(name, fallback) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function db() {
  // database.js's live handle (same one every route uses) — required lazily so
  // this lib never races DB initialization at module load.
  return require('../database').db;
}

function ensureNoticesTable() {
  db().exec(`
    CREATE TABLE IF NOT EXISTS inactivity_notices (
      user_id TEXT PRIMARY KEY,
      email TEXT,
      warned_at TEXT NOT NULL,
      delete_after TEXT NOT NULL,
      cancelled_at TEXT,
      deleted_at TEXT
    );
  `);
}

// A user counts as ACTIVE if any of these ever happened:
//  - connected a service (OAuth token that isn't a login-only identity token)
//  - made an API call with a token (audit rows attributed actor_type='token')
//  - created an automation
function isUserActive(userId) {
  const d = db();
  const svc = d.prepare(
    "SELECT 1 FROM oauth_tokens WHERE user_id = ? AND (login_only IS NULL OR login_only != 1) LIMIT 1"
  ).get(userId);
  if (svc) return true;
  const api = d.prepare(
    "SELECT 1 FROM audit_log WHERE actor_id = ? AND actor_type = 'token' LIMIT 1"
  ).get(userId);
  if (api) return true;
  const trigger = d.prepare('SELECT 1 FROM triggers WHERE owner_id = ? LIMIT 1').get(userId);
  return !!trigger;
}

function powerUserEmail() {
  return String(process.env.POWER_USER_EMAIL || process.env.OWNER_EMAIL || '').trim().toLowerCase();
}

function eligibleUsers() {
  const cutoff = new Date(Date.now() - WARN_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rows = db().prepare(
    "SELECT id, email, username, display_name, plan, created_at FROM users WHERE plan = 'free' AND created_at <= ?"
  ).all(cutoff);
  const power = powerUserEmail();
  return rows.filter((u) => !power || String(u.email || '').toLowerCase() !== power);
}

function workspaceIdFor(userId) {
  const row = db().prepare('SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1').get(userId);
  if (row) return row.workspace_id;
  const { getOrEnsureUserWorkspace } = require('../database');
  return getOrEnsureUserWorkspace(userId);
}

// Mirrors the cascade in DELETE /api/v1/account (index.js). Tables that may
// not exist in older DBs are skipped.
function deleteUserCascade(userId) {
  const adapter = db();
  const rawDb = adapter.getRawDB ? adapter.getRawDB() : adapter;
  const existingTables = new Set(
    rawDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name)
  );
  const safeDelete = (sql, ...params) => {
    const match = sql.match(/DELETE FROM (\w+)/i);
    if (match && !existingTables.has(match[1])) return;
    rawDb.prepare(sql).run(...params);
  };
  rawDb.pragma('foreign_keys = OFF');
  rawDb.transaction((uid) => {
    safeDelete('DELETE FROM oauth_tokens WHERE user_id = ?', uid);
    safeDelete('DELETE FROM vault_tokens WHERE owner_id = ?', uid);
    safeDelete('DELETE FROM access_tokens WHERE owner_id = ?', uid);
    safeDelete('DELETE FROM approved_devices WHERE user_id = ?', uid);
    safeDelete('DELETE FROM device_approvals_pending WHERE user_id = ?', uid);
    safeDelete('DELETE FROM handshakes WHERE user_id = ?', uid);
    safeDelete('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)', uid);
    safeDelete('DELETE FROM conversations WHERE user_id = ?', uid);
    safeDelete('DELETE FROM notifications WHERE user_id = ?', uid);
    safeDelete('DELETE FROM notification_preferences WHERE user_id = ?', uid);
    safeDelete('DELETE FROM service_preferences WHERE user_id = ?', uid);
    safeDelete('DELETE FROM activity_log WHERE user_id = ?', uid);
    safeDelete('DELETE FROM email_queue WHERE user_id = ?', uid);
    safeDelete('DELETE FROM rate_limits WHERE user_id = ?', uid);
    safeDelete('DELETE FROM subscriptions WHERE user_id = ?', uid);
    safeDelete('DELETE FROM two_factor_backup_codes WHERE user_id = ?', uid);
    safeDelete('DELETE FROM team_invitations WHERE sender_id = ? OR recipient_id = ?', uid, uid);
    safeDelete('DELETE FROM marketplace_listings WHERE owner_id = ?', uid);
    safeDelete('DELETE FROM persona_documents WHERE persona_id IN (SELECT id FROM personas WHERE owner_id = ?)', uid);
    safeDelete('DELETE FROM persona_skills WHERE persona_id IN (SELECT id FROM personas WHERE owner_id = ?)', uid);
    safeDelete('DELETE FROM skills WHERE owner_id = ?', uid);
    safeDelete('DELETE FROM personas WHERE owner_id = ?', uid);
    safeDelete('DELETE FROM kb_documents WHERE owner_id = ?', uid);
    safeDelete('DELETE FROM triggers WHERE owner_id = ?', uid);
    safeDelete('DELETE FROM workspace_members WHERE user_id = ?', uid);
    safeDelete('DELETE FROM afp_devices WHERE user_id = ?', uid);
    safeDelete('DELETE FROM user_pii_secure WHERE user_id = ?', uid);
    safeDelete('DELETE FROM users WHERE id = ?', uid);
  })(userId);
}

// After a seat frees up, tell the longest-waiting pending waitlist entries.
// One entry per freed seat; marks them invited so re-runs don't re-email.
function backfillWaitlist(freedSeats, { dryRun, emailService, markWaitlistInvited }) {
  if (freedSeats <= 0) return [];
  const pending = db().prepare(
    "SELECT id, email FROM waitlist WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?"
  ).all(freedSeats);
  const notified = [];
  for (const entry of pending) {
    if (!dryRun) {
      markWaitlistInvited(entry.id);
      emailService.sendWaitlistSpotOpenedEmail(entry.email).catch(() => {});
    }
    notified.push(entry.email);
  }
  return notified;
}

/**
 * Run one lifecycle pass. Returns a report; pass { dryRun: true } to see what
 * would happen without sending emails or touching rows.
 */
function sweepInactiveUsers({ dryRun = false } = {}) {
  if (!betaMode.isBetaMode()) {
    return { skipped: 'beta mode off', warned: [], cancelled: [], deleted: [], waitlistNotified: [] };
  }
  ensureNoticesTable();

  const emailService = require('../services/emailService');
  const { createNotification, markWaitlistInvited, createComplianceAuditLog } = require('../database');

  const d = db();
  const nowIso = new Date().toISOString();
  const report = { dryRun, warned: [], cancelled: [], deleted: [], waitlistNotified: [], graceDays: GRACE_DAYS };

  const notices = new Map(
    d.prepare('SELECT * FROM inactivity_notices').all().map((n) => [n.user_id, n])
  );

  for (const user of eligibleUsers()) {
    const active = isUserActive(user.id);
    const notice = notices.get(user.id);
    const name = user.display_name || user.username || user.email;

    if (active) {
      if (notice && !notice.cancelled_at && !notice.deleted_at) {
        if (!dryRun) {
          d.prepare('UPDATE inactivity_notices SET cancelled_at = ? WHERE user_id = ?').run(nowIso, user.id);
        }
        report.cancelled.push(user.email);
      }
      continue;
    }

    if (!notice || notice.cancelled_at) {
      // WARN phase (a previously-cancelled notice restarts the clock).
      const deleteAfter = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
      if (!dryRun) {
        d.prepare(`
          INSERT INTO inactivity_notices (user_id, email, warned_at, delete_after, cancelled_at, deleted_at)
          VALUES (?, ?, ?, ?, NULL, NULL)
          ON CONFLICT(user_id) DO UPDATE SET warned_at = excluded.warned_at,
            delete_after = excluded.delete_after, cancelled_at = NULL, deleted_at = NULL
        `).run(user.id, user.email || null, nowIso, deleteAfter);
        try {
          createNotification(
            workspaceIdFor(user.id), user.id, 'inactivity_warning',
            'Your beta seat is at risk',
            `Beta seats are limited and we cherish active feedback. Connect a service or make an API call within ${GRACE_DAYS} days, or your account will be removed to make room for waitlisted users.`,
            { deleteAfter, graceDays: GRACE_DAYS }
          );
        } catch (err) {
          console.error('[Lifecycle] notification failed for', user.id, err.message);
        }
        if (user.email) {
          emailService.sendInactivityWarningEmail(user.email, name, {
            graceDays: GRACE_DAYS,
            deleteAfter,
          }).catch((err) => console.error('[Lifecycle] warning email failed for', user.email, err.message));
        }
      }
      report.warned.push(user.email);
      continue;
    }

    if (!notice.deleted_at && notice.delete_after <= nowIso) {
      // DELETE phase: grace expired, still inactive.
      if (!dryRun) {
        if (user.email && !String(user.email).includes('example.com')) {
          emailService.sendGoodbyeEmail(user.email, name).catch((err) => console.error('[Lifecycle] goodbye email failed for', user.email, err.message));
        }
        deleteUserCascade(user.id);
        d.prepare('UPDATE inactivity_notices SET deleted_at = ? WHERE user_id = ?').run(nowIso, user.id);
        try {
          createComplianceAuditLog(
            'system', 'system', 'inactive_user_deleted', 'user', user.id,
            JSON.stringify({ email: user.email, warnedAt: notice.warned_at }), null, null
          );
        } catch { /* compliance log is best-effort */ }
        betaMode.invalidateBetaFullCache();
      }
      report.deleted.push(user.email);
    }
  }

  report.waitlistNotified = backfillWaitlist(report.deleted.length, {
    dryRun, emailService, markWaitlistInvited,
  });

  if (report.warned.length || report.deleted.length || report.cancelled.length) {
    console.log(`[Lifecycle] sweep${dryRun ? ' (dry-run)' : ''}: warned=${report.warned.length} cancelled=${report.cancelled.length} deleted=${report.deleted.length} waitlistNotified=${report.waitlistNotified.length}`);
  }
  return report;
}

module.exports = { sweepInactiveUsers, isUserActive, WARN_AFTER_DAYS, GRACE_DAYS };
