# Notification System Documentation

Complete guide to MyApi's notification system, including event types, user preferences, and integration points.

---

## Overview

MyApi automatically sends notifications for important events:
- Service connections/disconnections (OAuth)
- Team invitations
- Security events (2FA, new devices, device revocation)
- Billing events (quota warnings, failed payments)
- Agent access requests
- Skill installations/removals

Notifications **respect user preferences** — users can control:
- Which events notify them
- How they're notified (in-app, email, or both)
- Notification frequency

---

## Notification Events

### Services (OAuth)

| Event | Type | Default Channels | Severity |
|-------|------|------------------|----------|
| Service Connected | `oauth_connected` | in-app, email | info |
| Service Disconnected | `oauth_disconnected` | in-app, email | warning |

**When it triggers:** User successfully connects or disconnects an OAuth service (Google, GitHub, Slack, etc.)

### Team & Collaboration

| Event | Type | Default Channels | Severity |
|-------|------|------------------|----------|
| Team Member Invited (sent) | `team_invite_sent` | in-app | info |
| Team Invitation Received | `team_invitation` | in-app, email | info |
| Team Invitation Accepted | `team_invite_accepted` | in-app | info |

**When it triggers:** Team members are invited, invitations are accepted.

### Security

| Event | Type | Default Channels | Severity |
|-------|------|------------------|----------|
| New Device Login | `security_new_device` | in-app, email | warning |
| 2FA Enabled | `security_2fa_enabled` | in-app | info |
| 2FA Disabled | `security_2fa_disabled` | in-app, email | warning |
| Device Approved | `security_device_approved` | in-app | info |
| Device Revoked | `security_device_revoked` | in-app, email | warning |

**When it triggers:** Security-related account changes.

### Billing

| Event | Type | Default Channels | Severity |
|-------|------|------------------|----------|
| Quota Warning (80%+) | `billing_quota_warning` | in-app, email | warning |
| Quota Exceeded | `billing_quota_exceeded` | in-app, email | critical |
| Subscription Upgraded | `billing_subscription_upgraded` | in-app | info |
| Billing Failure | `billing_failure` | in-app, email | critical |

**When it triggers:** API usage or billing changes.

### Skills

| Event | Type | Default Channels | Severity |
|-------|------|------------------|----------|
| Skill Installed | `skill_installed` | in-app | info |
| Skill Removed | `skill_removed` | in-app | info |

**When it triggers:** Workspace skills are added or removed.

### Agents

| Event | Type | Default Channels | Severity |
|-------|------|------------------|----------|
| Agent Approval Requested | `agent_approval_request` | in-app, email | info |

**When it triggers:** An AI agent requests access to your MyApi services for the first time.

---

## User Preferences

### Where to Manage Notifications

Users can configure notifications in:
- **Dashboard:** `/dashboard/settings/notifications`
- **API:** `GET/POST /api/v1/notifications/preferences`

### Preference Structure

```javascript
{
  workspace_id: "ws_123",
  user_id: "user_456",
  channel: "email",           // or "in-app"
  enabled: 1,                 // 1 = enabled, 0 = disabled
  frequency: "immediate"      // "immediate" or "daily_digest"
}
```

### Default Behavior

- **In-app:** Enabled by default
- **Email:** Enabled by default (if email configured)
- **Users can disable** any channel for any event type

### API Examples

**Get notification preferences:**
```bash
curl -X GET https://www.myapiai.com/api/v1/notifications/preferences \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
```

**Disable email notifications for a specific channel:**
```bash
curl -X PUT https://www.myapiai.com/api/v1/notifications/preferences/email \
  -H "Authorization: Bearer {token}" \
  -d '{
    "enabled": false
  }'
```

**Get unread notification count:**
```bash
curl -X GET https://www.myapiai.com/api/v1/notifications/unread-count \
  -H "Authorization: Bearer {token}"
```

**Mark notification as read:**
```bash
curl -X POST https://www.myapiai.com/api/v1/notifications/{id}/read \
  -H "Authorization: Bearer {token}"
```

---

## How Notifications Are Delivered

### In-App Notifications

- **Stored in database** — Persisted in `notifications` table
- **Fetched on demand** — `GET /api/v1/notifications`
- **Marked as read** — Stays in DB but marked read
- **Expire after 30 days** — Old notifications auto-deleted

### Email Notifications

- **Configured via** `.env` (SendGrid, Resend, or Mailgun)
- **Queued for delivery** — `notification_queue` table
- **Retries** — 3 automatic retries on failure
- **Logs** — Delivery status in `notification_queue` table

### Configuration

Set up email delivery in `.env`:

```bash
# Using Resend (recommended)
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=notifications@myapiai.com
EMAIL_FROM_NAME=MyApi

# OR Using SendGrid
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
EMAIL_FROM=notifications@myapiai.com
EMAIL_FROM_NAME=MyApi

# OR Using Mailgun
EMAIL_PROVIDER=mailgun
MAILGUN_API_KEY=key-xxxxxxxxxxxxx
MAILGUN_DOMAIN=mg.myapiai.com
EMAIL_FROM=notifications@myapiai.com
EMAIL_FROM_NAME=MyApi
```

---

## Implementation for Developers

### Adding a New Notification Event

