# MyApi for AI Agents — Quick Reference

You are an AI agent with access to a user's unified OAuth data through MyApi.

---

## ⚡ Quick Start (30 seconds)

### 1. Get your token
The user will give you a token like: `myapi_8e04fdb632ee790fe5e95263bf4049a1c0865af06da94f576a646a94f028d2f5`

### 2. Make your first request
```bash
curl -X POST https://www.myapiai.com/api/v1/services/google/proxy \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/gmail/v1/users/me/messages",
    "method": "GET"
  }'
```

### 3. You got a 403?
That's normal. The system sent an approval notification to the user. Wait 5 minutes for approval, then retry.

---

## 🔌 How Services Are Connected

Services can be connected in **multiple ways**:

1. **OAuth** (most common) — User logs in, MyApi stores & auto-refreshes token
   - Examples: Google, GitHub, Slack, Discord, LinkedIn
   
2. **API Key/Token** — Credential stored in vault, MyApi retrieves it for each request
   - Examples: Stripe, fal, custom services
   
3. **Vault Token** — Long-lived credential for non-OAuth services
   - Examples: Home Assistant, Postquee, self-hosted APIs

**From your perspective:** No difference. Use the proxy the same way for all three.

---

## 🔑 Authentication

All requests need:

```
Authorization: Bearer myapi_xxxxxxxxxxxxxxxx
```

---

## 🔌 Main Tool: Service Proxy

Access any OAuth service with the proxy:

```
POST /api/v1/services/{service}/proxy
Authorization: Bearer {token}

{
  "path": "/api/v1/endpoint",
  "method": "GET|POST|PUT|DELETE",
  "query": { optional params },
  "body": { optional body }
}
```

### Supported Services

**Productivity:**
- `google` (Gmail, Calendar, Drive, Sheets)
- `notion` (Databases, Pages)
- `microsoft365` (Outlook, OneDrive)
- `dropbox` (Files)

**Developer:**
- `github` (Repos, Issues, PRs)
- `jira` (Issues, Workflows)

**Communication:**
- `slack` (Messages, Channels)
- `discord` (Servers, Channels)
- `zoom` (Meetings, Recordings)

**Social:**
- `linkedin`, `twitter`, `facebook`, `tiktok`

**Business:**
- `hubspot` (CRM)
- `salesforce` (CRM)

---

## 📋 Example Requests

### Get Gmail messages
```javascript
const response = await fetch('https://www.myapiai.com/api/v1/services/google/proxy', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    path: '/gmail/v1/users/me/messages',
    method: 'GET',
    query: { maxResults: 10 }
  })
});
const data = await response.json();
console.log(data.data.messages);
```

### Get GitHub repos
```javascript
const response = await fetch('https://www.myapiai.com/api/v1/services/github/proxy', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    path: '/user/repos',
    method: 'GET',
    query: { sort: 'updated', per_page: 5 }
  })
});
```

### Send a Slack message
```javascript
await fetch('https://www.myapiai.com/api/v1/services/slack/proxy', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    path: '/api/chat.postMessage',
    method: 'POST',
    body: {
      channel: 'C123456',
      text: 'Hello from MyApi!'
    }
  })
});
```

---

## 🔍 Identity & Preferences

### Get user identity data
```bash
GET /api/v1/identity?category=contact
Authorization: Bearer {token}
```

### Get user preferences
```bash
GET /api/v1/preferences?category=notifications
Authorization: Bearer {token}
```

### List connected services
```bash
GET /api/v1/connectors
Authorization: Bearer {token}
```

---

## ⚠️ Error Responses

### 403 — Pending Approval (First Request)
```json
{
  "ok": false,
  "error": "Access pending approval",
  "message": "...",
  "guidance": {
    "what_happened": "This is your first request. Approval notification sent.",
    "what_to_do": "Wait for user approval (check back in 5 min)",
    "retry_after": 300
  }
}
```

**What to do:** Wait ~5 minutes, then retry.

### 401 — Invalid Token
```json
{
  "ok": false,
  "error": "Invalid or expired token",
  "message": "Your token has expired. Request a new one."
}
```

**What to do:** Ask user for a new token.

### 429 — Rate Limited
```json
{
  "ok": false,
  "error": "Rate limit exceeded",
  "rateLimit": {
    "remaining": 0,
    "resetTime": "2026-03-26T17:30:00Z"
  }
}
```

**What to do:** Wait until `resetTime`, then retry.

### 500 — Server Error
```json
{
  "ok": false,
  "error": "Internal server error",
  "message": "Failed to refresh OAuth token"
}
```

**What to do:** Log the error and retry after a few seconds.

---

## 📚 Full Documentation

For detailed API specs, service-specific notes, and advanced patterns:

👉 **[API_DETAILED.md](./API_DETAILED.md)** — Complete reference

👉 **[API_QUICKSTART.md](./API_QUICKSTART.md)** — Feature overview

---

## 🛠️ Troubleshooting

**Q: I keep getting 403 after waiting 5 minutes**

A: The approval might have been denied, or the fingerprint changed (different IP/User-Agent). Ask the user to check their approval dashboard.

**Q: I got a rate limit error. When can I retry?**

A: Check the `rateLimit.resetTime` in the response. Retry after that time.

**Q: How do I know what endpoints are available for a service?**

A: Check the OAuth provider's API docs (Google, GitHub, Slack, etc.). The proxy forwards requests as-is.

**Q: Can I modify the user's data?**

A: Yes, if you have a write endpoint and the service allows it (e.g., POST to Gmail, create issues on GitHub). Always ask the user's permission first.

---

## ✅ Best Practices

1. **Cache responses** — Don't call the same endpoint repeatedly
2. **Respect rate limits** — Check `rateLimit` in responses
3. **Handle errors gracefully** — Always catch and log errors
4. **Ask for permission** — Before modifying user data
5. **Be transparent** — Tell the user what you're doing

---

## 🚀 Ready to go?

1. Grab your token from the user
2. Make your first request (expect 403)
3. Wait for approval
4. Retry and start using MyApi!

Questions? Read **[API_DETAILED.md](./API_DETAILED.md)** or contact support.

Happy coding! 🎉
