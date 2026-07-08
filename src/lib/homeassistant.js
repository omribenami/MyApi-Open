'use strict';

/**
 * Home Assistant connector.
 *
 * Unlike OAuth services, Home Assistant is INSTANCE-hosted: every user has
 * their own server (Nabu Casa cloud URL, reverse-proxied domain, or LAN IP)
 * and authenticates with a long-lived access token they generate in their HA
 * profile (Profile → Security → Long-lived access tokens).
 *
 * Connection = { base_url, token } stored in service_preferences under
 * 'homeassistant'. The proxy resolves the per-user API root as
 * `${base_url}/api` and sends `Authorization: Bearer ${token}` — giving
 * agents the full HA REST API (states, service calls, history, templates)
 * through the normal /services/homeassistant/proxy path with all the usual
 * gateway controls (scopes, sub-scopes, limits, audit).
 *
 * SSRF note: private/LAN base URLs are refused unless
 * ALLOW_PRIVATE_SERVICE_HOSTS=1 (for self-hosted MyApi on the same network —
 * a cloud deployment could otherwise be pointed at internal services).
 */

const https = require('https');
const http = require('http');

const SERVICE_NAME = 'homeassistant';

function allowPrivateHosts() {
  return ['1', 'true', 'yes'].includes(String(process.env.ALLOW_PRIVATE_SERVICE_HOSTS || '').toLowerCase());
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i, /\.local$/i,
  /^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./,
  /^\[?::1\]?$/, /^\[?f[cd][0-9a-f]{2}:/i, /^\[?fe80:/i,
];
function isPrivateHostname(hostname) {
  return PRIVATE_HOST_PATTERNS.some((re) => re.test(String(hostname || '')));
}

/**
 * Validate + canonicalize an instance URL.
 * Returns the normalized origin (scheme://host[:port], no trailing slash).
 * Throws with a user-facing message on invalid input.
 */
function normalizeBaseUrl(input) {
  const raw = String(input || '').trim().replace(/\/+$/, '');
  if (!raw) throw new Error('base_url is required (e.g. https://myhome.duckdns.org:8123)');
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error(`'${input}' is not a valid URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('base_url must use http:// or https://');
  }
  if (url.pathname && url.pathname !== '/') {
    // Keep sub-path installs (e.g. behind a reverse proxy at /homeassistant)
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  }
  return url.origin;
}

/**
 * Probe the instance: GET {base}/api/ with the token.
 * HA answers 200 {"message": "API running."} when the URL + token are right.
 */
function probeInstance(baseUrl, token, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    let targetUrl;
    try {
      targetUrl = new URL(`${baseUrl}/api/`);
    } catch {
      return resolve({ ok: false, error: 'Invalid base URL' });
    }
    const transport = targetUrl.protocol === 'https:' ? https : http;
    const req = transport.request(targetUrl, {
      method: 'GET',
      timeout: timeoutMs,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'User-Agent': 'MyApi-Gateway/1.0',
      },
    }, (resp) => {
      let data = '';
      resp.on('data', (chunk) => (data += chunk));
      resp.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = null; }
        if (resp.statusCode === 200) {
          // The HA frontend is an SPA that answers 200 with HTML on ANY path,
          // so a 200 alone proves nothing — require the REST API's JSON body.
          if (parsed && typeof parsed === 'object' && typeof parsed.message === 'string') {
            return resolve({ ok: true, message: parsed.message });
          }
          return resolve({
            ok: false,
            statusCode: 200,
            nonApiResponse: true,
            error: 'That URL answers with the Home Assistant web page, not the REST API. Use the instance root URL (e.g. https://xyz.ui.nabu.casa) without any page path like /profile or /lovelace.',
          });
        }
        if (resp.statusCode === 401 || resp.statusCode === 403) {
          return resolve({ ok: false, statusCode: resp.statusCode, error: 'Home Assistant rejected the token. Create a Long-Lived Access Token under Profile → Security and try again.' });
        }
        return resolve({ ok: false, statusCode: resp.statusCode, error: `Instance answered HTTP ${resp.statusCode} — is this the right URL? Expected the Home Assistant web address (e.g. https://myhome.duckdns.org:8123).` });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', (e) => resolve({
      ok: false,
      error: `Could not reach the instance (${e.message}). Check the URL is accessible from this server — LAN-only addresses are not reachable from a cloud deployment.`,
    }));
    req.end();
  });
}

// Stored connection for a user, or null. Reads service_preferences.
function getConnection(userId) {
  const { getServicePreference } = require('../database');
  const prefs = getServicePreference(userId, SERVICE_NAME);
  const baseUrl = String(prefs?.preferences?.base_url || '').trim().replace(/\/+$/, '');
  const token = String(prefs?.preferences?.token || '').trim();
  if (!baseUrl || !token) return null;
  return { baseUrl, token, apiRoot: `${baseUrl}/api`, createdAt: prefs?.created_at || null };
}

// Fields the dashboard connect modal renders (mirrors Composio authFields shape:
// name/displayName/required/secret/description).
const AUTH_FIELDS = [
  { name: 'base_url', displayName: 'Instance URL', required: true, secret: false, description: 'Your Home Assistant web address, e.g. https://myhome.duckdns.org:8123 or your Nabu Casa URL. Must be reachable from this server.' },
  { name: 'token', displayName: 'Long-Lived Access Token', required: true, secret: true, description: 'Create one in Home Assistant: your Profile → Security → Long-lived access tokens → Create token.' },
];

module.exports = {
  SERVICE_NAME,
  AUTH_FIELDS,
  allowPrivateHosts,
  isPrivateHostname,
  normalizeBaseUrl,
  probeInstance,
  getConnection,
};
