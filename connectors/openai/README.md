# MyApi GPT — ChatGPT Store App

This directory contains everything needed to create and publish the **MyApi Assistant** Custom GPT on the ChatGPT Store.

## What it does

MyApi Assistant lets ChatGPT users interact with their MyApi account through natural conversation — reading their identity, personas, knowledge base, and connected services. Users authorize once with OAuth and never paste tokens.

## Files

| File | Purpose |
|------|---------|
| `openapi.yaml` | OpenAPI 3.1 schema — paste this into the GPT Actions editor |
| `system-prompt.md` | Copy this as the GPT's Instructions |
| `privacy-policy.md` | Host this publicly; required for GPT Store submission |

---

## Step-by-step: Create the GPT

### Prerequisites
1. MyApi running at `https://www.myapiai.com`
2. `CHATGPT_OAUTH_CLIENT_SECRET` set in your `.env` (check server startup logs for the value)
3. `PUBLIC_URL=https://www.myapiai.com` in your `.env`

---

### Step 1 — Create the GPT

1. Go to [chat.openai.com](https://chat.openai.com)
2. Click your avatar → **My GPTs** → **Create a GPT**
3. Switch to the **Configure** tab

**Name:** `MyApi Assistant`

**Description:**
```
Access your MyApi account — identity, personas, knowledge base, and connected services. Authorize once, use forever.
```

**Instructions:** Copy the full content of `system-prompt.md`

**Conversation starters:**
- What's my current persona?
- Show me my knowledge base
- Which services am I connected to?
- What does my AI context look like?

---

### Step 2 — Add Actions (OAuth API)

1. In the Configure tab → **Create new action**
2. In the **Authentication** section → choose **OAuth**
3. Fill in:
   - **Client ID:** `chatgpt` *(or your `CHATGPT_OAUTH_CLIENT_ID` env var)*
   - **Client Secret:** *(from your `.env` `CHATGPT_OAUTH_CLIENT_SECRET` or server startup log)*
   - **Authorization URL:** `https://www.myapiai.com/api/v1/oauth-server/authorize`
   - **Token URL:** `https://www.myapiai.com/api/v1/oauth-server/token`
   - **Scope:** `full`
   - **Token Exchange Method:** `Default (POST request)`

4. Copy the **Callback URL** shown by ChatGPT — it looks like:
   `https://chatgpt.com/aip/g-XXXXXXXXXXXX/oauth/callback`

5. **Important:** Add that callback URL to your `.env`:
   ```
   CHATGPT_OAUTH_REDIRECT_URIS=https://chatgpt.com/aip/g-XXXXXXXXXXXX/oauth/callback
   ```
   Then restart the server.

6. In the **Schema** field → paste the full content of `openapi.yaml`

7. Click **Save**

---

### Step 3 — Test

1. In the GPT preview, type: *"What's my identity?"*
2. ChatGPT will ask you to sign in to MyApi
3. You'll see the MyApi authorization page → click **Authorize**
4. The GPT will now have access and answer your question

---

### Step 4 — Publish to GPT Store

1. In the GPT editor, click **Save** → choose **Everyone** (or **Anyone with link** for testing)
2. Add a profile picture and confirm the privacy policy URL: `https://www.myapiai.com/chatgpt-privacy`
3. Submit for review if you want it in the GPT Store browsable directory

---

## OAuth flow diagram

```
User types in ChatGPT
        ↓
ChatGPT: "Sign in to MyApi?" → user clicks Sign In
        ↓
Browser → https://www.myapiai.com/api/v1/oauth-server/authorize
        ↓
MyApi consent page → user clicks Authorize
        ↓
Redirect to ChatGPT callback with auth code
        ↓
ChatGPT calls /api/v1/oauth-server/token → gets access token
        ↓
ChatGPT stores token (never shown to user again)
        ↓
All future GPT calls use the token automatically
```

## Environment variables

Add these to your `.env`:

```env
# ChatGPT OAuth Server
PUBLIC_URL=https://www.myapiai.com
CHATGPT_OAUTH_CLIENT_ID=chatgpt
CHATGPT_OAUTH_CLIENT_SECRET=your-secret-from-startup-logs
CHATGPT_OAUTH_REDIRECT_URIS=https://chatgpt.com/aip/g-XXXXXXXXXXXX/oauth/callback
```

## Revoking access

Users can revoke ChatGPT's access at any time:
- MyApi Dashboard → **Token Vault** → find the token labeled **"ChatGPT (OAuth)"** → revoke
