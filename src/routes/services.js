const logger = require('../utils/logger');
const express = require('express');
const https = require('https');
const bcrypt = require('bcrypt');
const SERVICE_METHODS = require('./service-methods');
const {
  getServicePreference,
  getServicePreferences,
  createServicePreference,
  updateServicePreference,
  deleteServicePreference,
  createAuditLog,
  getOAuthToken,
  isTokenExpired,
  refreshOAuthToken,
  getAccessTokens,
} = require('../database');
const {
  isComposioConfigured,
  getComposioServiceCatalog,
  getComposioServiceByName,
  getComposioCategories,
  isComposioToolkitSlug,
  isComposioVirtualService,
  isComposioConnectedService,
  proxyComposioService,
} = require('../services/composio-integration');

// Native catalog entries shadowed by a Composio toolkit (github, facebook, box,
// canva, dropbox, zoom, figma) are hidden — Composio owns the clean name. When
// Composio isn't configured the native connectors remain so nothing disappears.
//
// 'google' is hidden too: Google products are connected via Composio's per-product
// toolkits (gmail, googlecalendar, googledrive, googledocs, ...), not the native
// catch-all connector. The native 'google' SERVICE_CATALOG entry is kept (not
// deleted) so the Sign-in-with-Google LOGIN flow and the native Gmail proxy
// fallback still resolve a 'google' service — it's only removed from the
// connectable services list shown to users.
const NATIVE_HIDDEN_WHEN_COMPOSIO = new Set(['google']);
function visibleNativeCatalog() {
  if (!isComposioConfigured()) return SERVICE_CATALOG;
  return SERVICE_CATALOG.filter(
    (svc) => !isComposioToolkitSlug(svc.id) && !NATIVE_HIDDEN_WHEN_COMPOSIO.has(svc.id)
  );
}
const { getAfpDevices } = require('../database');
const { afpConnections } = require('../lib/afp-state');

// ── AFP as a discoverable service ─────────────────────────────────────────────
// AFP (remote PC/server file system + shell) is not an OAuth service, but agents
// must find it the same way they find everything else: GET /services →
// /services/afp → /services/afp/methods. Requires a master token to USE
// (enforced by the /afp routes), and a master token to see device details.
function isMasterReq(req) {
  if (req.session?.user) return true;
  const m = req.tokenMeta;
  return Boolean(m && (m.scope === 'full' || m.tokenType === 'master' || String(m.tokenId || '').startsWith('sess_')));
}

function getAfpServiceEntry(req) {
  if (!isMasterReq(req)) return null;
  const userId = String(req.session?.user?.id || req.user?.id || req.tokenMeta?.ownerId || 'owner');
  let devices = [];
  try { devices = getAfpDevices(userId) || []; } catch { return null; }
  if (devices.length === 0) return null;
  const deviceList = devices.map((d) => ({
    deviceId: d.id,
    name: d.device_name,
    hostname: d.hostname,
    platform: d.platform,
    status: afpConnections.has(d.id) ? 'online' : 'offline',
  }));
  const online = deviceList.filter((d) => d.status === 'online').length;
  return {
    id: 'afp',
    name: 'afp',
    label: 'AFP — Remote Devices',
    category: 'developer-tools',
    categoryLabel: 'Developer Tools',
    auth_type: 'device',
    description: `File system and shell access to ${devices.length} registered machine(s): ${deviceList.map((d) => `${d.name} (${d.platform}, ${d.status})`).join(', ')}. Run commands, read/write files — e.g. check Docker containers with POST /api/v1/afp/{deviceId}/exec {"cmd":"docker ps -a"}.`,
    status: online > 0 ? 'connected' : 'available',
    source: 'afp',
    devices: deviceList,
  };
}

function buildAfpMethods(afpEntry) {
  const note = 'All paths are MyApi routes under /api/v1 (NOT the services proxy). Master token or ASC required. Pick deviceId from the devices list.';
  return {
    success: true,
    serviceId: 'afp',
    provider: 'afp',
    status: afpEntry.status,
    devices: afpEntry.devices,
    data: [
      { name: 'devices.list', description: 'List registered machines with online status', method: 'GET', endpoint: '/api/v1/afp/devices', scope: 'master token / ASC', parameters: {}, returns: 'devices[] with id, name, hostname, platform, status' },
      { name: 'exec', description: 'Run a shell command on the machine (e.g. "docker ps -a", "df -h")', method: 'POST', endpoint: '/api/v1/afp/{deviceId}/exec', scope: 'master token / ASC', parameters: { cmd: { type: 'string', description: 'Shell command', optional: false }, cwd: { type: 'string', optional: true }, timeout: { type: 'number', description: 'ms, max 30000', optional: true } }, returns: '{ ok, stdout, stderr, exitCode }' },
      { name: 'fs.ls', description: 'List a directory', method: 'GET', endpoint: '/api/v1/afp/{deviceId}/ls?path={dir}', scope: 'master token / ASC', parameters: { path: { type: 'string', optional: false } }, returns: 'directory entries' },
      { name: 'fs.read', description: 'Read a file', method: 'GET', endpoint: '/api/v1/afp/{deviceId}/read?path={file}', scope: 'master token / ASC', parameters: { path: { type: 'string', optional: false } }, returns: 'file content' },
      { name: 'fs.write', description: 'Write a file', method: 'POST', endpoint: '/api/v1/afp/{deviceId}/write', scope: 'master token / ASC', parameters: { path: { type: 'string', optional: false }, content: { type: 'string', optional: false }, encoding: { type: 'string', description: 'utf8|base64', optional: true } }, returns: '{ ok }' },
      { name: 'fs.stat', description: 'File/directory metadata', method: 'GET', endpoint: '/api/v1/afp/{deviceId}/stat?path={path}', scope: 'master token / ASC', parameters: { path: { type: 'string', optional: false } }, returns: 'stat object' },
      { name: 'fs.mkdir', description: 'Create a directory', method: 'POST', endpoint: '/api/v1/afp/{deviceId}/mkdir', scope: 'master token / ASC', parameters: { path: { type: 'string', optional: false } }, returns: '{ ok }' },
      { name: 'fs.rm', description: 'Delete a file or directory', method: 'DELETE', endpoint: '/api/v1/afp/{deviceId}/rm', scope: 'master token / ASC', parameters: { path: { type: 'string', optional: false }, recursive: { type: 'boolean', optional: true } }, returns: '{ ok }' },
    ],
    count: 8,
    note,
    example: {
      description: `Check Docker containers on ${afpEntry.devices[0]?.name || 'a device'}`,
      request: { method: 'POST', url: `/api/v1/afp/${afpEntry.devices[0]?.deviceId || '{deviceId}'}/exec`, body: { cmd: 'docker ps -a --format "{{.Names}}: {{.Status}}"' } },
    },
  };
}

