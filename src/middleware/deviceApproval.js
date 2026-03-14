const DeviceFingerprint = require('../utils/deviceFingerprint');
const db = require('../database');

/**
 * Device Approval Middleware
 * Checks if the requesting device is approved before allowing API access
 */

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
  // Extract user context from either session or token metadata
  const userId = req.user?.id || req.tokenMeta?.ownerId;
  const tokenId = req.tokenMeta?.tokenId;
  
  // Skip device check if not authenticated
  if (!userId || !tokenId) {
    return next();
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
      
      return next();
    }

    // Device not approved, check if approval already pending
    const pendingApprovals = db.getPendingApprovals(userId, tokenId);
    const existingPending = pendingApprovals.find(p => p.device_fingerprint_hash === fingerprintHash);

    // Check rate limit for new approvals
    const canCreateApproval = checkApprovalRateLimit(tokenId);
    
    if (!existingPending && !canCreateApproval) {
      // Rate limited
      return res.status(429).json({
        error: 'Too many device approval requests',
        message: 'Maximum 5 approval requests per hour allowed',
        retryAfter: 3600,
      });
    }

    // Get token info for device name generation
    const tokenInfo = db.db.prepare('SELECT label FROM access_tokens WHERE id = ?').get(tokenId);
    const tokenName = tokenInfo?.label || 'MyApi';

    // Create pending approval if not already exists
    let approvalId = null;
    if (!existingPending) {
      approvalId = db.createPendingApproval(
        tokenId,
        userId,
        fingerprintHash,
        currentFingerprint.summary,
        currentFingerprint.fingerprint.ipAddress
      );
    } else {
      approvalId = existingPending.id;
    }

    // Check for suspicious activity
    const allApprovals = db.getDeviceApprovalHistory(userId, tokenId, 10);
    const suspiciousAnalysis = DeviceFingerprint.analyzeSuspiciousActivity(
      currentFingerprint,
      allApprovals.map(a => ({
        summary: a.device_name ? JSON.parse(a.device_name || '{}') : {},
        fingerprint: { ipAddress: a.ip_address }
      }))
    );

    // Log the approval request
    db.createAuditLog(
      userId,
      'device_approval_requested',
      'device',
      tokenId,
      req.ip,
      JSON.stringify({
        device_fingerprint: fingerprintHash,
        approval_id: approvalId,
        suspicious: suspiciousAnalysis.suspicious,
        risk_level: suspiciousAnalysis.riskLevel,
        warnings: suspiciousAnalysis.warnings,
      })
    );

    // Trigger notification (will be handled by route handler if needed)
    req.pendingDeviceApproval = {
      approvalId,
      tokenName,
      deviceInfo: currentFingerprint.summary,
      ipAddress: currentFingerprint.fingerprint.ipAddress,
      suspiciousActivity: suspiciousAnalysis,
    };

    // Return 403 with pending approval info
    return res.status(403).json({
      error: 'device_not_approved',
      message: 'This device requires approval to access MyApi',
      approval: {
        id: approvalId,
        status: 'pending',
        expiresIn: '24 hours',
      },
      device: currentFingerprint.summary,
      ipAddress: currentFingerprint.fingerprint.ipAddress,
      suspiciousActivity: suspiciousAnalysis.warnings.length > 0 ? suspiciousAnalysis : null,
    });
  } catch (error) {
    console.error('Device approval middleware error:', error);
    // Don't block on middleware errors, just log and continue
    return next();
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
};
