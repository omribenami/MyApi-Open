#!/usr/bin/env node
/**
 * One-time repair for the 2026-07-05 inactivity sweep.
 *
 * That sweep recorded 48 warnings in `inactivity_notices`, but most warning
 * emails were dropped by Resend's rate limit (2 req/sec) before throttling
 * was added to emailService. This script:
 *
 *   1. Loads pending (not cancelled, not deleted) inactivity notices.
 *   2. Asks the Resend API which of those addresses actually received a
 *      "beta seat expires" email.
 *   3. For everyone who didn't: re-sends the warning (now throttled) and
 *      pushes their delete_after out to a full grace period from now, so
 *      they get the grace they were promised from the day the email lands.
 *
 * Usage (inside the prod container):
 *   node scripts/rewarn-missed-inactivity.js --dry-run
 *   node scripts/rewarn-missed-inactivity.js
 */

const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const GRACE_DAYS = parseInt(process.env.INACTIVITY_GRACE_DAYS, 10) || 4;
const RESEND_KEY = process.env.RESEND_API_KEY;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'myapi.db');
const WARNING_SUBJECT_MARKER = 'beta seat expires';
// Only look at Resend history from the first live sweep onward.
const HISTORY_CUTOFF = '2026-07-05 00:00';

async function fetchWarnedRecipients() {
  const delivered = new Set();
  let after = null;
  for (let page = 0; page < 30; page++) {
    const url = 'https://api.resend.com/emails?limit=100' + (after ? `&after=${after}` : '');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${RESEND_KEY}` } });
    if (!res.ok) throw new Error(`Resend API ${res.status}: ${await res.text()}`);
    const json = await res.json();
    for (const e of json.data) {
      if (e.subject && e.subject.includes(WARNING_SUBJECT_MARKER) && e.last_event === 'delivered') {
        for (const to of e.to || []) delivered.add(to.toLowerCase());
      }
    }
    const oldest = json.data[json.data.length - 1];
    if (!json.has_more || !oldest || oldest.created_at < HISTORY_CUTOFF) break;
    after = oldest.id;
  }
  return delivered;
}

async function main() {
  if (!RESEND_KEY) throw new Error('RESEND_API_KEY not set');
  const db = new Database(DB_PATH);

  const pending = db.prepare(`
    SELECT n.user_id, n.email, n.warned_at, n.delete_after,
           u.display_name, u.username
    FROM inactivity_notices n
    JOIN users u ON u.id = n.user_id
    WHERE n.cancelled_at IS NULL AND n.deleted_at IS NULL
  `).all();
  // JOIN (not LEFT JOIN): a notice whose user no longer exists is a stale row
  // (e.g. self-deleted account) — re-warning that address would be wrong.
  console.log(`Pending notices: ${pending.length}`);

  const delivered = await fetchWarnedRecipients();
  console.log(`Addresses with a delivered warning email: ${delivered.size}`);

  const missed = pending.filter((n) => n.email && !delivered.has(n.email.toLowerCase()));
  const noEmail = pending.filter((n) => !n.email);
  console.log(`Missed (no delivered warning): ${missed.length}; no email on file: ${noEmail.length}`);
  if (noEmail.length) noEmail.forEach((n) => console.log(`  no-email user: ${n.user_id}`));

  if (DRY_RUN) {
    missed.forEach((n) => console.log(`  would re-warn: ${n.email} (delete_after ${n.delete_after})`));
    console.log('Dry run — no changes made.');
    return;
  }

  const emailService = require('../services/emailService');
  const newDeleteAfter = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const update = db.prepare('UPDATE inactivity_notices SET delete_after = ? WHERE user_id = ?');

  let sent = 0, failed = 0;
  for (const n of missed) {
    const name = n.display_name || n.username || n.email;
    try {
      await emailService.sendInactivityWarningEmail(n.email, name, {
        graceDays: GRACE_DAYS,
        deleteAfter: newDeleteAfter,
      });
      update.run(newDeleteAfter, n.user_id);
      sent++;
      console.log(`re-warned ${n.email} → delete_after ${newDeleteAfter}`);
    } catch (err) {
      failed++;
      console.error(`FAILED for ${n.email}: ${err.message}`);
    }
  }
  console.log(`Done: re-warned ${sent}, failed ${failed}, new delete_after ${newDeleteAfter}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
