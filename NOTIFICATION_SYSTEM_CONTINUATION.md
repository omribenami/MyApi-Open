# Notification System - Continuation Guide

**Last Updated**: 2026-03-18 (Session ongoing)
**Status**: Phases 1-6 Complete - Ready for Testing & Remaining Event Hooks

---

## What's Been Done (Phases 1-6)

### Phase 1: Database & Backend ✅
- **Commit**: 5b85af7
- **Files**:
  - `src/database.js` - Added tables + functions
  - `src/services/notificationService.js` - Notification emission service
  - `src/routes/notifications.js` - Notification API endpoints
  - `src/routes/activity.js` - Activity log API endpoints
- **Tables Created**:
  - `notifications` - User notifications (60-day retention)
  - `notification_settings` - Per-user per-event settings
  - `activity_log` - Audit trail of all events
  - `email_queue` - Pending emails for async delivery

### Phase 2: Activity Log Page ✅
- **Commit**: 9d93825
- **File**: `src/public/dashboard-app/src/pages/ActivityLog.jsx`
- **Route**: `/dashboard/activity`
- **Features**:
  - Real-time WebSocket updates
  - Filters: action type, resource type, result, date range
  - Full-text search
  - Infinite scroll pagination

### Phase 3: Notification Center ✅
- **Commit**: 55799b1
- **Files**:
  - `src/public/dashboard-app/src/pages/NotificationCenter.jsx`
  - `src/public/dashboard-app/src/stores/notificationStore.js`
  - `src/public/dashboard-app/src/components/Toast.jsx`
- **Route**: `/dashboard/notifications`
- **Features**:
  - Notification bell icon (header)
  - Filter by type/status
  - Mark as read, delete
  - Toast notifications

### Phase 4: Settings Page ✅
- **Commit**: 2fe13bf
- **File**: `src/public/dashboard-app/src/components/NotificationSettings.jsx`
- **Features**:
  - Per-event toggles (web + email)
  - Email digest options (immediate, daily, weekly, disabled)
  - Bulk enable/disable

### Phase 5: Email Service ✅
- **Commit**: d160ac2
- **Files**:
  - `src/services/emailService.js` - EmailService class
  - `src/routes/email.js` - Email processing endpoints
- **Configuration**:
  - SMTP mode (Gmail, Outlook, custom)
  - SendGrid mode (via SMTP relay)
  - Configurable via env vars
- **Endpoints**:
  - `POST /api/v1/email/process` - Trigger email queue processing
  - `GET /api/v1/email/test` - Test email config

### Phase 6: Event Hooks (Device Events) ✅
- **Commit**: 10651c4
- **Files Modified**:
  - `src/middleware/deviceApproval.js` - Device approval request hook
  - `src/routes/devices.js` - Device approve/revoke hooks
- **Events Hooked**:
  - `device_approval_requested` - New device attempting login
  - `device_approved` - User approved a device
  - `device_revoked` - User revoked device access

---

## What's NOT Done Yet (Phases 7+)

### Phase 7: Remaining Event Hooks (TODO)

These 6 notification types are NOT YET hooked:

1. **skill_liked** - When user/AI likes a skill
   - Location: Unknown (need to search for skill like endpoint)
   - Hook: After skill is liked in DB
   - Notification: "Someone liked your skill 'X'"

2. **skill_used** - When skill is executed
   - Location: Unknown (skill execution endpoint)
   - Hook: After skill runs successfully
   - Notification: "Skill 'X' was executed by User Y"

3. **persona_invoked** - When persona is used
   - Location: Unknown (persona call endpoint)
   - Hook: After persona execution
   - Notification: "Persona 'X' was invoked by User Y"

4. **guest_token_used** - When guest token makes API call
   - Location: `src/middleware/auth.js` or `src/routes/api.js`
   - Hook: Before/after guest token request
   - Notification: "Guest token 'X' was used: /endpoint"

5. **token_revoked** - When any token is revoked
   - Location: Unknown (token revoke endpoint)
   - Hook: After token revocation
   - Notification: "Your token 'X' was revoked"

