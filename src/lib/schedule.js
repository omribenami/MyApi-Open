'use strict';

/**
 * Structured, timezone-aware schedules for Automations (Triggers).
 *
 * IFTTT-style — the UI never shows cron. Supported shapes:
 *   { type: 'interval', everyMinutes: 30 }
 *   { type: 'daily',    atHour: 7,  atMinute: 0 }
 *   { type: 'weekly',   weekday: 1, atHour: 9, atMinute: 0 }   // 0=Sun..6=Sat
 *   { type: 'monthly',  day: 1,     atHour: 8, atMinute: 0 }   // day 1..31
 *
 * computeNextRun returns the next fire time STRICTLY AFTER `from` as an ISO
 * string, honoring the IANA `timezone` via Intl (no external dependency).
 */

// Wall-clock parts for an instant in a given IANA timezone.
function partsInTz(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
  });
  const p = {};
  for (const { type, value } of fmt.formatToParts(date)) p[type] = value;
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: +p.year, month: +p.month, day: +p.day,
    hour: +(p.hour === '24' ? 0 : p.hour), minute: +p.minute, second: +p.second,
    weekday: WD[p.weekday],
  };
}

// The UTC instant whose wall-clock in `timeZone` is the given Y/M/D h:m:00.
// Resolves the tz offset by formatting a guess and correcting once (handles DST
// well enough for minute-granularity scheduling).
function zonedTimeToUtc(y, mo, d, h, mi, timeZone) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const seen = partsInTz(new Date(guess), timeZone);
  const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, 0);
  const offset = seenUtc - guess; // ms the tz is ahead of the naive UTC guess
  return new Date(guess - offset);
}

function isValidSchedule(s) {
  if (!s || typeof s !== 'object') return false;
  switch (s.type) {
    case 'once':     return !!s.at && !Number.isNaN(Date.parse(s.at));
    case 'interval': return Number.isFinite(s.everyMinutes) && s.everyMinutes >= 1;
    case 'daily':    return inRange(s.atHour, 0, 23) && inRange(s.atMinute, 0, 59);
    case 'weekly':   return inRange(s.weekday, 0, 6) && inRange(s.atHour, 0, 23) && inRange(s.atMinute, 0, 59);
    case 'monthly':  return inRange(s.day, 1, 31) && inRange(s.atHour, 0, 23) && inRange(s.atMinute, 0, 59);
    default:         return false;
  }
}
function inRange(v, lo, hi) { return Number.isInteger(v) && v >= lo && v <= hi; }

/**
 * @param {object} schedule  structured schedule (see top)
 * @param {string} timezone  IANA tz, default 'UTC'
 * @param {Date}   from      compute the first fire strictly after this (default now)
 * @returns {string|null}    ISO timestamp, or null for an invalid schedule
 */
function computeNextRun(schedule, timezone = 'UTC', from = new Date()) {
  if (!isValidSchedule(schedule)) return null;
  const tz = timezone || 'UTC';

  if (schedule.type === 'once') {
    const at = new Date(schedule.at);
    return at.getTime() > from.getTime() ? at.toISOString() : null; // fires once, then never again
  }

  if (schedule.type === 'interval') {
    return new Date(from.getTime() + schedule.everyMinutes * 60000).toISOString();
  }

  const { atHour: h, atMinute: mi } = schedule;
  // Walk forward day by day (max 366) from the tz-local "today" until we find a
  // matching day whose target time is strictly after `from`.
  const base = partsInTz(from, tz);
  for (let i = 0; i <= 366; i++) {
    const probe = new Date(Date.UTC(base.year, base.month - 1, base.day + i, 12, 0, 0));
    const pp = partsInTz(probe, tz);
    if (schedule.type === 'weekly' && pp.weekday !== schedule.weekday) continue;
    if (schedule.type === 'monthly' && pp.day !== schedule.day) continue;
    const candidate = zonedTimeToUtc(pp.year, pp.month, pp.day, h, mi, tz);
    if (candidate.getTime() > from.getTime()) return candidate.toISOString();
  }
  return null;
}

function describeSchedule(schedule) {
  if (!isValidSchedule(schedule)) return 'Invalid schedule';
  const t = (s) => `${String(s.atHour).padStart(2, '0')}:${String(s.atMinute).padStart(2, '0')}`;
  const DAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
  switch (schedule.type) {
    case 'once': {
      const d = new Date(schedule.at);
      return `Once on ${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    case 'interval': return `Every ${schedule.everyMinutes} minute(s)`;
    case 'daily':    return `Every day at ${t(schedule)}`;
    case 'weekly':   return `${DAYS[schedule.weekday]} at ${t(schedule)}`;
    case 'monthly':  return `Day ${schedule.day} of each month at ${t(schedule)}`;
    default:         return 'Custom';
  }
}

module.exports = { computeNextRun, isValidSchedule, describeSchedule };
