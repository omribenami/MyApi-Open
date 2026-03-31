const express = require('express');
const DeviceFingerprint = require('../utils/deviceFingerprint');
const db = require('../database');
const NotificationService = require('../services/notificationService');

const router = express.Router();

// Ensure user is authenticated and extract userId from either session or token
function requireAuth(req, res, next) {
  // Support both session auth (req.user.id) and Bearer token auth (req.tokenMeta.ownerId)
  const userId = req.user?.id || req.tokenMeta?.ownerId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Attach userId to request for use in route handlers
  req.userId = userId;
  next();
}

/**
 * POST /api/v1/devices/fingerprint
 * Generate device fingerprint for the current device
 */
router.post('/fingerprint', requireAuth, (req, res) => {
  try {
    const fingerprint = DeviceFingerprint.fromRequest(req);
    
    res.json({
      fingerprint: fingerprint.fingerprintHash,
      summary: fingerprint.summary,
      rawData: fingerprint.fingerprint,
    });
  } catch (error) {
    console.error('Error generating fingerprint:', error);
    res.status(500).json({ error: 'Failed to generate fingerprint' });
  }
});

/**
 * GET /api/v1/devices/approved
 * Get all approved devices for the authenticated user
 * Optional query: token_id (filter by token)
 * Note: This endpoint should be called frequently (e.g., every 5 seconds) to detect
 * when a pending approval has been approved on another device
 */
