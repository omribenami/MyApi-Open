# Device Approval System

## Overview

The Device Approval System is a security feature that requires users to approve new devices before they can access MyApi tokens. This prevents unauthorized access in case of token leakage and adds an additional layer of security through device-based authentication.

## Architecture

### Components

1. **Device Fingerprinting** (`src/utils/deviceFingerprint.js`)
   - Generates unique, collision-resistant device identifiers
   - Uses SHA256 hashing for cryptographic security
   - Captures: OS, browser, hostname, MAC address, IP address
   - Deterministic: Same device generates same fingerprint consistently

2. **Database** (`src/database.js`)
   - `approved_devices` table: Tracks approved devices per user/token
   - `device_approvals_pending` table: Queues new device approval requests
   - Automatic 24-hour expiration for pending approvals
   - Audit trail with timestamps for compliance

3. **Middleware** (`src/middleware/deviceApproval.js`)
   - Intercepts every API request
   - Checks device fingerprint against approved list
   - Returns 403 if device not approved
   - Rate limits: Max 5 approval requests per token per hour
   - Triggers notifications for pending approvals

4. **API Routes** (`src/routes/devices.js`)
   - Device management endpoints
   - Approval workflow endpoints
   - Activity logging endpoints

5. **Frontend** (`src/public/dashboard-app/src/pages/DeviceManagement.jsx`)
   - Device Management dashboard with 3 tabs:
     - **Approved Devices**: View, rename, revoke devices
     - **Pending Approvals**: Approve or deny new devices
     - **Activity Log**: Timeline of device actions

## Database Schema

### approved_devices Table

```sql
CREATE TABLE approved_devices (
  id TEXT PRIMARY KEY,
  token_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_fingerprint_hash TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  device_info_json TEXT,
  ip_address TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (token_id) REFERENCES access_tokens(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_approved_devices_user_token ON approved_devices(user_id, token_id);
CREATE INDEX idx_approved_devices_fingerprint ON approved_devices(device_fingerprint_hash);
```

### device_approvals_pending Table

```sql
CREATE TABLE device_approvals_pending (
  id TEXT PRIMARY KEY,
  device_fingerprint TEXT NOT NULL,
  device_fingerprint_hash TEXT NOT NULL,
  token_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  device_info_json TEXT,
  ip_address TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  approved_at TEXT,
  denied_at TEXT,
  denial_reason TEXT,
  FOREIGN KEY (token_id) REFERENCES access_tokens(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_pending_approvals_user ON device_approvals_pending(user_id);
CREATE INDEX idx_pending_approvals_status ON device_approvals_pending(status);
CREATE INDEX idx_pending_approvals_expires ON device_approvals_pending(expires_at);
```

### audit_log Table (Extended)

```sql
-- Added column:
ALTER TABLE audit_log ADD COLUMN device_id TEXT;
```

## API Endpoints

### Device Fingerprinting

#### POST /api/v1/devices/fingerprint
Generate device fingerprint for current device.

**Authentication**: Required (Bearer token)

**Response**:
```json
{
  "fingerprint": "abc123...",
  "summary": {
    "os": "Windows",
    "browser": "Chrome",
    "hostname": "my-laptop",
    "ipAddress": "192.168.1.100"
  },
  "rawData": { ... }
}
```

### Approved Devices

#### GET /api/v1/devices/approved
Get all approved devices for the user.

**Authentication**: Required

**Query Parameters**:
- `token_id` (optional): Filter by specific token

**Response**:
```json
{
  "devices": [
    {
      "id": "device_abc123...",
      "name": "Work Laptop",
      "fingerprint": "hash...",
      "ip": "192.168.1.100",
      "tokenId": "token_xyz",
      "approvedAt": "2024-03-13T18:00:00Z",
      "lastUsedAt": "2024-03-13T19:30:00Z",
      "info": { "os": "Windows", "browser": "Chrome" }
    }
  ],
  "total": 1
}
```

#### GET /api/v1/devices/:device_id
Get details of a specific device.

**Authentication**: Required

**Response**:
```json
{
  "id": "device_abc123...",
  "name": "Work Laptop",
  "fingerprint": "hash...",
  "ip": "192.168.1.100",
  "tokenId": "token_xyz",
  "approvedAt": "2024-03-13T18:00:00Z",
  "lastUsedAt": "2024-03-13T19:30:00Z",
  "revokedAt": null,
  "info": { "os": "Windows", "browser": "Chrome" }
}
```

#### POST /api/v1/devices/:device_id/rename
Rename an approved device.

**Authentication**: Required

**Request Body**:
```json
{
  "name": "New Device Name"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Device renamed successfully"
}
```

