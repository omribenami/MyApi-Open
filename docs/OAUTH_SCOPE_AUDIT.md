# OAuth Scopes & Provider Setup Manual

**Production redirect URI base**: `https://www.myapiai.com/api/v1/oauth/callback/{service}`  
**Local dev redirect URI base**: `http://localhost:4500/api/v1/oauth/callback/{service}`

---

## Scope Reference

| Service | Scopes | Notes |
|---------|--------|-------|
| **Google** | `https://www.googleapis.com/auth/userinfo.email` `https://www.googleapis.com/auth/userinfo.profile` `https://mail.google.com/` `https://www.googleapis.com/auth/drive` `https://www.googleapis.com/auth/calendar` | Full Gmail, Drive, and Calendar access |
| **GitHub** | `user repo gist` | Full repo read/write |
| **Slack** | `chat:write channels:read channels:history users:read users.profile:read` | User token scopes (not bot) |
| **Discord** | `identify email guilds` | User identity + server list |
| **WhatsApp** | *(token-based — no OAuth scopes)* | Business API token auth; not standard OAuth2 |
| **Facebook** | `email public_profile` | Basic user identity |
| **Instagram** | `instagram_business_basic instagram_business_content_publish` | Read profile + publish media |
| **Threads** | `threads_basic_access threads_manage_metadata threads_content_publish` | Read + publish threads |
| **TikTok** | `user.info.basic user.info.profile user.info.stats video.list video.upload video.publish comment.list comment.list.pull` | Full video + user access |
| **Twitter/X** | `tweet.read tweet.write users.read offline.access` | Read/write tweets + refresh token |
| **Reddit** | `identity read submit privatemessages` | User identity, read, post, DMs |
| **LinkedIn** | `openid profile email w_member_social` | Identity + posting |
| **Notion** | *(none — access set during auth)* | User selects pages at consent time |
| **Microsoft 365** | `openid profile email offline_access User.Read Mail.Read Mail.Send Calendars.Read Tasks.Read` | Identity, mail read/send, calendar, tasks |
| **Dropbox** | `account_info.read files.content.read files.content.write files.metadata.read files.metadata.write` | Full file read/write |
| **Trello** | `read write` | Full board access |
| **Zoom** | `meeting:read:admin meeting:write:admin user:read:admin` | Meeting management |
| **HubSpot** | `oauth crm.objects.contacts.read crm.objects.contacts.write crm.objects.deals.read crm.objects.deals.write` | Contacts + deals CRM |
| **Salesforce** | `api refresh_token` | Full REST API + offline access |
| **Jira** | `read:jira-user read:jira-work write:jira-work offline_access` | Read/write issues + refresh token |
| **Confluence** | `read:confluence-content.all read:confluence-user write:confluence-content offline_access` | Read/write pages + refresh token |
| **Asana** | `default` | All standard Asana access |
| **Linear** | `read write` | Full Linear access (only two scopes exist) |
| **Box** | `root_readwrite` | Full file system read/write |
| **Airtable** | `data.records:read data.records:write schema.bases:read` | Record read/write + schema access |
| **Figma** | `files:read` | Read-only file access |
| **Canva** | `asset:read asset:write profile:read design:content:read design:content:write design:meta:read` | Full design read/write |
| **Zendesk** | `read write` | Full ticket read/write |
| **Intercom** | *(none — access set by app permissions)* | Permissions configured in developer portal |
| **ClickUp** | *(none — access set by app install)* | All workspaces granted at install time |
| **Monday.com** | `me:read boards:read boards:write updates:read` | Profile, boards, and timeline updates |

---

## Provider Setup Manual

### How to use this manual

For each service below you will find:
- **Platform** — where to create the OAuth app
- **App type** — what kind of app to create
- **Redirect URI** — the exact value to paste into the provider's console
- **Credentials to collect** — what env vars to set in `src/.env`
- **Required scopes** — the permission set your app must be granted
- **Special notes** — gotchas, review processes, or unusual fields

---

### Google

**Platform**: https://console.cloud.google.com  
**App type**: OAuth 2.0 Client ID (Web application)

**Steps**:
1. Create or select a project
2. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Add redirect URI: `https://www.myapiai.com/api/v1/oauth/callback/google`
5. Go to **OAuth consent screen** → add scopes (or request them via the app):
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://mail.google.com/` (full Gmail — requires verification)
   - `https://www.googleapis.com/auth/drive`
   - `https://www.googleapis.com/auth/calendar`
6. Enable the APIs: **Gmail API**, **Google Drive API**, **Google Calendar API**

