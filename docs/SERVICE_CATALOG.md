# MyApi Service Catalog

Complete list of all services available via the service proxy, organized by category and authentication type.

---

## 📊 Quick Stats

- **Total Services:** 18+
- **OAuth Services:** 14
- **API Key Services:** 2
- **Vault/Custom Services:** Unlimited (user-configured)

---

## 🔐 OAuth Services (Auto-Refreshing Tokens)

User authorizes via OAuth login. Token automatically refreshed by MyApi.

### 📧 Productivity

| Service | Endpoint | Main Use |
|---------|----------|----------|
| **Google** | `/api/v1/services/google/proxy` | Gmail, Calendar, Drive, Sheets, Docs |
| **Notion** | `/api/v1/services/notion/proxy` | Databases, Pages, Blocks |
| **Microsoft 365** | `/api/v1/services/microsoft365/proxy` | Outlook, OneDrive, Teams, SharePoint |
| **Dropbox** | `/api/v1/services/dropbox/proxy` | Files, Folders, Sharing |

**Base Endpoints:**
- Google: `https://www.googleapis.com`
- Notion: `https://api.notion.com/v1`
- Microsoft 365: `https://graph.microsoft.com`
- Dropbox: `https://api.dropboxapi.com/2`

---

### 👨‍💻 Developer Tools

| Service | Endpoint | Main Use |
|---------|----------|----------|
| **GitHub** | `/api/v1/services/github/proxy` | Repos, Issues, PRs, Gists, Actions |
| **Jira** | `/api/v1/services/jira/proxy` | Issues, Projects, Workflows |

**Base Endpoints:**
- GitHub: `https://api.github.com`
- Jira: `https://api.atlassian.com`

---

### 💬 Communication

| Service | Endpoint | Main Use |
|---------|----------|----------|
| **Slack** | `/api/v1/services/slack/proxy` | Messages, Channels, Users, Files, Workflows |
| **Discord** | `/api/v1/services/discord/proxy` | Servers, Channels, Messages, Members, Roles |
| **Zoom** | `/api/v1/services/zoom/proxy` | Meetings, Recordings, Users, Reports |

**Base Endpoints:**
- Slack: `https://slack.com/api`
- Discord: `https://discord.com/api/v10`
- Zoom: `https://api.zoom.us/v2`

---

### 🌐 Social Media

| Service | Endpoint | Main Use |
|---------|----------|----------|
| **LinkedIn** | `/api/v1/services/linkedin/proxy` | Profile, Posts, Connections, Education, Experience |
| **Twitter/X** | `/api/v1/services/twitter/proxy` | Tweets, Retweets, Followers, Trends, DMs |
| **Facebook** | `/api/v1/services/facebook/proxy` | Posts, Photos, Events, Pages, Groups |
| **TikTok** | `/api/v1/services/tiktok/proxy` | Videos, Analytics, Hashtags, Sound |

**Base Endpoints:**
- LinkedIn: `https://api.linkedin.com/v2`
- Twitter/X: `https://api.twitter.com/2`
- Facebook: `https://graph.facebook.com`
- TikTok: `https://open.tiktokapis.com`

---

### 🏢 Business & CRM

| Service | Endpoint | Main Use |
|---------|----------|----------|
| **HubSpot** | `/api/v1/services/hubspot/proxy` | Contacts, Companies, Deals, Pipelines |
| **Salesforce** | `/api/v1/services/salesforce/proxy` | Records, Accounts, Opportunities, Leads |

**Base Endpoints:**
- HubSpot: `https://api.hubapi.com`
- Salesforce: `https://login.salesforce.com`

---

## 🔑 API Key Services (Vault-Stored)

Credentials stored securely in the vault. Token retrieved on each request.

### Payments & Commerce

| Service | Endpoint | Main Use |
|---------|----------|----------|
| **Stripe** | `/api/v1/services/stripe/proxy` | Charges, Subscriptions, Customers, Invoices |

**Base Endpoint:** `https://api.stripe.com`

---

### AI & Machine Learning

| Service | Endpoint | Main Use |
|---------|----------|----------|
| **fal** | `/api/v1/services/fal/proxy` | Image generation, video, audio, LLM inference |

