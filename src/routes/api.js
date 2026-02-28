const express = require('express');
const { body, query, validationResult } = require('express-validator');

function createApiRoutes(brain, vault, tokenManager, auditLog) {
  const router = express.Router();

  // Validation error handler
  const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  };

  // Helper to log API calls
  const logApiCall = (req, action, status, details = null) => {
    auditLog.log({
      tokenId: req.tokenData.id,
      tokenType: req.tokenData.type,
      requester: req.tokenData.name,
      action,
      endpoint: req.path,
      method: req.method,
      scope: req.tokenData.scope,
      status,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details
    });
  };

  // GET /api/identity/:key - Get identity data
  router.get('/identity/:key', async (req, res) => {
    try {
      const result = await brain.evaluateRequest(
        req.tokenData,
        'identity:get',
        { key: req.params.key }
      );

      logApiCall(req, 'identity:get', 200, { key: req.params.key });

      if (!result) {
        return res.status(404).json({ error: 'Identity key not found' });
      }

      res.json(result);
    } catch (error) {
      logApiCall(req, 'identity:get', error.message.includes('denied') ? 403 : 500, {
        error: error.message
      });
      
      res.status(error.message.includes('denied') ? 403 : 500).json({
        error: error.message
      });
    }
  });

  // GET /api/identity - List identity data by category
  router.get('/identity', [
    query('category').optional().isString().trim()
  ], handleValidationErrors, async (req, res) => {
    try {
      const category = req.query.category || 'general';
      
      const result = await brain.evaluateRequest(
        req.tokenData,
        'identity:list',
        { category }
      );

      logApiCall(req, 'identity:list', 200, { category });

      res.json(result);
    } catch (error) {
      logApiCall(req, 'identity:list', error.message.includes('denied') ? 403 : 500, {
        error: error.message
      });
      
      res.status(error.message.includes('denied') ? 403 : 500).json({
        error: error.message
      });
    }
  });

  // GET /api/identity/all - Get all identity data (personal tokens only)
  router.get('/identity-all', async (req, res) => {
    try {
      if (req.tokenData.type !== 'personal') {
        logApiCall(req, 'identity:all', 403);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'This endpoint requires a personal token'
        });
      }

      const result = await brain.evaluateRequest(
        req.tokenData,
        'identity:all',
        {}
      );

      logApiCall(req, 'identity:all', 200);

      res.json(result);
    } catch (error) {
      logApiCall(req, 'identity:all', 500, { error: error.message });
      
      res.status(500).json({
        error: error.message
      });
    }
  });

  // GET /api/preferences/:key - Get preference
  router.get('/preferences/:key', async (req, res) => {
    try {
      const result = await brain.evaluateRequest(
        req.tokenData,
        'preferences:get',
        { key: req.params.key }
      );

      logApiCall(req, 'preferences:get', 200, { key: req.params.key });

      if (!result) {
        return res.status(404).json({ error: 'Preference key not found' });
      }

      res.json(result);
    } catch (error) {
      logApiCall(req, 'preferences:get', error.message.includes('denied') ? 403 : 500, {
        error: error.message
      });
      
      res.status(error.message.includes('denied') ? 403 : 500).json({
        error: error.message
      });
    }
  });

  // GET /api/preferences - List preferences by category
  router.get('/preferences', [
    query('category').optional().isString().trim()
  ], handleValidationErrors, async (req, res) => {
    try {
      const category = req.query.category || 'general';
      
      const result = await brain.evaluateRequest(
        req.tokenData,
        'preferences:list',
        { category }
      );

      logApiCall(req, 'preferences:list', 200, { category });

      res.json(result);
    } catch (error) {
      logApiCall(req, 'preferences:list', error.message.includes('denied') ? 403 : 500, {
        error: error.message
      });
      
      res.status(error.message.includes('denied') ? 403 : 500).json({
        error: error.message
      });
    }
  });

  // POST /api/identity - Store identity data (personal tokens only)
  router.post('/identity', [
    body('key').isString().trim().notEmpty(),
    body('value').exists(),
    body('category').optional().isString().trim()
  ], handleValidationErrors, async (req, res) => {
    try {
      if (req.tokenData.type !== 'personal') {
        logApiCall(req, 'identity:store', 403);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'This endpoint requires a personal token'
        });
      }

      const { key, value, category, metadata } = req.body;
      
      vault.storeIdentity(key, value, category || 'general', metadata);

      logApiCall(req, 'identity:store', 201, { key, category });

      res.status(201).json({ success: true, key });
    } catch (error) {
      logApiCall(req, 'identity:store', 500, { error: error.message });
      
      res.status(500).json({
        error: error.message
      });
    }
  });

  // POST /api/preferences - Store preference (personal tokens only)
  router.post('/preferences', [
    body('key').isString().trim().notEmpty(),
    body('value').exists(),
    body('category').optional().isString().trim()
  ], handleValidationErrors, async (req, res) => {
    try {
      if (req.tokenData.type !== 'personal') {
        logApiCall(req, 'preferences:store', 403);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'This endpoint requires a personal token'
        });
      }

      const { key, value, category } = req.body;
      
      vault.storePreference(key, value, category || 'general');

      logApiCall(req, 'preferences:store', 201, { key, category });

      res.status(201).json({ success: true, key });
    } catch (error) {
      logApiCall(req, 'preferences:store', 500, { error: error.message });
      
      res.status(500).json({
        error: error.message
      });
    }
  });

  // GET /api/connectors - List connectors (personal tokens only)
  router.get('/connectors', async (req, res) => {
    try {
      if (req.tokenData.type !== 'personal') {
        logApiCall(req, 'connectors:list', 403);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'This endpoint requires a personal token'
        });
      }

      const result = await brain.evaluateRequest(
        req.tokenData,
        'connectors:list',
        {}
      );

      logApiCall(req, 'connectors:list', 200);

      res.json(result);
    } catch (error) {
      logApiCall(req, 'connectors:list', 500, { error: error.message });
      
      res.status(500).json({
        error: error.message
      });
    }
  });

  return router;
}

module.exports = createApiRoutes;