**Credentials to collect**:
```
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/google
```

**Notes**:
- `https://mail.google.com/` is a sensitive scope — Google requires app verification before granting it to users outside your domain
- Keep the consent screen in **Testing** mode during development; only verified accounts can auth
- `access_type=offline` + `prompt=consent` are already hardcoded in the adapter to force refresh token issuance

---

### GitHub

**Platform**: https://github.com/settings/developers  
**App type**: OAuth App

**Steps**:
1. Go to **Settings → Developer settings → OAuth Apps → New OAuth App**
2. Set **Homepage URL**: `https://www.myapiai.com`
3. Set **Authorization callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/github`
4. After creating, generate a **Client Secret**

**Credentials to collect**:
```
GITHUB_CLIENT_ID=<your-client-id>
GITHUB_CLIENT_SECRET=<your-client-secret>
GITHUB_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/github
```

**Scopes requested**: `user repo gist`  
GitHub scopes are passed at auth time, not configured in the app portal.

**Notes**:
- `repo` gives read/write access to all repositories the user has access to
- GitHub does **not** issue refresh tokens for OAuth Apps — tokens don't expire
- To revoke a token programmatically, use `DELETE /applications/{client_id}/grant`

---

### Slack

**Platform**: https://api.slack.com/apps  
**App type**: Slack App

**Steps**:
1. Click **Create New App → From scratch**
2. Name the app and select a development workspace
3. Go to **OAuth & Permissions**
4. Add **Redirect URL**: `https://www.myapiai.com/api/v1/oauth/callback/slack`
5. Under **User Token Scopes**, add:
   - `chat:write`
   - `channels:read`
   - `channels:history`
   - `users:read`
   - `users.profile:read`
6. Install the app to your workspace to get test tokens; distribute via OAuth for others

**Credentials to collect**:
```
SLACK_CLIENT_ID=<your-client-id>
SLACK_CLIENT_SECRET=<your-client-secret>
SLACK_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/slack
```

**Notes**:
- The adapter uses `user_scope` (not `scope`) — this requests a **user token**, not a bot token
- Do NOT add bot scopes unless you're adding bot functionality; mixing bot + user scopes causes install failures when the app has no bot user
- For distribution to other workspaces, enable **Manage Distribution** in the app settings

---

### Discord

**Platform**: https://discord.com/developers/applications  
**App type**: Application (OAuth2)

**Steps**:
1. Click **New Application**, give it a name
2. Go to **OAuth2 → General**
3. Add redirect: `https://www.myapiai.com/api/v1/oauth/callback/discord`
4. Go to **OAuth2 → URL Generator** to verify scope coverage (for reference only)

**Credentials to collect**:
```
DISCORD_CLIENT_ID=<your-application-id>
DISCORD_CLIENT_SECRET=<your-client-secret>
DISCORD_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/discord
```

**Scopes requested**: `identify email guilds`

**Notes**:
- `identify` = basic user info (username, avatar, ID)
- `email` = verified email address
- `guilds` = list of servers the user belongs to
- Do **not** add `bot` or `guilds.join` — these are bot installation scopes requiring guild management permissions
- Client ID = Application ID (found on the General Information page)

---

### WhatsApp Business

**Platform**: https://developers.facebook.com  
**App type**: Business app with WhatsApp product

**Steps**:
1. Go to **My Apps → Create App → Business**
2. Add the **WhatsApp** product
3. Under **WhatsApp → Getting Started**, note your test phone number and business account ID
4. Go to **WhatsApp → API Setup** to get your temporary access token
5. For production: generate a **permanent system user token** via Business Manager
   - Business Manager → **Settings → Users → System Users**
   - Add a system user, assign the WhatsApp app asset, generate a token

**Credentials to collect**:
```
WHATSAPP_BUSINESS_ACCOUNT_ID=<numeric-account-id>
WHATSAPP_API_TOKEN=<long-lived-system-user-token>
WHATSAPP_WEBHOOK_TOKEN=<any-string-you-choose-for-webhook-verification>
WHATSAPP_APP_SECRET=<app-secret-from-basic-settings>
```

**Notes**:
- This is **not standard OAuth2** — tokens are provided manually, not via redirect flow
- `WHATSAPP_APP_SECRET` is used to verify incoming webhook signatures (X-Hub-Signature-256)
- Webhook URL to register in the console: `https://www.myapiai.com/api/v1/webhooks/whatsapp`
- WhatsApp requires verified business accounts before going live

---

### Facebook

**Platform**: https://developers.facebook.com  
**App type**: Consumer or Business app

