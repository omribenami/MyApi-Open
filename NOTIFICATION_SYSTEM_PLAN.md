# MyApi Notification & Activity Log System - Architecture Plan

## Part 1: Activity Log

### Current Problem
- "View All" button on dashboard goes to `/settings` (wrong)
- No real activity log page exists
- Need to track: token usage, skill usage, persona usage, guest access

### Solution
Create `/activity` page showing real audit log with:
- **Token Usage**: Which token used, when, what endpoint, by whom (user/AI agent)
- **Skill Executions**: Who ran which skill, with what parameters, success/failure
- **Persona Invocations**: Which persona was called, by which user/AI, context
- **Guest Token Activity**: Guest token usage events with IP, action, result
- **Service Calls**: Which service API was called, with which scopes
- **Device Approvals**: New device requests, approvals, revocations

**Filters Available:**
- By date range
- By event type (token, skill, persona, guest, device, service)
- By user/AI agent
- By status (success, failed, pending)
- By entity (which skill, which persona, which token)

**Real-time Updates:** WebSocket to show new activity instantly

---

## Part 2: Notification System

### 2.1 Notification Types (Events)

| Event Type | Trigger | User Notification | Email | Customizable |
|---|---|---|---|---|
| `device_approval_requested` | New device login | ✅ Alert + Action | ✅ | ✅ |
| `skill_liked` | User/AI likes your skill | ✅ Mention | ✅ | ✅ |
| `skill_used` | Someone executes your skill | ✅ Mention | ✅ | ✅ |
| `persona_invoked` | Someone uses your persona | ✅ Mention | ✅ | ✅ |
| `guest_token_used` | Guest token was used | ✅ Alert | ✅ | ✅ |
| `marketplace_listing_view` | Skill viewed in marketplace | ❌ | ❌ | - |
| `marketplace_listing_purchase` | Skill purchased | ✅ Alert | ✅ | ✅ |
| `token_revoked` | One of your tokens was revoked | ✅ Alert | ✅ | ✅ |
| `device_approved` | Device was approved | ✅ Alert | ❌ | - |
| `service_connected` | New OAuth service connected | ✅ Alert | ❌ | - |
| `device_revoked` | Device access removed | ✅ Alert | ✅ | ✅ |

### 2.2 Notification Delivery Channels

**In-App (Web):**
- Toast notifications (top-right, 5 second auto-dismiss)
- Notification bell icon with unread count
- Notification center page (all notifications, filterable, searchable)

**Email:**
- Batched emails (daily digest or per-event based on settings)
- HTML templates for each event type
- Unsubscribe link in footer
- User can disable per-event or all emails

**WebSocket (Real-time):**
- Critical alerts (device approval requests) via WebSocket
- Immediate delivery without page refresh
- Badge updates on navigation menu

---

## Part 3: Notification Settings Management Page

### User Interface (Location: `/settings#notifications`)

```
┌─────────────────────────────────────────────────────┐
│ Notification Preferences                             │
├─────────────────────────────────────────────────────┤
│                                                      │
│ [🔔 See all notifications] [Mark all as read]       │
│                                                      │
│ ─── NOTIFICATION TYPES ───                           │
│                                                      │
│ □ Device Approval Requests                           │
│   ☐ In-App  ☐ Email  [settings icon]                │
│                                                      │
│ □ Skill Likes                                        │
│   ☐ In-App  ☐ Email  [settings icon]                │
│                                                      │
│ □ Skill Usage                                        │
│   ☐ In-App  ☐ Email  [settings icon]                │
│                                                      │
│ □ Persona Usage                                      │
│   ☐ In-App  ☐ Email  [settings icon]                │
│                                                      │
│ □ Guest Token Usage                                  │
│   ☐ In-App  ☐ Email  [settings icon]                │
│                                                      │
│ [Disable All]  [Enable All]                          │
│                                                      │
│ ─── EMAIL DIGEST SETTINGS ───                        │
│                                                      │
│ ○ Send notifications immediately                    │
│ ○ Daily digest (sent at 9:00 AM)                   │
│ ○ Weekly digest (sent every Monday)                │
│ ○ Disable all email notifications                  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Per-Event Settings Modal:**
- Mute for 1 hour / 24 hours / 1 week
- Add note/context
- Mark as read or spam
- Snooze until tomorrow / next week

---

## Part 4: Database Schema

```sql
-- Notifications table
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL, -- device_approval_requested, skill_liked, etc
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  read_at TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT, -- For auto-cleanup of old notifications
  related_entity_type TEXT, -- skill, persona, token, device, etc
  related_entity_id TEXT,
  data JSON, -- Extra context (skill_name, user_name, etc)
  action_url TEXT -- Link to related resource
);

