const express = require('express');
const db = require('../database');

const router = express.Router();

// Middleware to ensure authentication
function requireAuth(req, res, next) {
  const userId = req.user?.id || req.tokenMeta?.ownerId;
  
  console.log('[Dashboard requireAuth]', { 
    hasUser: !!req.user, 
    userId: req.user?.id,
    hasTokenMeta: !!req.tokenMeta,
    tokenMetaOwnerId: req.tokenMeta?.ownerId,
    sessionUser: req.session?.user
  });
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized - no userId found' });
  }
  
  req.userId = userId;
  next();
}

/**
 * GET /api/v1/dashboard/metrics
 * Returns comprehensive dashboard metrics
 */
router.get('/metrics', requireAuth, (req, res) => {
  try {
    console.log('[Dashboard Metrics] userId:', req.userId);
    
    // If still no userId despite auth, try fallback
    if (!req.userId && req.session?.user?.id) {
      req.userId = req.session.user.id;
      console.log('[Dashboard Metrics] Recovered userId from session:', req.userId);
    }
    
    if (!req.userId) {
      console.error('[Dashboard Metrics] No userId available after recovery');
      return res.status(401).json({ error: 'Session not loaded - please refresh' });
    }
    
    // Initialize metrics with default values
    let approvedDevices = 0;
    let pendingApprovals = 0;
    let connectedServices = 0;
    let totalServices = 0;
    let activeTokens = 0;
    let personas = 0;
    let skills = 0;
    let marketplace = 0;
    let knowledge = 0;
    let lastActivityTime = null;
    let recentActivity = [];

    try {
      const result = db.db.prepare('SELECT COUNT(*) as count FROM approved_devices WHERE user_id = ?').get(req.userId);
      approvedDevices = result?.count || 0;
    } catch (e) { console.error('Error counting approved devices:', e); }

    try {
      const result = db.db.prepare('SELECT COUNT(*) as count FROM device_approvals_pending WHERE user_id = ? AND status = "pending"').get(req.userId);
      pendingApprovals = result?.count || 0;
    } catch (e) { console.error('Error counting pending approvals:', e); }

    try {
      const result = db.db.prepare('SELECT COUNT(*) as count FROM oauth_tokens WHERE user_id = ? AND (expires_at IS NULL OR expires_at > datetime("now"))').get(req.userId);
      connectedServices = result?.count || 0;
    } catch (e) { console.error('Error counting connected services:', e); }

    try {
      const result = db.db.prepare('SELECT COUNT(*) as count FROM oauth_tokens WHERE user_id = ?').get(req.userId);
      totalServices = result?.count || 0;
    } catch (e) { console.error('Error counting total services:', e); }

    try {
      const result = db.db.prepare('SELECT COUNT(*) as count FROM access_tokens WHERE owner_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > datetime("now"))').get(req.userId);
      activeTokens = result?.count || 0;
    } catch (e) { console.error('Error counting active tokens:', e); }

    try {
      const result = db.db.prepare('SELECT COUNT(*) as count FROM personas WHERE user_id = ?').get(req.userId);
      personas = result?.count || 0;
    } catch (e) { }

    try {
      const result = db.db.prepare('SELECT COUNT(*) as count FROM skills WHERE user_id = ? OR public = 1').get(req.userId);
      skills = result?.count || 0;
    } catch (e) { }

    try {
      const result = db.db.prepare('SELECT COUNT(*) as count FROM marketplace_listings WHERE user_id = ? AND active = 1').get(req.userId);
      marketplace = result?.count || 0;
    } catch (e) { }

    try {
      const result = db.db.prepare('SELECT COUNT(*) as count FROM kb_documents WHERE user_id = ?').get(req.userId);
      knowledge = result?.count || 0;
    } catch (e) { }

    try {
      const result = db.db.prepare('SELECT MAX(created_at) as last_time FROM (SELECT created_at FROM device_approvals_pending WHERE user_id = ? UNION ALL SELECT created_at FROM oauth_tokens WHERE user_id = ? UNION ALL SELECT created_at FROM access_tokens WHERE owner_id = ?)').get(req.userId, req.userId, req.userId);
      if (result?.last_time) {
        lastActivityTime = result.last_time;
      }
    } catch (e) { }

    // Set cache control
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    // Return metrics
    res.json({
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
    // Return fallback metrics
    res.json({
      approvedDevices: 0,
      pendingApprovals: 0,
      connectedServices: 0,
      totalServices: 0,
      activeTokens: 0,
      personas: 0,
      skills: 0,
      marketplace: 0,
      knowledge: 0,
      lastActivityTime: new Date().toISOString(),
      recentActivity: [],
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