6. **service_connected** - When OAuth service is connected
   - Location: Unknown (OAuth callback endpoint)
   - Hook: After OAuth token stored
   - Notification: "GitHub connected successfully"

### Phase 8: Testing (TODO)
- [ ] Test email delivery (SMTP/SendGrid)
- [ ] Test notification creation and delivery
- [ ] Test activity log recording
- [ ] Test notification settings preferences
- [ ] Test WebSocket real-time updates
- [ ] Load test email queue with bulk emails

### Phase 9: Production Setup (TODO)
- [ ] Configure email provider (SendGrid/SMTP)
- [ ] Setup cron job: Call `/api/v1/email/process` every 5 minutes
- [ ] Setup monitoring for email queue failures
- [ ] Setup monitoring for activity log size (60-day cleanup)
- [ ] Configure notification retention policy
- [ ] Test notification delivery on production

---

## How to Continue

### Step 1: Hook Remaining Events

For each event type, you need to:

1. **Find the endpoint** where the action happens
2. **Import** NotificationService
3. **Call** NotificationService.emitNotification() with:
   - userId
   - notification type
   - title
   - message
   - options (relatedEntityType, relatedEntityId, data, actionUrl)
4. **Call** NotificationService.logActivity() for audit trail

### Example: Hooking Skill Liked Event

```javascript
// In skill routes (need to find exact file)
const NotificationService = require('../services/notificationService');

// After skill is liked:
NotificationService.emitNotification(
  userId,
  'skill_liked',
  'Skill Liked',
  `User ${userName} liked your skill "${skillName}"`,
  {
    relatedEntityType: 'skill',
    relatedEntityId: skillId,
    data: { skillName, userName, userAvatar },
    actionUrl: `/dashboard/skills/${skillId}`,
  }
).catch(err => console.error('Failed to emit skill_liked notification:', err));

NotificationService.logActivity(userId, 'skill_liked', 'skill', {
  resourceId: skillId,
  resourceName: skillName,
  actorType: 'user',
  actorId: likedByUserId,
  actorName: userName,
  result: 'success',
});
```

### Step 2: Test Email Service

```bash
# Test SMTP/SendGrid config
curl -X GET http://localhost:4500/api/v1/email/test \
  -H "Authorization: Bearer <admin-token>"

# Response should be:
# { "success": true }

# Trigger email processing
curl -X POST http://localhost:4500/api/v1/email/process \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# Response shows: { "sent": X, "failed": Y }
```

### Step 3: Setup Cron Job

**Linux/Mac (crontab)**:
```bash
# Every 5 minutes, process pending emails
*/5 * * * * curl -X POST http://localhost:4500/api/v1/email/process \
  -H "X-Internal-Key: your-internal-key" \
  -H "Content-Type: application/json" \
  -d '{"limit": 50}'
```

**Docker/Kubernetes**:
Create a sidecar job that calls the email endpoint periodically.

### Step 4: Environment Variables

Add to `.env`:
```bash
# Email Configuration
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Gmail App Password, not regular password
EMAIL_FROM=noreply@myapiai.com

# OR for SendGrid:
# EMAIL_PROVIDER=sendgrid
# SENDGRID_API_KEY=SG.xxxxxxxxxxxxx

# Internal Processing
INTERNAL_PROCESS_KEY=secret-key-for-cron-jobs
```

---

## API Routes Summary

### Notifications
- `GET /api/v1/notifications` - List notifications (paginated)
- `GET /api/v1/notifications/unread` - Get unread count
- `POST /api/v1/notifications/:id/read` - Mark as read
- `DELETE /api/v1/notifications/:id` - Delete notification
- `GET /api/v1/notifications/settings` - Get user settings
- `PUT /api/v1/notifications/settings` - Update settings

### Activity Log
- `GET /api/v1/activity` - List activities (with filters)
- `GET /api/v1/activity/summary` - Get 24h summary

