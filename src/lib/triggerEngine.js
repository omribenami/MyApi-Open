'use strict';

/**
 * Automations engine — the runtime that makes MyApi proactive.
 *
 *   scheduler tick (60s): due schedule-triggers → enqueue a trigger_run, advance next_run_at
 *   worker tick    (10s): claim queued runs (durable lease) → executeAction → record result
 *
 * The platform itself executes — it never depends on the user's agent being awake.
 * Event (webhook) triggers and the AI loop arrive in later phases; this is the
 * deterministic core (service_proxy + afp_exec), fully audited and quota-counted.
 */

const db = require('../database');
const { computeNextRun } = require('./schedule');
const { executeAction } = require('./actionExecutor');

let schedulerTimer = null;
let workerTimer = null;

function parse(json, fallback) {
  try { return json ? JSON.parse(json) : fallback; } catch { return fallback; }
}

// Enqueue runs for any schedule-triggers that are due, then roll next_run_at.
function runSchedulerTick(now = new Date()) {
  const nowIso = now.toISOString();
  let enqueued = 0;
  let due;
  try { due = db.getDueScheduleTriggers(nowIso); } catch { return 0; }
  for (const t of due) {
    try {
      db.createTriggerRun({
        triggerId: t.id, workspaceId: t.workspace_id, ownerId: t.owner_id,
        status: 'queued', triggerKind: 'schedule', payloadJson: {},
      });
      const next = computeNextRun(parse(t.schedule_json, null), t.timezone || 'UTC', now);
      db.updateTrigger(t.id, { nextRunAt: next, lastRunAt: nowIso });
      enqueued += 1;
    } catch (err) {
      console.error('[Automations] scheduler enqueue failed', { trigger: t.id, err: err.message });
    }
  }
  return enqueued;
}

// Claim and execute queued runs.
async function runWorkerTick(limit = 5) {
  let claimed;
  try { claimed = db.claimQueuedTriggerRuns(limit); } catch { return 0; }
  let processed = 0;
  for (const run of claimed) {
    const trigger = db.getTriggerById(run.trigger_id);
    if (!trigger) { db.finishTriggerRun(run.id, 'failed', { error: 'trigger deleted' }); continue; }
    try {
      const res = await executeAction({
        ownerId: trigger.owner_id,
        workspaceId: trigger.workspace_id,
        actionType: trigger.action_type,
        action: parse(trigger.action_json, {}),
        actor: { triggerId: trigger.id, triggerName: trigger.name },
      });
      db.finishTriggerRun(run.id, res.ok ? 'done' : 'failed', {
        ok: res.ok, statusCode: res.statusCode, error: res.error || null,
        // Cap stored output so a chatty service can't bloat the row.
        data: res.ok ? truncate(res.data) : undefined,
      });
      processed += 1;
    } catch (err) {
      db.finishTriggerRun(run.id, 'failed', { error: err.message });
    }
  }
  return processed;
}

// Cap stored output so a chatty service response can't bloat the run row.
function truncate(data) {
  try {
    const s = JSON.stringify(data);
    if (s.length <= 8000) return data;
    return { _truncated: true, preview: s.slice(0, 8000) };
  } catch { return null; }
}

function start({ schedulerMs = 60_000, workerMs = 10_000 } = {}) {
  if (schedulerTimer || workerTimer) return; // idempotent
  // Backfill next_run_at for any schedule trigger missing it (e.g. first boot
  // after the migration), so existing rows start firing.
  try {
    for (const t of db.getDueScheduleTriggers('9999-12-31T00:00:00.000Z')) {
      if (!t.next_run_at) {
        const next = computeNextRun(parse(t.schedule_json, null), t.timezone || 'UTC', new Date());
        if (next) db.updateTrigger(t.id, { nextRunAt: next });
      }
    }
  } catch (_) {}

  schedulerTimer = setInterval(() => { try { runSchedulerTick(); } catch (e) { console.error('[Automations] scheduler error:', e.message); } }, schedulerMs);
  workerTimer = setInterval(() => { runWorkerTick().catch((e) => console.error('[Automations] worker error:', e.message)); }, workerMs);
  if (schedulerTimer.unref) schedulerTimer.unref();
  if (workerTimer.unref) workerTimer.unref();
  console.log('✅ Automations engine started (scheduler + worker)');
}

function stop() {
  if (schedulerTimer) clearInterval(schedulerTimer);
  if (workerTimer) clearInterval(workerTimer);
  schedulerTimer = workerTimer = null;
}

module.exports = { start, stop, runSchedulerTick, runWorkerTick };
