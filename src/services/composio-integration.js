const COMPOSIO_ROOT_SERVICE = 'composio';
const COMPOSIO_VIRTUAL_PREFIX = 'composio__';
const COMPOSIO_PREF_KEY = 'composio';
const COMPOSIO_DOCS_URL = 'https://docs.composio.dev/docs/proxy-execute';
const COMPOSIO_BASE_URL = String(process.env.COMPOSIO_BASE_URL || 'https://backend.composio.dev/api/v3.1').replace(/\/+$/, '');
// Composio-hosted brand logos (SVG) — serves a real logo for every toolkit slug.
const COMPOSIO_LOGO_BASE = String(process.env.COMPOSIO_LOGO_BASE || 'https://logos.composio.dev/api').replace(/\/+$/, '');
const getToolkitLogo = (toolkitSlug) => `${COMPOSIO_LOGO_BASE}/${String(toolkitSlug || '').toLowerCase()}`;
const COMPOSIO_API_KEY = String(process.env.COMPOSIO_API_KEY || process.env.COMPOSIO_KEY || '').trim();
const COMPOSIO_AUTH_CONFIG_ID = String(process.env.COMPOSIO_AUTH_CONFIG_ID || process.env.COMPOSIO_DEFAULT_AUTH_CONFIG_ID || '').trim();
const COMPOSIO_CALLBACK_URL = String(process.env.COMPOSIO_CALLBACK_URL || process.env.COMPOSIO_REDIRECT_URI || 'https://www.myapiai.com/api/v1/oauth/callback/composio').trim();

// Per-toolkit auth configs (one auth_config_id per app/toolkit, e.g. github, slack, gmail).
// Loaded from src/config/composio-toolkits.json; can be extended/overridden via the
// COMPOSIO_AUTH_CONFIGS env var (JSON map of slug -> auth_config_id).
const COMPOSIO_TOOLKITS = (() => {
  let toolkits = {};
  try {
    toolkits = { ...require('../config/composio-toolkits.json') };
  } catch {
    toolkits = {};
  }
  const overrides = String(process.env.COMPOSIO_AUTH_CONFIGS || '').trim();
  if (overrides) {
    try {
      const parsed = JSON.parse(overrides);
      for (const [slug, authConfigId] of Object.entries(parsed)) {
        const key = String(slug).toLowerCase();
        toolkits[key] = { ...(toolkits[key] || { label: toTitleCase(key) }), authConfigId: String(authConfigId) };
      }
    } catch (error) {
      console.warn('[Composio] Failed to parse COMPOSIO_AUTH_CONFIGS:', error.message);
    }
  }
  return toolkits;
})();

function isComposioConfigured() {
  return Boolean(COMPOSIO_API_KEY && (COMPOSIO_AUTH_CONFIG_ID || Object.keys(COMPOSIO_TOOLKITS).length > 0));
}

function getAuthConfigIdForToolkit(toolkitSlug) {
  if (!toolkitSlug) return COMPOSIO_AUTH_CONFIG_ID || null;
  const config = COMPOSIO_TOOLKITS[String(toolkitSlug).toLowerCase()];
  return config?.authConfigId || null;
}

function isComposioRootService(serviceName) {
  return String(serviceName || '').toLowerCase() === COMPOSIO_ROOT_SERVICE;
}

// Remove the internal composio__ prefix to get the clean public/toolkit name.
function stripComposioPrefix(serviceName) {
  const s = String(serviceName || '').toLowerCase();
  return s.startsWith(COMPOSIO_VIRTUAL_PREFIX) ? s.slice(COMPOSIO_VIRTUAL_PREFIX.length) : s;
}

// A clean name (e.g. "gmail", "github") is treated as Composio-managed when it
// matches a known toolkit. This is what lets the prefix-free public name route to
// Composio, and — for names that also exist as native connectors (github, facebook,
// box, canva, dropbox, zoom, figma) — makes Composio deliberately win.
function isComposioToolkitSlug(serviceName) {
  return !!COMPOSIO_TOOLKITS[stripComposioPrefix(serviceName)];
}

function isComposioVirtualService(serviceName) {
  const s = String(serviceName || '').toLowerCase();
  if (s.startsWith(COMPOSIO_VIRTUAL_PREFIX)) return true;
  return isComposioToolkitSlug(s);
}

function isComposioManagedService(serviceName) {
  return isComposioRootService(serviceName) || isComposioVirtualService(serviceName);
}