-- User notification preferences
CREATE TABLE notification_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  device_approval_requested_web INTEGER DEFAULT 1,
  device_approval_requested_email INTEGER DEFAULT 1,
  skill_liked_web INTEGER DEFAULT 1,
  skill_liked_email INTEGER DEFAULT 1,
  skill_used_web INTEGER DEFAULT 1,
  skill_used_email INTEGER DEFAULT 1,
  persona_invoked_web INTEGER DEFAULT 1,
  persona_invoked_email INTEGER DEFAULT 1,
  guest_token_used_web INTEGER DEFAULT 1,
  guest_token_used_email INTEGER DEFAULT 1,
  token_revoked_web INTEGER DEFAULT 1,
  token_revoked_email INTEGER DEFAULT 1,
  device_approved_web INTEGER DEFAULT 1,
  device_approved_email INTEGER DEFAULT 0,
  service_connected_web INTEGER DEFAULT 1,
  service_connected_email INTEGER DEFAULT 0,
  email_digest_type TEXT DEFAULT 'immediate', -- immediate, daily, weekly, disabled
  email_digest_time TEXT DEFAULT '09:00', -- For daily/weekly
  email_digest_day TEXT DEFAULT 'monday', -- For weekly
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Activity/audit log (enhanced existing audit_log)
CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL, -- token_used, skill_executed, persona_invoked, guest_token_used, device_approved, service_connected
  resource_type TEXT NOT NULL, -- token, skill, persona, device, service, guest_token
  resource_id TEXT,
  resource_name TEXT,
  actor_type TEXT, -- user, ai_agent, system
  actor_id TEXT,
  actor_name TEXT,
  details JSON, -- Contextual data (which endpoint, which parameters, result)
  result TEXT, -- success, failure, pending
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Email queue (for async email sending)
CREATE TABLE email_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email_address TEXT NOT NULL,
  notification_id TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  html_body TEXT,
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  sent_at TEXT,
  failed_reason TEXT,
  created_at TEXT NOT NULL
);
```

---

## Part 5: Implementation Phases

### Phase 1: Database & Backend (2 hours)
- [ ] Create/migrate notification tables
- [ ] Create notification manager service (emit, create, mark-read)
- [ ] Hook notification emission into existing event handlers (device approval, etc)
- [ ] Create `/api/v1/activity` endpoint (paginated activity log)
- [ ] Create `/api/v1/notifications` endpoints (list, mark-read, delete)
- [ ] Create `/api/v1/notifications/settings` endpoints (get, update)

### Phase 2: Frontend - Activity Log (1.5 hours)
- [ ] Create `/activity` page with real audit log
- [ ] Add filters (date, type, status, user/AI)
- [ ] Add search
- [ ] Real-time updates via WebSocket
- [ ] Link from dashboard "View All"

### Phase 3: Frontend - Notification Center (1.5 hours)
- [ ] Notification bell icon in header (with unread count)
- [ ] Notification center page (all notifications, filterable)
- [ ] Toast/banner notifications for real-time events
- [ ] Mark as read, delete, snooze
- [ ] Link to related resource

### Phase 4: Frontend - Notification Settings (1.5 hours)
- [ ] `/settings#notifications` page
- [ ] Toggle on/off for each notification type
- [ ] Choose channels (web, email, or both)
- [ ] Email digest settings (immediate, daily, weekly, disabled)
- [ ] Bulk actions (enable all, disable all)

### Phase 5: Email Notification Service (1 hour)
- [ ] Email template system (HTML emails for each event type)
- [ ] Background job to process email queue
- [ ] Test email delivery
- [ ] Unsubscribe links

### Phase 6: Events Integration (2 hours)
- [ ] Hook device approval into notifications
- [ ] Hook skill like/use into notifications
- [ ] Hook persona use into notifications
- [ ] Hook guest token use into notifications
- [ ] Hook service connection into notifications

---

## Part 6: Priority Events

**Critical (Immediate):**
1. Device approval requests (user needs to act)
2. Token revoked (user needs to know)
3. Guest token used (security audit)

**High (Next Sprint):**
4. Skill liked (engagement)
5. Skill used (usage tracking)
6. Persona invoked (usage tracking)

**Medium (Later):**
7. Service connected (informational)
8. Marketplace views (analytics)

---

## Part 7: Example User Flows

### Flow 1: New Device Approval
```
Device login attempt → ActivityLog entry + Notification created
→ Toast pops up "New device requesting access: iPhone 15"
→ Notification center shows "Approve or Deny"
→ Email sent: "New device login attempt from 192.168.1.x"
→ User clicks link → Device Management page
→ User approves → ActivityLog updated + Notification marked resolved
```

### Flow 2: Skill Liked
```
User A likes Skill B → ActivityLog entry + Notification created
→ Owner (User B) gets toast: "User A liked your skill 'Web Scraper'"
→ Notification center shows skill card with link to skill
→ Email (if enabled): "Your skill 'Web Scraper' was liked"
```

### Flow 3: Guest Token Used
```
Guest uses token → ActivityLog entry + Notification created
→ Owner gets toast: "Guest token 'app_integration' was used"
→ Notification center shows: Called /skills/analyze_sentiment
→ Email (if enabled): "Guest token activity: 3 requests today"
```

---

## Estimated Timeline
- **Database + Backend**: 2 hours
- **Activity Log Page**: 1.5 hours
- **Notification Center UI**: 1.5 hours
- **Settings Page**: 1.5 hours
- **Email Service**: 1 hour
- **Event Hooks**: 2 hours
- **Testing + Cleanup**: 1 hour

**Total: ~10 hours of focused work**

---

## Questions for Omri

1. **Email Service**: Should we use:
   - Simple SMTP (sendgrid, mailgun API)?
   - Built-in Node mailer?
   - 3rd-party service (AWS SES)?

2. **Email Digest**: Default to immediate or daily?

3. **Notification Retention**: How long to keep notifications? (7 days? 30 days?)

4. **Activity Log Retention**: How long to keep activity logs? (90 days? 1 year?)

5. **Critical Events**: Should device approval requests also send SMS/WhatsApp or just email?

6. **Batch Emails**: Should we batch multiple events into one daily email or send individual emails?