// Token URLs for auto-refresh (keyed by service id)
const TOKEN_REFRESH_URLS = {
  google:     { tokenUrl: 'https://oauth2.googleapis.com/token',          clientId: () => process.env.GOOGLE_CLIENT_ID,     clientSecret: () => process.env.GOOGLE_CLIENT_SECRET },
  github:     { tokenUrl: 'https://github.com/login/oauth/access_token',  clientId: () => process.env.GITHUB_CLIENT_ID,     clientSecret: () => process.env.GITHUB_CLIENT_SECRET },
  dropbox:    { tokenUrl: 'https://api.dropboxapi.com/oauth2/token',      clientId: () => process.env.DROPBOX_CLIENT_ID,    clientSecret: () => process.env.DROPBOX_CLIENT_SECRET },
  zoom:       { tokenUrl: 'https://zoom.us/oauth/token',                  clientId: () => process.env.ZOOM_CLIENT_ID,       clientSecret: () => process.env.ZOOM_CLIENT_SECRET },
  box:        { tokenUrl: 'https://api.box.com/oauth2/token',             clientId: () => process.env.BOX_CLIENT_ID,        clientSecret: () => process.env.BOX_CLIENT_SECRET },
  figma:      { tokenUrl: 'https://www.figma.com/api/oauth/token',        clientId: () => process.env.FIGMA_CLIENT_ID,      clientSecret: () => process.env.FIGMA_CLIENT_SECRET },
  canva:      { tokenUrl: 'https://www.canva.com/api/oauth/token',        clientId: () => process.env.CANVA_CLIENT_ID,      clientSecret: () => process.env.CANVA_CLIENT_SECRET },
  // TikTok uses client_key instead of client_id in token requests
  tiktok:     { tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',  clientId: () => process.env.TIKTOK_CLIENT_KEY,    clientSecret: () => process.env.TIKTOK_CLIENT_SECRET, clientIdParam: 'client_key' },
};

// Native services. Where a service is also offered as a Composio toolkit
// (composio-toolkits.json), the Composio version is preferred and the native
// entry is removed here to avoid duplicates — except github, google, and
// facebook, which keep their native entries alongside Composio.
const SERVICE_CATALOG = [
  { id: 'github', name: 'GitHub', description: 'Version control and collaboration', icon: 'github', category: 'Developer Tools', auth_type: 'oauth2', api_endpoint: 'https://api.github.com' },
  { id: 'google', name: 'Google', description: 'Email, Calendar, Drive, Sheets, Docs', icon: 'google', category: 'Productivity', auth_type: 'oauth2', api_endpoint: 'https://www.googleapis.com' },
  { id: 'tiktok', name: 'TikTok', description: 'Short-form video platform', icon: 'tiktok', category: 'Social Media', auth_type: 'oauth2', api_endpoint: 'https://open.tiktokapis.com' },
  { id: 'facebook', name: 'Facebook', description: 'Social media platform', icon: 'facebook', category: 'Social Media', auth_type: 'oauth2', api_endpoint: 'https://graph.facebook.com' },
  { id: 'twitter', name: 'Twitter/X', description: 'Social media platform', icon: 'twitter', category: 'Social Media', auth_type: 'oauth2', api_endpoint: 'https://api.twitter.com/2' },
  { id: 'microsoft365', name: 'Microsoft 365', description: 'Outlook, Calendar, OneDrive, and Microsoft Graph', icon: 'microsoft365', category: 'Productivity', auth_type: 'oauth2', api_endpoint: 'https://graph.microsoft.com' },
  { id: 'dropbox', name: 'Dropbox', description: 'Cloud file storage and sync', icon: 'dropbox', category: 'Productivity', auth_type: 'oauth2', api_endpoint: 'https://api.dropboxapi.com/2' },
  { id: 'zoom', name: 'Zoom', description: 'Meetings, users, and recording metadata', icon: 'zoom', category: 'Communication', auth_type: 'oauth2', api_endpoint: 'https://api.zoom.us/v2' },
  { id: 'box', name: 'Box', description: 'Cloud content management and file sharing', icon: 'box', category: 'Productivity', auth_type: 'oauth2', api_endpoint: 'https://api.box.com/2.0' },
  { id: 'figma', name: 'Figma', description: 'Collaborative design and prototyping', icon: 'figma', category: 'Developer Tools', auth_type: 'oauth2', api_endpoint: 'https://api.figma.com/v1' },
  { id: 'canva', name: 'Canva', description: 'Visual design and content creation', icon: 'canva', category: 'Productivity', auth_type: 'oauth2', api_endpoint: 'https://api.canva.com/rest/v1' },
  { id: 'fal', name: 'fal', description: 'fal AI inference APIs (HTTP MVP, MCP phase-2)', icon: 'fal', category: 'Developer Tools', auth_type: 'api_key', api_endpoint: 'https://fal.run' },
  {
    id: 'homeassistant', name: 'homeassistant', label: 'Home Assistant',
    description: 'Control your Home Assistant instance — read entity states, call services (lights, switches, climate, scenes), query history and render templates through the full HA REST API.',
    icon: 'https://cdn.simpleicons.org/homeassistant/18BCF2', category: 'Smart Home',
    auth_type: 'api_key', connect_method: 'instance', api_endpoint: null,
    authFields: require('../lib/homeassistant').AUTH_FIELDS,
    setup_hint: 'Enter your instance URL (Nabu Casa / DuckDNS / public address) and a Long-Lived Access Token from Profile → Security.',
  },
  // Native LinkedIn Pages connector (organization/company pages). MyApi's own
  // integration — distinct from Composio's `linkedin` toolkit, which is the
  // personal-profile connector.
  { id: 'linkedin_pages', name: 'LinkedIn Pages', description: 'Post and read on LinkedIn company Pages you administer (organization access)', icon: 'linkedin', category: 'Social Media', auth_type: 'oauth2', api_endpoint: 'https://api.linkedin.com' },
];

function createServicesRoutes() {
  const router = express.Router();

  // Auth middleware — honours tokenMeta already set by index.js authenticate(),
  // and falls back to parsing the Bearer token itself when the services router
  // runs before the global authenticate middleware.
  async function requireAuth(req, res, next) {
    if (req.session?.user || req.tokenMeta) return next();

    const authHeader = req.headers.authorization || '';
    const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!rawToken) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const tokens = getAccessTokens();
      for (const t of tokens) {
        if (t.revokedAt) continue;
        if (t.expiresAt && new Date(t.expiresAt) <= new Date()) continue;
        if (t.hash && await bcrypt.compare(rawToken, t.hash).catch(() => false)) {
          req.tokenMeta = t;
          req.user = req.user || { id: t.ownerId };
          return next();
        }
      }
    } catch (e) {
      logger.error('[services] requireAuth error:', e.message);
    }

    res.status(401).json({ error: 'Unauthorized' });
  }

  function resolveUserId(req) {
    return String(req.session?.user?.id || req.user?.id || req.tokenMeta?.ownerId || req.tokenMeta?.userId || 'owner');
  }

  // Returns true if the caller has sufficient scope to access a service endpoint.
  // Session users always pass (they are the account owner); master tokens always pass;
  // guest/scoped bearer tokens need services:* scope.
  function hasServiceScope(req, serviceName, operation = 'read') {
    // Session users own their data — always allow.
    if (req.session?.user) return true;
    const meta = req.tokenMeta;
    if (!meta) return false;
    if (meta.scope === 'full' || meta.tokenType === 'master') return true;

    let scopes = [];
    try {
      const parsed = JSON.parse(meta.scope);
      scopes = Array.isArray(parsed) ? parsed : [];
    } catch { return false; }

    return scopes.some(s =>
      s === `services:${operation}` ||
      s === 'services:write' ||                                    // write implies read
      (serviceName && s === `services:${serviceName}:${operation}`) ||
      (serviceName && s === `services:${serviceName}:*`) ||
      s === 'services:*'
    );
  }

  function requireServiceScope(serviceName, operation = 'read') {
    return (req, res, next) => {
      if (hasServiceScope(req, serviceName, operation)) return next();
      const needed = serviceName
        ? `services:${operation}' or 'services:${serviceName}:${operation}`
        : `services:${operation}`;
      return res.status(403).json({ error: `Requires '${needed}' scope` });
    };
  }

  // Per-param variant: resolves the service name from req.params at request time
  // so a scoped token can only touch the specific service it's scoped for.
  function requireServiceScopeParam(paramName, operation = 'read') {
    return (req, res, next) => {
      const serviceName = String(req.params[paramName] || '').toLowerCase();
      if (hasServiceScope(req, serviceName, operation)) return next();
      return res.status(403).json({
        error: `Requires 'services:${operation}' or 'services:${serviceName}:${operation}' scope`,
      });
    };
  }

  async function getConnectionMetadata(serviceId, userId) {
    if (serviceId === 'homeassistant') {
      const conn = require('../lib/homeassistant').getConnection(userId);
      return {
        connected: Boolean(conn),
        status: conn ? 'connected' : 'available',
        created_at: conn?.createdAt || null,
        expires_at: null,
        instance_url: conn?.baseUrl || null,
      };
    }
    if (serviceId === 'fal') {
      const prefs = getServicePreference(userId, 'fal');
      const perUserKey = String(prefs?.preferences?.fal_api_key || prefs?.preferences?.api_key || '').trim();
      const envKey = String(process.env.FAL_API_KEY || '').trim();
      const connected = Boolean(perUserKey || envKey);
      return {
        connected,
        status: connected ? 'connected' : 'available',
        created_at: prefs?.created_at || null,
        expires_at: null,
      };
    }

    try {
      const token = getOAuthToken(serviceId, userId);
      if (token && !token.revokedAt) {
        // Auto-refresh if expired and we know the token URL
        if (isTokenExpired(token) && token.refreshToken && TOKEN_REFRESH_URLS[serviceId]) {
          const { tokenUrl, clientId, clientSecret, clientIdParam } = TOKEN_REFRESH_URLS[serviceId];
          try {
            const refreshResult = await refreshOAuthToken(serviceId, userId, tokenUrl, clientId(), clientSecret(), clientIdParam ? { clientIdParam } : {});
            if (refreshResult?.ok) {
              return { connected: true, created_at: token.createdAt || null, expires_at: refreshResult.token?.expiresAt || null };
            }
          } catch {
            // refresh failed — still show as connected (token exists, just expired)
          }
        }
        return {
          connected: true,
          created_at: token.createdAt || null,
          expires_at: token.expiresAt || null,
        };
      }
    } catch {
      // keep resilient
    }

    return { connected: false, created_at: null, expires_at: null };
  }

  // Returns true if the token carries any per-service scope (services:{name}:...).
  // Such tokens may list/inspect the services they are scoped for, even without
  // the global services:read scope — output is filtered down to those services.
  function hasAnyPerServiceScope(req) {
    const meta = req.tokenMeta;
    if (!meta) return false;
    let scopes = [];
    try {
      const parsed = JSON.parse(meta.scope);
      scopes = Array.isArray(parsed) ? parsed : [];
    } catch { return false; }
    return scopes.some((s) => /^services:[^:]+:(read|write|\*)$/.test(s));
  }

  // GET /api/v1/services - List all services with their connection status
  router.get('/', requireAuth, (req, res, next) => {
    if (hasAnyPerServiceScope(req)) return next();
    return requireServiceScope(null, 'read')(req, res, next);
  }, async (req, res) => {
    try {
      const userId = resolveUserId(req);

      const servicesWithStatus = await Promise.all(
        visibleNativeCatalog().map(async (svc) => {
          const conn = await getConnectionMetadata(svc.id, userId);
          return {
            ...svc,
            status: conn.status || (conn.connected ? 'connected' : 'available'),
            connectedAt: conn.created_at,
            expiresAt: conn.expires_at,
            configMissing: conn.configMissing || [],
          };
        })
      );

      // Composio: one virtual service per toolkit (connected + available), each
      // carrying its real category (Developer Tools, Communication, ...). The
      // root 'composio' connector is intentionally not listed.
      if (isComposioConfigured()) {
        try {
          const composioCatalog = await getComposioServiceCatalog(userId);
          for (const svc of composioCatalog) {
            servicesWithStatus.push({
              ...svc,
              status: svc.status || 'available',
              connectedAt: null,
              expiresAt: null,
              configMissing: [],
            });
          }
        } catch (composioError) {
          logger.warn('[Services] Composio catalog unavailable:', composioError.message);
        }
      }

      // AFP devices (remote PC/server access) appear as a service so agents
      // discover them in the standard catalog.
      const afpEntry = getAfpServiceEntry(req);
      if (afpEntry) servicesWithStatus.push({ ...afpEntry, connectedAt: null, expiresAt: null, configMissing: [] });

      // Narrow per-service-scoped tokens (no global services:read) only see the
      // services they are actually scoped for.
      const visible = hasServiceScope(req, null, 'read')
        ? servicesWithStatus
        : servicesWithStatus.filter((s) => hasServiceScope(req, String(s.id || s.name || '').toLowerCase(), 'read'));

      res.json({
        success: true,
        data: visible,
        total: visible.length,
        connected: visible.filter((s) => s.status === 'connected').length,
      });
    } catch (error) {
      logger.error('[Services] Error fetching services:', error);
      res.status(500).json({ error: 'Failed to fetch services' });
    }
  });

  // GET /api/v1/services/categories
  // Category keys are slugified (lowercase, non-alphanumerics -> '-') and must
  // match the `category` field on each service so frontend filter tabs work.
  router.get('/categories', requireAuth, (req, res) => {
    try {
      const slugify = (label) => String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const map = new Map();
      for (const svc of SERVICE_CATALOG) {
        const key = slugify(svc.category);
        if (!map.has(key)) {
          map.set(key, { name: key, label: svc.category });
        }
      }
      if (isComposioConfigured()) {
        for (const category of getComposioCategories()) {
          if (!map.has(category.name)) map.set(category.name, category);
        }
      }
      res.json({ success: true, data: Array.from(map.values()) });
    } catch (error) {
      logger.error('[Services] Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // GET /api/v1/services/resource-capabilities — which services support resource
  // sub-scopes and what kinds (boards/channels/repos/...) each offers. Feeds the
  // dashboard token-creation picker. Registered before /:serviceName so the
  // catch-all doesn't shadow it.
  router.get('/resource-capabilities', requireAuth, (req, res) => {
    const { getResourceCapabilities } = require('../lib/service-resource-scopes');
    res.json({ success: true, data: getResourceCapabilities() });
  });

  // ── Home Assistant: instance connect (URL + long-lived token) ──────────────
  // POST validates the pair by probing GET {base}/api/ before storing anything.
  router.post('/homeassistant/connect', requireAuth, async (req, res) => {
    if (!isMasterReq(req)) {
      return res.status(403).json({ error: 'Only the account owner can connect Home Assistant' });
    }
    const ha = require('../lib/homeassistant');
    // Accept both flat body and the {fields:{...}} shape the connect modal sends.
    const body = req.body?.fields && typeof req.body.fields === 'object' ? req.body.fields : (req.body || {});
    const token = String(body.token || '').trim();

    let baseUrl;
    try {
      baseUrl = ha.normalizeBaseUrl(body.base_url);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    if (!token) {
      return res.status(400).json({ error: 'token is required — create a Long-Lived Access Token in Home Assistant under Profile → Security.' });
    }
    if (ha.isPrivateHostname(new URL(baseUrl).hostname) && !ha.allowPrivateHosts()) {
      return res.status(400).json({
        error: 'That URL points to a private/LAN address which this server cannot (or must not) reach. Use your public Home Assistant address (Nabu Casa, DuckDNS, or reverse proxy).',
      });
    }

    let probe = await ha.probeInstance(baseUrl, token);
    if (!probe.ok) {
      // Users often paste a deep link (e.g. .../profile/security, the page where
      // the token is created). If a sub-path URL fails, retry at the origin —
      // that's the real API root for everything except sub-path proxy installs.
      const origin = new URL(baseUrl).origin;
      if (origin !== baseUrl) {
        const originProbe = await ha.probeInstance(origin, token);
        if (originProbe.ok) {
          baseUrl = origin;
          probe = originProbe;
        }
      }
    }
    if (!probe.ok) {
      return res.status(400).json({ error: probe.error || 'Could not validate the Home Assistant connection' });
    }

    const userId = resolveUserId(req);
    createServicePreference(userId, 'homeassistant', { base_url: baseUrl, token });

    createAuditLog({
      requesterId: req.tokenMeta?.tokenId || `sess_${userId}`,
      action: 'service_connected',
      resource: '/services/homeassistant/connect',
      ip: req.ip,
      details: { service: 'homeassistant', instance: baseUrl },
    });

    res.json({
      success: true,
      data: {
        service: 'homeassistant',
        connected: true,
        instance_url: baseUrl,
        message: probe.message,
        next: 'Call it via POST /api/v1/services/homeassistant/proxy with {path, method, body} — e.g. {"path": "/states"} to list all entities.',
      },
    });
  });

  router.delete('/homeassistant/connect', requireAuth, (req, res) => {
    if (!isMasterReq(req)) {
      return res.status(403).json({ error: 'Only the account owner can disconnect Home Assistant' });
    }
    const userId = resolveUserId(req);
    deleteServicePreference(userId, 'homeassistant');
    createAuditLog({
      requesterId: req.tokenMeta?.tokenId || `sess_${userId}`,
      action: 'service_disconnected',
      resource: '/services/homeassistant/connect',
      ip: req.ip,
      details: { service: 'homeassistant' },
    });
    res.json({ success: true, data: { service: 'homeassistant', connected: false } });
  });

  // GET /api/v1/services/:serviceName - Service detail.
  // Reserved names (available/preferences/categories) must short-circuit to the
  // next matching route BEFORE the broad scope middleware runs — otherwise a
  // narrow-scoped token (e.g. services:gmail:read) would hit 403 here when it
  // actually wanted /preferences, which has its own scope handling downstream.
  router.get('/:serviceName', requireAuth, (req, res, next) => {
    const blocked = new Set(['available', 'preferences', 'categories']);
    const serviceName = String(req.params.serviceName || '').toLowerCase();
    if (blocked.has(serviceName)) {
      return next('route');
    }
    // A standalone per-service scope grants detail access to that one service.
    if (hasServiceScope(req, serviceName, 'read')) return next();
    return requireServiceScope(null, 'read')(req, res, next);
  }, async (req, res, next) => {
    try {
      const userId = resolveUserId(req);
      const serviceName = String(req.params.serviceName || '').toLowerCase();
      // Composio wins: if the clean name maps to a toolkit, resolve it via Composio
      // even when a (now-hidden) native connector of the same name still exists.
      const service = (isComposioConfigured() && isComposioToolkitSlug(serviceName))
        ? null
        : SERVICE_CATALOG.find((s) => s.id === serviceName || s.name.toLowerCase() === serviceName);

      if (!service) {
        if (serviceName === 'afp') {
          const afpEntry = getAfpServiceEntry(req);
          if (afpEntry) return res.json({ success: true, data: afpEntry });
          return res.status(404).json({
            error: 'No AFP devices registered',
            hint: 'Install the AFP connector on a machine from /dashboard/connectors, then it appears here.',
          });
        }
        if (isComposioConfigured()) {
          const composioService = await getComposioServiceByName(userId, serviceName);
          if (composioService) {
            return res.json({ success: true, data: composioService });
          }
        }
        return res.status(404).json({ error: 'Service not found' });
      }

      const conn = await getConnectionMetadata(service.id, userId);
      return res.json({
        success: true,
        data: {
          ...service,
          status: conn.status || (conn.connected ? 'connected' : 'available'),
          connectedAt: conn.created_at,
          expiresAt: conn.expires_at,
          configMissing: conn.configMissing || [],
        },
      });
    } catch (error) {
      logger.error('[Services] Error fetching service detail:', error);
      return res.status(500).json({ error: 'Failed to fetch service detail' });
    }
  });

  // GET /api/v1/services/available - List available services


  // GET /api/v1/services/:serviceId/methods - List available methods for a service
  // Use the per-param variant so a narrow `services:{id}:read` token is resolved
  // against the actual serviceId from the URL — passing the literal ':serviceId'
  // string would never match a per-service scope and wrongly 403 scoped tokens.
  // Every service (native or Composio) also supports the generic proxy — surface it
  // alongside the documented methods so agents always have a working call path.
  function buildProxyMethodDoc(serviceId, label) {
    return {
      name: 'proxy.request',
      description: `Proxy any ${label || serviceId} API request through MyApi using the stored credentials. Works for every connected service, including Composio-backed ones.`,
      method: 'POST',
      endpoint: `/services/${serviceId}/proxy`,
      scope: `services:read (GET) / services:write (POST/PUT/PATCH/DELETE), or standalone per-service scope services:${serviceId}:read|write`,
      parameters: {
        path: { type: 'string', description: 'Provider-native REST path (e.g. "/gmail/v1/users/me/messages" or "/user/repos")', optional: false },
        method: { type: 'string', description: 'HTTP method for the provider call (default: GET)', optional: true },
        body: { type: 'object', description: 'JSON body for write requests', optional: true },
        query: { type: 'object', description: 'Query string parameters as key/value pairs', optional: true },
        headers: { type: 'object', description: 'Provider request headers as key/value pairs (e.g. {"LinkedIn-Version":"202606","X-Restli-Protocol-Version":"2.0.0"}). Authorization/Host/Cookie are managed by MyApi and cannot be overridden.', optional: true },
      },
      returns: 'provider response wrapped as { ok, statusCode, data, meta }',
    };
  }

  // Service-specific prerequisites surfaced on /:serviceId/methods so agents
  // learn non-obvious authorization gates without re-discovering them by trial.
  const SERVICE_ACCESS_NOTES = {
    // Composio `linkedin` toolkit = personal/member profile only.
    linkedin: [
      'This is the personal LinkedIn PROFILE connector (member identity + personal posting). Scopes: openid profile email w_member_social. Example: GET /v2/userinfo, POST /v2/ugcPosts with author=urn:li:person:<id>.',
      'For company/organization Pages (posting & analytics on Pages you administer) use the separate "linkedin_pages" connector — POST /api/v1/services/linkedin_pages/proxy — not this one.',
      'All /rest calls require headers {"LinkedIn-Version":"<YYYYMM>","X-Restli-Protocol-Version":"2.0.0"} — pass them via the proxy "headers" field.',
    ],
    // Native MyApi connector = organization/company Pages.
    linkedin_pages: [
      'This is the LinkedIn PAGES connector — MyApi\'s native integration for company/organization Pages you administer. Distinct from the personal-profile "linkedin" connector (Composio).',
      'Scopes: r_organization_admin, rw_organization_admin, r_organization_social, w_organization_social (plus openid profile email). Set LINKEDIN_PAGES_SCOPE to override.',
      'Organization access is gated by LinkedIn\'s "Community Management API" PRODUCT, not just scope strings — errors decorated "partnerApi*" mean the product/verification is missing, not a wrong path. In the LinkedIn Developer Portal request the "Community Management API" product and VERIFY the app against the Page you administer, then disconnect + reconnect LinkedIn Pages in MyApi to re-consent.',
      'All /rest calls require headers {"LinkedIn-Version":"<YYYYMM>","X-Restli-Protocol-Version":"2.0.0"} — pass them via the proxy "headers" field.',
      'Probe order after reconnect: GET /v2/userinfo (200 sanity) → GET /rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED (lists orgs you admin as urn:li:organization:<id>) → GET /rest/organizations?q=vanityName&vanityName=<vanity> → POST /rest/posts with author=urn:li:organization:<id> (needs w_organization_social).',
    ],
  };

  router.get('/:serviceId/methods', requireAuth, requireServiceScopeParam('serviceId', 'read'), async (req, res) => {
    try {
      const { serviceId } = req.params;

      if (serviceId === 'afp') {
        const afpEntry = getAfpServiceEntry(req);
        if (!afpEntry) {
          return res.status(404).json({ error: 'No AFP devices registered', hint: 'Install the AFP connector from /dashboard/connectors.' });
        }
        return res.json(buildAfpMethods(afpEntry));
      }

      let methods = [...(SERVICE_METHODS[serviceId] || [])];
      let composioService = null;

      if (isComposioConfigured() && isComposioVirtualService(serviceId)) {
        composioService = await getComposioServiceByName(resolveUserId(req), serviceId);
        if (!composioService) {
          return res.status(404).json({ error: 'Service not found' });
        }
      }

      methods.push(buildProxyMethodDoc(serviceId, composioService?.label));

      res.json({
        success: true,
        serviceId,
        ...(composioService ? {
          provider: 'composio',
          toolkitSlug: composioService.toolkitSlug,
          status: composioService.status,
        } : {}),
        data: methods,
        count: methods.length,
        ...(SERVICE_ACCESS_NOTES[serviceId] ? { accessNotes: SERVICE_ACCESS_NOTES[serviceId] } : {}),
        note: composioService
          ? `${composioService.label} is connected through Composio. Call it exactly like a native service: POST /api/v1/services/${serviceId}/proxy with {path, method, body, query, headers} — MyApi relays the request via Composio with the stored credentials. Pass provider request headers via "headers" (e.g. LinkedIn needs {"LinkedIn-Version":"202606","X-Restli-Protocol-Version":"2.0.0"} for /rest endpoints); Authorization/Host/Cookie are managed by MyApi and cannot be overridden.`
          : 'Use these methods under /api/v1/services/. Every connected service also accepts the generic proxy.request call.',
      });
    } catch (error) {
      logger.error(`[Services] Error fetching methods for ${req.params.serviceId}:`, error);
      res.status(500).json({ error: 'Failed to fetch service methods' });
    }
  });
  router.get('/available', requireAuth, (req, res) => {
    try {
      res.json({
        success: true,
        services: visibleNativeCatalog().map(({ id, name, description }) => ({ id, name, description })),
        total: visibleNativeCatalog().length,
      });
    } catch (error) {
      logger.error('[Services] Error fetching available services:', error);
      res.status(500).json({ error: 'Failed to fetch available services' });
    }
  });

  router.get('/preferences', requireAuth, (req, res) => {
    try {
      const userId = req.session?.user?.id || req.user?.id || req.tokenMeta?.userId || 'owner';
      const preferences = getServicePreferences(userId);

      // Filter down to the services this token is actually scoped for.
      // Master tokens, session users, and broad 'services:*'/'services:read' all pass
      // every row via hasServiceScope(); narrow `services:{id}:read` tokens see only
      // their one service; tokens with no services scope at all see an empty array.
      // Prevents a narrow-scoped token from enumerating every connected OAuth
      // provider (and any API keys stored in preferences JSON).
      const filtered = Array.isArray(preferences)
        ? preferences.filter((p) => hasServiceScope(req, String(p.service_name || p.serviceName || '').toLowerCase(), 'read'))
        : preferences;

      res.json({ success: true, data: filtered });
    } catch (error) {
      logger.error('[ServicePreferences] Error fetching preferences:', error);
      res.status(500).json({ error: 'Failed to fetch service preferences' });
    }
  });

  router.get('/preferences/:serviceName', requireAuth, requireServiceScopeParam('serviceName', 'read'), (req, res) => {
    try {
      const userId = req.session?.user?.id || req.user?.id || req.tokenMeta?.userId || 'owner';
      const { serviceName } = req.params;

      const preference = getServicePreference(userId, serviceName);

      if (!preference) {
        return res.status(404).json({ error: 'Service preferences not found' });
      }

      res.json({ success: true, data: preference });
    } catch (error) {
      logger.error('[ServicePreferences] Error fetching preference:', error);
      res.status(500).json({ error: 'Failed to fetch service preference' });
    }
  });

  router.post('/preferences/:serviceName', requireAuth, requireServiceScopeParam('serviceName', 'write'), (req, res) => {
    try {
      const userId = req.session?.user?.id || req.user?.id || req.tokenMeta?.ownerId || 'owner';
      const { serviceName } = req.params;
      const { preferences } = req.body;

      if (!preferences || typeof preferences !== 'object') {
        return res.status(400).json({ error: 'preferences must be a JSON object' });
      }

      const result = updateServicePreference(userId, serviceName, preferences);

      createAuditLog({
        requesterId: req.tokenMeta?.tokenId || 'system',
        action: 'update_service_preferences',
        resource: `/services/preferences/${serviceName}`,
        scope: req.tokenMeta?.scope || 'full',
        ip: req.ip,
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error('[ServicePreferences] Error updating preference:', error);
      res.status(500).json({ error: 'Failed to update service preference' });
    }
  });

  router.put('/preferences/:serviceName', requireAuth, requireServiceScopeParam('serviceName', 'write'), (req, res) => {
    try {
      const userId = req.user?.id || req.tokenMeta?.ownerId || 'owner';
      const { serviceName } = req.params;
      const { preferences } = req.body;

      if (!preferences || typeof preferences !== 'object') {
        return res.status(400).json({ error: 'preferences must be a JSON object' });
      }

      const result = updateServicePreference(userId, serviceName, preferences);

      createAuditLog({
        requesterId: req.tokenMeta?.tokenId || 'system',
        action: 'update_service_preferences',
        resource: `/services/preferences/${serviceName}`,
        scope: req.tokenMeta?.scope || 'full',
        ip: req.ip,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('[ServicePreferences] Error updating preference:', error);
      res.status(500).json({ error: 'Failed to update service preference' });
    }
  });

  router.delete('/preferences/:serviceName', requireAuth, requireServiceScopeParam('serviceName', 'write'), (req, res) => {
    try {
      const userId = req.session?.user?.id || req.user?.id || req.tokenMeta?.userId || 'owner';
      const { serviceName } = req.params;

      const deleted = deleteServicePreference(userId, serviceName);

      if (!deleted) {
        return res.status(404).json({ error: 'Service preferences not found' });
      }

      createAuditLog({
        requesterId: req.tokenMeta?.tokenId || 'system',
        action: 'delete_service_preferences',
        resource: `/services/preferences/${serviceName}`,
        scope: req.tokenMeta?.scope || 'full',
        ip: req.ip,
      });

      res.json({ success: true, message: 'Service preferences deleted' });
    } catch (error) {
      logger.error('[ServicePreferences] Error deleting preference:', error);
      res.status(500).json({ error: 'Failed to delete service preference' });
    }
  });

  // ── Google Gmail endpoints ───────────────────────────────────────────────

  // Helper: get a valid Google access token, auto-refreshing if needed
  async function getGoogleAccessToken(userId) {
    let token = getOAuthToken('google', userId);
    if (!token) return null;

    if (isTokenExpired(token) && token.refreshToken) {
      const result = await refreshOAuthToken(
        'google', userId,
        'https://oauth2.googleapis.com/token',
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      if (result?.ok) token = result.token;
    }

    return token?.accessToken || null;
  }

  // Gmail GET transport that works regardless of HOW Gmail was connected:
  // prefers the native Google OAuth token, but falls back to the Composio "gmail"
  // toolkit (same provider-native paths, same response shape) when Gmail was
  // connected through Composio instead of native Google. Returns { status, body }
  // like gmailGet, or null when Gmail is not connected by either path.
  async function gmailGetForUser(userId, path) {
    const accessToken = await getGoogleAccessToken(userId);
    if (accessToken) return gmailGet(accessToken, path);
    if (isComposioConfigured() && await isComposioConnectedService(userId, 'gmail')) {
      const r = await proxyComposioService({ userId, serviceName: 'gmail', apiPath: path, httpMethod: 'GET' });
      return { status: r.statusCode || (r.ok ? 200 : 502), body: r.data };
    }
    return null;
  }

  // Helper: make a GET request to the Gmail API
  function gmailGet(accessToken, path) {
    return new Promise((resolve, reject) => {
      const url = new URL('https://gmail.googleapis.com' + path);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  // Helper: POST/DELETE to Gmail API
  function gmailRequest(accessToken, method, path, body) {
    return new Promise((resolve, reject) => {
      const url = new URL('https://gmail.googleapis.com' + path);
      const payload = body ? JSON.stringify(body) : null;
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  // GET /api/v1/services/google/gmail/messages
  // Query params: maxResults (default 5, max 20), q (Gmail search query), pageToken
  router.get('/google/gmail/messages', requireAuth, requireServiceScope('google', 'read'), async (req, res) => {
    try {
      const userId = resolveUserId(req);

      const maxResults = Math.min(Number(req.query.maxResults) || 5, 20);
      const q = req.query.q || '';
      const pageToken = req.query.pageToken || '';

      let listPath = `/gmail/v1/users/me/messages?maxResults=${maxResults}`;
      if (q) listPath += `&q=${encodeURIComponent(q)}`;
      if (pageToken) listPath += `&pageToken=${encodeURIComponent(pageToken)}`;

      const listResp = await gmailGetForUser(userId, listPath);
      if (!listResp) {
        return res.status(403).json({
          error: 'Gmail not connected',
          message: 'Connect Gmail first — either via Composio (POST /api/v1/services/gmail connect) or native Google (/api/v1/oauth/connect/google).',
        });
      }
      if (listResp.status !== 200) {
        return res.status(listResp.status).json({ error: 'Gmail API error', details: listResp.body });
      }

      const { messages = [], nextPageToken, resultSizeEstimate } = listResp.body;

      // Fetch metadata for each message in parallel (headers only, no body)
      const details = await Promise.all(
        messages.map(async (msg) => {
          const r = await gmailGetForUser(
            userId,
            `/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`
          );
          if (!r || r.status !== 200) return { id: msg.id, threadId: msg.threadId };

          const headers = {};
          for (const h of (r.body.payload?.headers || [])) {
            headers[h.name.toLowerCase()] = h.value;
          }

          return {
            id: msg.id,
            threadId: msg.threadId,
            subject: headers.subject || '(no subject)',
            from: headers.from || '',
            to: headers.to || '',
            date: headers.date || '',
            snippet: r.body.snippet || '',
            labelIds: r.body.labelIds || [],
            isUnread: (r.body.labelIds || []).includes('UNREAD'),
          };
        })
      );

      res.json({
        success: true,
        messages: details,
        nextPageToken: nextPageToken || null,
        resultSizeEstimate: resultSizeEstimate || details.length,
      });
    } catch (error) {
      logger.error('[Gmail] Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch Gmail messages', message: error.message });
    }
  });

  // GET /api/v1/services/google/gmail/messages/:messageId
  // Returns the full email (plain text body extracted)
  router.get('/google/gmail/messages/:messageId', requireAuth, requireServiceScope('google', 'read'), async (req, res) => {
    try {
      const userId = resolveUserId(req);

      const r = await gmailGetForUser(
        userId,
        `/gmail/v1/users/me/messages/${req.params.messageId}?format=full`
      );

      if (!r) {
        return res.status(403).json({
          error: 'Gmail not connected',
          message: 'Connect Gmail first — via Composio or native Google (/api/v1/oauth/connect/google).',
        });
      }
      if (r.status !== 200) {
        return res.status(r.status).json({ error: 'Gmail API error', details: r.body });
      }

      const msg = r.body;
      const headers = {};
      for (const h of (msg.payload?.headers || [])) {
        headers[h.name.toLowerCase()] = h.value;
      }

      // Recursively extract text/plain or text/html body parts
      function extractBody(part) {
        if (!part) return '';
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf8');
        }
        if (part.parts) {
          for (const p of part.parts) {
            const text = extractBody(p);
            if (text) return text;
          }
        }
        // Fall back to html if no plain text found
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        return '';
      }

      // Recursively collect attachment metadata. Never inline data — agents must
      // fetch each attachment via the dedicated endpoint to avoid blowing past
      // the MCP stdio response size limit (which truncates large JSON to "...").
      function collectAttachments(part, out = []) {
        if (!part) return out;
        const fname = part.filename;
        const attId = part.body?.attachmentId;
        const inlineData = part.body?.data;
        // Gmail returns attachment metadata in two shapes:
        //   (1) body.attachmentId (typical for >~5KB attachments — fetch via /attachments/:id)
        //   (2) body.data (small inline attachments — base64url payload sits right here)
        // Treat any part with a filename as an attachment, regardless. Also catch
        // unnamed binary parts that still carry an attachmentId (e.g. some forwarded
        // mail). Skip the text/plain + text/html body parts.
        const isBodyText = (part.mimeType === 'text/plain' || part.mimeType === 'text/html')
                           && !fname;
        if (!isBodyText && (fname || attId || (inlineData && part.mimeType && !part.mimeType.startsWith('text/')))) {
          let inline = false;
          for (const h of (part.headers || [])) {
            const name = (h.name || '').toLowerCase();
            if (name === 'content-disposition' && /inline/i.test(h.value || '')) inline = true;
            if (name === 'content-id') inline = true;
          }
          const entry = {
            attachmentId: attId || null,
            filename: fname || null,
            mimeType: part.mimeType || 'application/octet-stream',
            size: part.body?.size || (inlineData ? Buffer.byteLength(inlineData, 'base64') : 0),
            partId: part.partId || null,
            inline,
          };
          if (inlineData && !attId) {
            // Re-encode base64url -> base64 so common decoders work without surprises.
            entry.dataBase64 = String(inlineData).replace(/-/g, '+').replace(/_/g, '/');
            entry.note = 'Inline attachment — data is included here. No second fetch needed.';
          }
          out.push(entry);
        }
        if (part.parts) {
          for (const p of part.parts) collectAttachments(p, out);
        }
        return out;
      }

      const attachments = collectAttachments(msg.payload);

      // Debug shape — never includes attachment data, just mime types and
      // presence flags. Lets agents (and us) confirm what the Gmail payload
      // looked like when attachments[] comes back empty unexpectedly.
      function shapeOf(part, depth = 0) {
        if (!part || depth > 6) return null;
        return {
          mime: part.mimeType || null,
          filename: part.filename || null,
          partId: part.partId || null,
          hasAttachmentId: !!part.body?.attachmentId,
          hasInlineData: !!part.body?.data,
          size: part.body?.size || 0,
          parts: (part.parts || []).map((p) => shapeOf(p, depth + 1)).filter(Boolean),
        };
      }

      res.json({
        success: true,
        message: {
          id: msg.id,
          threadId: msg.threadId,
          subject: headers.subject || '(no subject)',
          from: headers.from || '',
          to: headers.to || '',
          date: headers.date || '',
          snippet: msg.snippet || '',
          body: extractBody(msg.payload),
          labelIds: msg.labelIds || [],
          isUnread: (msg.labelIds || []).includes('UNREAD'),
          attachments,
          attachmentHint: attachments.length
            ? `Fetch each attachment (when attachmentId is set) via GET /api/v1/services/google/gmail/messages/${msg.id}/attachments/{attachmentId}. Inline attachments already contain dataBase64.`
            : null,
          payloadShape: shapeOf(msg.payload),
        },
      });
    } catch (error) {
      logger.error('[Gmail] Error fetching message:', error);
      res.status(500).json({ error: 'Failed to fetch Gmail message', message: error.message });
    }
  });

  // GET /api/v1/services/google/gmail/messages/:messageId/attachments/:attachmentId
  // Returns full attachment payload (base64) — never truncated.
  // Optional query: ?filename=...&mimeType=...  (the message endpoint includes these
  // in attachments[]; pass them back so the response is self-describing).
  router.get(
    '/google/gmail/messages/:messageId/attachments/:attachmentId',
    requireAuth,
    requireServiceScope('google', 'read'),
    async (req, res) => {
      try {
        const userId = resolveUserId(req);
        const accessToken = await getGoogleAccessToken(userId);
        if (!accessToken) return res.status(403).json({ error: 'Google not connected' });

        const { messageId, attachmentId } = req.params;
        const r = await gmailGet(
          accessToken,
          `/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`
        );

        if (r.status !== 200) {
          return res.status(r.status).json({ error: 'Gmail API error', details: r.body });
        }

        // Gmail returns data in base64url. Re-encode to standard base64 so the
        // common `Buffer.from(data, 'base64')` / browser atob() decode path works
        // without surprises.
        const rawData = r.body?.data || '';
        const dataBase64 = rawData.replace(/-/g, '+').replace(/_/g, '/');
        const buf = Buffer.from(dataBase64, 'base64');

        // If the client asks for raw bytes, stream them back directly. Useful
        // when the caller already has the metadata from the message endpoint
        // and just wants the file (e.g. to forward to WhatsApp).
        if ((req.query.format || '').toLowerCase() === 'binary') {
          res.setHeader('Content-Type', req.query.mimeType || 'application/octet-stream');
          if (req.query.filename) {
            res.setHeader(
              'Content-Disposition',
              `attachment; filename="${String(req.query.filename).replace(/"/g, '')}"`
            );
          }
          return res.send(buf);
        }

        res.json({
          success: true,
          attachmentId,
          messageId,
          filename: req.query.filename || null,
          mimeType: req.query.mimeType || null,
          size: r.body?.size || buf.length,
          dataBase64,
          encoding: 'base64',
          note: 'Decode with Buffer.from(dataBase64, "base64") or atob() to get the original file bytes.',
        });
      } catch (error) {
        logger.error('[Gmail] Error fetching attachment:', error);
        res.status(500).json({ error: 'Failed to fetch Gmail attachment', message: error.message });
      }
    }
  );

  // POST /api/v1/services/google/gmail/send
  // Body: { to, subject, body, cc?, bcc? }
  router.post('/google/gmail/send', requireAuth, requireServiceScope('google', 'write'), async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const accessToken = await getGoogleAccessToken(userId);
      if (!accessToken) return res.status(403).json({ error: 'Google not connected' });

      const { to, subject, body: emailBody, cc, bcc } = req.body;
      if (!to || !subject || !emailBody) {
        return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
      }

      const lines = [
        `To: ${to}`,
        ...(cc ? [`Cc: ${cc}`] : []),
        ...(bcc ? [`Bcc: ${bcc}`] : []),
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        emailBody,
      ];
      const raw = Buffer.from(lines.join('\r\n')).toString('base64url');

      const r = await gmailRequest(accessToken, 'POST', '/gmail/v1/users/me/messages/send', { raw });
      if (r.status !== 200) {
        return res.status(r.status).json({ error: 'Gmail send failed', details: r.body });
      }

      res.json({ success: true, messageId: r.body.id, threadId: r.body.threadId });
    } catch (error) {
      logger.error('[Gmail] Error sending message:', error);
      res.status(500).json({ error: 'Failed to send Gmail message', message: error.message });
    }
  });

  // DELETE /api/v1/services/google/gmail/messages/:messageId
  // Moves message to Trash (not permanent delete)
  router.delete('/google/gmail/messages/:messageId', requireAuth, requireServiceScope('google', 'write'), async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const accessToken = await getGoogleAccessToken(userId);
      if (!accessToken) return res.status(403).json({ error: 'Google not connected' });

      const r = await gmailRequest(accessToken, 'POST', `/gmail/v1/users/me/messages/${req.params.messageId}/trash`, null);
      if (r.status !== 200) {
        return res.status(r.status).json({ error: 'Gmail trash failed', details: r.body });
      }

      res.json({ success: true, messageId: r.body.id, trashed: true });
    } catch (error) {
      logger.error('[Gmail] Error trashing message:', error);
      res.status(500).json({ error: 'Failed to trash Gmail message', message: error.message });
    }
  });

  // ── Google Drive ─────────────────────────────────────────────────────────────

  function driveRequest(accessToken, method, path, body, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL('https://www.googleapis.com' + path);
      const payload = body ? JSON.stringify(body) : null;
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...extraHeaders,
        },
      };
      const req = https.request(options, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          try { resolve({ status: res.statusCode, body: JSON.parse(raw.toString()) }); }
          catch { resolve({ status: res.statusCode, body: raw }); }
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  // Unified Drive/Calendar transport: prefers the native Google OAuth token; if Google
  // was connected through Composio instead, falls back to the matching Composio toolkit.
  // Composio's googledrive/googlecalendar proxies are based at .../drive/v3 and
  // .../calendar/v3, so the version prefix is stripped from the path for them (verified
  // live). Returns { status, body } like driveRequest, or null when neither is connected.
  const GOOGLE_COMPOSIO = {
    drive:    { toolkit: 'googledrive',    toComposioPath: (p) => p.replace(/^\/drive\/v3/, '') },
    calendar: { toolkit: 'googlecalendar', toComposioPath: (p) => p.replace(/^\/calendar\/v3/, '') },
  };
  async function googleApiForUser(userId, kind, method, path, body = null, extraHeaders = {}) {
    const accessToken = await getGoogleAccessToken(userId);
    if (accessToken) return driveRequest(accessToken, method, path, body, extraHeaders);
    const cfg = GOOGLE_COMPOSIO[kind];
    if (cfg && isComposioConfigured() && await isComposioConnectedService(userId, cfg.toolkit)) {
      const r = await proxyComposioService({ userId, serviceName: cfg.toolkit, apiPath: cfg.toComposioPath(path), httpMethod: method, reqBody: body });
      return { status: r.statusCode || (r.ok ? 200 : 502), body: r.data };
    }
    return null;
  }

  const googleNotConnected = (res, what) => res.status(403).json({
    error: `Google ${what} not connected`,
    message: `Connect ${what} first — via Composio or native Google (/api/v1/oauth/connect/google).`,
  });

  // GET /api/v1/services/google/drive/files?q=&pageSize=
  router.get('/google/drive/files', requireAuth, requireServiceScope('google', 'read'), async (req, res) => {
    try {
      const userId = resolveUserId(req);

      const pageSize = Math.min(Number(req.query.pageSize) || 20, 100);
      const q = req.query.q || '';
      const pageToken = req.query.pageToken || '';
      let path = `/drive/v3/files?pageSize=${pageSize}&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime,parents,webViewLink,webContentLink)`;
      if (q) path += `&q=${encodeURIComponent(q)}`;
      if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;

      const r = await googleApiForUser(userId, 'drive', 'GET', path);
      if (!r) return googleNotConnected(res, 'Drive');
      if (r.status !== 200) return res.status(r.status).json({ error: 'Drive API error', details: r.body });
      res.json({ success: true, files: r.body.files, nextPageToken: r.body.nextPageToken || null });
    } catch (e) {
      res.status(500).json({ error: 'Failed to list Drive files', message: e.message });
    }
  });

  // POST /api/v1/services/google/drive/upload  body: { name, content, mimeType?, folderId? }
  router.post('/google/drive/upload', requireAuth, requireServiceScope('google', 'write'), async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const accessToken = await getGoogleAccessToken(userId);
      // Upload is a resumable multipart call that the Composio drive proxy can't relay,
      // so this one operation still needs a native Google connection (read/delete work
      // via Composio). List + open files instead if Drive was connected through Composio.
      if (!accessToken) return res.status(403).json({
        error: 'Native Google required for upload',
        message: 'Uploading to Drive requires a native Google connection (/api/v1/oauth/connect/google). Listing and deleting files work via Composio.',
      });

      const { name, content, mimeType = 'text/plain', encoding = 'utf8', folderId } = req.body;
      if (!name || content === undefined) return res.status(400).json({ error: 'name and content are required' });

      const fileBuffer = encoding === 'base64' ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf8');
      const metadata = { name, mimeType, ...(folderId ? { parents: [folderId] } : {}) };
      const metaJson = JSON.stringify(metadata);

      // Multipart upload
      const boundary = '-------MyApiUpload';
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
        fileBuffer,
        Buffer.from(`\r\n--${boundary}--`),
      ]);

      const r = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'www.googleapis.com',
          path: '/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink',
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
            'Content-Length': body.length,
          },
        };
        const req2 = https.request(options, (res2) => {
          const chunks = [];
          res2.on('data', c => chunks.push(c));
          res2.on('end', () => {
            try { resolve({ status: res2.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
            catch (e) { resolve({ status: res2.statusCode, body: {} }); }
          });
        });
        req2.on('error', reject);
        req2.write(body);
        req2.end();
      });

      if (r.status !== 200) return res.status(r.status).json({ error: 'Upload failed', details: r.body });
      res.json({ success: true, file: r.body });
    } catch (e) {
      res.status(500).json({ error: 'Failed to upload to Drive', message: e.message });
    }
  });

  // DELETE /api/v1/services/google/drive/files/:fileId
  router.delete('/google/drive/files/:fileId', requireAuth, requireServiceScope('google', 'write'), async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const r = await googleApiForUser(userId, 'drive', 'DELETE', `/drive/v3/files/${req.params.fileId}`);
      if (!r) return googleNotConnected(res, 'Drive');
      if (r.status !== 204 && r.status !== 200) return res.status(r.status).json({ error: 'Delete failed', details: r.body });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to delete Drive file', message: e.message });
    }
  });

  // GET /api/v1/services/google/calendar/events?timeMin=&timeMax=&q=&maxResults=&calendarId=
  // Upcoming events by default. Works via native Google OR the Composio googlecalendar toolkit.
  router.get('/google/calendar/events', requireAuth, requireServiceScope('google', 'read'), async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const calendarId = encodeURIComponent(req.query.calendarId || 'primary');
      const maxResults = Math.min(Number(req.query.maxResults) || 10, 50);
      const timeMin = req.query.timeMin || new Date().toISOString();
      let path = `/calendar/v3/calendars/${calendarId}/events?maxResults=${maxResults}&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}`;
      if (req.query.timeMax) path += `&timeMax=${encodeURIComponent(req.query.timeMax)}`;
      if (req.query.q) path += `&q=${encodeURIComponent(req.query.q)}`;

      const r = await googleApiForUser(userId, 'calendar', 'GET', path);
      if (!r) return googleNotConnected(res, 'Calendar');
      if (r.status !== 200) return res.status(r.status).json({ error: 'Calendar API error', details: r.body });

      const events = (r.body.items || []).map((e) => ({
        id: e.id,
        summary: e.summary || '(no title)',
        description: e.description || '',
        location: e.location || '',
        start: e.start?.dateTime || e.start?.date || null,
        end: e.end?.dateTime || e.end?.date || null,
        allDay: !e.start?.dateTime,
        status: e.status,
        attendees: (e.attendees || []).map((a) => a.email),
        htmlLink: e.htmlLink,
        organizer: e.organizer?.email || null,
      }));
      res.json({ success: true, events, nextPageToken: r.body.nextPageToken || null });
    } catch (e) {
      res.status(500).json({ error: 'Failed to list calendar events', message: e.message });
    }
  });

  // POST /api/v1/services/google/calendar/events
  // Body: { summary, start, end, description?, location?, attendees?[], calendarId?, timeZone? }
  // start/end accept an ISO datetime (timed event) or YYYY-MM-DD (all-day).
  router.post('/google/calendar/events', requireAuth, requireServiceScope('google', 'write'), async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const { summary, start, end, description, location, attendees, calendarId = 'primary', timeZone } = req.body || {};
      if (!summary || !start || !end) {
        return res.status(400).json({ error: 'summary, start and end are required' });
      }
      const toPoint = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v))
        ? { date: v }
        : { dateTime: new Date(v).toISOString(), ...(timeZone ? { timeZone } : {}) });
      const body = {
        summary,
        ...(description ? { description } : {}),
        ...(location ? { location } : {}),
        start: toPoint(start),
        end: toPoint(end),
        ...(Array.isArray(attendees) && attendees.length ? { attendees: attendees.map((email) => ({ email })) } : {}),
      };
      const path = `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

      const r = await googleApiForUser(userId, 'calendar', 'POST', path, body);
      if (!r) return googleNotConnected(res, 'Calendar');
      if (r.status !== 200 && r.status !== 201) return res.status(r.status).json({ error: 'Failed to create event', details: r.body });
      res.json({ success: true, event: { id: r.body.id, summary: r.body.summary, htmlLink: r.body.htmlLink, start: r.body.start, end: r.body.end } });
    } catch (e) {
      res.status(500).json({ error: 'Failed to create calendar event', message: e.message });
    }
  });

  return router;
}

module.exports = createServicesRoutes;
