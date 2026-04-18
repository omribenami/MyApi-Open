const logger = require('../utils/logger');
const express = require('express');
const https = require('https');
const bcrypt = require('bcrypt');
const SERVICE_METHODS = require('./service-methods');
const {
  getServicePreference,
  getServicePreferences,
  updateServicePreference,
  deleteServicePreference,
  createAuditLog,
  getOAuthToken,
  isTokenExpired,
  refreshOAuthToken,
  getAccessTokens,
} = require('../database');

// Token URLs for auto-refresh (keyed by service id)
const TOKEN_REFRESH_URLS = {
  google:     { tokenUrl: 'https://oauth2.googleapis.com/token',          clientId: () => process.env.GOOGLE_CLIENT_ID,     clientSecret: () => process.env.GOOGLE_CLIENT_SECRET },
  github:     { tokenUrl: 'https://github.com/login/oauth/access_token',  clientId: () => process.env.GITHUB_CLIENT_ID,     clientSecret: () => process.env.GITHUB_CLIENT_SECRET },
  slack:      { tokenUrl: 'https://slack.com/api/oauth.v2.access',        clientId: () => process.env.SLACK_CLIENT_ID,      clientSecret: () => process.env.SLACK_CLIENT_SECRET },
  discord:    { tokenUrl: 'https://discord.com/api/oauth2/token',         clientId: () => process.env.DISCORD_CLIENT_ID,    clientSecret: () => process.env.DISCORD_CLIENT_SECRET },
  notion:     { tokenUrl: 'https://api.notion.com/v1/oauth/token',        clientId: () => process.env.NOTION_CLIENT_ID,     clientSecret: () => process.env.NOTION_CLIENT_SECRET },
  linkedin:   { tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',clientId: () => process.env.LINKEDIN_CLIENT_ID,   clientSecret: () => process.env.LINKEDIN_CLIENT_SECRET },
  dropbox:    { tokenUrl: 'https://api.dropboxapi.com/oauth2/token',      clientId: () => process.env.DROPBOX_CLIENT_ID,    clientSecret: () => process.env.DROPBOX_CLIENT_SECRET },
  zoom:       { tokenUrl: 'https://zoom.us/oauth/token',                  clientId: () => process.env.ZOOM_CLIENT_ID,       clientSecret: () => process.env.ZOOM_CLIENT_SECRET },
  hubspot:    { tokenUrl: 'https://api.hubapi.com/oauth/v1/token',        clientId: () => process.env.HUBSPOT_CLIENT_ID,    clientSecret: () => process.env.HUBSPOT_CLIENT_SECRET },
  confluence: { tokenUrl: 'https://auth.atlassian.com/oauth/token',       clientId: () => process.env.CONFLUENCE_CLIENT_ID, clientSecret: () => process.env.CONFLUENCE_CLIENT_SECRET },
  asana:      { tokenUrl: 'https://app.asana.com/-/oauth_token',          clientId: () => process.env.ASANA_CLIENT_ID,      clientSecret: () => process.env.ASANA_CLIENT_SECRET },
  linear:     { tokenUrl: 'https://api.linear.app/oauth/token',           clientId: () => process.env.LINEAR_CLIENT_ID,     clientSecret: () => process.env.LINEAR_CLIENT_SECRET },
  box:        { tokenUrl: 'https://api.box.com/oauth2/token',             clientId: () => process.env.BOX_CLIENT_ID,        clientSecret: () => process.env.BOX_CLIENT_SECRET },
  airtable:   { tokenUrl: 'https://airtable.com/oauth2/v1/token',        clientId: () => process.env.AIRTABLE_CLIENT_ID,   clientSecret: () => process.env.AIRTABLE_CLIENT_SECRET },
  figma:      { tokenUrl: 'https://www.figma.com/api/oauth/token',        clientId: () => process.env.FIGMA_CLIENT_ID,      clientSecret: () => process.env.FIGMA_CLIENT_SECRET },
  canva:      { tokenUrl: 'https://www.canva.com/api/oauth/token',        clientId: () => process.env.CANVA_CLIENT_ID,      clientSecret: () => process.env.CANVA_CLIENT_SECRET },
  intercom:   { tokenUrl: 'https://api.intercom.io/auth/eagle/token',     clientId: () => process.env.INTERCOM_CLIENT_ID,   clientSecret: () => process.env.INTERCOM_CLIENT_SECRET },
  clickup:    { tokenUrl: 'https://app.clickup.com/api/v2/oauth/token',   clientId: () => process.env.CLICKUP_CLIENT_ID,    clientSecret: () => process.env.CLICKUP_CLIENT_SECRET },
  monday:     { tokenUrl: 'https://auth.monday.com/oauth2/token',         clientId: () => process.env.MONDAY_CLIENT_ID,     clientSecret: () => process.env.MONDAY_CLIENT_SECRET },
  // TikTok uses client_key instead of client_id in token requests
  tiktok:     { tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',  clientId: () => process.env.TIKTOK_CLIENT_KEY,    clientSecret: () => process.env.TIKTOK_CLIENT_SECRET, clientIdParam: 'client_key' },
};

const SERVICE_CATALOG = [
  { id: 'github', name: 'GitHub', description: 'Version control and collaboration', icon: 'github', category: 'Developer Tools', auth_type: 'oauth2', api_endpoint: 'https://api.github.com' },
  { id: 'google', name: 'Google', description: 'Email, Calendar, Drive, Sheets, Docs', icon: 'google', category: 'Productivity', auth_type: 'oauth2', api_endpoint: 'https://www.googleapis.com' },
  { id: 'slack', name: 'Slack', description: 'Team messaging and collaboration', icon: 'slack', category: 'Communication', auth_type: 'oauth2', api_endpoint: 'https://slack.com/api' },
  { id: 'discord', name: 'Discord', description: 'Voice, video, and text communication', icon: 'discord', category: 'Communication', auth_type: 'oauth2', api_endpoint: 'https://discord.com/api/v10' },
  { id: 'tiktok', name: 'TikTok', description: 'Short-form video platform', icon: 'tiktok', category: 'Social Media', auth_type: 'oauth2', api_endpoint: 'https://open.tiktokapis.com' },
  { id: 'linkedin', name: 'LinkedIn', description: 'Professional networking', icon: 'linkedin', category: 'Social Media', auth_type: 'oauth2', api_endpoint: 'https://api.linkedin.com/v2' },
  { id: 'facebook', name: 'Facebook', description: 'Social media platform', icon: 'facebook', category: 'Social Media', auth_type: 'oauth2', api_endpoint: 'https://graph.facebook.com' },
  { id: 'instagram', name: 'Instagram', description: 'Photo and video sharing', icon: 'instagram', category: 'Social Media', auth_type: 'oauth2', api_endpoint: 'https://graph.instagram.com' },
  { id: 'twitter', name: 'Twitter/X', description: 'Social media platform', icon: 'twitter', category: 'Social Media', auth_type: 'oauth2', api_endpoint: 'https://api.twitter.com/2' },
  { id: 'notion', name: 'Notion', description: 'Workspace and documentation', icon: 'notion', category: 'Productivity', auth_type: 'oauth2', api_endpoint: 'https://api.notion.com/v1' },
  { id: 'microsoft365', name: 'Microsoft 365', description: 'Outlook, Calendar, OneDrive, and Microsoft Graph', icon: 'microsoft365', category: 'Productivity', auth_type: 'oauth2', api_endpoint: 'https://graph.microsoft.com' },
  { id: 'dropbox', name: 'Dropbox', description: 'Cloud file storage and sync', icon: 'dropbox', category: 'Productivity', auth_type: 'oauth2', api_endpoint: 'https://api.dropboxapi.com/2' },
  { id: 'trello', name: 'Trello', description: 'Boards, cards, and task workflows', icon: 'trello', category: 'Productivity', auth_type: 'oauth2', api_endpoint: 'https://api.trello.com/1' },
  { id: 'zoom', name: 'Zoom', description: 'Meetings, users, and recording metadata', icon: 'zoom', category: 'Communication', auth_type: 'oauth2', api_endpoint: 'https://api.zoom.us/v2' },
  { id: 'hubspot', name: 'HubSpot', description: 'CRM contacts, companies, and deals', icon: 'hubspot', category: 'Business', auth_type: 'oauth2', api_endpoint: 'https://api.hubapi.com' },
  { id: 'salesforce', name: 'Salesforce', description: 'Enterprise CRM records and workflows', icon: 'salesforce', category: 'Business', auth_type: 'oauth2', api_endpoint: 'https://login.salesforce.com' },
  { id: 'jira', name: 'Jira', description: 'Issue tracking and project management', icon: 'jira', category: 'Developer Tools', auth_type: 'oauth2', api_endpoint: 'https://api.atlassian.com' },
  { id: 'confluence', name: 'Confluence', description: 'Team wiki, docs, and knowledge base', icon: 'confluence', category: 'Developer Tools', auth_type: 'oauth2', api_endpoint: 'https://api.atlassian.com' },
  { id: 'asana', name: 'Asana', description: 'Project and task management', icon: 'asana', category: 'Productivity', auth_type: 'oauth2', api_endpoint: 'https://app.asana.com/api/1.0' },
  { id: 'linear', name: 'Linear', description: 'Issue tracking for software teams', icon: 'linear', category: 'Developer Tools', auth_type: 'oauth2', api_endpoint: 'https://api.linear.app' },
  { id: 'box', name: 'Box', description: 'Cloud content management and file sharing', icon: 'box', category: 'Productivity', auth_type: 'oauth2', api_endpoint: 'https://api.box.com/2.0' },
  { id: 'airtable', name: 'Airtable', description: 'Flexible database and spreadsheet hybrid', icon: 'airtable', category: 'Productivity', auth_type: 'oauth2', api_endpoint: 'https://api.airtable.com/v0' },
  { id: 'figma', name: 'Figma', description: 'Collaborative design and prototyping', icon: 'figma', category: 'Developer Tools', auth_type: 'oauth2', api_endpoint: 'https://api.figma.com/v1' },
  { id: 'canva', name: 'Canva', description: 'Visual design and content creation', icon: 'canva', category: 'Productivity', auth_type: 'oauth2', api_endpoint: 'https://api.canva.com/rest/v1' },
  { id: 'zendesk', name: 'Zendesk', description: 'Customer support and ticketing', icon: 'zendesk', category: 'Business', auth_type: 'oauth2', api_endpoint: 'https://developer.zendesk.com' },
  { id: 'intercom', name: 'Intercom', description: 'Customer messaging and engagement', icon: 'intercom', category: 'Business', auth_type: 'oauth2', api_endpoint: 'https://api.intercom.io' },
  { id: 'clickup', name: 'ClickUp', description: 'All-in-one project management', icon: 'clickup', category: 'Productivity', auth_type: 'oauth2', api_endpoint: 'https://api.clickup.com/api/v2' },
  { id: 'monday', name: 'Monday.com', description: 'Work management and team workflows', icon: 'monday', category: 'Productivity', auth_type: 'oauth2', api_endpoint: 'https://api.monday.com/v2' },
  { id: 'fal', name: 'fal', description: 'fal AI inference APIs (HTTP MVP, MCP phase-2)', icon: 'fal', category: 'Developer Tools', auth_type: 'api_key', api_endpoint: 'https://fal.run' },
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

// Service methods registry — documents what operations available for each service
const SERVICE_METHODS = {
  google: [
    {
      name: 'gmail.messages.list',
      description: 'List Gmail messages from inbox',
      method: 'GET',
      endpoint: '/services/google/gmail/messages',
      scope: 'services:read or services:google:read or master',
      parameters: {
        maxResults: { type: 'number', description: 'Max messages to return (default: 10)', optional: true },
        pageToken: { type: 'string', description: 'Pagination token from previous response', optional: true }
      },
      returns: 'messages array with id, subject, from, to, date, snippet, threadId'
    },
    {
      name: 'gmail.messages.get',
      description: 'Get full Gmail message by ID',
      method: 'GET',
      endpoint: '/services/google/gmail/messages/:messageId',
      scope: 'services:read or services:google:read or master',
      parameters: {
        messageId: { type: 'string', description: 'Message ID from messages.list', optional: false }
      },
      returns: 'full message object with body, headers, attachments, labels'
    }
  ],
  github: [],
  slack: [],
  discord: [],
  notion: [],
  microsoft365: [],
};
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

  // GET /api/v1/services - List all services with their connection status
  router.get('/', requireAuth, requireServiceScope(null, 'read'), async (req, res) => {
    try {
      const userId = resolveUserId(req);

      const servicesWithStatus = await Promise.all(
        SERVICE_CATALOG.map(async (svc) => {
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

      res.json({
        success: true,
        data: servicesWithStatus,
        total: servicesWithStatus.length,
        connected: servicesWithStatus.filter((s) => s.status === 'connected').length,
      });
    } catch (error) {
      logger.error('[Services] Error fetching services:', error);
      res.status(500).json({ error: 'Failed to fetch services' });
    }
  });

  // GET /api/v1/services/categories
  router.get('/categories', requireAuth, (req, res) => {
    try {
      const map = new Map();
      for (const svc of SERVICE_CATALOG) {
        const key = svc.category.toLowerCase().replace(/\s+/g, '-');
        if (!map.has(key)) {
          map.set(key, { name: key, label: svc.category });
        }
      }
      res.json({ success: true, data: Array.from(map.values()) });
    } catch (error) {
      logger.error('[Services] Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // GET /api/v1/services/:serviceName - Service detail.
  // Reserved names (available/preferences/categories) must short-circuit to the
  // next matching route BEFORE the broad scope middleware runs — otherwise a
  // narrow-scoped token (e.g. services:gmail:read) would hit 403 here when it
  // actually wanted /preferences, which has its own scope handling downstream.
  router.get('/:serviceName', requireAuth, (req, res, next) => {
    const blocked = new Set(['available', 'preferences', 'categories']);
    if (blocked.has(String(req.params.serviceName || '').toLowerCase())) {
      return next('route');
    }
    return requireServiceScope(null, 'read')(req, res, next);
  }, async (req, res, next) => {
    try {
      const userId = resolveUserId(req);
      const serviceName = String(req.params.serviceName || '').toLowerCase();
      const service = SERVICE_CATALOG.find((s) => s.id === serviceName || s.name.toLowerCase() === serviceName);

      if (!service) {
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
  router.get('/:serviceId/methods', requireAuth, requireServiceScope(':serviceId', 'read'), async (req, res) => {
    try {
      const { serviceId } = req.params;
      const methods = SERVICE_METHODS[serviceId] || [];
      
      res.json({
        success: true,
        serviceId,
        data: methods,
        count: methods.length,
        note: methods.length === 0 ? 'No methods documented yet for this service' : `Use these methods under /api/v1/services/`
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
        services: SERVICE_CATALOG.map(({ id, name, description }) => ({ id, name, description })),
        total: SERVICE_CATALOG.length,
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

  // GET /api/v1/services/google/gmail/messages
  // Query params: maxResults (default 5, max 20), q (Gmail search query), pageToken
  router.get('/google/gmail/messages', requireAuth, requireServiceScope('google', 'read'), async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const accessToken = await getGoogleAccessToken(userId);

      if (!accessToken) {
        return res.status(403).json({
          error: 'Google not connected',
          message: 'Connect your Google account first via /api/v1/oauth/connect/google',
        });
      }

      const maxResults = Math.min(Number(req.query.maxResults) || 5, 20);
      const q = req.query.q || '';
      const pageToken = req.query.pageToken || '';

      let listPath = `/gmail/v1/users/me/messages?maxResults=${maxResults}`;
      if (q) listPath += `&q=${encodeURIComponent(q)}`;
      if (pageToken) listPath += `&pageToken=${encodeURIComponent(pageToken)}`;

      const listResp = await gmailGet(accessToken, listPath);
      if (listResp.status !== 200) {
        return res.status(listResp.status).json({ error: 'Gmail API error', details: listResp.body });
      }

      const { messages = [], nextPageToken, resultSizeEstimate } = listResp.body;

      // Fetch metadata for each message in parallel (headers only, no body)
      const details = await Promise.all(
        messages.map(async (msg) => {
          const r = await gmailGet(
            accessToken,
            `/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`
          );
          if (r.status !== 200) return { id: msg.id, threadId: msg.threadId };

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
      const accessToken = await getGoogleAccessToken(userId);

      if (!accessToken) {
        return res.status(403).json({ error: 'Google not connected' });
      }

      const r = await gmailGet(
        accessToken,
        `/gmail/v1/users/me/messages/${req.params.messageId}?format=full`
      );

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
        },
      });
    } catch (error) {
      logger.error('[Gmail] Error fetching message:', error);
      res.status(500).json({ error: 'Failed to fetch Gmail message', message: error.message });
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

  // GET /api/v1/services/google/drive/files?q=&pageSize=
  router.get('/google/drive/files', requireAuth, requireServiceScope('google', 'read'), async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const accessToken = await getGoogleAccessToken(userId);
      if (!accessToken) return res.status(401).json({ error: 'Google account not connected', hint: 'Connect via /api/v1/oauth/connect/google' });

      const pageSize = Math.min(Number(req.query.pageSize) || 20, 100);
      const q = req.query.q || '';
      const pageToken = req.query.pageToken || '';
      let path = `/drive/v3/files?pageSize=${pageSize}&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime,parents,webViewLink,webContentLink)`;
      if (q) path += `&q=${encodeURIComponent(q)}`;
      if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;

      const r = await driveRequest(accessToken, 'GET', path);
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
      if (!accessToken) return res.status(401).json({ error: 'Google account not connected', hint: 'Connect via /api/v1/oauth/connect/google' });

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
      const accessToken = await getGoogleAccessToken(userId);
      if (!accessToken) return res.status(401).json({ error: 'Google account not connected' });
      const r = await driveRequest(accessToken, 'DELETE', `/drive/v3/files/${req.params.fileId}`);
      if (r.status !== 204 && r.status !== 200) return res.status(r.status).json({ error: 'Delete failed', details: r.body });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to delete Drive file', message: e.message });
    }
  });

  return router;
}

module.exports = createServicesRoutes;
