# Agent Approval System Integration

This guide explains how to integrate the Agent Approval system into your MyApi server.

## What It Does

1. **First Request**: An AI agent makes an API call to MyApi
   - System detects it's an agent (not a human)
   - Returns 403 "Pending Approval"
   - Sends notification to user
   - Agent waits for approval

2. **User Approves**: User sees notification and clicks "Approve"
   - Database records approval
   - Agent is added to whitelist (fingerprint-based)
   - Valid for 30 days

3. **Subsequent Requests**: Agent makes API call again
   - Checks fingerprint against whitelist
   - Access granted; request proceeds normally

---

## Integration Steps

### Step 1: Verify the middleware file exists

```bash
ls -la src/middleware/agent-approval.js
```

If it doesn't exist, run:

```bash
# File was created at: src/middleware/agent-approval.js
# (check git status to confirm)
```

### Step 2: Add to src/index.js

Find this line (around 1273):

```javascript
app.use('/api/v1/auth', newAuthRoutes);
app.use('/api/v1', authRoutes);
```

Add this right after the imports (at the top of the file, after other requires):

```javascript
// Agent Approval Middleware
const {
  agentApprovalMiddleware,
  createAgentApprovalsRoutes,
  initializeAgentApprovalsTable
} = require('./middleware/agent-approval');
```

Then, after the existing `app.use()` calls (around line 1280), add:

```javascript
// Initialize agent approvals table on startup
initializeAgentApprovalsTable();

// Add agent approval check (runs AFTER authenticate middleware)
app.use('/api/v1', authenticate, agentApprovalMiddleware);

// Agent approval management endpoints
app.use('/api/v1/agent-approvals', authenticate, createAgentApprovalsRoutes());
```

### Step 3: Test the integration

Run the server:

```bash
node src/index.js
```

Test with an AI agent making a request:

```bash
curl -X GET https://www.myapiai.com/api/v1/services/google \
  -H "Authorization: Bearer myapi_xxx" \
  -H "User-Agent: Claude/1.0" \
  -H "X-Agent-ID: my-assistant"
```

**Expected response (first request):**

```json
{
  "ok": false,
  "error": "Access pending approval",
  "message": "Claude is requesting access to your MyApi services.",
  "guidance": {
    "what_happened": "This is your first request from this AI agent. An approval notification has been sent to you.",
    "what_to_do": "Check your MyApi dashboard notifications and approve or deny access.",
    "retry_after": 300
  },
  "statusCode": 403
}
```

### Step 4: Connect notification system

The approval system sends notifications to users. You need to connect your notification service.

Open `src/middleware/agent-approval.js` and find the `sendApprovalNotification()` function (around line 135):

```javascript
async function sendApprovalNotification(userId, agentName, fingerprint) {
  try {
    // This would call your notifications service
    console.log(`[AgentApproval] Sending approval notification...`);
    
    // TODO: Integrate with your notification system
    // Example:
    // await notificationService.send({
    //   userId,
    //   type: 'agent_approval_request',
    //   title: `${agentName} wants access`,
    //   message: `${agentName} is requesting access to your MyApi services.`,
    //   actionUrl: `/dashboard/approvals/${fingerprint}`,
    //   actions: [...]
    // });
  } catch (error) {
    console.error('[AgentApproval] Error sending notification:', error);
  }
}
```

Replace the `// TODO:` section with your actual notification service call.

### Step 5: Add UI for approval management

Users need a way to approve/deny agents. Create a dashboard page at:

```
/dashboard/approvals
```

This page should:
1. List pending agent requests
2. Show agent name and when it first requested access
3. Provide "Approve" and "Deny" buttons

Example API calls:

```bash
# Get pending and approved agents
GET /api/v1/agent-approvals

# Approve an agent
POST /api/v1/agent-approvals/:fingerprint/approve

# Deny an agent
POST /api/v1/agent-approvals/:fingerprint/deny
```

---

## How Agent Detection Works

The system identifies agents by checking:

1. **User-Agent header** — Contains "Claude", "Cursor", "ChatGPT", etc.
2. **X-Agent-ID header** — Optional explicit agent identification
3. **Request pattern** — No human session/cookie detected

The system generates a **fingerprint** (SHA256 hash) of:
- User-Agent
- IP address
- X-Agent-ID

This fingerprint is used to whitelist agents. The same agent from the same IP will be recognized on subsequent requests.

---

## API Reference

### GET /api/v1/agent-approvals

List all approval requests for the current user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "agent_fingerprint": "a1b2c3d4...",
      "agent_name": "Claude",
      "approved": false,
      "created_at": "2026-03-26T16:30:00Z",
      "approved_at": null,
      "denied_at": null,
      "expires_at": "2026-04-25T16:30:00Z",
      "last_seen_at": "2026-03-26T16:35:00Z",
      "status": "pending",
      "fingerprint": "a1b2c3d4..."
    }
  ]
}
```

### POST /api/v1/agent-approvals/:fingerprint/approve

Approve an agent request.

**Request:**
```bash
POST /api/v1/agent-approvals/a1b2c3d4/approve
Authorization: Bearer ...
```

**Response:**
```json
{
  "success": true,
  "message": "Claude has been approved.",
  "agentName": "Claude"
}
```

### POST /api/v1/agent-approvals/:fingerprint/deny

Deny an agent request.

**Request:**
```bash
POST /api/v1/agent-approvals/a1b2c3d4/deny
Authorization: Bearer ...
```

**Response:**
```json
{
  "success": true,
  "message": "Claude has been denied.",
  "agentName": "Claude"
}
```

---

## Database Schema

The system creates an `agent_approvals` table:

```sql
CREATE TABLE agent_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  agent_fingerprint TEXT NOT NULL,
  agent_name TEXT,
  approved BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME,
  denied_at DATETIME,
  expires_at DATETIME,
  last_seen_at DATETIME,
  UNIQUE(user_id, agent_fingerprint)
);
```

---

## Security Considerations

1. **Fingerprint-based** — Not foolproof but good enough for most use cases
2. **Expiration** — Approvals valid for 30 days (can be changed)
3. **User control** — Users can revoke approvals at any time
4. **Logging** — All approvals are logged for auditing

---

## Troubleshooting

### Agent keeps getting 403 after approval

**Check:**
1. User approved the agent (check database: `SELECT * FROM agent_approvals WHERE user_id = 'X' AND approved = 1`)
2. Agent fingerprint matches (if agent's User-Agent or IP changed, it's a different fingerprint)
3. Approval hasn't expired (check `expires_at` date)

### Notification not being sent

The middleware logs to console when it tries to send notifications. Check:

```bash
# Look for this in server logs:
# [AgentApproval] Sending approval notification to user ...
```

If you don't see it, the `sendApprovalNotification()` function isn't being called. Check the middleware integration in `src/index.js`.

---

## Next Steps

1. [ ] Add middleware to `src/index.js`
2. [ ] Initialize `agent_approvals` table on startup
3. [ ] Connect notification service
4. [ ] Create dashboard UI for approval management
5. [ ] Test with an AI agent
6. [ ] Document for users in MyApi docs
