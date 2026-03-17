const express = require('express');
const db = require('../database');

const router = express.Router();

// Middleware to ensure authentication
function requireAuth(req, res, next) {
  const userId = req.user?.id || req.tokenMeta?.ownerId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  req.userId = userId;
  next();
}

/**
 * GET /api/v1/dashboard/metrics
 * 
 * Returns comprehensive dashboard metrics for the authenticated user:
 * - Security status (approved devices, pending approvals)
 * - API health (uptime, active tokens, errors)
 * - Connected services
 * - Recent activity
 * 
 * Response format:
 * {
 *   "approvedDevices": 5,
 *   "pendingApprovals": 2,
 *   "connectedServices": 7,
 *   "apiUptime": 99.8,
 *   "lastError": null,
 *   "activeTokens": 3,
 *   "totalServices": 10,
 *   "lastActivityTime": "2024-03-17T03:50:00Z",
 *   "recentActivity": [
 *     {
 *       "id": "activity-1",
 *       "type": "device_approval",
 *       "description": "Device 'iPhone 15' was approved",
 *       "timestamp": "2024-03-17T03:50:00Z"
 *     }
 *   ]
 * }
 */
router.get('/metrics', requireAuth, (req, res) => {
  try {
    // Get approved devices count
    const approvedDevicesResult = db.db.prepare(`
      SELECT COUNT(*) as count FROM approved_devices 
      WHERE user_id = ?
    `).get(req.userId);
    const approvedDevices = approvedDevicesResult?.count || 0;

    // Get pending approvals count
    const pendingApprovalsResult = db.db.prepare(`
      SELECT COUNT(*) as count FROM device_approvals_pending 
      WHERE user_id = ? AND status = 'pending'
    `).get(req.userId);
    const pendingApprovals = pendingApprovalsResult?.count || 0;

    // Get connected services count
    const connectedServicesResult = db.db.prepare(`
      SELECT COUNT(*) as count FROM oauth_tokens 
      WHERE user_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
    `).get(req.userId);
    const connectedServices = connectedServicesResult?.count || 0;

    // Get total services count
    const totalServicesResult = db.db.prepare(`
      SELECT COUNT(*) as count FROM oauth_tokens 
      WHERE user_id = ?
    `).get(req.userId);
    const totalServices = totalServicesResult?.count || 0;

    // Get active tokens count
    const activeTokensResult = db.db.prepare(`
      SELECT COUNT(*) as count FROM access_tokens 
      WHERE owner_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > datetime('now'))
    `).get(req.userId);
    const activeTokens = activeTokensResult?.count || 0;

    // Get API uptime (from system health - default to 99.8% if no data)
    let apiUptime = 99.8;
    try {
      const healthResult = db.db.prepare(`
        SELECT uptime_percentage FROM system_health 
        WHERE user_id = ? 
        ORDER BY recorded_at DESC 
        LIMIT 1
      `).get(req.userId);
      if (healthResult?.uptime_percentage !== undefined) {
        apiUptime = healthResult.uptime_percentage;
      }
    } catch (err) {
      // Table might not exist, use default
    }

    // Get last error
    let lastError = null;
    try {
      const errorResult = db.db.prepare(`
        SELECT error_message FROM api_errors 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `).get(req.userId);
      if (errorResult?.error_message) {
        lastError = errorResult.error_message;
      }
    } catch (err) {
      // Table might not exist
    }

    // Get last activity time
    let lastActivityTime = null;
    try {
      const activityResult = db.db.prepare(`
        SELECT MAX(created_at) as last_time FROM (
          SELECT created_at FROM device_approvals_pending WHERE user_id = ?
          UNION ALL
          SELECT created_at FROM oauth_tokens WHERE user_id = ?
          UNION ALL
          SELECT created_at FROM access_tokens WHERE owner_id = ?
        )
      `).get(req.userId, req.userId, req.userId);
      if (activityResult?.last_time) {
        lastActivityTime = activityResult.last_time;
      }
    } catch (err) {
      // Fallback if query fails
    }

    // Get recent activity (last 5 events)
    const recentActivity = [];
    try {
      // Device approvals
      const deviceApprovals = db.db.prepare(`
        SELECT ad.id, ad.device_name, ad.created_at 
        FROM approved_devices ad
        WHERE ad.user_id = ?
        ORDER BY ad.approved_at DESC 
        LIMIT 3
      `).all(req.userId);

      deviceApprovals.forEach((approval) => {
        recentActivity.push({
          id: `device-${approval.id}`,
          type: 'device_approval',
          description: `Device '${approval.device_name || 'Device'}' was approved`,
          timestamp: approval.created_at,
        });
      });

      // Service connections
      const serviceConnections = db.db.prepare(`
        SELECT id, service_name, created_at FROM oauth_tokens 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 2
      `).all(req.userId);

      serviceConnections.forEach((service) => {
        recentActivity.push({
          id: `service-${service.id}`,
          type: 'oauth_connection',
          description: `Connected to ${service.service_name}`,
          timestamp: service.created_at,
        });
      });
    } catch (err) {
      console.error('Error fetching recent activity:', err);
    }

    // Sort by timestamp and take only the most recent 5
    recentActivity.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
    const limitedActivity = recentActivity.slice(0, 5);

    // Prevent caching
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.json({
      approvedDevices,
      pendingApprovals,
      connectedServices,
      totalServices,
      apiUptime: parseFloat(apiUptime.toFixed(1)),
      lastError,
      activeTokens,
      lastActivityTime,
      recentActivity: limitedActivity,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

module.exports = router;