1. **Define the event type** in `NotificationDispatcher.notificationTypes`:

```javascript
static notificationTypes = {
  'my_new_event': { 
    channels: ['in-app', 'email'], 
    category: 'my-category', 
    severity: 'info' 
  }
};
```

2. **Create an event handler method** in `NotificationDispatcher`:

```javascript
static async onMyNewEvent(workspaceId, userId, eventData) {
  const title = 'My Event Title';
  const message = `Event message for user`;
  return this.dispatch(workspaceId, userId, 'my_new_event', title, message, eventData);
}
```

3. **Call the handler** when the event occurs:

```javascript
const NotificationDispatcher = require('../lib/notificationDispatcher');
const ws = getWorkspaces(userId);
if (ws?.length) {
  NotificationDispatcher.onMyNewEvent(ws[0].id, userId, eventData)
    .catch(err => console.error('Notification error:', err));
}
```

### The Dispatch Process

```
User triggers event (e.g., connects OAuth service)
    ↓
NotificationDispatcher.onServiceConnected() called
    ↓
Gets user's preferences from notification_preferences table
    ↓
Filters enabled channels (e.g., [in-app, email])
    ↓
Creates notification in DB
    ↓
Queues for delivery on enabled channels
    ↓
Email worker processes queue and sends
```

### Respecting Preferences

The dispatcher **automatically** respects user preferences:

```javascript
// User has disabled email for this event type
// The dispatcher will only queue for in-app

// The dispatch method:
const enabledChannels = this.getUserChannelPreferences(
  workspaceId, 
  userId, 
  ['in-app', 'email']
);
// Returns: { 'in-app': true, 'email': false }

// Only queues enabled channels
queueNotificationForDelivery(notificationId, ['in-app']);
```

---

## Database Schema

### notifications table
```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,                  -- Event type (e.g., 'oauth_connected')
  title TEXT NOT NULL,
  message TEXT,
  data TEXT,                            -- JSON: extra event data
  is_read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,                   -- 30 days after creation
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

### notification_preferences table
```sql
CREATE TABLE notification_preferences (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL,                -- 'in-app' or 'email'
  enabled INTEGER DEFAULT 1,            -- 1 = enabled, 0 = disabled
  frequency TEXT DEFAULT 'immediate',   -- 'immediate' or 'daily_digest'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(workspace_id, user_id, channel)
);
```

### notification_queue table
```sql
CREATE TABLE notification_queue (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  channel TEXT NOT NULL,                -- 'in-app' or 'email'
  status TEXT DEFAULT 'pending',        -- 'pending', 'sent', 'failed'
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  sent_at INTEGER,
  next_retry_at INTEGER,
  created_at INTEGER NOT NULL
);
```

---

## Testing Notifications

### Manual Test: Team Invitation
```bash
# 1. Create second test user
# 2. Invite them to your workspace
# 3. Check notifications: GET /api/v1/notifications
```

### Manual Test: Service Connection
```bash
# 1. Connect Google OAuth
# 2. Check notifications: GET /api/v1/notifications
# 3. Should see 'oauth_connected' event
```

### Manual Test: 2FA
```bash
# 1. Enable 2FA on account
# 2. Check notifications
# 3. Should see 'security_2fa_enabled'
```

### Email Delivery (if configured)
```bash
# 1. Set up SendGrid/Resend in .env
# 2. Check notification_queue table
# 3. Should see email delivery attempts
# 4. Check SendGrid/Resend dashboard for delivery stats
```

---

## Troubleshooting

### "I'm not getting any notifications"

**Check 1: Preferences enabled?**
```bash
GET /api/v1/notifications/preferences
```
Make sure `enabled: 1` for your channel.

**Check 2: Email configured?**
If expecting email, check `.env`:
- `EMAIL_PROVIDER` set?
- `SENDGRID_API_KEY` or `RESEND_API_KEY` present?

**Check 3: Database**
```sql
SELECT * FROM notifications WHERE user_id = 'your_user_id' ORDER BY created_at DESC LIMIT 5;
```
Check if notifications are being created at all.

### "Email notifications not arriving"

**Check delivery queue:**
```sql
SELECT * FROM notification_queue WHERE status = 'failed' LIMIT 5;
```

**Check logs:**
```bash
grep -i "sendgrid\|email\|resend" server.log | tail -20
```

**Check provider account:**
- SendGrid: Check "Mail Settings" → "Sender Authentication"
- Resend: Check "Domains" configuration
- Mailgun: Check domain verification status

### "Can't disable notifications"

Make sure you're calling the right endpoint:
```bash
# WRONG (this won't work)
POST /api/v1/notifications/disable

# CORRECT (preferences endpoint)
PUT /api/v1/notifications/preferences/email
{
  "enabled": false
}
```

---

## Performance Notes

- **In-app notifications:** Instant (DB write)
- **Email notifications:** Async queue, 5-30 second delivery
- **Cleanup:** Old notifications (30+ days) auto-deleted nightly
- **Query optimization:** Indexed on (workspace_id, user_id, created_at)

---

## Related Docs

- [API_DETAILED.md](./API_DETAILED.md) — Notifications endpoints
- [AGENT_APPROVAL_INTEGRATION.md](./AGENT_APPROVAL_INTEGRATION.md) — Agent approval notifications
