const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { requirePersonal } = require('../middleware/auth');

function createManagementRoutes(tokenManager, vault, auditLog) {
  const router = express.Router();

  // All management routes require personal token
  router.use(requirePersonal);

  // Validation error handler
  const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  };

  // POST /manage/tokens - Create a new token
  router.post('/tokens', [
    body('name').isString().trim().notEmpty(),
    body('type').isIn(['personal', 'guest']),
    body('scope').isObject(),
    body('expiresInDays').optional().isInt({ min: 1 })
  ], handleValidationErrors, async (req, res) => {
    try {
      const { name, type, scope, expiresInDays, metadata } = req.body;
      
      const token = await tokenManager.createToken(
        name,
        type,
        scope,
        expiresInDays,
        metadata || {}
      );

      auditLog.log({
        tokenId: req.tokenData.id,
        tokenType: req.tokenData.type,
        requester: req.tokenData.name,
        action: 'token:create',
        endpoint: req.path,
        method: req.method,
        status: 201,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: { newTokenId: token.id, newTokenName: name, newTokenType: type }
      });

      res.status(201).json(token);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /manage/tokens - List all tokens
  router.get('/tokens', [
    query('includeRevoked').optional().isBoolean().toBoolean()
  ], handleValidationErrors, async (req, res) => {
    try {
      const includeRevoked = req.query.includeRevoked || false;
      const tokens = tokenManager.listTokens(includeRevoked);

      auditLog.log({
        tokenId: req.tokenData.id,
        tokenType: req.tokenData.type,
        requester: req.tokenData.name,
        action: 'token:list',
        endpoint: req.path,
        method: req.method,
        status: 200,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json(tokens);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /manage/tokens/:id - Get token by ID
  router.get('/tokens/:id', async (req, res) => {
    try {
      const token = tokenManager.getTokenById(req.params.id);

      if (!token) {
        return res.status(404).json({ error: 'Token not found' });
      }

      auditLog.log({
        tokenId: req.tokenData.id,
        tokenType: req.tokenData.type,
        requester: req.tokenData.name,
        action: 'token:get',
        endpoint: req.path,
        method: req.method,
        status: 200,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: { queriedTokenId: req.params.id }
      });

      res.json(token);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /manage/tokens/:id - Revoke a token
  router.delete('/tokens/:id', async (req, res) => {
    try {
      const success = tokenManager.revokeToken(req.params.id);

      if (!success) {
        return res.status(404).json({ error: 'Token not found' });
      }

      auditLog.log({
        tokenId: req.tokenData.id,
        tokenType: req.tokenData.type,
        requester: req.tokenData.name,
        action: 'token:revoke',
        endpoint: req.path,
        method: req.method,
        status: 200,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: { revokedTokenId: req.params.id }
      });

      res.json({ success: true, message: 'Token revoked' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /manage/audit - Get audit logs
  router.get('/audit', [
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt()
  ], handleValidationErrors, async (req, res) => {
    try {
      const limit = req.query.limit || 100;
      const offset = req.query.offset || 0;
      
      const logs = auditLog.getRecent(limit, offset);

      auditLog.log({
        tokenId: req.tokenData.id,
        tokenType: req.tokenData.type,
        requester: req.tokenData.name,
        action: 'audit:list',
        endpoint: req.path,
        method: req.method,
        status: 200,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /manage/audit/stats - Get audit statistics
  router.get('/audit/stats', async (req, res) => {
    try {
      const stats = auditLog.getStats();

      auditLog.log({
        tokenId: req.tokenData.id,
        tokenType: req.tokenData.type,
        requester: req.tokenData.name,
        action: 'audit:stats',
        endpoint: req.path,
        method: req.method,
        status: 200,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /manage/audit/token/:tokenId - Get audit logs for specific token
  router.get('/audit/token/:tokenId', [
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt()
  ], handleValidationErrors, async (req, res) => {
    try {
      const limit = req.query.limit || 100;
      const logs = auditLog.getByToken(req.params.tokenId, limit);

      auditLog.log({
        tokenId: req.tokenData.id,
        tokenType: req.tokenData.type,
        requester: req.tokenData.name,
        action: 'audit:token',
        endpoint: req.path,
        method: req.method,
        status: 200,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: { queriedTokenId: req.params.tokenId }
      });

      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /manage/ingest-user-md - Ingest USER.md file
  router.post('/ingest-user-md', async (req, res) => {
    try {
      const userMdPath = process.env.USER_MD_PATH || '/home/jarvis/.openclaw/workspace/USER.md';
      
      const result = vault.ingestUserMd(userMdPath);

      auditLog.log({
        tokenId: req.tokenData.id,
        tokenType: req.tokenData.type,
        requester: req.tokenData.name,
        action: 'vault:ingest_user_md',
        endpoint: req.path,
        method: req.method,
        status: result.success ? 200 : 500,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: result
      });

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /manage/audit/agents - Get token usage by AI agents
  router.get('/audit/agents', async (req, res) => {
    try {
      const logs = auditLog.getRecent(1000, 0); // Get last 1000 audit logs

      // Parse userAgent and group by agent
      const agentMap = {};
      
      logs.forEach(log => {
        if (!log.userAgent) return;
        
        // Extract agent name from user-agent string
        // Patterns: "Jarvis/1.0", "OpenClaw/...", "Mozilla/5.0 ..."
        let agentName = 'Unknown';
        let agentType = 'browser';
        
        if (log.userAgent.includes('Jarvis')) {
          agentName = 'Jarvis';
          agentType = 'ai';
        } else if (log.userAgent.includes('OpenClaw')) {
          agentName = 'OpenClaw';
          agentType = 'ai';
        } else if (log.userAgent.includes('Python')) {
          agentName = 'Python Script';
          agentType = 'script';
        } else if (log.userAgent.includes('Node')) {
          agentName = 'Node.js';
          agentType = 'script';
        } else if (log.userAgent.includes('curl')) {
          agentName = 'cURL';
          agentType = 'cli';
        } else {
          agentName = log.userAgent.split('/')[0] || 'Unknown';
          agentType = 'browser';
        }

        if (!agentMap[agentName]) {
          agentMap[agentName] = {
            agentName,
            agentType,
            accessCount: 0,
            lastAccess: null,
            tokenIds: new Set(),
            endpoints: new Set(),
            methods: new Set()
          };
        }

        agentMap[agentName].accessCount++;
        agentMap[agentName].lastAccess = log.date;
        if (log.tokenId) agentMap[agentName].tokenIds.add(log.tokenId);
        if (log.endpoint) agentMap[agentName].endpoints.add(log.endpoint);
        if (log.method) agentMap[agentName].methods.add(log.method);
      });

      // Convert to array and sort by access count
      const agents = Object.values(agentMap)
        .map(agent => ({
          agentName: agent.agentName,
          agentType: agent.agentType,
          accessCount: agent.accessCount,
          lastAccess: agent.lastAccess,
          tokensUsed: Array.from(agent.tokenIds),
          endpointsAccessed: Array.from(agent.endpoints),
          methodsUsed: Array.from(agent.methods)
        }))
        .sort((a, b) => b.accessCount - a.accessCount);

      auditLog.log({
        tokenId: req.tokenData.id,
        tokenType: req.tokenData.type,
        requester: req.tokenData.name,
        action: 'audit:agents',
        endpoint: req.path,
        method: req.method,
        status: 200,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({
        agents,
        total: agents.length,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createManagementRoutes;
