# MyApi Quick Start — AI Agent Guide

Welcome to MyApi. You are an AI agent with access to a user's unified OAuth data.

## First Time? You Need Approval

If you're seeing this after a 403 error, **the user hasn't approved your access yet**. 

The system just sent them a notification asking: *"An AI agent wants access to your MyApi services. Approve or deny?"*

**What happens next:**
- Once approved, you can use MyApi's proxy API to read Gmail, Calendar, Drive, GitHub, Slack, etc.
- If denied, your access is revoked and you'll need to ask the user again.

---

## Service Authentication Methods

Services can be connected in **multiple ways**:

| Method | What It Is | Example |
|--------|-----------|---------|
| **OAuth** | User authorized via provider's login | Google, GitHub, Slack |
| **API Key/Token** | Direct credential stored in vault | Stripe, fal, custom services |
| **Vault Token** | Long-lived token for any service | Home Assistant, Postquee |

The proxy detects which method is configured and uses it automatically. No difference from your perspective — just make the request.

---

## After Approval: What You Can Do

Once approved, you have access to these **high-level capabilities**:

### 1. **Service Proxy** — Call any connected service
**What it does:** Pass requests to any service (OAuth, API key, or vault token) with the appropriate credentials attached. The system handles authentication automatically.

**Endpoint:** `POST /api/v1/services/{service}/proxy`

**Simple example:**
```bash
POST https://www.myapiai.com/api/v1/services/google/proxy
Authorization: Bearer {token}

{
  "path": "/gmail/v1/users/me/messages",
  "method": "GET"
}
```

**Common services:** google, github, slack, discord, notion, linkedin, twitter, facebook, tiktok

---

### 2. **Identity Data** — Access stored personal info
**What it does:** Read identity data (name, email, documents, preferences) that the user has stored in MyApi.

**Endpoint:** `GET /api/v1/identity` or `GET /api/v1/identity/{key}`

**Example:**
```bash
GET https://www.myapiai.com/api/v1/identity?category=contact
Authorization: Bearer {token}
```

---

### 3. **Preferences** — User settings & configuration
**What it does:** Retrieve user preferences, settings, and customizations.

**Endpoint:** `GET /api/v1/preferences` or `GET /api/v1/preferences/{key}`

---

### 4. **Connectors** — List active services
**What it does:** See which services are connected and ready to use.

**Endpoint:** `GET /api/v1/connectors`

---

## Service Types: OAuth, API Keys & Vault Tokens

Services are connected in **one of three ways**:

| Type | How It Works | Examples |
|------|--------------|----------|
| **OAuth** | User logs in, token auto-refreshed | Google, GitHub, Slack, Discord |
| **API Key** | Stored credential in vault | Stripe, fal, custom services |
| **Vault Token** | Long-lived credential for non-OAuth | Home Assistant, Postquee, custom APIs |

**The proxy works the same way for all three.** You don't need to know which method is used — just make the request.

---

## How to Use the Proxy (Most Important)

The **service proxy** is your main tool. It lets you call any OAuth service as if you were the user.

### Pattern:
```javascript
POST /api/v1/services/{service}/proxy
{
  "path": "/api/endpoint/path",
  "method": "GET|POST|PUT|DELETE",
  "query": { optional query params },
  "body": { optional request body }
}
```

### Real Examples:

**Get Gmail messages:**
```bash
POST /api/v1/services/google/proxy
{
  "path": "/gmail/v1/users/me/messages",
  "method": "GET"
}
```

**Get GitHub repos:**
```bash
POST /api/v1/services/github/proxy
{
  "path": "/user/repos",
  "method": "GET"
}
```

**Get Slack channels:**
```bash
POST /api/v1/services/slack/proxy
{
  "path": "/api/conversations.list",
  "method": "GET"
}
```

**Create a calendar event (Google):**
```bash
POST /api/v1/services/google/proxy
{
  "path": "/calendar/v3/calendars/primary/events",
  "method": "POST",
  "body": {
    "summary": "Meeting with team",
    "start": { "dateTime": "2026-03-27T10:00:00Z" },
    "end": { "dateTime": "2026-03-27T11:00:00Z" }
  }
}
```

---

## For Detailed API Docs

**Need specific API details?** See [`API_DETAILED.md`](./API_DETAILED.md)

That file has:
- Full endpoint reference
- Authentication details
- Error handling
- Rate limits
- Service-specific notes

---

## Key Rules

1. **Always use Bearer token** — Include your token in the `Authorization: Bearer {token}` header
2. **The proxy is the gateway** — Don't call OAuth services directly; use the proxy so tokens are refreshed & logged
3. **Check rate limits** — The response includes `rateLimit` info; respect it
4. **Errors return guidance** — If you hit a 403 or 401, it includes instructions on what to do next

---

## Next Steps

1. **First time?** Wait for user approval (notification already sent)
2. **Approved?** Read [`API_DETAILED.md`](./API_DETAILED.md) for specific endpoints
3. **Stuck?** Check the error message — it includes debugging info

Good luck! 🚀