**Steps**:
1. Go to **My Apps → Create App → Consumer** (for login use cases)
2. Add the **Facebook Login** product
3. Go to **Facebook Login → Settings**
4. Add **Valid OAuth Redirect URIs**: `https://www.myapiai.com/api/v1/oauth/callback/facebook`
5. Under **App Settings → Basic**, note App ID and App Secret

**Credentials to collect**:
```
FACEBOOK_CLIENT_ID=<app-id>
FACEBOOK_CLIENT_SECRET=<app-secret>
FACEBOOK_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/facebook
```

**Scopes requested**: `email,public_profile`

**Notes**:
- App ID = Client ID in the adapter
- For production access beyond test users: submit the app for **App Review**
- The verify URL fetches `id,name,email,picture` fields from Graph API

---

### Instagram

**Platform**: https://developers.facebook.com  
**App type**: Business app with Instagram product

**Steps**:
1. Go to **My Apps → Create App → Business**
2. Add the **Instagram** product (not "Instagram Basic Display" — that API was shut down Dec 2024)
3. Go to **Instagram → API with Instagram Login**
4. Add redirect URI: `https://www.myapiai.com/api/v1/oauth/callback/instagram`
5. Under **App Settings → Basic**, note App ID and App Secret

**Credentials to collect**:
```
INSTAGRAM_CLIENT_ID=<app-id>
INSTAGRAM_CLIENT_SECRET=<app-secret>
INSTAGRAM_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/instagram
```

**Scopes requested**: `instagram_business_basic,instagram_business_content_publish`

**Notes**:
- App must be of type **Instagram** in the Meta console (not Facebook Login)
- `instagram_business_basic` requires App Review before production use
- `instagram_business_content_publish` requires additional App Review approval
- The Instagram Graph API (not the old Basic Display API) is used — auth URL is `instagram.com/oauth/authorize`

---

### Threads

**Platform**: https://developers.facebook.com  
**App type**: Business app with Threads product

**Steps**:
1. Go to **My Apps → Create App → Business**
2. Add the **Threads** product
3. Go to **Threads → API Setup**
4. Add redirect URI: `https://www.myapiai.com/api/v1/oauth/callback/threads`

**Credentials to collect**:
```
THREADS_CLIENT_ID=<app-id>
THREADS_CLIENT_SECRET=<app-secret>
THREADS_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/threads
```

**Scopes requested**: `threads_basic_access,threads_manage_metadata,threads_content_publish`

**Notes**:
- Threads API launched June 2024; token endpoint is `graph.threads.net`
- `threads_content_publish` requires App Review
- The adapter sends `response_type=code` explicitly (required by Threads)

---

### TikTok

**Platform**: https://developers.tiktok.com  
**App type**: Web app

**Steps**:
1. Sign in with a TikTok developer account
2. Go to **Manage apps → Create app**
3. App type: **Web**
4. Under **Login Kit**: add redirect URI: `https://www.myapiai.com/api/v1/oauth/callback/tiktok`
5. Request the scopes you need in the **Scope** section
6. Submit for review once ready

**Credentials to collect**:
```
TIKTOK_CLIENT_ID=<client-key>        # TikTok calls this "Client Key"
TIKTOK_CLIENT_SECRET=<client-secret>
TIKTOK_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/tiktok
```

**Scopes requested**:
```
user.info.basic
user.info.profile
user.info.stats
video.list
video.upload
video.publish
comment.list
comment.list.pull
```

**Notes**:
- TikTok calls the client ID a **Client Key** — `TIKTOK_CLIENT_ID` and `TIKTOK_CLIENT_KEY` are both accepted
- The auth flow sends `client_key` (not `client_id`) as the param name — handled automatically
- Video upload/publish scopes require separate review and approval
- Verify endpoint upgraded to v2: `https://open.tiktokapis.com/v2/user/info/`

---

### Twitter / X

**Platform**: https://developer.twitter.com  
**App type**: Project + App (OAuth 2.0)

**Steps**:
1. Apply for a developer account if you don't have one
2. Create a **Project** and an **App** inside it
3. Go to **App Settings → User authentication settings**
4. Enable **OAuth 2.0**
5. App type: **Web App, Automated App or Bot**
6. Set **Callback URI**: `https://www.myapiai.com/api/v1/oauth/callback/twitter`
7. Set **Website URL**: `https://www.myapiai.com`
8. Under **Keys and tokens**, copy OAuth 2.0 Client ID and Client Secret