function getVirtualServiceName(toolkitSlug) {
  return `${COMPOSIO_VIRTUAL_PREFIX}${String(toolkitSlug || '').toLowerCase()}`;
}

function getToolkitSlugFromServiceName(serviceName) {
  if (!isComposioVirtualService(serviceName)) return null;
  return stripComposioPrefix(serviceName);
}

// Canonical category key: lowercase, non-alphanumerics collapsed to '-'.
// Must match the frontend's category matching ('Business & CRM' -> 'business-crm').
function slugifyCategory(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getToolkitCategory(toolkitSlug) {
  return COMPOSIO_TOOLKITS[String(toolkitSlug || '').toLowerCase()]?.category || 'Productivity';
}

// How a toolkit is connected: 'oauth2' (redirect), 'api_key' (user pastes a
// secret), or 'none' (no credentials). Defaults to oauth2 for legacy entries.
function getToolkitAuthMode(toolkitSlug) {
  return COMPOSIO_TOOLKITS[String(toolkitSlug || '').toLowerCase()]?.authMode || 'oauth2';
}

// Credential fields the user must supply for an api_key toolkit (name,
// displayName, required, secret, description) — drives the connect form.
function getToolkitAuthFields(toolkitSlug) {
  return COMPOSIO_TOOLKITS[String(toolkitSlug || '').toLowerCase()]?.authFields || [];
}

// Unique categories across configured toolkits, as {name (key), label} pairs.
function getComposioCategories() {
  const map = new Map();
  for (const cfg of Object.values(COMPOSIO_TOOLKITS)) {
    const label = cfg.category || 'Productivity';
    map.set(slugifyCategory(label), { name: slugifyCategory(label), label });
  }
  return [...map.values()];
}

function toTitleCase(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\w/g, (char) => char.toUpperCase());
}

function buildVirtualService(toolkit) {
  const toolkitSlug = String(toolkit.toolkitSlug || toolkit.slug || '').toLowerCase();
  // Prefer the curated label from composio-toolkits.json — Composio's connected
  // account API can report raw lowercase names (e.g. "gmail").
  const toolkitLabel = COMPOSIO_TOOLKITS[toolkitSlug]?.label || toolkit.label || toolkit.toolkitName || toTitleCase(toolkitSlug);
  const categoryLabel = getToolkitCategory(toolkitSlug);
  const authMode = getToolkitAuthMode(toolkitSlug);
  return {
    // Public identifier is the clean toolkit slug (no composio__ prefix). Routing
    // still recognizes it via isComposioVirtualService/toolkitSlug.
    id: toolkitSlug,
    name: toolkitSlug,
    label: toolkitLabel,
    category: slugifyCategory(categoryLabel),
    categoryLabel,
    auth_type: authMode,
    authType: authMode,
    authMode,
    authFields: getToolkitAuthFields(toolkitSlug),
    description: toolkit.description || `${toolkitLabel} connected through Composio and proxied by MyApi.`,
    icon: getToolkitLogo(toolkitSlug),
    apiEndpoint: `${COMPOSIO_BASE_URL}/tools/execute/proxy`,
    documentationUrl: COMPOSIO_DOCS_URL,
    methods: [
      {
        methodName: 'default_request',
        httpMethod: 'GET',
        endpoint: null,
        description: `Proxy any ${toolkitLabel} API request via Composio. Pass params.endpoint or params.path and optional params.method/body/query.`,
        parameters: [],
        validation: {
          paramsRequired: false,
          paramsType: 'object',
        },
      },
    ],
    source: 'composio',
    provider: 'composio',
    byComposio: true,
    toolkitSlug,
    connectedAccountIds: toolkit.connectedAccountIds || [],
    connectedAccounts: toolkit.connectedAccounts || [],
    status: 'connected',
  };
}

function buildAvailableVirtualService(toolkitSlug, config) {
  const label = config?.label || toTitleCase(toolkitSlug);
  const categoryLabel = getToolkitCategory(toolkitSlug);
  const authMode = config?.authMode || 'oauth2';
  const connectVerb = authMode === 'api_key' ? 'Add your API key to connect' : 'Connect';
  return {
    // Public identifier is the clean toolkit slug (no composio__ prefix).
    id: toolkitSlug,
    name: toolkitSlug,
    label,
    category: slugifyCategory(categoryLabel),
    categoryLabel,
    auth_type: authMode,
    authType: authMode,
    authMode,
    authFields: config?.authFields || [],
    description: `${connectVerb} ${label} through Composio to enable it as a service in MyApi.`,
    icon: getToolkitLogo(toolkitSlug),
    apiEndpoint: null,
    documentationUrl: COMPOSIO_DOCS_URL,
    methods: [],
    source: 'composio',
    provider: 'composio',
    byComposio: true,
    toolkitSlug,
    connectToolkit: toolkitSlug,
    connectedAccountIds: [],
    connectedAccounts: [],
    status: 'available',
  };
}