### Email
- `POST /api/v1/email/process` - Process pending emails
- `GET /api/v1/email/test` - Test email config

---

## Database Schema Quick Reference

### notifications
```sql
SELECT * FROM notifications 
WHERE user_id = 'user-id' 
AND expires_at > datetime('now')
ORDER BY created_at DESC;
```

### notification_settings
```sql
-- All 9 event types:
-- device_approval_requested_web/email
-- device_approved_web/email
-- device_revoked_web/email
-- skill_liked_web/email
-- skill_used_web/email
-- persona_invoked_web/email
-- guest_token_used_web/email
-- token_revoked_web/email
-- service_connected_web/email

-- Plus email digest settings:
-- email_digest_type: immediate|daily|weekly|disabled
-- email_digest_time: 09:00 (for daily/weekly)
-- email_digest_day: monday (for weekly)
```

### activity_log
```sql
SELECT * FROM activity_log
WHERE user_id = 'user-id'
ORDER BY created_at DESC
LIMIT 50;

-- Filter by action: token_used, skill_executed, device_approved, etc
-- Filter by result: success, failure, pending
```

### email_queue
```sql
SELECT * FROM email_queue
WHERE status = 'pending'
ORDER BY created_at ASC;

-- Statuses: pending, sent, failed
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/database.js` | Notification CRUD functions |
| `src/services/notificationService.js` | Core notification logic + email templates |
| `src/services/emailService.js` | Email sending (SMTP/SendGrid) |
| `src/routes/notifications.js` | API endpoints for notifications |
| `src/routes/activity.js` | API endpoints for activity log |
| `src/routes/email.js` | API endpoints for email processing |
| `src/routes/devices.js` | Device event hooks |
| `src/middleware/deviceApproval.js` | Device approval request hook |
| `src/public/dashboard-app/src/pages/ActivityLog.jsx` | Activity log UI |
| `src/public/dashboard-app/src/pages/NotificationCenter.jsx` | Notification center UI |
| `src/public/dashboard-app/src/components/NotificationSettings.jsx` | Settings UI |
| `src/public/dashboard-app/src/stores/notificationStore.js` | Zustand state management |

---

## Testing Checklist

- [ ] Device approval request creates notification
- [ ] Device approval request sends email
- [ ] Device approved notification works
- [ ] Device revoked notification works
- [ ] User can toggle notification channels
- [ ] Email digest options work
- [ ] Activity log shows all events
- [ ] WebSocket real-time updates work
- [ ] Notification bell badge updates
- [ ] Email queue processes successfully
- [ ] Failed emails marked as failed (not retried forever)
- [ ] 60-day notification expiration works
- [ ] Unread count accuracy

---

## Git Commits Reference

```bash
5b85af7 - feat(notifications): Phase 1 - Database schema and backend API
9d93825 - feat(activity-log): Phase 2 - Activity Log page
55799b1 - feat(notification-center): Phase 3 - Notification Center UI
2fe13bf - feat(notification-settings): Phase 4 - Settings page
d160ac2 - feat(email-service): Phase 5 - Email sending infrastructure
10651c4 - feat(event-hooks): Phase 6 - Device event notifications
98eed78 - docs(status): Update implementation status
```

To see all changes:
```bash
git log --oneline | grep -E "(Phase|notifications|activity|email)"
```

---

## Notes for Next Session

1. **Most Important**: Hook the 6 remaining event types (skill_liked, skill_used, persona_invoked, guest_token_used, token_revoked, service_connected)

2. **Second Priority**: Test email delivery with real SMTP provider (SendGrid recommended)

3. **Third Priority**: Setup cron job for email processing

4. **Performance Note**: Database indexes created on:
   - `notifications(user_id, created_at)`
   - `activity_log(user_id, created_at)`
   - `email_queue(status)`
   - These help with pagination and filtering

5. **Security Note**: Email service requires `INTERNAL_PROCESS_KEY` env var for cron job calls to `/api/v1/email/process`

---

**Session End Marker**: If tokens run out, all work is committed to git and fully documented above.
