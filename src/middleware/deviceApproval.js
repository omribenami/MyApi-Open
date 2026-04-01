const DeviceFingerprint = require('../utils/deviceFingerprint');
const db = require('../database');
const NotificationService = require('../services/notificationService');

/**
 * Device Approval Middleware
 * Checks if the requesting device is approved before allowing API access
 */

// Global alert emitter (will be set by index.js)
let globalAlertEmitter = null;

function setAlertEmitter(emitter) {
  globalAlertEmitter = emitter;
}

// Rate limit tracking (in-memory, should use Redis for production)
const approvalRateLimits = new Map(); // token_id -> { count, resetTime }

function getRateLimitKey(tokenId) {
  return `approval_${tokenId}`;
}

function checkApprovalRateLimit(tokenId) {
  const key = getRateLimitKey(tokenId);
  const now = Date.now();
  const limit = approvalRateLimits.get(key);
  
  if (!limit || now > limit.resetTime) {
    // New window
    approvalRateLimits.set(key, { count: 1, resetTime: now + 3600000 }); // 1 hour
    return true;
  }
  
  if (limit.count >= 5) { // Max 5 approval requests per hour
    return false;
  }
  
  limit.count++;
  return true;
}

/**
 * Main device approval middleware
 * Should be applied to all API endpoints that require device approval
 */