**Credentials to collect**:
```
TWITTER_CLIENT_ID=<oauth2-client-id>
TWITTER_CLIENT_SECRET=<oauth2-client-secret>
TWITTER_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/twitter
```

**Scopes requested**: `tweet.read tweet.write users.read offline.access`

**Notes**:
- The adapter uses **HTTP Basic Auth** for the token endpoint (tokenAuthStyle: 'basic')
- `offline.access` is required to receive a refresh token
- Twitter's PKCE is handled automatically by the GenericOAuthAdapter
- Elevated access may be needed for certain tweet operations

---

### Reddit

**Platform**: https://www.reddit.com/prefs/apps  
**App type**: Web app

**Steps**:
1. Go to **Preferences → Apps → Create an app**
2. Select **web app**
3. Set **redirect uri**: `https://www.myapiai.com/api/v1/oauth/callback/reddit`
4. After creating, note the **client ID** (under the app name) and **secret**

**Credentials to collect**:
```
REDDIT_CLIENT_ID=<app-id-under-app-name>
REDDIT_CLIENT_SECRET=<secret>
REDDIT_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/reddit
```

**Scopes requested**: `identity read submit privatemessages`

**Notes**:
- The adapter sends `duration=permanent` to get a refresh token
- Uses HTTP Basic Auth for the token endpoint
- `modmail` was removed — it requires moderator status on a subreddit; regular users get a permission error

---

### LinkedIn

**Platform**: https://www.linkedin.com/developers/apps  
**App type**: App

**Steps**:
1. Click **Create app**
2. Associate with a LinkedIn Company Page
3. Go to **Auth** tab
4. Add **Authorized redirect URL**: `https://www.myapiai.com/api/v1/oauth/callback/linkedin`
5. Request the required OAuth 2.0 scopes in the **Products** tab:
   - **Sign In with LinkedIn using OpenID Connect** → grants `openid profile email`
   - **Share on LinkedIn** → grants `w_member_social`

**Credentials to collect**:
```
LINKEDIN_CLIENT_ID=<client-id>
LINKEDIN_CLIENT_SECRET=<client-secret>
LINKEDIN_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/linkedin
```

**Scopes requested**: `openid profile email w_member_social`

**Notes**:
- `w_member_social` requires applying for the **Share on LinkedIn** product and awaiting approval
- LinkedIn requires a company page to create an app
- The adapter sends `response_type=code` as an extra param (required by LinkedIn)

---

### Notion

**Platform**: https://www.notion.so/my-integrations  
**App type**: Public Integration

**Steps**:
1. Click **+ New integration**
2. Set integration type: **Public**
3. Add **Redirect URIs**: `https://www.myapiai.com/api/v1/oauth/callback/notion`
4. Set capabilities: **Read content**, **Update content**, **Insert content**
5. After saving, go to the integration page to get **OAuth client ID** and **OAuth client secret**

**Credentials to collect**:
```
NOTION_CLIENT_ID=<oauth-client-id>
NOTION_CLIENT_SECRET=<oauth-client-secret>
NOTION_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/notion
```