router.get('/approved', requireAuth, (req, res) => {
  try {
    const { token_id } = req.query;
    const devices = db.getApprovedDevices(req.userId, token_id);
    
    // Prevent caching to ensure frontend always gets latest data
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const formattedDevices = devices.map(device => ({
      id: device.id,
      name: device.device_name,
      fingerprint: device.device_fingerprint_hash,
      ip: device.ip_address,
      tokenId: device.token_id,
      approvedAt: device.approved_at,
      lastUsedAt: device.last_used_at,
      info: device.device_info_json ? JSON.parse(device.device_info_json) : null,
    }));
    
    res.json({
      devices: formattedDevices,
      total: formattedDevices.length,
    });
  } catch (error) {
    console.error('Error fetching approved devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

/**
 * GET /api/v1/devices/:device_id
 * Get details of a specific device
 */
router.get('/:device_id', requireAuth, (req, res) => {
  try {
    const device = db.db.prepare(`
      SELECT * FROM approved_devices 
      WHERE id = ? AND user_id = ?
    `).get(req.params.device_id, req.userId);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    res.json({
      id: device.id,
      name: device.device_name,
      fingerprint: device.device_fingerprint_hash,
      ip: device.ip_address,
      tokenId: device.token_id,
      approvedAt: device.approved_at,
      lastUsedAt: device.last_used_at,
      revokedAt: device.revoked_at,
      info: device.device_info_json ? JSON.parse(device.device_info_json) : null,
    });
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

/**
 * POST /api/v1/devices/:device_id/rename
 * Rename a device
 */
router.post('/:device_id/rename', requireAuth, (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Device name is required' });
    }
    
    // Verify ownership
    const device = db.db.prepare(`
      SELECT id FROM approved_devices WHERE id = ? AND user_id = ?
    `).get(req.params.device_id, req.userId);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    db.renameDevice(req.params.device_id, name.trim());
    
    db.createAuditLog({
      requesterId: req.userId,
      action: 'device_renamed',
      resource: 'device',
      scope: req.params.device_id,
      ip: req.ip,
      details: { old_name: device.device_name, new_name: name }
    });
    
    res.json({ success: true, message: 'Device renamed successfully' });
  } catch (error) {
    console.error('Error renaming device:', error);
    res.status(500).json({ error: 'Failed to rename device' });
  }
});

/**
 * POST /api/v1/devices/:device_id/revoke
 * Revoke device access immediately
 */
router.post('/:device_id/revoke', requireAuth, (req, res) => {
  try {
    // Verify ownership
    const device = db.db.prepare(`
      SELECT device_name FROM approved_devices WHERE id = ? AND user_id = ?
    `).get(req.params.device_id, req.userId);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    db.revokeDevice(req.params.device_id);
    
    // Emit notification via dispatcher (respects user preferences)
    const NotificationDispatcher = require('../lib/notificationDispatcher');
    const ws = require('../database').getWorkspaces(req.userId);
    if (ws?.length) {
      NotificationDispatcher.onDeviceRevoked(ws[0].id, req.userId, device.device_name)
        .catch(err => console.error('Notification dispatch error:', err));
    }
    
    // Log activity
    NotificationService.logActivity(req.userId, 'device_revoked', 'device', {
      resourceId: req.params.device_id,
      resourceName: device.device_name,
      actorType: 'user',
      actorId: req.userId,
      result: 'success',
      ipAddress: req.ip,
    });
    
    db.createAuditLog({
      requesterId: req.userId,
      action: 'device_revoked',
      resource: 'device',
      scope: req.params.device_id,
      ip: req.ip,
      details: { device_name: device.device_name }
    });
    
    res.json({ 
      success: true, 
      message: 'Device revoked successfully. It will need to be re-approved to access MyApi.' 
    });
  } catch (error) {
    console.error('Error revoking device:', error);
    res.status(500).json({ error: 'Failed to revoke device' });
  }
});

/**
 * GET /api/v1/devices/approvals/pending
 * Get pending device approvals for the user
 * Optional query: token_id (filter by token)
 * Note: Called frequently by polling interval to detect new pending approvals
 */
router.get('/approvals/pending', requireAuth, (req, res) => {
  try {
    const { token_id } = req.query;
    const pendingApprovals = db.getPendingApprovals(req.userId, token_id);
    
    // Prevent caching to ensure frontend always gets latest pending approvals
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const formatted = pendingApprovals.map(approval => ({
      id: approval.id,
      deviceInfo: approval.device_info_json ? JSON.parse(approval.device_info_json) : null,
      ip: approval.ip_address,
      tokenId: approval.token_id,
      createdAt: approval.created_at,
      expiresAt: approval.expires_at,
      status: approval.status,
    }));
    
    res.json({
      approvals: formatted,
      total: formatted.length,
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

/**
 * POST /api/v1/devices/approve/:approval_id
 * Approve a pending device
 */
router.post('/approve/:approval_id', requireAuth, (req, res) => {
  try {
    const { device_name } = req.body;
    
    // Validate input
    if (!req.params.approval_id) {
      return res.status(400).json({ error: 'Approval ID is required' });
    }
    
    const approval = db.getPendingApprovalById(req.params.approval_id);
    
    if (!approval) {
      return res.status(404).json({ error: 'Approval request not found' });
    }
    
    // Convert to string for safe comparison
    if (String(approval.user_id) !== String(req.userId)) {
      return res.status(403).json({ error: 'Unauthorized: This approval is for a different user' });
    }
    
    if (approval.status !== 'pending') {
      return res.status(400).json({ error: `Approval is already ${approval.status}` });
    }
    
    // Check expiration
    if (new Date(approval.expires_at) < new Date()) {
      db.denyPendingApproval(req.params.approval_id, 'Approval request expired');
      return res.status(410).json({ error: 'Approval request has expired' });
    }
    
    // Determine device name
    let finalDeviceName = device_name;
    if (!finalDeviceName || finalDeviceName.trim().length === 0) {
      try {
        const deviceInfo = approval.device_info_json ? JSON.parse(approval.device_info_json) : {};
        finalDeviceName = `Approved Device (${deviceInfo.browser || 'Unknown'})`;
      } catch {
        finalDeviceName = 'Approved Device';
      }
    }
    
    const deviceId = db.approvePendingDevice(req.params.approval_id, finalDeviceName);
    
    if (!deviceId) {
      return res.status(500).json({ error: 'Failed to approve device (database error)' });
    }
    
    // Emit notification via dispatcher (respects user preferences)
    const NotificationDispatcher = require('../lib/notificationDispatcher');
    const ws = require('../database').getWorkspaces(req.userId);
    if (ws?.length) {
      NotificationDispatcher.onDeviceApproved(ws[0].id, req.userId, finalDeviceName)
        .catch(err => console.error('Notification dispatch error:', err));
    }
    
    // Log activity
    NotificationService.logActivity(req.userId, 'device_approved', 'device', {
      resourceId: deviceId,
      resourceName: finalDeviceName,
      actorType: 'user',
      actorId: req.userId,
      result: 'success',
      ipAddress: req.ip,
    });
    
    db.createAuditLog({
      requesterId: req.userId,
      action: 'device_approved',
      resource: 'device',
      scope: deviceId,
      ip: req.ip,
      details: { approval_id: req.params.approval_id }
    });
    
    res.json({
      success: true,
      message: 'Device approved successfully',
      deviceId,
    });
  } catch (error) {
    console.error('Error approving device:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to approve device' });
  }
});

/**
 * POST /api/v1/devices/deny/:approval_id
 * Deny a pending device approval
 */
router.post('/deny/:approval_id', requireAuth, (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!req.params.approval_id) {
      return res.status(400).json({ error: 'Approval ID is required' });
    }
    
    const approval = db.getPendingApprovalById(req.params.approval_id);
    
    if (!approval) {
      return res.status(404).json({ error: 'Approval request not found' });
    }
    
    // Convert to string for safe comparison
    if (String(approval.user_id) !== String(req.userId)) {
      return res.status(403).json({ error: 'Unauthorized: This approval is for a different user' });
    }
    
    if (approval.status !== 'pending') {
      return res.status(400).json({ error: `Approval is already ${approval.status}` });
    }
    
    const denied = db.denyPendingApproval(
      req.params.approval_id,
      reason || 'Device approval denied by user'
    );
    
    if (!denied) {
      return res.status(500).json({ error: 'Failed to deny device (database error)' });
    }
    
    db.createAuditLog({
      requesterId: req.userId,
      action: 'device_denied',
      resource: 'device',
      scope: req.params.approval_id,
      ip: req.ip,
      details: { reason: reason || 'No reason provided' }
    });
    
    res.json({
      success: true,
      message: 'Device approval request denied',
    });
  } catch (error) {
    console.error('Error denying device:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to deny device' });
  }
});

/**
 * GET /api/v1/devices/activity
 * Get device activity log for the user
 * Optional query: token_id, device_id, limit
 */
router.get('/activity/log', requireAuth, (req, res) => {
  try {
    const { token_id, limit = 100 } = req.query;
    const activity = db.getDeviceApprovalHistory(req.userId, token_id, parseInt(limit));
    
    const formatted = activity.map(item => ({
      id: item.id,
      type: item.type,
      action: item.action,
      deviceName: item.device_name,
      ip: item.ip_address,
      timestamp: item.event_date,
    }));
    
    res.json({
      activity: formatted,
      total: formatted.length,
    });
  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

module.exports = router;
