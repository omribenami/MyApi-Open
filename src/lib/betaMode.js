'use strict';

// BETA mode toggle driven by .env:
//   BETA=true|false        (default true: fail-safe to closed beta)
//   BETA_MAX_USERS=50      (integer; 0 = fully closed, waitlist only)
//
// Public signups (email/password + OAuth first-time) are blocked when the
// user count reaches BETA_MAX_USERS. Admin-created users bypass the cap
// intentionally, so admins can seat beta testers even when "full".

const DEFAULT_MAX = 50;
const FULL_CACHE_MS = 5000;

let fullCache = { at: 0, value: false };

function isBetaMode() {
  const raw = String(process.env.BETA ?? 'true').trim().toLowerCase();
  return !(raw === 'false' || raw === '0' || raw === 'no' || raw === 'off');
}

function getBetaMaxUsers() {
  const raw = parseInt(process.env.BETA_MAX_USERS, 10);
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_MAX;
  return raw;
}

function countActiveUsers() {
  const { countTotalUsers } = require('../database');
  try {
    return countTotalUsers();
  } catch {
    return 0;
  }
}

function isBetaFull() {
  if (!isBetaMode()) return false;
  const now = Date.now();
  if (now - fullCache.at < FULL_CACHE_MS) return fullCache.value;
  const max = getBetaMaxUsers();
  const count = countActiveUsers();
  const full = count >= max;
  fullCache = { at: now, value: full };
  return full;
}

function invalidateBetaFullCache() {
  fullCache = { at: 0, value: false };
}

function getBetaStatus() {
  return {
    beta: isBetaMode(),
    betaFull: isBetaFull(),
    betaMaxUsers: getBetaMaxUsers(),
  };
}

module.exports = {
  isBetaMode,
  getBetaMaxUsers,
  isBetaFull,
  getBetaStatus,
  invalidateBetaFullCache,
};
