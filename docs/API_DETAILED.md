# MyApi Detailed API Reference

Complete technical documentation for AI agents using MyApi.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Service Proxy (Main Gateway)](#service-proxy-main-gateway)
3. [Identity Data](#identity-data)
4. [Preferences](#preferences)
5. [Connectors](#connectors)
6. [Error Handling](#error-handling)
7. [Service-Specific Notes](#service-specific-notes)

---

## Authentication

All requests require a Bearer token in the `Authorization` header:

```bash
Authorization: Bearer myapi_xxxxxxxxxxxxxxxx
```

Tokens are provided by MyApi and linked to a user account. Each token has:
- **Scope:** What data/services it can access
- **Type:** `personal` (full access) or `guest` (limited scope)
- **Expiration:** May expire; MyApi handles auto-refresh

---

## Service Proxy (Main Gateway)

The service proxy is your primary tool for accessing OAuth services.

### Endpoint

```
POST /api/v1/services/{service}/proxy
```

### Request Format

```json
{
  "path": "/api/v1/endpoint/path",
  "method": "GET|POST|PUT|DELETE|PATCH",
  "query": {
    "optional": "query_params"
  },
  "body": {
    "optional": "request_body"
  },
  "headers": {
    "optional": "custom_headers"
  }
}
```

### Response Format

```json
{
  "ok": true,
  "service": "google",
  "statusCode": 200,
  "data": {
    "the": "response_from_oauth_service"
  },
  "meta": {
    "endpoint": "https://www.googleapis.com/...",
    "method": "GET",
    "timestamp": "2026-03-26T16:30:57.706Z",
    "responseTimeMs": 374,
    "rateLimit": {
      "limit": 150,
      "remaining": 149,
      "resetTime": "2026-03-26T17:30:57.706Z"
    }
  },
  "nextEndpoints": [
    "/gmail/v1/users/me/messages",
    "/calendar/v3/calendars/primary/events"
  ]
}
```

### Supported Services

| Service | OAuth Provider | Base Endpoint | Common Use |
|---------|----------------|---------------|-----------|
| `google` | Google | `https://www.googleapis.com` | Gmail, Calendar, Drive, Sheets, Docs |
| `github` | GitHub | `https://api.github.com` | Repos, Issues, PRs, Gists |
| `slack` | Slack | `https://slack.com/api` | Messages, Channels, Users, Files |
| `discord` | Discord | `https://discord.com/api/v10` | Servers, Channels, Messages, Members |
| `notion` | Notion | `https://api.notion.com/v1` | Databases, Pages, Blocks |
| `linkedin` | LinkedIn | `https://api.linkedin.com/v2` | Profile, Posts, Connections |
| `twitter` | Twitter/X | `https://api.twitter.com/2` | Tweets, Retweets, Followers |
| `facebook` | Facebook | `https://graph.facebook.com` | Posts, Photos, Events, Pages |
| `tiktok` | TikTok | `https://open.tiktokapis.com` | Videos, Analytics, Hashtags |
| `microsoft365` | Microsoft | `https://graph.microsoft.com` | Outlook, OneDrive, Teams |
| `dropbox` | Dropbox | `https://api.dropboxapi.com/2` | Files, Folders, Sharing |
| `zoom` | Zoom | `https://api.zoom.us/v2` | Meetings, Recordings, Users |
| `hubspot` | HubSpot | `https://api.hubapi.com` | Contacts, Companies, Deals |
| `salesforce` | Salesforce | `https://login.salesforce.com` | Records, Accounts, Opportunities |
| `jira` | Jira | `https://api.atlassian.com` | Issues, Projects, Workflows |

### Examples

#### Get Gmail Messages

```bash
curl -X POST https://www.myapiai.com/api/v1/services/google/proxy \
  -H "Authorization: Bearer myapi_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/gmail/v1/users/me/messages",
    "method": "GET",
    "query": { "maxResults": 10 }
  }'
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "messages": [
      { "id": "19d2af01dd519dd4", "threadId": "19d2af01dd519dd4" },
      { "id": "19d2ae93efae4c51", "threadId": "19d2ae93efae4c51" }
    ],
    "nextPageToken": "11819052...",
    "resultSizeEstimate": 201
  }
}
```

#### Get GitHub Repositories

```bash
curl -X POST https://www.myapiai.com/api/v1/services/github/proxy \
  -H "Authorization: Bearer myapi_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/user/repos",
    "method": "GET",
    "query": { "sort": "updated", "per_page": 5 }
  }'
```

#### Create a Google Calendar Event

```bash
curl -X POST https://www.myapiai.com/api/v1/services/google/proxy \
  -H "Authorization: Bearer myapi_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/calendar/v3/calendars/primary/events",
    "method": "POST",
    "body": {
      "summary": "Team Meeting",
      "start": { "dateTime": "2026-03-27T10:00:00Z" },
      "end": { "dateTime": "2026-03-27T11:00:00Z" }
    }
  }'
```

#### Send a Slack Message

```bash
curl -X POST https://www.myapiai.com/api/v1/services/slack/proxy \
  -H "Authorization: Bearer myapi_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/chat.postMessage",
    "method": "POST",
    "body": {
      "channel": "C123456",
      "text": "Hello from MyApi!"
    }
  }'
```

---

## Identity Data

Access stored identity information.

### Endpoints

```
GET /api/v1/identity              # List all identity data by category
GET /api/v1/identity/:key         # Get a specific identity key
GET /api/v1/identity-all          # Get all identity data (personal tokens only)
POST /api/v1/identity             # Store identity data
```

### Get Identity Data

```bash
curl -X GET "https://www.myapiai.com/api/v1/identity?category=contact" \
  -H "Authorization: Bearer myapi_xxx"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "key": "name",
      "value": "YOUR_NAME",
      "category": "contact"
    },
    {
      "key": "email",
      "value": "admin@your.domain.com",
      "category": "contact"
    }
  ]
}
```

### Store Identity Data

```bash
curl -X POST https://www.myapiai.com/api/v1/identity \
  -H "Authorization: Bearer myapi_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "bio",
    "value": "Full-stack developer from Texas",
    "category": "contact"
  }'
```

---

## Preferences

Manage user settings and preferences.

### Endpoints

```
GET /api/v1/preferences            # List all preferences
GET /api/v1/preferences/:key       # Get a specific preference
POST /api/v1/preferences           # Store a preference
```

### Get Preferences

```bash
curl -X GET https://www.myapiai.com/api/v1/preferences?category=notifications \
  -H "Authorization: Bearer myapi_xxx"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "key": "email_notifications",
      "value": true,
      "category": "notifications"
    }
  ]
}
```

---

## Connectors

List and manage service connections.

### Endpoint

```
GET /api/v1/connectors
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "google",
      "name": "Google",
      "status": "connected",
      "connectedAt": "2026-03-20T10:00:00Z",
      "expiresAt": "2026-06-20T10:00:00Z"
    },
    {
      "id": "github",
      "name": "GitHub",
      "status": "connected",
      "connectedAt": "2026-03-15T14:30:00Z",
      "expiresAt": null
    }
  ]
}
```

---

## Error Handling

MyApi returns structured error responses:

### 401 Unauthorized

```json
{
  "ok": false,
  "error": "Invalid or expired token",
  "message": "Your token has expired. Request a new one from the user.",
  "statusCode": 401
}
```

**What to do:** Ask the user to regenerate the token via the dashboard.

### 403 Forbidden (First-Time Access)

```json
{
  "ok": false,
  "error": "Access pending approval",
  "message": "This is your first request. An approval notification has been sent to the user.",
  "statusCode": 403,
  "guidance": {
    "nextStep": "Wait for user approval",
    "retryAfter": 300,
    "contact": "Support the user in approving your access via the MyApi dashboard"
  }
}
```

**What to do:** 
1. Inform the user that approval is pending
2. Wait ~5 minutes (user will see notification)
3. Retry after approval

### 429 Rate Limited

```json
{
  "ok": false,
  "error": "Rate limit exceeded",
  "statusCode": 429,
  "rateLimit": {
    "limit": 150,
    "remaining": 0,
    "resetTime": "2026-03-26T17:30:57.706Z"
  }
}
```

**What to do:** Wait until `resetTime` before retrying.

### 500 Server Error

```json
{
  "ok": false,
  "error": "Internal server error",
  "message": "Failed to refresh OAuth token for google",
  "statusCode": 500
}
```

**What to do:** Log the error and retry after a few seconds. If it persists, inform the user.

---

## Service-Specific Notes

### Google (Gmail, Calendar, Drive, Sheets)

- **OAuth Scopes:** `gmail.readonly`, `calendar`, `drive`
- **Rate Limit:** 150 requests per minute
- **Useful Endpoints:**
  - `/gmail/v1/users/me/messages` — List emails
  - `/gmail/v1/users/me/messages/{id}` — Get email details
  - `/calendar/v3/calendars/primary/events` — List calendar events
  - `/drive/v3/files` — List files
  - `/sheets/v4/spreadsheets/{id}` — Read/write sheets

### GitHub

- **OAuth Scopes:** `repo`, `user`, `gist`
- **Rate Limit:** 5,000 requests per hour (authenticated)
- **Useful Endpoints:**
  - `/user/repos` — List repos
  - `/user/issues` — List issues
  - `/repos/{owner}/{repo}/issues` — Repo issues
  - `/gists` — List gists

### Slack

- **OAuth Scopes:** `chat:write`, `channels:read`, `users:read`
- **Rate Limit:** Varies by endpoint; see response headers
- **Useful Endpoints:**
  - `/api/conversations.list` — List channels
  - `/api/users.list` — List users
  - `/api/chat.postMessage` — Send message

### Discord

- **OAuth Scopes:** `identify`, `email`, `guilds`, `messages.read`
- **Rate Limit:** 50 requests per second per user
- **Useful Endpoints:**
  - `/users/@me` — Get current user
  - `/users/@me/guilds` — List guilds
  - `/channels/{channel_id}/messages` — List messages

---

## Best Practices

1. **Cache responses** — Don't call the API repeatedly for the same data
2. **Respect rate limits** — Check the `rateLimit` in responses and throttle accordingly
3. **Handle errors gracefully** — Always catch and log error responses
4. **Use pagination** — For large result sets, use `pageToken` or similar parameters
5. **Log all requests** — Track what you access for auditing purposes

---

## Support

If you encounter issues:
1. Check the error message for guidance
2. Review this documentation for the endpoint
3. Contact support via the user's MyApi dashboard

Good luck! 🚀