function getComposioHeaders() {
  if (!COMPOSIO_API_KEY) {
    throw new Error('Composio API key is not configured');
  }
  return {
    'x-api-key': COMPOSIO_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

function unwrapArray(payload) {
  if (Array.isArray(payload)) return payload;
  const candidates = [
    payload?.items,
    payload?.data?.items,
    payload?.data,
    payload?.connected_accounts,
    payload?.results,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

async function composioRequest(pathname, { method = 'GET', body = null, query = null } = {}) {
  const url = new URL(`${COMPOSIO_BASE_URL}${pathname}`);
  if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, {
    method,
    headers: getComposioHeaders(),
    body: body == null ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `Composio request failed with status ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function normalizeConnectedAccount(account) {
  const toolkitSlug = String(
    account?.toolkit?.slug ||
    account?.toolkit_slug ||
    account?.app?.slug ||
    account?.appSlug ||
    ''
  ).toLowerCase();
  const toolkitName =
    account?.toolkit?.name ||
    account?.toolkit_name ||
    account?.app?.name ||
    account?.appName ||
    toTitleCase(toolkitSlug);

  return {
    id: account?.id || account?.nanoid || account?.connected_account_id || account?.connectedAccountId,
    userId: String(account?.user_id || account?.userId || ''),
    status: String(account?.status || 'ACTIVE').toUpperCase(),
    toolkitSlug,
    toolkitName,
    authConfigId: account?.auth_config_id || account?.authConfigId || null,
    raw: account,
  };
}

function groupConnectedAccounts(accounts) {
  const grouped = new Map();
  for (const account of accounts) {
    if (!account.toolkitSlug || !account.id) continue;
    const existing = grouped.get(account.toolkitSlug) || {
      toolkitSlug: account.toolkitSlug,
      label: account.toolkitName || toTitleCase(account.toolkitSlug),
      connectedAccountIds: [],
      connectedAccounts: [],
      description: `${account.toolkitName || toTitleCase(account.toolkitSlug)} connected through Composio and available in MyApi.`,
    };
    existing.connectedAccountIds.push(account.id);
    existing.connectedAccounts.push({
      id: account.id,
      status: account.status,
      authConfigId: account.authConfigId,
    });
    grouped.set(account.toolkitSlug, existing);
  }
  return [...grouped.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function getStoredState(userId) {
  if (!userId) return null;
  try {
    const { getServicePreference } = require('../database');
    const pref = getServicePreference(String(userId), COMPOSIO_PREF_KEY);
    return pref?.preferences || null;
  } catch {
    return null;
  }
}

function storeState(userId, state) {
  if (!userId) return state;
  try {
    const { updateServicePreference } = require('../database');
    updateServicePreference(String(userId), COMPOSIO_PREF_KEY, state);
  } catch (error) {
    console.warn('[Composio] Failed to persist state:', error.message);
  }
  return state;
}

const COMPOSIO_SYNC_TTL_MS = 60 * 1000;

async function syncComposioStateForUser(userId, { persist = true, force = false } = {}) {
  const fallback = getStoredState(userId);
  if (!userId) {
    return fallback || { connected: false, services: [], accounts: [], lastSyncedAt: null };
  }
  if (!isComposioConfigured()) {
    const state = { connected: false, services: [], accounts: [], lastSyncedAt: new Date().toISOString(), notConfigured: true };
    if (persist) storeState(userId, state);
    return state;
  }

  // TTL fast-path: every /services and /oauth/status request funnels through here,
  // so serve the cached state unless it is stale or a re-sync is forced (OAuth
  // callback and disconnect must always see live data).
  if (!force && fallback?.lastSyncedAt && !fallback.notConfigured) {
    const age = Date.now() - new Date(fallback.lastSyncedAt).getTime();
    if (Number.isFinite(age) && age >= 0 && age < COMPOSIO_SYNC_TTL_MS) {
      return fallback;
    }
  }

  try {
    const payload = await composioRequest('/connected_accounts', {
      query: {
        user_ids: [String(userId)],
        statuses: ['ACTIVE'],
        limit: 200,
      },
    });

    const accounts = unwrapArray(payload)
      .map(normalizeConnectedAccount)
      .filter((account) => account.toolkitSlug && account.id && !['DELETED', 'DISABLED'].includes(account.status));
    const services = groupConnectedAccounts(accounts);
    const state = {
      provider: 'composio',
      connected: services.length > 0,
      services,
      accounts,
      lastSyncedAt: new Date().toISOString(),
      lastSyncError: null,
    };
    if (persist) storeState(userId, state);
    return state;
  } catch (error) {
    const state = fallback || {
      provider: 'composio',
      connected: false,
      services: [],
      accounts: [],
      lastSyncedAt: null,
    };
    state.lastSyncError = error.message;
    return state;
  }
}

// The root 'composio' connector is intentionally NOT in the catalog — only the
// per-toolkit virtual services (composio__{slug}) are user/agent-facing. The root
// name still exists for OAuth routing and the proxy/execute guards.
async function getComposioServiceCatalog(userId) {
  const catalog = [];
  if (!userId || !isComposioConfigured()) return catalog;
  const state = await syncComposioStateForUser(userId);
  const connectedSlugs = new Set();
  for (const toolkit of state.services || []) {
    catalog.push(buildVirtualService(toolkit));
    connectedSlugs.add(toolkit.toolkitSlug);
  }
  for (const [slug, config] of Object.entries(COMPOSIO_TOOLKITS)) {
    if (connectedSlugs.has(slug)) continue;
    catalog.push(buildAvailableVirtualService(slug, config));
  }
  return catalog;
}

// Whether the user actually has this toolkit connected through Composio (cached
// state). Used to decide routing: a clean name routes to Composio only when it is
// truly connected there — otherwise we fall back to a native connector of the same
// name (e.g. github/facebook connected natively, not via Composio).
async function isComposioConnectedService(userId, serviceName) {
  if (!userId || !isComposioConfigured()) return false;
  if (!isComposioVirtualService(serviceName)) return false;
  const slug = stripComposioPrefix(serviceName);
  try {
    const state = await syncComposioStateForUser(String(userId));
    return (state.services || []).some((t) => t.toolkitSlug === slug);
  } catch (_) {
    return false;
  }
}

async function getComposioServiceByName(userId, serviceName) {
  const catalog = await getComposioServiceCatalog(userId);
  // Accept either the clean public name ("gmail") or the legacy composio__ form.
  const want = stripComposioPrefix(serviceName);
  return catalog.find((service) =>
    service.name === serviceName || service.id === serviceName ||
    stripComposioPrefix(service.name) === want || service.toolkitSlug === want
  ) || null;
}

async function getComposioStatusServices(userId) {
  const root = {
    name: COMPOSIO_ROOT_SERVICE,
    label: 'Composio',
    auth_type: 'oauth2',
    status: 'disconnected',
    enabled: isComposioConfigured(),
    source: 'composio',
    description: 'Connect Composio through MyApi.',
  };
  if (!userId || !isComposioConfigured()) {
    return [root];
  }

  const state = await syncComposioStateForUser(userId);
  root.status = state.connected ? 'connected' : 'disconnected';
  root.last_sync = state.lastSyncedAt || null;
  root.connected_count = (state.services || []).length;

  const virtualStatuses = (state.services || []).map((toolkit) => {
    const label = COMPOSIO_TOOLKITS[toolkit.toolkitSlug]?.label || toolkit.label || toTitleCase(toolkit.toolkitSlug);
    return {
      name: toolkit.toolkitSlug, // clean public name (no composio__ prefix)
      label,
      auth_type: 'oauth2',
      status: 'connected',
      enabled: true,
      source: 'composio',
      description: `${label} — connected through Composio`,
      toolkitSlug: toolkit.toolkitSlug,
      last_sync: state.lastSyncedAt || null,
    };
  });

  return [root, ...virtualStatuses];
}

async function createComposioConnectLink(userId, toolkitSlug = null, callbackUrl = COMPOSIO_CALLBACK_URL) {
  if (!isComposioConfigured()) {
    throw new Error('Composio is not configured');
  }
  const authConfigId = getAuthConfigIdForToolkit(toolkitSlug);
  if (!authConfigId) {
    throw new Error(toolkitSlug ? `Composio toolkit '${toolkitSlug}' is not configured` : 'No Composio auth config is configured');
  }
  const payload = await composioRequest('/connected_accounts/link', {
    method: 'POST',
    body: {
      auth_config_id: authConfigId,
      user_id: String(userId),
      callback_url: callbackUrl || COMPOSIO_CALLBACK_URL,
    },
  });

  const authUrl =
    payload?.redirect_url ||
    payload?.redirectUrl ||
    payload?.composio_link_redirect_url ||
    payload?.data?.redirect_url ||
    payload?.data?.redirectUrl ||
    payload?.data?.composio_link_redirect_url ||
    payload?.link ||
    payload?.url;

  if (!authUrl) {
    throw new Error('Composio did not return a connect URL');
  }

  return {
    authUrl,
    payload,
  };
}

// Connect an API-key (or no-auth) Composio toolkit by submitting the user's
// secret directly — no OAuth redirect. The connected account comes back ACTIVE
// immediately. `fields` is a map of authField name -> value (e.g.
// { generic_api_key: 'sk-...' } for OpenAI, { bearer_token: '...' } for Replicate).
async function createComposioApiKeyConnection(userId, toolkitSlug, fields = {}) {
  if (!isComposioConfigured()) {
    throw new Error('Composio is not configured');
  }
  const slug = stripComposioPrefix(toolkitSlug);
  const config = COMPOSIO_TOOLKITS[slug];
  if (!config) {
    throw new Error(`Composio toolkit '${slug}' is not configured`);
  }
  const authMode = config.authMode || 'oauth2';
  if (authMode !== 'api_key' && authMode !== 'none') {
    throw new Error(`Toolkit '${slug}' is connected via OAuth, not an API key`);
  }
  const authConfigId = config.authConfigId;
  if (!authConfigId) {
    throw new Error(`Composio toolkit '${slug}' has no auth config`);
  }

  // Validate + collect declared fields only (never forward stray input).
  const data = {};
  for (const field of (config.authFields || [])) {
    const raw = fields[field.name];
    const value = raw == null ? '' : String(raw).trim();
    if (field.required && !value) {
      throw new Error(`Missing required field: ${field.displayName || field.name}`);
    }
    if (value) data[field.name] = value;
  }

  const payload = await composioRequest('/connected_accounts', {
    method: 'POST',
    body: {
      auth_config: { id: authConfigId },
      connection: { user_id: String(userId), data },
    },
  });

  const status = String(
    payload?.status || payload?.connectionData?.val?.status || ''
  ).toUpperCase();

  // Refresh cached state so the new connection is visible immediately.
  await syncComposioStateForUser(String(userId), { persist: true, force: true });

  return {
    ok: status === 'ACTIVE' || Boolean(payload?.id),
    status: status || 'UNKNOWN',
    connectedAccountId: payload?.id || payload?.nanoid || null,
    toolkitSlug: slug,
  };
}

async function disconnectComposioForUser(userId) {
  const state = await syncComposioStateForUser(userId, { persist: false, force: true });
  const accountIds = [...new Set((state.accounts || []).map((account) => account.id).filter(Boolean))];
  for (const accountId of accountIds) {
    try {
      await composioRequest(`/connected_accounts/${accountId}`, { method: 'DELETE' });
    } catch (error) {
      console.warn(`[Composio] Failed to delete connected account ${accountId}:`, error.message);
    }
  }
  const cleared = {
    provider: 'composio',
    connected: false,
    services: [],
    accounts: [],
    lastSyncedAt: new Date().toISOString(),
    lastSyncError: null,
  };
  storeState(userId, cleared);
  return cleared;
}

// Disconnect ONE Composio toolkit (e.g. googlecalendar) without touching the
// user's other connected toolkits. serviceName may be a clean slug
// ("googlecalendar") or the prefixed form ("composio__googlecalendar").
async function disconnectComposioToolkit(userId, serviceName) {
  const toolkitSlug = stripComposioPrefix(serviceName);
  if (!toolkitSlug) {
    return { ok: false, error: 'No toolkit specified' };
  }
  // Force a fresh view so we delete the right account ids and persist accurate
  // remaining state.
  const state = await syncComposioStateForUser(userId, { persist: false, force: true });
  const targetAccountIds = [...new Set(
    (state.accounts || [])
      .filter((account) => account.toolkitSlug === toolkitSlug)
      .map((account) => account.id)
      .filter(Boolean)
  )];

  if (targetAccountIds.length === 0) {
    // Nothing connected for this toolkit — persist current state and report.
    storeState(userId, state);
    return { ok: true, removed: 0, toolkitSlug, services: state.services || [] };
  }

  let failed = 0;
  for (const accountId of targetAccountIds) {
    try {
      await composioRequest(`/connected_accounts/${accountId}`, { method: 'DELETE' });
    } catch (error) {
      failed += 1;
      console.warn(`[Composio] Failed to delete connected account ${accountId} (${toolkitSlug}):`, error.message);
    }
  }

  // Re-sync from Composio (source of truth) so the persisted state reflects only
  // the toolkits that are still connected — the others stay intact.
  const refreshed = await syncComposioStateForUser(userId, { persist: true, force: true });
  return {
    ok: failed === 0,
    removed: targetAccountIds.length - failed,
    failed,
    toolkitSlug,
    connected: refreshed.connected,
    services: refreshed.services || [],
  };
}

async function proxyComposioService({ userId, serviceName, apiPath, httpMethod = 'GET', reqBody = null, queryParams = null, reqHeaders = null }) {
  if (!isComposioVirtualService(serviceName)) {
    return {
      ok: false,
      statusCode: 400,
      error: { message: 'Composio proxy is only available for virtual Composio services' },
      data: null,
      meta: { provider: 'composio' },
    };
  }

  const toolkitSlug = getToolkitSlugFromServiceName(serviceName);
  const state = await syncComposioStateForUser(userId);
  const toolkit = (state.services || []).find((item) => item.toolkitSlug === toolkitSlug);
  if (!toolkit || !(toolkit.connectedAccountIds || []).length) {
    return {
      ok: false,
      statusCode: 403,
      error: { message: `Service '${serviceName}' is not connected through Composio.` },
      data: null,
      meta: { provider: 'composio', toolkitSlug },
    };
  }

  if (!apiPath || typeof apiPath !== 'string') {
    return {
      ok: false,
      statusCode: 400,
      error: { message: 'path or endpoint is required for Composio proxy execution' },
      data: null,
      meta: { provider: 'composio', toolkitSlug },
    };
  }

  const parameters = [];
  if (queryParams && typeof queryParams === 'object') {
    for (const [name, value] of Object.entries(queryParams)) {
      if (value == null) continue;
      parameters.push({ name, value, type: 'query' });
    }
  }
  // Forward caller-supplied request headers (e.g. LinkedIn-Version,
  // X-Restli-Protocol-Version) to the upstream provider. Composio's proxy
  // distinguishes header vs query params by the `type` field — without this,
  // /rest LinkedIn endpoints fail with VERSION_MISSING.
  if (reqHeaders && typeof reqHeaders === 'object') {
    for (const [name, value] of Object.entries(reqHeaders)) {
      if (value == null) continue;
      parameters.push({ name, value: String(value), type: 'header' });
    }
  }

  try {
    const payload = await composioRequest('/tools/execute/proxy', {
      method: 'POST',
      body: {
        connected_account_id: toolkit.connectedAccountIds[0],
        endpoint: apiPath,
        method: String(httpMethod || 'GET').toUpperCase(),
        body: reqBody || undefined,
        parameters: parameters.length > 0 ? parameters : undefined,
      },
    });

    const statusCode = Number(payload?.status_code || payload?.statusCode || 200);
    return {
      ok: statusCode < 400,
      statusCode,
      data: payload?.data !== undefined ? payload.data : payload,
      error: statusCode >= 400 ? { message: payload?.error?.message || payload?.message || 'Composio proxy request failed', details: payload } : null,
      meta: {
        provider: 'composio',
        toolkitSlug,
        connectedAccountId: toolkit.connectedAccountIds[0],
      },
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: Number(error.statusCode || 500),
      data: error.payload || null,
      error: { message: error.message, details: error.payload || null },
      meta: {
        provider: 'composio',
        toolkitSlug,
        connectedAccountId: toolkit.connectedAccountIds[0],
      },
    };
  }
}

module.exports = {
  COMPOSIO_ROOT_SERVICE,
  getComposioCategories,
  isComposioConfigured,
  isComposioRootService,
  isComposioVirtualService,
  isComposioManagedService,
  isComposioToolkitSlug,
  isComposioConnectedService,
  stripComposioPrefix,
  getComposioStatusServices,
  getComposioServiceCatalog,
  getComposioServiceByName,
  createComposioConnectLink,
  createComposioApiKeyConnection,
  getToolkitAuthMode,
  getToolkitAuthFields,
  disconnectComposioForUser,
  disconnectComposioToolkit,
  proxyComposioService,
  syncComposioStateForUser,
};
