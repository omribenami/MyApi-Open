# 🤖 ChatGPT + MyApi Integration

Connect ChatGPT to all your OAuth services (Twitter, Google, Slack, Facebook, GitHub, Discord, LinkedIn, Notion, Dropbox, etc.)

**Setup time: 5 minutes**  
**Difficulty: Easy**  
**Requirements: ChatGPT Plus ($20/month)**

---

## 🚀 Quick Start

Choose your setup method:

### **Option 1: Web Tool (Easiest)**

[Download chatgpt-setup-tool.html](https://github.com/omribenami/MyApi/raw/main/chatgpt-setup-tool.html)

1. Click the link above
2. Save the file: `chatgpt-setup-tool.html`
3. Double-click the file to open in your browser
4. Follow the 6-step interactive guide
5. Done! ✅

**Advantages:**
- ✅ No installation needed
- ✅ Works offline
- ✅ Visual, step-by-step
- ✅ Super easy

### **Option 2: CLI Tool (For Developers)**

```bash
npm install -g chatgpt-myapi-setup
chatgpt-myapi-setup
```

This will guide you through setup in your terminal and save configuration files.

---

## What You Can Do After Setup

Ask ChatGPT things like:

```
"Send a tweet saying hello world"
"Add a meeting to my calendar tomorrow at 2pm"
"Post to Slack: We're shipping today!"
"List my GitHub repos"
"Create a GitHub repo called my-new-project"
"Post to Facebook: Check out my new project!"
"What's on my calendar for next week?"
"Send a Discord message to #general"
"Create a Notion page called Dashboard"
```

ChatGPT will use your MyApi connection to access these services on your behalf.

---

## Security

Your MyApi token:
- Grants access to all connected OAuth services
- Should be kept private (like a password)
- Can be revoked/regenerated anytime at https://www.myapiai.com/dashboard/tokens

The setup tool:
- Web version: Stores token in browser localStorage (you can clear it anytime)
- CLI version: Stores token in `~/.myapi-chatgpt/` (on your computer only)
- Your token is NEVER sent anywhere except MyApi and ChatGPT

---

## Current Capabilities

### ✅ **Fully Working**
- ✅ Read Twitter timeline
- ✅ Read/create calendar events
- ✅ Read/send Slack messages
- ✅ Read Facebook profile & posts
- ✅ List/create GitHub repos
- ✅ Read Discord profile & servers
- ✅ Read LinkedIn profile
- ✅ Access Notion databases
- ✅ Read Dropbox account

### ⚠️ **Limited (Read-Only)**
- 🔒 Twitter: Can't post yet (need tweet.write scope)
- 🔒 Google: Calendar/Gmail read-only
- 🔒 Facebook: Can't post to feed (need publish_actions)
- 🔒 Dropbox: Can't access files (need files.content.read)
- 🔒 LinkedIn: Can't post updates (need w_member_social)

### ❌ **Not Connected Yet**
- Instagram, TikTok, Threads
- Microsoft 365, Reddit, Trello
- Zoom, HubSpot, Salesforce, Jira

---

## Requirements

- **ChatGPT Plus** subscription ($20/month)
  - Custom GPTs require ChatGPT Plus
  - If you don't have it, start a free trial at https://chatgpt.com

- **MyApi account**
  - Sign up free at https://www.myapiai.com
  - Create/get an API token (starts with `myapi_`)

---

## Troubleshooting

### "I don't have ChatGPT Plus"
- Upgrade at https://chatgpt.com
- Start 7-day free trial to test first

### "My token doesn't work"
Check at https://www.myapiai.com/dashboard/tokens:
- Is it a valid token? (starts with `myapi_`)
- Has it expired?
- Do you have services connected?

### "Service not found"
Go to https://www.myapiai.com/dashboard/oauth:
- Authenticate the service
- Grant requested permissions
- Try again in ChatGPT

### "Permission denied"
Your service doesn't have required permissions.  
Re-authenticate it to request new scopes.

### "Still not working?"
1. Check [CHATGPT_MYAPI_INTEGRATION.md](CHATGPT_MYAPI_INTEGRATION.md) for detailed setup
2. Visit [MyApi Discord](https://discord.gg/myapi) for help
3. Email: support@myapiai.com

---

## How It Works

```
You: "Send a tweet saying hello"
        ↓
ChatGPT: "I'll post that for you"
        ↓
ChatGPT calls: POST /api/v1/services/twitter/proxy
        ↓
MyApi: Authenticates with your Twitter OAuth token
        ↓
Twitter API: Posts the tweet
        ↓
ChatGPT: "Done! Tweet posted ✅"
```

---

## Advanced Setup

### For Developers

See [CHATGPT_MYAPI_INTEGRATION.md](CHATGPT_MYAPI_INTEGRATION.md) for:
- Full technical architecture
- Assistants API integration
- OpenAPI schema details
- Custom tool development

### Using Your Own Custom GPT

If you prefer to create a custom GPT from scratch:

1. Get your token from https://www.myapiai.com/dashboard/tokens
2. Go to https://chatgpt.com/gpts/mine
3. Create a GPT with:
   - **Instructions:** See [CHATGPT_MYAPI_INTEGRATION.md](CHATGPT_MYAPI_INTEGRATION.md)
   - **Action Schema:** https://raw.githubusercontent.com/omribenami/MyApi/main/openapi-chatgpt-schema.yaml
   - **Auth:** Bearer token = your MyApi token

---

## API Services Overview

| Service | Read | Write | Status |
|---------|------|-------|--------|
| Twitter | ✅ | ❌ | Connected |
| Google | ✅ | ❌ | Connected |
| Slack | ✅ | ✅ | Connected |
| Facebook | ✅ | ❌ | Connected |
| GitHub | ✅ | ✅ | Connected |
| Discord | ✅ | ✅ | Connected |
| LinkedIn | ✅ | ❌ | Connected |
| Notion | ✅ | ✅ | Connected |
| Dropbox | ✅ | ❌ | Connected |
| Instagram | ❌ | ❌ | Not Connected |
| TikTok | ❌ | ❌ | Not Connected |
| Microsoft 365 | ❌ | ❌ | Not Connected |
| Reddit | ❌ | ❌ | Not Connected |

---

## FAQ

**Q: Do I need a paid MyApi account?**  
A: No, the free tier is sufficient. Tokens are free. You only pay if you use premium features.

**Q: Can I use this with Claude or other AI?**  
A: The web tool and schema work with any LLM. See [CHATGPT_MYAPI_INTEGRATION.md](CHATGPT_MYAPI_INTEGRATION.md) for Claude/Anthropic integration.

**Q: What data is stored?**  
A: None. ChatGPT calls MyApi in real-time. No caching or data storage.

**Q: Is my token safe?**  
A: Yes, if you keep it private. The setup tools use HTTPS and secure storage. Rotate it anytime at your dashboard.

**Q: Can I share my Custom GPT with others?**  
A: Only if you're comfortable sharing your token. Better to have each person create their own GPT with their own token.

**Q: Will you add more services?**  
A: Yes! Submit feature requests at https://github.com/omribenami/MyApi/issues

---

## Next Steps

1. **Choose a setup method:**
   - Web tool (easiest) or CLI tool (for developers)

2. **Get your token:**
   - https://www.myapiai.com/dashboard/tokens

3. **Complete the 5-minute setup:**
   - Follow the interactive guide

4. **Test it:**
   - Ask ChatGPT to access a service

5. **Done!** 🎉

---

## Support

- 📖 Full documentation: [CHATGPT_MYAPI_INTEGRATION.md](CHATGPT_MYAPI_INTEGRATION.md)
- 🆘 Issues: https://github.com/omribenami/MyApi/issues
- 💬 Chat: https://discord.gg/myapi
- ✉️ Email: support@myapiai.com

---

**Enjoy ChatGPT with the power of MyApi! 🚀**
