// Public runtime config (beta flag + user cap status). Cached in module scope
// so pages that render the billing cards or signup wizard share a single fetch.
// The backend sets Cache-Control: max-age=30, so a BETA flag flip propagates
// within ~30s without requiring a client reload.

import apiClient from './apiClient';

const FALLBACK = { beta: true, betaFull: false, betaMaxUsers: 50 };
let cached = null;
let inflight = null;

export function getCachedPublicConfig() {
  return cached || FALLBACK;
}

export async function fetchPublicConfig({ force = false } = {}) {
  if (cached && !force) return cached;
  if (inflight) return inflight;
  inflight = apiClient
    .get('/config/public')
    .then((res) => {
      const data = res?.data?.data || res?.data || {};
      cached = {
        beta: data.beta !== false,
        betaFull: Boolean(data.betaFull),
        betaMaxUsers: Number.isFinite(data.betaMaxUsers) ? data.betaMaxUsers : FALLBACK.betaMaxUsers,
      };
      return cached;
    })
    .catch(() => {
      cached = cached || FALLBACK;
      return cached;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function invalidatePublicConfigCache() {
  cached = null;
}
