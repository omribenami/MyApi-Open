const express = require('express');
const {
  createServicePreference,
  getServicePreference,
  getServicePreferences,
  updateServicePreference,
  deleteServicePreference,
  createAuditLog
} = require('../database');

function createServicesRoutes() {
  const router = express.Router();

  // GET /api/v1/services/available - List available services
  router.get('/available', (req, res) => {
    try {
      // Return list of available services
      const availableServices = [
        { id: 'github', name: 'GitHub', description: 'Version control and collaboration' },
        { id: 'google', name: 'Google', description: 'Email, Calendar, Drive, Sheets, Docs' },
        { id: 'slack', name: 'Slack', description: 'Team messaging and collaboration' },
        { id: 'discord', name: 'Discord', description: 'Voice, video, and text communication' },
        { id: 'tiktok', name: 'TikTok', description: 'Short-form video platform' },
        { id: 'linkedin', name: 'LinkedIn', description: 'Professional networking' },
        { id: 'facebook', name: 'Facebook', description: 'Social media platform' },
        { id: 'instagram', name: 'Instagram', description: 'Photo and video sharing' },
        { id: 'twitter', name: 'Twitter/X', description: 'Social media platform' },
        { id: 'notion', name: 'Notion', description: 'Workspace and documentation' }
      ];
      
      res.json({
        success: true,
        services: availableServices,
        total: availableServices.length
      });
    } catch (error) {
      console.error('[Services] Error fetching available services:', error);
      res.status(500).json({ error: 'Failed to fetch available services' });
    }
  });

  // GET /api/v1/services/preferences - Get all service preferences for the user
  router.get('/preferences', (req, res) => {
    try {
      const userId = req.user?.id || req.tokenMeta?.userId || 'owner';
      const preferences = getServicePreferences(userId);
      
      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      console.error('[ServicePreferences] Error fetching preferences:', error);
      res.status(500).json({ error: 'Failed to fetch service preferences' });
    }
  });

  // GET /api/v1/services/preferences/:serviceName - Get preferences for a specific service
  router.get('/preferences/:serviceName', (req, res) => {
    try {
      const userId = req.user?.id || req.tokenMeta?.userId || 'owner';
      const { serviceName } = req.params;

      const preference = getServicePreference(userId, serviceName);
      
      if (!preference) {
        return res.status(404).json({ error: 'Service preferences not found' });
      }

      res.json({
        success: true,
        data: preference
      });
    } catch (error) {
      console.error('[ServicePreferences] Error fetching preference:', error);
      res.status(500).json({ error: 'Failed to fetch service preference' });
    }
  });

  // POST /api/v1/services/preferences/:serviceName - Create or update service preferences
  router.post('/preferences/:serviceName', (req, res) => {
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
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[ServicePreferences] Error updating preference:', error);
      res.status(500).json({ error: 'Failed to update service preference' });
    }
  });

  // PUT /api/v1/services/preferences/:serviceName - Update service preferences
  router.put('/preferences/:serviceName', (req, res) => {
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
        ip: req.ip
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[ServicePreferences] Error updating preference:', error);
      res.status(500).json({ error: 'Failed to update service preference' });
    }
  });

  // DELETE /api/v1/services/preferences/:serviceName - Delete service preferences
  router.delete('/preferences/:serviceName', (req, res) => {
    try {
      const userId = req.user?.id || req.tokenMeta?.userId || 'owner';
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
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Service preferences deleted'
      });
    } catch (error) {
      console.error('[ServicePreferences] Error deleting preference:', error);
      res.status(500).json({ error: 'Failed to delete service preference' });
    }
  });

  return router;
}

module.exports = createServicesRoutes;
