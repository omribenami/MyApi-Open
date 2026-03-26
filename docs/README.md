# MyApi Documentation

Welcome to MyApi — a unified OAuth data gateway for AI agents and applications.

---

## 🚀 Quick Navigation

### For AI Agents
**👉 Start here:** [AGENT_README.md](./AGENT_README.md) (30-second quickstart)

Then read: [API_QUICKSTART.md](./API_QUICKSTART.md) → [API_DETAILED.md](./API_DETAILED.md) for specifics

**Time:** 15 minutes to get started

### For Developers
**👉 Start here:** [AGENT_APPROVAL_INTEGRATION.md](./AGENT_APPROVAL_INTEGRATION.md) (how to set it up)

Then read: [SERVICE_CATALOG.md](./SERVICE_CATALOG.md) (what services are available)

**Time:** 30 minutes to integrate

### For Operations/Support
**👉 Reference:** [SERVICE_CATALOG.md](./SERVICE_CATALOG.md) + [API_DETAILED.md](./API_DETAILED.md) (error codes)

---

## 📚 Documentation Files

### Getting Started
- **[AGENT_README.md](./AGENT_README.md)** — Quick 30-sec start for AI agents. Token, first request, error handling, troubleshooting.

### API Reference
- **[API_QUICKSTART.md](./API_QUICKSTART.md)** — High-level overview of what you can do. Service types, approval flow, next steps.
- **[API_DETAILED.md](./API_DETAILED.md)** — Complete endpoint reference. All services, request/response formats, error codes, best practices.
- **[SERVICE_CATALOG.md](./SERVICE_CATALOG.md)** — Complete list of all available services (18+). Organized by category. Auth types and examples.

### Integration & Approval System
- **[AGENT_APPROVAL_INTEGRATION.md](./AGENT_APPROVAL_INTEGRATION.md)** — How to set up the approval system. 5 implementation steps, notification integration, dashboard UI.
- **[AGENT_DOCUMENTATION_SUMMARY.md](./AGENT_DOCUMENTATION_SUMMARY.md)** — Navigation guide. Reading paths for different audiences.

---

## 🎯 What Is MyApi?

MyApi is a **unified OAuth data gateway** that allows AI agents and applications to:

1. **Access user data** from 18+ services (Google, GitHub, Slack, Discord, LinkedIn, etc.)
2. **No direct tokens** — MyApi stores & manages credentials securely
3. **Auto-refresh** — OAuth tokens automatically refreshed
4. **Vault support** — API keys, custom tokens for any service
5. **Approval flow** — Users control what agents can access

---

## 🔌 How It Works

### Service Proxy Pattern

All access goes through the **service proxy**:

```bash
POST /api/v1/services/{service}/proxy
Authorization: Bearer {token}

{
  "path": "/api/endpoint",
  "method": "GET|POST|PUT|DELETE",
  "body": { optional body }
}
```

**One endpoint. Works for:**
- OAuth services (Google, GitHub, Slack, etc.)
- API key services (Stripe, fal, etc.)
- Custom vault services (Home Assistant, Postquee, etc.)

---

## 🔐 Agent Approval Flow

```
Agent makes API call
    ↓
Is agent approved?
    ├─ Yes → Request proceeds
    └─ No → 403 "Pending Approval" + notification sent
         ↓
         User approves in dashboard
         ↓
         Agent whitelist updated (30-day window)
         ↓
         Retry → Request proceeds
```

First request gets blocked. User approves. Subsequent requests work.

---

## 📊 Service Overview

| Category | Services | Count |
|----------|----------|-------|
| **Productivity** | Google, Notion, Microsoft 365, Dropbox | 4 |
| **Developer** | GitHub, Jira | 2 |
| **Communication** | Slack, Discord, Zoom | 3 |
| **Social Media** | LinkedIn, Twitter/X, Facebook, TikTok | 4 |
| **Business** | HubSpot, Salesforce | 2 |
| **Payments** | Stripe | 1 |
| **AI/ML** | fal | 1 |
| **Custom/Vault** | Home Assistant, Postquee, custom APIs | Unlimited |

---

## 🚀 Getting Started

### As an AI Agent:

1. **Get token** from the user
2. **Make first request** (expect 403 approval pending)
3. **Wait for approval** (~5 minutes)
4. **Retry** → Access granted!
5. **Read docs** as needed for specific endpoints

See: [AGENT_README.md](./AGENT_README.md)

### As a Developer:

1. **Integrate approval middleware** (5 steps)
2. **Connect notification system**
3. **Build dashboard approval UI**
4. **Test with real agent**
5. **Deploy**

See: [AGENT_APPROVAL_INTEGRATION.md](./AGENT_APPROVAL_INTEGRATION.md)

---

## 📖 Common Questions

**Q: How do I get started as an agent?**

A: Read [AGENT_README.md](./AGENT_README.md) (30 seconds), then try your first request. You'll get a 403 with guidance on what to do next.

**Q: What services are available?**

A: Check [SERVICE_CATALOG.md](./SERVICE_CATALOG.md) for the complete list (18+). User can also add custom services via vault.

**Q: How do I make a request to a service?**

A: Use the proxy endpoint. Examples in [AGENT_README.md](./AGENT_README.md) and [API_DETAILED.md](./API_DETAILED.md).

**Q: What happens if I hit a rate limit?**

A: The response includes `rateLimit` info (remaining calls, reset time). Wait and retry.

**Q: Can I modify user data?**

A: Yes, if the service API supports it (e.g., create Gmail draft, post to Slack). Always ask permission first.

**Q: How long are approvals valid?**

A: 30 days. After expiration, the agent needs new approval.

**Q: Can users deny agents?**

A: Yes. If denied, the agent must request approval again.

---

## 🔗 External Links

- **GitHub:** https://github.com/omribenami/MyApi
- **Website:** https://www.myapiai.com
- **API Base:** https://www.myapiai.com/api/v1

---

## 📝 Feedback & Issues

Found a problem with the docs? Have suggestions?

- **For agents:** Contact your MyApi user (they can escalate to support)
- **For developers:** Check [AGENT_APPROVAL_INTEGRATION.md](./AGENT_APPROVAL_INTEGRATION.md) troubleshooting section
- **For support:** Open an issue on GitHub or contact support@myapiai.com

---

## 📜 Version

- **Created:** March 2026
- **Status:** Production Ready
- **Last Updated:** March 26, 2026

---

**Ready to start?** Pick your path above. Good luck! 🚀
