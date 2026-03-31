# MyApi → ChatGPT Connector: Setup Instructions

This file tells you exactly what's done, what's left, and every step required to go live on the ChatGPT Store.

---

## What's already built (no action needed)

- [x] OAuth 2.0 authorization server running at `https://www.myapiai.com`
- [x] Consent page served at `/api/v1/oauth-server/authorize`
- [x] Token exchange endpoint at `/api/v1/oauth-server/token`
- [x] OpenAPI schema hosted at `https://www.myapiai.com/api/v1/oauth-server/openapi.yaml`
- [x] Privacy policy page live at `https://www.myapiai.com/chatgpt-privacy`
- [x] Connectors page in the MyApi dashboard under AI & Data → Connectors
- [x] ChatGPT OAuth client auto-created on server startup (client ID: `chatgpt`)

---

## What's left — your action items

### Step 1 — Lock in the client secret

The server auto-generates a client secret from your `ENCRYPTION_KEY` on every startup.
To lock it to a fixed value so it never changes:

1. Start the server: `node src/index.js`
2. Look for this line in the logs:
   ```
   [OAuthServer] Client secret (set CHATGPT_OAUTH_CLIENT_SECRET to fix): abc123...
   ```
3. Copy that value and add it to your `.env`:
   ```env
   CHATGPT_OAUTH_CLIENT_SECRET=abc123...
   ```
4. Restart the server. The secret is now permanent.

> **Why this matters:** If you don't set this, the secret changes if your `ENCRYPTION_KEY` changes (e.g. after a server migration). Setting it explicitly prevents broken OAuth connections.

---

### Step 2 — Create the Custom GPT

1. Go to [chat.openai.com](https://chat.openai.com)
2. Click your avatar (top-right) → **My GPTs** → **Create a GPT**
3. Switch to the **Configure** tab (not the chat tab)

**Fill in:**

| Field | Value |
|-------|-------|
| Name | `MyApi Assistant` |
| Description | `Access your MyApi account — identity, personas, knowledge base, and connected services. Authorize once, use forever.` |
| Instructions | Copy the full content of `system-prompt.md` (in this folder) |

**Conversation starters** (copy these in):
- What's my current persona?
- Show me my knowledge base
- Which services am I connected to?
- What does my AI context look like?

---

### Step 3 — Add the Action with OAuth

1. In the Configure tab → scroll down → click **"Create new action"**
2. In the **Authentication** section → select **OAuth**

**Fill in the Authentication form:**

| Field | Value |
|-------|-------|
| Client ID | `chatgpt` |
| Client Secret | *(from Step 1 — your `CHATGPT_OAUTH_CLIENT_SECRET`)* |
| Authorization URL | `https://www.myapiai.com/api/v1/oauth-server/authorize` |
| Token URL | `https://www.myapiai.com/api/v1/oauth-server/token` |
| Scope | `full` |
| Token Exchange Method | `Default (POST request)` |

3. Click **Save** on the authentication form

---

### Step 4 — Import the OpenAPI Schema

In the **Schema** field of the Action editor:

**Option A — Import from URL (easiest):**
Click "Import from URL" and paste:
```
https://www.myapiai.com/api/v1/oauth-server/openapi.yaml
```

**Option B — Paste directly:**
Copy the full content of `openapi.yaml` (in this folder) and paste it into the Schema field.

After importing, you should see the available operations listed:
- `getIdentity`
- `listPersonas` / `getPersona`
- `listKnowledgeDocs` / `getKnowledgeDoc`
- `listServices`
- `getBrainContext`
- `listNotifications`

---

### Step 5 — Copy the Callback URL → update your server

After saving the Action, ChatGPT displays a **Callback URL** like:
```
https://chatgpt.com/aip/g-XXXXXXXXXXXX/oauth/callback
```

You MUST add this to your server or OAuth will fail when users try to authorize.

1. Copy the full callback URL from ChatGPT
2. Open your `.env` file on the server
3. Add or update:
   ```env
   CHATGPT_OAUTH_REDIRECT_URIS=https://chatgpt.com/aip/g-XXXXXXXXXXXX/oauth/callback
   ```
   *(Replace `g-XXXXXXXXXXXX` with your actual GPT ID)*
4. Restart the server: `node src/index.js` (or however you run it in production)

> **Note:** Until you do this, the OAuth flow will be blocked with `invalid_redirect_uri`. The server logs exact-match validation errors if this isn't set correctly.

---

### Step 6 — Test the OAuth flow end-to-end

Before publishing, test that everything works:

1. In the GPT preview (right side of the editor), type: **"What's my identity?"**
2. ChatGPT should say: *"To use this action, you need to sign in to MyApi"* — click the button
3. Your browser opens `https://www.myapiai.com/api/v1/oauth-server/authorize`
4. You should see the MyApi consent page with your username
5. Click **Authorize**
6. You're redirected back to ChatGPT, and it answers your question

**If the consent page shows "Sign in required" instead of your username:**
You need to be logged into your MyApi dashboard in the same browser. Open `https://www.myapiai.com/dashboard/` in a tab, log in, then try the OAuth flow again.

**If you see `invalid_redirect_uri`:**
The callback URL in your `.env` doesn't match exactly. Double-check Step 5.

**If you see `invalid_client`:**
The client secret doesn't match. Re-check Step 1.

---

### Step 7 — Add a profile picture

ChatGPT Store listings need a profile picture. You can:
- Use the MyApi logo (export it from the dashboard)
- Generate one with DALL-E inside the GPT editor (click the image in the Configure tab)

---

### Step 8 — Publish to the ChatGPT Store

1. Click **Save** in the top-right of the GPT editor
2. Choose visibility:
   - **Only me** — private, for testing
   - **Anyone with a link** — share with a URL, not listed in store
   - **Everyone** — listed in the ChatGPT GPT Store (requires OpenAI review)
3. Set the **Privacy Policy URL** to:
   ```
   https://www.myapiai.com/chatgpt-privacy
   ```
4. If publishing to Everyone: submit for OpenAI review. They check that the OAuth flow works, the privacy policy is accessible, and the GPT behaves as described.

---

## Environment variables summary

All vars that must be set in your `.env`:

```env
# Already set:
PUBLIC_URL=https://www.myapiai.com

# Set after Step 1:
CHATGPT_OAUTH_CLIENT_ID=chatgpt
CHATGPT_OAUTH_CLIENT_SECRET=<from server startup logs>

# Set after Step 5 (once you have the GPT ID):
CHATGPT_OAUTH_REDIRECT_URIS=https://chatgpt.com/aip/g-XXXXXXXXXXXX/oauth/callback
```

---

## How users experience it

Once published, a user's flow is:

1. User finds **MyApi Assistant** in the ChatGPT Store → clicks **Start chat**
2. They type anything that needs your data (e.g. "What's my persona?")
3. ChatGPT shows: *"MyApi Assistant needs to connect to MyApi — Sign in"*
4. User clicks Sign In → sees the MyApi consent page → clicks **Authorize**
5. They're returned to ChatGPT. The question is answered.
6. **Every future conversation**: silent, automatic — no sign-in prompt again

Users can revoke access at any time:
**MyApi Dashboard → Token Vault → find "ChatGPT (OAuth)" → Revoke**

---

## Files in this folder

| File | Purpose |
|------|---------|
| `instructions.md` | This file — setup guide |
| `openapi.yaml` | API schema for the GPT Actions editor |
| `system-prompt.md` | Paste this as the GPT's Instructions |
| `privacy-policy.md` | Hosted at `/chatgpt-privacy` — required for Store listing |
| `README.md` | Technical reference |