**Scopes**: None (Notion doesn't use OAuth scope params — users select pages during auth)

**Notes**:
- The adapter sends `owner=user` to ensure the token is scoped to the user, not a bot
- Uses HTTP Basic Auth for the token endpoint
- Capabilities (read/write) are configured in the integration settings, not via scope strings

---

### Microsoft 365

**Platform**: https://portal.azure.com  
**App type**: Azure App Registration

**Steps**:
1. Go to **Azure Active Directory → App registrations → New registration**
2. Name the app; select **Accounts in any organizational directory and personal Microsoft accounts**
3. Set **Redirect URI**: Web → `https://www.myapiai.com/api/v1/oauth/callback/microsoft365`
4. Go to **Certificates & secrets → New client secret**; copy immediately
5. Go to **API permissions → Add a permission → Microsoft Graph** and add:
   - `openid`, `profile`, `email`, `offline_access` (delegated)
   - `User.Read` (delegated)
   - `Mail.Read` (delegated)
   - `Mail.Send` (delegated)
   - `Calendars.Read` (delegated)
   - `Tasks.Read` (delegated)
6. Click **Grant admin consent** (if your org requires it)

**Credentials to collect**:
```
MICROSOFT365_CLIENT_ID=<application-id>
MICROSOFT365_CLIENT_SECRET=<client-secret-value>
MICROSOFT365_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/microsoft365
```

**Scopes requested**: `openid profile email offline_access User.Read Mail.Read Mail.Send Calendars.Read Tasks.Read`

**Notes**:
- Application (client) ID ≠ Object ID — use the **Application ID**
- Client secrets expire; set a reminder to rotate before expiry
- `offline_access` is required for refresh tokens

---

### Dropbox

**Platform**: https://www.dropbox.com/developers/apps  
**App type**: Scoped access app

**Steps**:
1. Click **Create app**
2. Choose **Scoped access** and **Full Dropbox** access
3. Name the app
4. Go to the **Permissions** tab and enable:
   - `account_info.read`
   - `files.content.read`
   - `files.content.write`
   - `files.metadata.read`
   - `files.metadata.write`
5. Go to **Settings** tab
6. Add redirect URI: `https://www.myapiai.com/api/v1/oauth/callback/dropbox`

**Credentials to collect**:
```
DROPBOX_CLIENT_ID=<app-key>
DROPBOX_CLIENT_SECRET=<app-secret>
DROPBOX_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/dropbox
```

**Scopes requested**: `account_info.read files.content.read files.content.write files.metadata.read files.metadata.write`

**Notes**:
- App Key = Client ID, App Secret = Client Secret
- Scopes must be enabled in the **Permissions** tab before they can be requested at auth time
- For production: submit the app for **Production approval** (required for >50 users)

---

### Trello

**Platform**: https://trello.com/power-ups/admin  
**App type**: Power-Up

**Steps**:
1. Click **New** to create a Power-Up
2. Fill in name, workspace, and iframe URL (can be placeholder)
3. On the Power-Up page, go to **API Key** tab
4. Copy the **API Key** (= Client ID)
5. Generate a **Secret** token
6. Add allowed origins: `https://www.myapiai.com`

**Credentials to collect**:
```
TRELLO_CLIENT_ID=<api-key>
TRELLO_CLIENT_SECRET=<secret>
TRELLO_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/trello
```

**Scopes requested**: `read,write`

**Notes**:
- Trello uses OAuth 1.0a (legacy) — the GenericOAuthAdapter handles this via the standard code flow
- `read,write` grants access to boards, cards, lists
- Add `account` scope for profile management if needed

---

### Zoom

**Platform**: https://marketplace.zoom.us  
**App type**: OAuth app

**Steps**:
1. Click **Develop → Build App → OAuth**
2. Set app name and type: **Account-level app**
3. Go to **App Credentials**
4. Add **Redirect URL for OAuth**: `https://www.myapiai.com/api/v1/oauth/callback/zoom`
5. Add **OAuth allow list**: `https://www.myapiai.com`
6. Go to **Scopes** tab and add:
   - `meeting:read:admin`
   - `meeting:write:admin`
   - `user:read:admin`

**Credentials to collect**:
```
ZOOM_CLIENT_ID=<client-id>
ZOOM_CLIENT_SECRET=<client-secret>
ZOOM_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/zoom
```

**Scopes requested**: `meeting:read:admin meeting:write:admin user:read:admin`

**Notes**:
- Zoom uses HTTP Basic Auth for the token endpoint (tokenAuthStyle: 'basic') — handled automatically
- `:admin` scopes require an account-level OAuth app; remove `:admin` suffix for user-level apps
- After scoping, submit for **Zoom App Marketplace review** before public distribution

---

### HubSpot

**Platform**: https://app.hubspot.com/developer  
**App type**: Public app

**Steps**:
1. Go to **Apps → Create app**
2. Go to **Auth** tab
3. Set **Redirect URL**: `https://www.myapiai.com/api/v1/oauth/callback/hubspot`
4. Under **Scopes**, add:
   - `oauth` (required for token introspection endpoint)
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`

**Credentials to collect**:
```
HUBSPOT_CLIENT_ID=<client-id>
HUBSPOT_CLIENT_SECRET=<client-secret>
HUBSPOT_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/hubspot
```

**Scopes requested**: `oauth crm.objects.contacts.read crm.objects.contacts.write crm.objects.deals.read crm.objects.deals.write`

**Notes**:
- The `oauth` scope is required to use the token introspection endpoint (`/oauth/v1/access-tokens/`)
- HubSpot scopes are space-separated in the adapter but shown comma-separated in the portal
- Add `crm.objects.companies.read/write` if company data is needed

---

### Salesforce

**Platform**: https://login.salesforce.com (or sandbox: https://test.salesforce.com)  
**App type**: Connected App

**Steps**:
1. Go to **Setup → App Manager → New Connected App**
2. Fill in app name, email, and description
3. Enable **OAuth Settings**
4. Set **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/salesforce`
5. Add scopes:
   - `Access and manage your data (api)`
   - `Perform requests on your behalf at any time (refresh_token, offline_access)`
6. Save and wait ~10 minutes for propagation
7. Go to the app → **Manage Consumer Details** to get credentials

**Credentials to collect**:
```
SALESFORCE_CLIENT_ID=<consumer-key>
SALESFORCE_CLIENT_SECRET=<consumer-secret>
SALESFORCE_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/salesforce
```

**Scopes requested**: `api refresh_token`

**Notes**:
- Consumer Key = Client ID, Consumer Secret = Client Secret
- `api` grants access to all Salesforce REST/SOAP APIs
- For sandbox installs, change the auth URL to `https://test.salesforce.com/services/oauth2/authorize`

---

### Jira

**Platform**: https://developer.atlassian.com/console/myapps  
**App type**: OAuth 2.0 (3LO) app

**Steps**:
1. Click **Create** → **OAuth 2.0 integration**
2. Name the app
3. Go to **Authorization**
4. Set **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/jira`
5. Go to **Permissions** → **Jira API** → **Add** and enable:
   - `read:jira-user`
   - `read:jira-work`
   - `write:jira-work`
6. Go to **Settings** to get Client ID and Secret

**Credentials to collect**:
```
JIRA_CLIENT_ID=<client-id>
JIRA_CLIENT_SECRET=<client-secret>
JIRA_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/jira
```

**Scopes requested**: `read:jira-user read:jira-work write:jira-work offline_access`

**Notes**:
- `offline_access` is required to get a refresh token (Atlassian OAuth 2.0 3LO)
- The adapter sends `audience=api.atlassian.com` and `prompt=consent` (required by Atlassian)
- Same app can serve both Jira and Confluence (different scope sets)

---

### Confluence

**Platform**: https://developer.atlassian.com/console/myapps  
**App type**: OAuth 2.0 (3LO) app — can share with Jira app or create separate

**Steps**:
1. Same as Jira app creation above
2. Under **Permissions** → **Confluence API** → **Add** and enable:
   - `read:confluence-content.all`
   - `read:confluence-user`
   - `write:confluence-content`
3. Get Client ID and Secret from **Settings**

**Credentials to collect**:
```
CONFLUENCE_CLIENT_ID=<client-id>
CONFLUENCE_CLIENT_SECRET=<client-secret>
CONFLUENCE_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/confluence
```

**Scopes requested**: `read:confluence-content.all read:confluence-user write:confluence-content offline_access`

**Notes**:
- If combining Jira + Confluence in one Atlassian app: use the same Client ID/Secret for both; the scopes are additive

---

### Asana

**Platform**: https://app.asana.com/0/developer-console  
**App type**: App

**Steps**:
1. Click **Create new app**
2. Fill in name and description
3. Add **Redirect URL**: `https://www.myapiai.com/api/v1/oauth/callback/asana`
4. Click **Save**; copy **Client ID** and **Client Secret**

**Credentials to collect**:
```
ASANA_CLIENT_ID=<client-id>
ASANA_CLIENT_SECRET=<client-secret>
ASANA_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/asana
```

**Scopes requested**: `default`

**Notes**:
- `default` is the only scope Asana supports and grants full standard access
- Uses HTTP Basic Auth for token exchange
- Tokens don't expire unless revoked

---

### Linear

**Platform**: https://linear.app/settings/api  
**App type**: OAuth2 Application

**Steps**:
1. Go to **API → OAuth2 Applications → Create new**
2. Set **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/linear`
3. After saving, copy **Client ID** and **Client Secret**

**Credentials to collect**:
```
LINEAR_CLIENT_ID=<client-id>
LINEAR_CLIENT_SECRET=<client-secret>
LINEAR_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/linear
```

**Scopes requested**: `read write`

**Notes**:
- Linear only has two scopes: `read` and `write`
- The adapter sends `response_type=code` and `actor=user` (required by Linear)

---

### Box

**Platform**: https://app.box.com/developers/console  
**App type**: Custom App (OAuth 2.0)

**Steps**:
1. Click **Create New App → Custom App**
2. Select **User Authentication (OAuth 2.0)**
3. Name the app
4. Under **Configuration**:
   - Add redirect URI: `https://www.myapiai.com/api/v1/oauth/callback/box`
   - Set **Scopes**: Read all files and folders + Write all files and folders
5. Copy **Client ID** and **Client Secret** from the Configuration tab

**Credentials to collect**:
```
BOX_CLIENT_ID=<client-id>
BOX_CLIENT_SECRET=<client-secret>
BOX_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/box
```

**Scopes requested**: `root_readwrite`

**Notes**:
- `root_readwrite` is a Box-specific scope covering full file system access
- For enterprise use: app must be authorized by a Box Admin in the Admin Console

---

### Airtable

**Platform**: https://airtable.com/create/oauth  
**App type**: OAuth Integration

**Steps**:
1. Click **Register an OAuth integration**
2. Set **Redirect URL**: `https://www.myapiai.com/api/v1/oauth/callback/airtable`
3. Under **Scopes**, select:
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`
4. Save and copy **Client ID** and **Client Secret**

**Credentials to collect**:
```
AIRTABLE_CLIENT_ID=<client-id>
AIRTABLE_CLIENT_SECRET=<client-secret>
AIRTABLE_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/airtable
```

**Scopes requested**: `data.records:read data.records:write schema.bases:read`

**Notes**:
- Uses HTTP Basic Auth for token exchange
- Airtable issues short-lived access tokens (1 hour) with refresh tokens

---

### Figma

**Platform**: https://www.figma.com/developers/apps  
**App type**: App

**Steps**:
1. Click **Create a new app**
2. Set **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/figma`
3. Note the **Client ID** and **Client Secret**

**Credentials to collect**:
```
FIGMA_CLIENT_ID=<client-id>
FIGMA_CLIENT_SECRET=<client-secret>
FIGMA_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/figma
```

**Scopes requested**: `files:read`

**Notes**:
- Figma only supports `files:read` as a scope — no write access via OAuth
- For write operations, Figma uses Plugins/Widgets with separate auth

---

### Canva

**Platform**: https://www.canva.com/developers  
**App type**: Integration

**Steps**:
1. Go to **Developer Portal → Create integration**
2. Go to **Configure → Authentication**
3. Set **Redirect URL**: `https://www.myapiai.com/api/v1/oauth/callback/canva`
4. Enable required scopes in the integration settings
5. Copy **Client ID** and **Client Secret**

**Credentials to collect**:
```
CANVA_CLIENT_ID=<client-id>
CANVA_CLIENT_SECRET=<client-secret>
CANVA_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/canva
```

**Scopes requested**: `asset:read asset:write profile:read design:content:read design:content:write design:meta:read`

**Notes**:
- Canva's OAuth 2.0 is PKCE-based; the GenericOAuthAdapter handles this
- Apps must go through Canva review before accessing production users

---

### Zendesk

**Platform**: Your Zendesk instance: `https://{subdomain}.zendesk.com`  
**App type**: OAuth Client

**Steps**:
1. Log in as admin → **Admin Center → Apps and integrations → APIs → Zendesk API**
2. Enable **Token Access**
3. Go to **OAuth Clients → Add OAuth client**
4. Set **Redirect URLs**: `https://www.myapiai.com/api/v1/oauth/callback/zendesk`
5. Note **Unique Identifier** (= Client ID) and **Secret**

**Credentials to collect**:
```
ZENDESK_CLIENT_ID=<unique-identifier>
ZENDESK_CLIENT_SECRET=<secret>
ZENDESK_SUBDOMAIN=<your-subdomain>       # e.g. "mycompany" from mycompany.zendesk.com
ZENDESK_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/zendesk
```

**Scopes requested**: `read write`

**Notes**:
- `ZENDESK_SUBDOMAIN` is required — all Zendesk API URLs are subdomain-specific
- The adapter constructs auth/token/verify URLs dynamically from `ZENDESK_SUBDOMAIN`

---

### Intercom

**Platform**: https://app.intercom.com/a/apps/_/developer-hub  
**App type**: Development App

**Steps**:
1. Go to **Developer Hub → Your apps → New app**
2. Under **Authentication**, set **Redirect URLs**: `https://www.myapiai.com/api/v1/oauth/callback/intercom`
3. Note the **Client ID** and **Client Secret**

**Credentials to collect**:
```
INTERCOM_CLIENT_ID=<client-id>
INTERCOM_CLIENT_SECRET=<client-secret>
INTERCOM_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/intercom
```

**Scopes**: None (Intercom access permissions are set in the app settings, not via OAuth scope params)

**Notes**:
- Intercom uses implicit scopes — no `scope` parameter is sent; access is controlled by what permissions the app is granted in the developer portal
- For marketplace distribution: submit for Intercom App Review

---

### ClickUp

**Platform**: https://app.clickup.com/settings/apps  
**App type**: OAuth App

**Steps**:
1. Go to **Settings → Integrations → ClickUp API → Create an App**
2. Name the app
3. Set **Redirect URL**: `https://www.myapiai.com/api/v1/oauth/callback/clickup`
4. Copy **Client ID** and **Client Secret**

**Credentials to collect**:
```
CLICKUP_CLIENT_ID=<client-id>
CLICKUP_CLIENT_SECRET=<client-secret>
CLICKUP_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/clickup
```

**Scopes**: None (ClickUp does not use OAuth scope parameters — all permissions granted at app install)

**Notes**:
- ClickUp grants access to all workspaces the user belongs to upon install
- No scope granularity is available via the OAuth flow

---

### Monday.com

**Platform**: https://monday.com/developers/apps  
**App type**: App

**Steps**:
1. Go to **Developer Center → Create app**
2. Under **OAuth**, set **Redirect URL**: `https://www.myapiai.com/api/v1/oauth/callback/monday`
3. Under **Permissions**, add:
   - `me:read`
   - `boards:read`
   - `boards:write`
   - `updates:read`
4. Copy **Client ID** and **Client Secret**

**Credentials to collect**:
```
MONDAY_CLIENT_ID=<client-id>
MONDAY_CLIENT_SECRET=<client-secret>
MONDAY_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/monday
```

**Scopes requested**: `me:read boards:read boards:write updates:read`

**Notes**:
- Monday.com does not have a `/me` verify endpoint; profile info is obtained via the GraphQL API separately
- Scopes must be listed in the app permissions before users will see them in the consent screen

---

## Environment Variable Reference

Complete list of all env vars for all 31 services:

```bash
# Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/google
GOOGLE_SCOPE=           # optional override

# GitHub
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/github

# Slack
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/slack

# Discord
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/discord

# WhatsApp Business
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_API_TOKEN=
WHATSAPP_WEBHOOK_TOKEN=
WHATSAPP_APP_SECRET=

# Facebook
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
FACEBOOK_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/facebook

# Instagram
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
INSTAGRAM_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/instagram

# Threads
THREADS_CLIENT_ID=
THREADS_CLIENT_SECRET=
THREADS_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/threads

# TikTok
TIKTOK_CLIENT_ID=       # also accepted as TIKTOK_CLIENT_KEY
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/tiktok

# Twitter / X
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
TWITTER_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/twitter

# Reddit
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/reddit

# LinkedIn
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/linkedin

# Notion
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
NOTION_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/notion

# Microsoft 365
MICROSOFT365_CLIENT_ID=
MICROSOFT365_CLIENT_SECRET=
MICROSOFT365_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/microsoft365

# Dropbox
DROPBOX_CLIENT_ID=
DROPBOX_CLIENT_SECRET=
DROPBOX_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/dropbox

# Trello
TRELLO_CLIENT_ID=
TRELLO_CLIENT_SECRET=
TRELLO_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/trello

# Zoom
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
ZOOM_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/zoom

# HubSpot
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
HUBSPOT_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/hubspot

# Salesforce
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=
SALESFORCE_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/salesforce

# Jira
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=
JIRA_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/jira

# Confluence
CONFLUENCE_CLIENT_ID=
CONFLUENCE_CLIENT_SECRET=
CONFLUENCE_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/confluence

# Asana
ASANA_CLIENT_ID=
ASANA_CLIENT_SECRET=
ASANA_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/asana

# Linear
LINEAR_CLIENT_ID=
LINEAR_CLIENT_SECRET=
LINEAR_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/linear

# Box
BOX_CLIENT_ID=
BOX_CLIENT_SECRET=
BOX_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/box

# Airtable
AIRTABLE_CLIENT_ID=
AIRTABLE_CLIENT_SECRET=
AIRTABLE_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/airtable

# Figma
FIGMA_CLIENT_ID=
FIGMA_CLIENT_SECRET=
FIGMA_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/figma

# Canva
CANVA_CLIENT_ID=
CANVA_CLIENT_SECRET=
CANVA_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/canva

# Zendesk
ZENDESK_CLIENT_ID=
ZENDESK_CLIENT_SECRET=
ZENDESK_SUBDOMAIN=      # just the subdomain, e.g. "mycompany"
ZENDESK_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/zendesk

# Intercom
INTERCOM_CLIENT_ID=
INTERCOM_CLIENT_SECRET=
INTERCOM_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/intercom

# ClickUp
CLICKUP_CLIENT_ID=
CLICKUP_CLIENT_SECRET=
CLICKUP_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/clickup

# Monday.com
MONDAY_CLIENT_ID=
MONDAY_CLIENT_SECRET=
MONDAY_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/monday
```