**Base Endpoint:** `https://fal.run`

---

## 🏠 Custom Vault Services (User-Configured)

Users can add **any service** via vault tokens. Common examples:

### Smart Home & IoT

| Service | Auth Type | Main Use |
|---------|-----------|----------|
| **Home Assistant** | Vault Token (JWT) | Entities, Automations, Scripts, Integrations |
| **Hue** | Vault Token (Bridge API key) | Lights, Groups, Scenes |
| **MQTT** | Vault Token (Broker credentials) | IoT messages, smart home automation |

### Custom Internal APIs

| Service | Auth Type | Main Use |
|---------|-----------|----------|
| **Postquee** | Vault Token (API key) | Social media scheduling platform |
| **Custom Backend** | Vault Token (JWT/API key) | Your own service, any endpoint |

### Other Services

| Service | Auth Type | Main Use |
|---------|-----------|----------|
| **Mailchimp** | Vault Token (API key) | Email campaigns, lists, subscribers |
| **SendGrid** | Vault Token (API key) | Email sending, templates, lists |
| **Twilio** | Vault Token (API key) | SMS, voice, messaging |

---

## 🚀 Usage Examples

### Get Gmail Messages (OAuth)
```bash
curl -X POST https://www.myapiai.com/api/v1/services/google/proxy \
  -H "Authorization: Bearer myapi_xxx" \
  -d '{
    "path": "/gmail/v1/users/me/messages",
    "method": "GET"
  }'
```

### Create Stripe Charge (API Key)
```bash
curl -X POST https://www.myapiai.com/api/v1/services/stripe/proxy \
  -H "Authorization: Bearer myapi_xxx" \
  -d '{
    "path": "/v1/charges",
    "method": "POST",
    "body": {
      "amount": 2000,
      "currency": "usd",
      "source": "tok_visa"
    }
  }'
```

### Control Home Assistant (Vault Token)
```bash
curl -X POST https://www.myapiai.com/api/v1/services/home-assistant/proxy \
  -H "Authorization: Bearer myapi_xxx" \
  -d '{
    "path": "/api/states",
    "method": "GET"
  }'
```

### Post to Slack (OAuth)
```bash
curl -X POST https://www.myapiai.com/api/v1/services/slack/proxy \
  -H "Authorization: Bearer myapi_xxx" \
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

## 📋 Check What's Connected

```bash
# List all connected services for current user
curl -X GET https://www.myapiai.com/api/v1/connectors \
  -H "Authorization: Bearer myapi_xxx"
```

**Response includes:**
- Service name
- Connection status (connected/available)
- Connection date
- Token expiration (if applicable)
- Rate limit info

---

## 🔍 Service-Specific Documentation

For detailed API docs for each service:

- **Google:** https://developers.google.com/apis-explorer
- **GitHub:** https://docs.github.com/en/rest
- **Slack:** https://api.slack.com/docs
- **Discord:** https://discord.com/developers/docs
- **Stripe:** https://stripe.com/docs/api
- **Notion:** https://developers.notion.com/reference
- **LinkedIn:** https://learn.microsoft.com/en-us/linkedin/shared/api-reference/api-reference
- **Twitter/X:** https://developer.twitter.com/en/docs/api
- And many more...

---

## 🛠️ Adding Custom Vault Services

Users can add **any service** via the vault:

1. Store API key/token in MyApi vault
2. Label it with a service name (e.g., `home-assistant`, `my-api`)
3. Use the proxy: `POST /api/v1/services/{service-name}/proxy`

Example:
```bash
# User stores Home Assistant JWT in vault
# User labels it: "home-assistant"
# Agent can now call it:
curl -X POST https://www.myapiai.com/api/v1/services/home-assistant/proxy
```

---

## 📈 Service Growth

This catalog is **user-expandable**. As users add more vault tokens, the available services grow. The proxy handles all of them uniformly.

Check `GET /api/v1/connectors` to see the full list for any user.

---

## 🔗 Related Docs

- [API_QUICKSTART.md](./API_QUICKSTART.md) — High-level features
- [API_DETAILED.md](./API_DETAILED.md) — Complete endpoint reference
- [AGENT_README.md](./AGENT_README.md) — Quick start for agents
