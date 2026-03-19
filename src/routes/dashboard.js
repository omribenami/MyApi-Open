const express = require('express');
const {
  getApprovedDevices,
  getPendingApprovals,
  getOAuthToken,
  getAccessTokens,
  getPersonas,
  getSkills,
  getMyMarketplaceListings,
  getKBDocuments,
  getActivityLog,
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

/**
 * GET /api/v1/dashboard/metrics
 */
router.get('/metrics', requireAuth, (req, res) => {
  try {
    const userId = req.userId;

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

    const connectedServices = oauthServices.filter((svc) => {
      try {
        const token = getOAuthToken(svc, userId);
        return Boolean(token && !token.revokedAt);
      } catch {
        return false;
      }
    }).length;

    const totalServices = oauthServices.length;

    const activeTokens = (getAccessTokens(userId) || []).filter((t) => !t.revokedAt).length;
    const personas = (getPersonas(userId) || []).length;
    const skills = (getSkills(userId) || []).length;
    const marketplace = (getMyMarketplaceListings(userId) || []).filter((x) => x.active !== 0).length;
    const knowledge = (getKBDocuments(userId) || []).length;

    const activity = getActivityLog(userId, { limit: 5 }) || [];
    const recentActivity = activity.map((item) => ({
      type: item.action,
      description: item.action || 'Activity',
      createdAt: item.createdAt || item.created_at || null,
    }));

    const lastActivityTime =
      recentActivity.find((a) => a.createdAt)?.createdAt ||
      null;

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
      lastActivityTime,
      recentActivity,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return res.status(500).json({ error: 'Failed to load dashboard metrics' });
  }
});

module.exports = router;
