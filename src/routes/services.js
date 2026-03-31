const express = require('express');
const {
  getServicePreference,
  getServicePreferences,
  updateServicePreference,
  deleteServicePreference,
  createAuditLog,
  getOAuthToken,
  isTokenExpired,
  refreshOAuthToken,
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
  { id: 'fal', name: 'fal', description: 'fal AI inference APIs (HTTP MVP, MCP phase-2)', icon: 'fal', category: 'Developer Tools', auth_type: 'api_key', api_endpoint: 'https://fal.run' },
];

function createServicesRoutes() {
  const router = express.Router();

  // Auth middleware for write operations
  function requireAuth(req, res, next) {
    if (req.session?.user || req.tokenMeta) {
      return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
  }

  function resolveUserId(req) {
    return String(req.session?.user?.id || req.user?.id || req.tokenMeta?.ownerId || req.tokenMeta?.userId || 'owner');
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
          const { tokenUrl, clientId, clientSecret } = TOKEN_REFRESH_URLS[serviceId];
          try {
            const refreshResult = await refreshOAuthToken(serviceId, userId, tokenUrl, clientId(), clientSecret());
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
  router.get('/', async (req, res) => {
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
      console.error('[Services] Error fetching services:', error);
      res.status(500).json({ error: 'Failed to fetch services' });
    }
  });

  // GET /api/v1/services/categories
  router.get('/categories', (req, res) => {
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
      console.error('[Services] Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // GET /api/v1/services/:serviceName - Service detail
  router.get('/:serviceName', async (req, res, next) => {
    const blocked = new Set(['available', 'preferences', 'categories']);
    if (blocked.has(String(req.params.serviceName || '').toLowerCase())) {
      return next();
    }

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
      console.error('[Services] Error fetching service detail:', error);
      return res.status(500).json({ error: 'Failed to fetch service detail' });
    }
  });

  // GET /api/v1/services/available - List available services
  router.get('/available', (req, res) => {
    try {
      res.json({
        success: true,
        services: SERVICE_CATALOG.map(({ id, name, description }) => ({ id, name, description })),
        total: SERVICE_CATALOG.length,
      });
    } catch (error) {
      console.error('[Services] Error fetching available services:', error);
      res.status(500).json({ error: 'Failed to fetch available services' });
    }
  });

  router.get('/preferences', (req, res) => {
    try {
      const userId = req.session?.user?.id || req.user?.id || req.tokenMeta?.userId || 'owner';
      const preferences = getServicePreferences(userId);

      res.json({ success: true, data: preferences });
    } catch (error) {
      console.error('[ServicePreferences] Error fetching preferences:', error);
      res.status(500).json({ error: 'Failed to fetch service preferences' });
    }
  });

  router.get('/preferences/:serviceName', (req, res) => {
    try {
      const userId = req.session?.user?.id || req.user?.id || req.tokenMeta?.userId || 'owner';
      const { serviceName } = req.params;

      const preference = getServicePreference(userId, serviceName);

      if (!preference) {
        return res.status(404).json({ error: 'Service preferences not found' });
      }

      res.json({ success: true, data: preference });
    } catch (error) {
      console.error('[ServicePreferences] Error fetching preference:', error);
      res.status(500).json({ error: 'Failed to fetch service preference' });
    }
  });

  router.post('/preferences/:serviceName', requireAuth, (req, res) => {
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
      console.error('[ServicePreferences] Error updating preference:', error);
      res.status(500).json({ error: 'Failed to update service preference' });
    }
  });

  router.put('/preferences/:serviceName', requireAuth, (req, res) => {
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
      console.error('[ServicePreferences] Error updating preference:', error);
      res.status(500).json({ error: 'Failed to update service preference' });
    }
  });

  router.delete('/preferences/:serviceName', requireAuth, (req, res) => {
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
      console.error('[ServicePreferences] Error deleting preference:', error);
      res.status(500).json({ error: 'Failed to delete service preference' });
    }
  });

  return router;
}

module.exports = createServicesRoutes;
