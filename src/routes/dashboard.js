const express = require('express');
const {
  getApprovedDevices,
  getPendingApprovals,
  countConnectedOAuthServices,
  getAccessTokens,
  getPersonas,
  getSkills,
  getMyMarketplaceListings,
  getMarketplaceListings,
  getKBDocuments,
  getActivityLog,
  getMemories,
} = require('../database');

const router = express.Router();

function requireAuth(req, res, next) {
  const userId =
    req.user?.id ||
    req.tokenMeta?.ownerId ||
    req.tokenMeta?.userId ||
    req.session?.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.userId = String(userId);
  next();
}

function handleDashboardMetrics(req, res) {
  try {
    const userId = req.userId;

    // Multi-tenancy: Extract workspace context from request
    const workspaceId = req.workspaceId || req.session?.currentWorkspace || req.headers['x-workspace-id'] || null;

    const approvedDevices = getApprovedDevices(userId)?.length || 0;
    const pendingApprovals = getPendingApprovals(userId)?.length || 0;

    const oauthServices = [
      'google',
      'github',
      'facebook',
      'instagram',
      'tiktok',
      'twitter',
      'linkedin',
      'reddit',
      'slack',
      'discord',
      'whatsapp',
      'notion',
    ];

    // Use DB-level count so metrics don't break when encrypted token decryption/key context fails.
    const connectedServices = countConnectedOAuthServices(userId);

    const totalServices = oauthServices.length;

    const activeTokens = (getAccessTokens(userId, workspaceId) || []).filter((t) => !t.revokedAt).length;
    const personas = (getPersonas(userId, workspaceId) || []).length;
    const skills = (getSkills(userId, workspaceId) || []).length;
    // Use public marketplace total so dashboard matches what users see in Marketplace browse.
    const marketplace = (getMarketplaceListings({}) || []).length;
    const knowledge = (getKBDocuments(userId) || []).length;
    const memories = (getMemories(userId, workspaceId) || []).length;

    const activity = getActivityLog(userId, { limit: 5 }) || [];
    const recentActivity = activity.map((item) => {
      const actionType = item.action_type || item.action || '';
      const resourceName = item.resource_name || item.resource_id || '';
      const resourceType = item.resource_type || '';
      // Build a human-readable one-liner: e.g. "Connected google", "Created persona Alex"
      const verb = actionType.split(':').pop() || actionType;
      const subject = resourceName || resourceType;
      const description = subject
        ? `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${subject}`
        : verb.charAt(0).toUpperCase() + verb.slice(1) || 'Activity';
      return {
        type: actionType,
        description,
        createdAt: item.created_at || item.createdAt || null,
      };
    });

    const lastActivityTime = recentActivity[0]?.createdAt || null;

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.json({
      approvedDevices,
      pendingApprovals,
      connectedServices,
      totalServices,
      activeTokens,
      personas,
      skills,
      marketplace,
      knowledge,
      memories,
      lastActivityTime,
      recentActivity,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return res.status(500).json({ error: 'Failed to load dashboard metrics' });
  }
}

// Support both old and new frontend bundles.
router.get('/metrics', requireAuth, handleDashboardMetrics);
router.get('/stats', requireAuth, handleDashboardMetrics);

module.exports = router;