function deviceApprovalMiddleware(req, res, next) {
  // Session-authenticated requests (dashboard users) do not require device approval.
  // Sessions are protected by CORS + HttpOnly cookies — no agent fingerprinting needed.
  // The dashboard sends both a session cookie AND a Bearer masterToken; if the session
  // is valid, skip device approval regardless of whether a token is also present.
  if (req.authType === 'session' || (req.session && req.session.user)) {
    return next();
  }

  // Extract user context from token metadata ONLY (no session fallback)
  const userId = req.tokenMeta?.ownerId;
  const tokenId = req.tokenMeta?.tokenId;
  const isMasterToken = req.tokenMeta?.tokenType === 'master' || req.tokenMeta?.scope === 'full';
  const tokenKind = isMasterToken ? 'master' : 'guest';
  
  console.log('[Device Approval Middleware]', {
    userId,
    tokenId,
    path: req.path,
    authType: req.authType,
  });
  
  // Skip device check if not a Bearer token
  if (!userId || !tokenId) {
    console.log('[Device Approval] Skipping - not an API token');
    return next();
  }

  // Check if this token requires device approval
  // Tokens without requires_approval=1 (e.g. bundle tokens without the approval checkbox) skip this gate
  try {
    const tokenRow = db.db.prepare('SELECT requires_approval FROM access_tokens WHERE id = ?').get(tokenId);
    if (!tokenRow || !tokenRow.requires_approval) {
      return next(); // token doesn't require approval — pass through
    }
  } catch (_) {
    // If lookup fails, fall through to full device check
  }

  try {
    // Generate fingerprint from request
    const currentFingerprint = DeviceFingerprint.fromRequest(req);
    const fingerprintHash = currentFingerprint.fingerprintHash;

    // Check if device is already approved
    const approvedDevice = db.getApprovedDeviceByHash(userId, fingerprintHash);
    
    if (approvedDevice && !approvedDevice.revoked_at) {
      // Device is approved, update last used
      db.updateDeviceLastUsed(approvedDevice.id);
      
      // Attach device info to request
      req.device = {
        id: approvedDevice.id,
        name: approvedDevice.device_name,
        fingerprint: fingerprintHash,
        approvedAt: approvedDevice.approved_at,
      };
      
      // Set cache-control headers to prevent stale device status
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      return next();
    }

    // Device not approved - return 403 immediately
    // (Do NOT rate limit the rejection itself, only the approval request creation)
    
    // But first, check if approval already pending
    const pendingApprovals = db.getPendingApprovals(userId, tokenId);
    const existingPending = pendingApprovals.find(p => p.device_fingerprint_hash === fingerprintHash);

    // Check rate limit ONLY for new approval requests (not for the 403 response itself)
    const canCreateApproval = checkApprovalRateLimit(tokenId);
    
    if (!existingPending && !canCreateApproval) {
      // RATE LIMITED - but we still return 403 to maintain security posture
      // (The rate limit applies only to creating NEW pending approvals)
      return res.status(403).json({
        error: 'device_not_approved',
        message: 'Device not approved for this token.',
        code: 'DEVICE_NOT_APPROVED',
        token: { kind: tokenKind, name: tokenName },
        approval_pending: false,
        approval_id: null,
      });
    }

    // Get token info for device name generation
    const tokenInfo = db.db.prepare('SELECT label, token_type FROM access_tokens WHERE id = ?').get(tokenId);
    const tokenName = tokenInfo?.label || (isMasterToken ? 'Master Token' : 'Guest Token');

    // Create pending approval if not already exists
    let approvalId = null;
    let isNewApproval = false;
    if (!existingPending) {
      isNewApproval = true;
      approvalId = db.createPendingApproval(
        tokenId,
        userId,
        fingerprintHash,
        currentFingerprint.summary,
        currentFingerprint.fingerprint.ipAddress
      );
      
      // Emit notification and log activity for new device approval request
      const deviceInfo = `${currentFingerprint.summary.os} · ${currentFingerprint.summary.browser}`;
      NotificationService.emitNotification(userId, 'device_approval_requested',
        `New Device Requesting Access (${tokenKind === 'master' ? 'Master Token' : 'Guest Token'}: "${tokenName}")`,
        `A new device is requesting access via ${tokenKind} token "${tokenName}" from ${currentFingerprint.fingerprint.ipAddress}`,
        {
          relatedEntityType: 'device',
          relatedEntityId: approvalId,
          data: {
            deviceInfo,
            ipAddress: currentFingerprint.fingerprint.ipAddress,
            os: currentFingerprint.summary.os,
            browser: currentFingerprint.summary.browser,
            tokenKind,
            tokenName,
          },
          actionUrl: '/dashboard/devices',
        }
      ).catch(err => console.error('Failed to emit device approval notification:', err));
      
      // Log activity
      NotificationService.logActivity(userId, 'device_approval_requested', 'device', {
        resourceId: approvalId,
        resourceName: deviceInfo,
        actorType: 'system',
        details: {
          ip_address: currentFingerprint.fingerprint.ipAddress,
          os: currentFingerprint.summary.os,
          browser: currentFingerprint.summary.browser,
        },
        result: 'pending',
        ipAddress: currentFingerprint.fingerprint.ipAddress,
      });
      
      // Emit alert event for new device approval request (legacy WebSocket)
      if (globalAlertEmitter) {
        globalAlertEmitter.emit('device:pending_approval', {
          userId,
          deviceId: approvalId,
          deviceName: currentFingerprint.summary.os || 'Unknown Device',
          ip: currentFingerprint.fingerprint.ipAddress,
          userAgent: currentFingerprint.summary.browser || 'Unknown',
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      approvalId = existingPending.id;
    }

    // Check for suspicious activity
    const allApprovals = db.getDeviceApprovalHistory(userId, tokenId, 10);
    const suspiciousAnalysis = DeviceFingerprint.analyzeSuspiciousActivity(
      currentFingerprint,
      allApprovals.map(a => ({
        // device_name is a string, not JSON - don't parse it
        summary: a.device_name ? { name: a.device_name } : {},
        fingerprint: { ipAddress: a.ip_address }
      }))
    );

    // Log the approval request
    db.createAuditLog({
      timestamp: new Date().toISOString(),
      requesterId: userId,
      action: 'device_approval_requested',
      resource: 'device',
      scope: tokenId,
      ip: req.ip,
      details: JSON.stringify({
        device_fingerprint: fingerprintHash,
        approval_id: approvalId,
        suspicious: suspiciousAnalysis.suspicious,
        risk_level: suspiciousAnalysis.riskLevel,
        warnings: suspiciousAnalysis.warnings,
      })
    });

    // Trigger notification (will be handled by route handler if needed)
    req.pendingDeviceApproval = {
      approvalId,
      tokenName,
      deviceInfo: currentFingerprint.summary,
      ipAddress: currentFingerprint.fingerprint.ipAddress,
      suspiciousActivity: suspiciousAnalysis,
    };

    // Prevent caching of device approval responses
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    // Return 403 Forbidden with pending approval info
    // Use explicit error codes so frontend can handle appropriately
    return res.status(403).json({
      error: 'device_not_approved',
      code: 'DEVICE_APPROVAL_REQUIRED',
      message: 'This device requires approval to access MyApi',
      token: {
        kind: tokenKind,
        name: tokenName,
      },
      approval: {
        id: approvalId,
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        expiresIn: '24 hours',
      },
      device: currentFingerprint.summary,
      ipAddress: currentFingerprint.fingerprint.ipAddress,
      suspiciousActivity: suspiciousAnalysis.warnings.length > 0 ? suspiciousAnalysis : null,
    });
  } catch (error) {
    console.error('[Device Approval Middleware CRITICAL ERROR]', {
      message: error.message,
      stack: error.stack,
      userId,
      tokenId,
      path: req.path,
    });
    // FAIL CLOSED: On error, DENY access instead of allowing it
    // This is critical for security - we must not let errors bypass the gate
    return res.status(403).json({
      error: 'device_approval_error',
      code: 'DEVICE_APPROVAL_FAILED',
      message: 'Device approval check failed. Please approve this device in Device Management and try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Lightweight device check - only for logging, doesn't block
 * Use this to track device usage without enforcing approvals
 */
function deviceTrackingMiddleware(req, res, next) {
  try {
    const tokenId = req.tokenId;
    const userId = req.userId;
    
    if (!tokenId || !userId) return next();

    const fingerprint = DeviceFingerprint.fromRequest(req);
    
    // Just attach device info to request for logging
    req.deviceFingerprint = fingerprint.fingerprintHash;
    req.deviceSummary = fingerprint.summary;
    
    // Check if approved for logging purposes
    const approved = db.getApprovedDeviceByHash(userId, fingerprint.fingerprintHash);
    if (approved && !approved.revoked_at) {
      db.updateDeviceLastUsed(approved.id);
    }
    
    next();
  } catch (error) {
    console.error('Device tracking middleware error:', error);
    next();
  }
}

/**
 * Optional: Skip device approval for certain routes
 * Use this for public endpoints that shouldn't require device approval
 */
function skipDeviceApproval(req, res, next) {
  req.skipDeviceApproval = true;
  next();
}

module.exports = {
  deviceApprovalMiddleware,
  deviceTrackingMiddleware,
  skipDeviceApproval,
  setAlertEmitter,
};