#### POST /api/v1/devices/:device_id/revoke
Revoke device access immediately.

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "message": "Device revoked successfully. It will need to be re-approved to access MyApi."
}
```

### Pending Approvals

#### GET /api/v1/devices/approvals/pending
Get pending device approval requests.

**Authentication**: Required

**Query Parameters**:
- `token_id` (optional): Filter by specific token

**Response**:
```json
{
  "approvals": [
    {
      "id": "approval_xyz...",
      "deviceInfo": { "os": "macOS", "browser": "Safari" },
      "ip": "10.0.0.1",
      "tokenId": "token_abc",
      "createdAt": "2024-03-13T20:00:00Z",
      "expiresAt": "2024-03-14T20:00:00Z",
      "status": "pending"
    }
  ],
  "total": 1
}
```

#### POST /api/v1/devices/approve/:approval_id
Approve a pending device.

**Authentication**: Required

**Request Body**:
```json
{
  "device_name": "Home MacBook"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Device approved successfully",
  "deviceId": "device_new123..."
}
```

#### POST /api/v1/devices/deny/:approval_id
Deny a pending device approval.

**Authentication**: Required

**Request Body**:
```json
{
  "reason": "This device is not recognized"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Device approval request denied"
}
```

### Activity Log

#### GET /api/v1/devices/activity/log
Get device activity log for the user.

**Authentication**: Required

**Query Parameters**:
- `token_id` (optional): Filter by specific token
- `limit` (optional, default 100): Max results to return

**Response**:
```json
{
  "activity": [
    {
      "id": "device_abc123...",
      "type": "approved",
      "action": "approval",
      "deviceName": "Work Laptop",
      "ip": "192.168.1.100",
      "timestamp": "2024-03-13T18:00:00Z"
    },
    {
      "id": "approval_xyz...",
      "type": "denied",
      "action": "denied",
      "deviceName": "Device Request",
      "ip": "203.0.113.1",
      "timestamp": "2024-03-13T19:00:00Z"
    }
  ],
  "total": 2
}
```

## Device Fingerprinting Details

### Components Used

The fingerprint is generated from:

1. **User Agent**: Browser/client type and version
2. **Accept-Language**: Language preferences
3. **IP Address**: Client's public IP (for reference only, not hashed)
4. **Platform**: Operating system (from headers or User Agent parsing)
5. **Hostname**: Device hostname
6. **MAC Address**: Device MAC address (if available)

### Collision Resistance

- Uses SHA256 hashing for cryptographic security
- Deterministic: Same device always produces same hash
- 256-bit hash space makes collisions statistically impossible
- Time-safe comparison prevents timing attacks

### Privacy

- Only the hash is stored, not raw device data
- Raw data available in approved_devices.device_info_json for user reference
- No persistent tracking across unrelated services
- User can delete/revoke devices at any time

## Security Features

### 1. Rate Limiting
- Max 5 approval requests per token per hour
- Returns 429 (Too Many Requests) if exceeded
- Prevents brute force approval requests

### 2. Automatic Expiration
- Pending approvals expire after 24 hours
- Expired approvals automatically cleaned up after 7 days
- Forces users to actively respond to approval requests

### 3. Revocation
- Revoked devices must be re-approved (no cache bypass)
- Immediate effect - no grace period
- Audit trail records all revocations

### 4. Suspicious Activity Detection
- Detects OS changes (e.g., Windows to macOS)
- Detects browser changes (e.g., Chrome to Firefox)
- Detects multiple IP addresses in short time
- Categorizes risk levels: new, low, medium, high

### 5. Audit Trail
- All device actions logged in audit_log
- Timestamps for compliance
- User ID and device ID for traceability
- IP address for forensics

## User Guide

### Approving a New Device

1. When a new device requests access, you'll receive a notification
2. Go to **Dashboard → Device Management → Pending Approvals**
3. Review the device info (OS, browser, IP, timestamp)
4. Enter a device name (e.g., "Home Laptop", "Mobile Phone")
5. Click **Approve** to allow access

### Managing Approved Devices

1. Go to **Dashboard → Device Management → Approved Devices**
2. View all devices currently approved
3. **Rename**: Click the "Rename" button to change device name
4. **Revoke**: Click "Revoke Access" to immediately block a device
5. **View Details**: See OS, browser, IP, approval date, last used time

### Understanding the Activity Log

1. Go to **Dashboard → Device Management → Activity Log**
2. See timeline of all device-related events
3. Filter by token or time period
4. Track approvals, denials, and revocations

### Security Best Practices

1. **Review New Devices Carefully**
   - Check if the OS and browser match your devices
   - Verify the IP makes sense for your location
   - Be suspicious of multiple new devices at once

2. **Revoke Old Devices**
   - Regularly review approved devices
   - Remove devices you no longer use
   - Immediately revoke if device is lost or stolen

3. **Use Device Names**
   - Give devices descriptive names (e.g., "Work MacBook 2024")
   - Makes it easier to identify and manage devices
   - Helps spot unauthorized devices

4. **Monitor Activity**
   - Check activity log regularly
   - Look for unusual patterns
   - Report suspicious activity immediately

## Implementation Details

### Middleware Integration

The device approval middleware is applied to all API requests:

```javascript
app.use('/api/v1', authenticate); // Auth middleware
app.use('/api/v1', deviceApprovalMiddleware); // Device check
app.use('/api/v1', apiRoutes); // API endpoints
```

### Request Flow for New Device

1. Client sends API request with Bearer token
2. `authenticate` middleware validates token
3. `deviceApprovalMiddleware` extracts device fingerprint
4. Checks if device is approved
5. If not approved:
   - Creates pending approval record
   - Adds pending approval to request context
   - Returns 403 with approval details
   - Route handler triggers notification
6. If approved:
   - Updates last_used_at timestamp
   - Attaches device info to request
   - Proceeds to API endpoint

### Notification Integration

When a new device requests approval:

```javascript
if (req.pendingDeviceApproval) {
  // Send notification to user
  const { approvalId, tokenName, deviceInfo, ipAddress } = req.pendingDeviceApproval;
  
  // Example: Send WhatsApp message
  await sendNotification({
    message: `New device requesting MyApi access: ${deviceInfo.os} from ${ipAddress}. Token: ${tokenName}. Approve: [link]`,
    userId: req.userId,
    approvalId,
  });
}
```

## Troubleshooting

### "Device Not Approved" Error

**Issue**: Getting 403 errors with "device_not_approved"

**Solution**:
1. Check Device Management → Pending Approvals
2. If you see a pending request, approve it
3. If no pending request, check if device was denied
4. Try again with a new request

### Fingerprint Changes

**Issue**: Same device generates different fingerprints

**Possible Causes**:
- Changed browser (Chrome → Firefox)
- Updated OS or browser version
- Connected from different IP
- Changed network (WiFi → Mobile)

**Solution**:
1. Device will show as new with different fingerprint
2. Approve the new fingerprint
3. Old fingerprint can be revoked if not needed

### Can't Approve Device

**Issue**: Approval link expired or not working

**Solution**:
1. New devices must be approved within 24 hours
2. If expired, the device will need to request approval again
3. Try accessing MyApi from the device again

## Testing

Run the test suite:

```bash
npm test -- src/tests/deviceApproval.test.js
```

Tests cover:
- Fingerprint generation and consistency
- Device approval workflow
- Pending approval management
- Suspicious activity detection
- Database operations
- Edge cases and error handling

## Performance Considerations

### Database Indexes

Three indexes optimize common queries:
- `idx_approved_devices_user_token`: Fast lookup for user's devices
- `idx_approved_devices_fingerprint`: Fast fingerprint verification
- `idx_pending_approvals_user`: Fast pending approval queries
- `idx_pending_approvals_status`: Fast status-based filtering
- `idx_pending_approvals_expires`: Fast expiration cleanup

### Query Optimization

- Fingerprint check is O(1) via hash lookup
- Pending approval creation is O(1)
- Activity log retrieval uses LIMIT clause
- Cleanup process batches deletes

### Scalability

For production with high volume:
1. Move rate limit tracking to Redis
2. Use job queue for approval notifications
3. Archive old audit logs to separate database
4. Consider sharding user device data

## Compliance

### Audit Trail

All device actions are logged:
- Device approvals
- Device denials
- Device revocations
- Device renames
- Suspicious activity

### Data Retention

- Pending approvals: 24 hours (auto-cleanup after 7 days)
- Approved devices: Until revoked (indefinite)
- Audit logs: Indefinite (for compliance)
- Activity log: User can view full history

### Privacy

- Fingerprints are hashed (not reversible)
- Users can see and manage their devices
- Users can delete/revoke any device
- Device info is stored for user reference only

## Future Enhancements

### Potential Features

1. **Device Trust Levels**
   - Auto-approve "trusted" devices
   - Extended trust period for frequently used devices

2. **Geolocation Verification**
   - Validate IP geolocation matches user history
   - Alert on impossible travel (too fast between locations)

3. **Biometric Integration**
   - Optional: Require biometric confirmation for approval
   - WebAuthn/FIDO2 support

4. **Hardware Token Support**
   - Hardware security keys (YubiKey, etc.)
   - TPM (Trusted Platform Module) integration

5. **Advanced Analytics**
   - Machine learning for anomaly detection
   - Behavioral analysis
   - Risk scoring

6. **Multi-Factor Approval**
   - Require email + SMS for approval
   - Approval codes sent via separate channel

7. **Device Groups**
   - Create device groups (work, personal, mobile)
   - Per-group access controls
   - Batch revocation

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the activity log for details
3. Check audit logs for system events
4. Contact support with device ID if needed

---

**Version**: 1.0
**Last Updated**: March 13, 2024
**Maintainer**: MyApi Team
