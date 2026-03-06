# MyApi Services Integration Manual

**Base URL**: `https://www.myapiai.com`
**OAuth Callback Pattern**: `https://www.myapiai.com/api/v1/oauth/callback/{service_name}`

---

## Quick Reference

| Service | Auth Type | Callback URL | Dev Portal |
|---------|-----------|-------------|------------|
| Google | OAuth2 | `/api/v1/oauth/callback/google` | [console.cloud.google.com](https://console.cloud.google.com) |
| GitHub | OAuth2 | `/api/v1/oauth/callback/github` | [github.com/settings/developers](https://github.com/settings/developers) |
| Facebook | OAuth2 | `/api/v1/oauth/callback/facebook` | [developers.facebook.com](https://developers.facebook.com) |
| Twitter/X | OAuth2 | `/api/v1/oauth/callback/twitter` | [developer.twitter.com](https://developer.twitter.com) |
| LinkedIn | OAuth2 | `/api/v1/oauth/callback/linkedin` | [linkedin.com/developers](https://www.linkedin.com/developers) |
| Instagram | OAuth2 | `/api/v1/oauth/callback/instagram` | [developers.facebook.com](https://developers.facebook.com) |
| TikTok | OAuth2 | `/api/v1/oauth/callback/tiktok` | [developers.tiktok.com](https://developers.tiktok.com) |
| Reddit | OAuth2 | `/api/v1/oauth/callback/reddit` | [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) |
| YouTube | OAuth2 | `/api/v1/oauth/callback/youtube` | [console.cloud.google.com](https://console.cloud.google.com) |
| Twitch | OAuth2 | `/api/v1/oauth/callback/twitch` | [dev.twitch.tv](https://dev.twitch.tv/console) |
| Bluesky | JWT | N/A (no callback) | [docs.bsky.app](https://docs.bsky.app) |
| Mastodon | OAuth2 | `/api/v1/oauth/callback/mastodon` | [docs.joinmastodon.org](https://docs.joinmastodon.org) |
| GitLab | OAuth2 | `/api/v1/oauth/callback/gitlab` | [gitlab.com/-/profile/applications](https://gitlab.com/-/profile/applications) |
| Bitbucket | OAuth2 | `/api/v1/oauth/callback/bitbucket` | [bitbucket.org/account/settings](https://bitbucket.org/account/settings) |
| Azure DevOps | OAuth2 | `/api/v1/oauth/callback/azuredevops` | [aex.dev.azure.com](https://aex.dev.azure.com) |
| Notion | OAuth2 | `/api/v1/oauth/callback/notion` | [notion.so/my-integrations](https://www.notion.so/my-integrations) |
| Asana | OAuth2 | `/api/v1/oauth/callback/asana` | [asana.com/developers](https://asana.com/developers) |
| Trello | OAuth2 | `/api/v1/oauth/callback/trello` | [trello.com/power-ups/admin](https://trello.com/power-ups/admin) |
| Jira | OAuth2 | `/api/v1/oauth/callback/jira` | [developer.atlassian.com](https://developer.atlassian.com/console/myapps) |
| PayPal | OAuth2 | `/api/v1/oauth/callback/paypal` | [developer.paypal.com](https://developer.paypal.com/dashboard) |
| Shopify | OAuth2 | `/api/v1/oauth/callback/shopify` | [partners.shopify.com](https://partners.shopify.com) |
| Square | OAuth2 | `/api/v1/oauth/callback/square` | [developer.squareup.com](https://developer.squareup.com/apps) |
| Mattermost | OAuth2 | `/api/v1/oauth/callback/mattermost` | Self-hosted |
| Azure | OAuth2 | `/api/v1/oauth/callback/azure` | [portal.azure.com](https://portal.azure.com) |
| Google Analytics | OAuth2 | `/api/v1/oauth/callback/googleanalytics` | [console.cloud.google.com](https://console.cloud.google.com) |
| Stripe | API Key | N/A | [dashboard.stripe.com](https://dashboard.stripe.com/apikeys) |
| Travis CI | Token | N/A | [app.travis-ci.com/account/preferences](https://app.travis-ci.com/account/preferences) |
| CircleCI | Token | N/A | [app.circleci.com/settings/user/tokens](https://app.circleci.com/settings/user/tokens) |
| Airtable | Token | N/A | [airtable.com/create/tokens](https://airtable.com/create/tokens) |
| Monday.com | Token | N/A | [monday.com/developers](https://monday.com/developers) |
| ClickUp | Token | N/A | [app.clickup.com/settings](https://app.clickup.com/settings) |
| Linear | Token | N/A | [linear.app/settings/api](https://linear.app/settings/api) |
| Telegram | Bot Token | N/A | [@BotFather](https://t.me/BotFather) |
| Matrix | Token | N/A | Self-hosted |
| DigitalOcean | Token | N/A | [cloud.digitalocean.com/account/api/tokens](https://cloud.digitalocean.com/account/api/tokens) |
| Mixpanel | Token | N/A | [mixpanel.com/settings/project](https://mixpanel.com/settings/project) |
| Segment | Token | N/A | [app.segment.com](https://app.segment.com) |
| AWS | API Key | N/A | [console.aws.amazon.com/iam](https://console.aws.amazon.com/iam) |
| GCP | API Key | N/A | [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) |
| Gitea | OAuth2 | `/api/v1/oauth/callback/gitea` | Self-hosted |
| Email/SMTP | OAuth2 | `/api/v1/oauth/callback/email` | [console.cloud.google.com](https://console.cloud.google.com) |
| Signal | Webhook | N/A | [signal.org](https://signal.org) |

---

## Detailed Service Setup

### Social Media

#### Twitter/X
- **Auth**: OAuth 2.0 (PKCE)
- **Dev Portal**: https://developer.twitter.com
- **Required credentials**:
  - `TWITTER_CLIENT_ID`
  - `TWITTER_CLIENT_SECRET`
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/twitter`
- **Scopes**: `tweet.read`, `tweet.write`, `users.read`, `offline.access`
- **API Base**: `https://api.twitter.com/2`
- **Setup steps**:
  1. Create a project at developer.twitter.com
  2. Create an app inside the project
  3. Enable OAuth 2.0 in User Authentication settings
  4. Set callback URL
  5. Copy Client ID and Client Secret to `.env`

#### Facebook
- **Auth**: OAuth 2.0
- **Dev Portal**: https://developers.facebook.com
- **Required credentials**:
  - `FACEBOOK_CLIENT_ID` (App ID)
  - `FACEBOOK_CLIENT_SECRET` (App Secret)
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/facebook`
- **Scopes**: `public_profile`, `email`, `pages_manage_posts`, `pages_read_engagement`
- **API Base**: `https://graph.facebook.com`
- **Setup steps**:
  1. Create app at developers.facebook.com
  2. Add Facebook Login product
  3. Set Valid OAuth Redirect URIs
  4. Copy App ID and App Secret to `.env`

#### LinkedIn
- **Auth**: OAuth 2.0
- **Dev Portal**: https://www.linkedin.com/developers
- **Required credentials**:
  - `LINKEDIN_CLIENT_ID`
  - `LINKEDIN_CLIENT_SECRET`
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/linkedin`
- **Scopes**: `r_liteprofile`, `r_emailaddress`, `w_member_social`
- **API Base**: `https://api.linkedin.com/v2`
- **Setup steps**:
  1. Create app at linkedin.com/developers
  2. Add "Sign In with LinkedIn using OpenID Connect" product
  3. Set Authorized redirect URLs
  4. Copy Client ID and Client Secret to `.env`

#### Instagram
- **Auth**: OAuth 2.0 (via Facebook)
- **Dev Portal**: https://developers.facebook.com
- **Required credentials**:
  - `INSTAGRAM_CLIENT_ID` (Facebook App ID)
  - `INSTAGRAM_CLIENT_SECRET` (Facebook App Secret)
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/instagram`
- **Scopes**: `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`
- **API Base**: `https://graph.instagram.com`
- **Setup steps**:
  1. Create app at developers.facebook.com
  2. Add Instagram Graph API product
  3. Set callback URL in Instagram Basic Display settings
  4. Copy credentials to `.env`

#### TikTok
- **Auth**: OAuth 2.0
- **Dev Portal**: https://developers.tiktok.com
- **Required credentials**:
  - `TIKTOK_CLIENT_KEY`
  - `TIKTOK_CLIENT_SECRET`
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/tiktok`
- **Scopes**: `user.info.basic`, `video.list`, `video.upload`
- **API Base**: `https://open.tiktok.com/v1`
- **Setup steps**:
  1. Register at developers.tiktok.com
  2. Create an app
  3. Add Login Kit and set redirect URI
  4. Copy Client Key and Client Secret to `.env`

#### Reddit
- **Auth**: OAuth 2.0
- **Dev Portal**: https://www.reddit.com/prefs/apps
- **Required credentials**:
  - `REDDIT_CLIENT_ID`
  - `REDDIT_CLIENT_SECRET`
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/reddit`
- **Scopes**: `identity`, `read`, `submit`, `history`
- **API Base**: `https://oauth.reddit.com`
- **Setup steps**:
  1. Go to reddit.com/prefs/apps
  2. Create a "web app"
  3. Set redirect URI
  4. Copy the ID (under app name) and secret to `.env`

#### YouTube
- **Auth**: OAuth 2.0 (via Google)
- **Dev Portal**: https://console.cloud.google.com
- **Required credentials**:
  - `YOUTUBE_CLIENT_ID` (Google OAuth Client ID)
  - `YOUTUBE_CLIENT_SECRET`
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/youtube`
- **Scopes**: `https://www.googleapis.com/auth/youtube.readonly`, `youtube.upload`
- **API Base**: `https://www.googleapis.com/youtube/v3`
- **Setup steps**:
  1. Enable YouTube Data API v3 in Google Cloud Console
  2. Create OAuth 2.0 credentials
  3. Set authorized redirect URI
  4. Copy credentials to `.env`

#### Twitch
- **Auth**: OAuth 2.0
- **Dev Portal**: https://dev.twitch.tv/console
- **Required credentials**:
  - `TWITCH_CLIENT_ID`
  - `TWITCH_CLIENT_SECRET`
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/twitch`
- **Scopes**: `user:read:email`, `channel:read:subscriptions`
- **API Base**: `https://api.twitch.tv/helix`
- **Setup steps**:
  1. Register app at dev.twitch.tv/console
  2. Set OAuth Redirect URL
  3. Copy Client ID and Client Secret to `.env`

#### Bluesky
- **Auth**: JWT (App Password)
- **Dev Portal**: https://docs.bsky.app
- **Required credentials**:
  - `BLUESKY_IDENTIFIER` (handle, e.g. `user.bsky.social`)
  - `BLUESKY_APP_PASSWORD`
- **Callback URL**: N/A (no OAuth flow)
- **API Base**: `https://bsky.social/xrpc`
- **Setup steps**:
  1. Go to Settings → App Passwords in Bluesky
  2. Create an app password
  3. Add handle and app password to `.env`

#### Mastodon
- **Auth**: OAuth 2.0
- **Dev Portal**: Your instance's `/settings/applications`
- **Required credentials**:
  - `MASTODON_CLIENT_ID`
  - `MASTODON_CLIENT_SECRET`
  - `MASTODON_INSTANCE` (e.g. `mastodon.social`)
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/mastodon`
- **Scopes**: `read`, `write`, `follow`
- **API Base**: `https://{instance}/api/v1`
- **Setup steps**:
  1. Go to your Mastodon instance → Preferences → Development
  2. Create a new application
  3. Set redirect URI
  4. Copy credentials to `.env`

---

### Development

#### GitHub
- **Auth**: OAuth 2.0
- **Dev Portal**: https://github.com/settings/developers
- **Required credentials**:
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/github`
- **Scopes**: `user`, `repo`, `read:org`
- **API Base**: `https://api.github.com`
- **Setup steps**:
  1. Go to Settings → Developer Settings → OAuth Apps
  2. Create new OAuth App
  3. Set Authorization callback URL
  4. Copy Client ID and generate a Client Secret to `.env`

#### GitLab
- **Auth**: OAuth 2.0
- **Dev Portal**: https://gitlab.com/-/profile/applications
- **Required credentials**:
  - `GITLAB_CLIENT_ID` (Application ID)
  - `GITLAB_CLIENT_SECRET` (Secret)
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/gitlab`
- **Scopes**: `read_user`, `read_api`, `read_repository`
- **API Base**: `https://gitlab.com/api/v4`
- **Setup steps**:
  1. Go to User Settings → Applications
  2. Add new application with redirect URI and scopes
  3. Copy Application ID and Secret to `.env`

#### Bitbucket
- **Auth**: OAuth 2.0
- **Dev Portal**: https://bitbucket.org/account/settings
- **Required credentials**:
  - `BITBUCKET_CLIENT_ID` (Key)
  - `BITBUCKET_CLIENT_SECRET` (Secret)
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/bitbucket`
- **Scopes**: `account`, `repository`
- **API Base**: `https://api.bitbucket.org/2.0`
- **Setup steps**:
  1. Go to Workspace Settings → OAuth consumers
  2. Add consumer with callback URL
  3. Copy Key and Secret to `.env`

#### Azure DevOps
- **Auth**: OAuth 2.0
- **Dev Portal**: https://aex.dev.azure.com
- **Required credentials**:
  - `AZUREDEVOPS_CLIENT_ID` (App ID)
  - `AZUREDEVOPS_CLIENT_SECRET`
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/azuredevops`
- **Scopes**: `vso.code`, `vso.project`
- **API Base**: `https://dev.azure.com`

#### Travis CI
- **Auth**: API Token
- **Dev Portal**: https://app.travis-ci.com/account/preferences
- **Required credentials**:
  - `TRAVISCI_TOKEN`
- **Callback URL**: N/A
- **API Base**: `https://api.travis-ci.com`
- **Setup steps**:
  1. Go to account preferences on Travis CI
  2. Copy the API token to `.env`

#### CircleCI
- **Auth**: Personal API Token
- **Dev Portal**: https://app.circleci.com/settings/user/tokens
- **Required credentials**:
  - `CIRCLECI_TOKEN`
- **Callback URL**: N/A
- **API Base**: `https://circleci.com/api/v2`

#### Gitea
- **Auth**: OAuth 2.0
- **Dev Portal**: Self-hosted (`/user/settings/applications`)
- **Required credentials**:
  - `GITEA_CLIENT_ID`
  - `GITEA_CLIENT_SECRET`
  - `GITEA_INSTANCE` (e.g. `https://gitea.example.com`)
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/gitea`
- **API Base**: `https://{instance}/api/v1`

---

### Productivity

#### Notion
- **Auth**: OAuth 2.0
- **Dev Portal**: https://www.notion.so/my-integrations
- **Required credentials**:
  - `NOTION_CLIENT_ID` (OAuth Client ID)
  - `NOTION_CLIENT_SECRET` (OAuth Client Secret)
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/notion`
- **Scopes**: Set in integration settings (read content, update content, etc.)
- **API Base**: `https://api.notion.com/v1`
- **Setup steps**:
  1. Create integration at notion.so/my-integrations
  2. Enable as Public integration (for OAuth)
  3. Set redirect URI
  4. Copy OAuth Client ID and Secret to `.env`

#### Airtable
- **Auth**: Personal Access Token
- **Dev Portal**: https://airtable.com/create/tokens
- **Required credentials**:
  - `AIRTABLE_TOKEN`
- **Callback URL**: N/A
- **API Base**: `https://api.airtable.com/v0`

#### Asana
- **Auth**: OAuth 2.0
- **Dev Portal**: https://asana.com/developers
- **Required credentials**:
  - `ASANA_CLIENT_ID`
  - `ASANA_CLIENT_SECRET`
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/asana`
- **API Base**: `https://app.asana.com/api/1.0`

#### Monday.com
- **Auth**: API Token
- **Dev Portal**: https://monday.com/developers
- **Required credentials**:
  - `MONDAY_TOKEN`
- **Callback URL**: N/A
- **API Base**: `https://api.monday.com/graphql` (GraphQL)

#### Trello
- **Auth**: OAuth 2.0
- **Dev Portal**: https://trello.com/power-ups/admin
- **Required credentials**:
  - `TRELLO_CLIENT_ID` (API Key)
  - `TRELLO_CLIENT_SECRET` (OAuth Secret)
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/trello`
- **API Base**: `https://api.trello.com/1`

#### Jira
- **Auth**: OAuth 2.0
- **Dev Portal**: https://developer.atlassian.com/console/myapps
- **Required credentials**:
  - `JIRA_CLIENT_ID`
  - `JIRA_CLIENT_SECRET`
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/jira`
- **Scopes**: `read:jira-work`, `write:jira-work`, `read:jira-user`
- **API Base**: `https://your-domain.atlassian.net/rest/api/2`

#### ClickUp
- **Auth**: Personal API Token
- **Dev Portal**: https://clickup.com/api
- **Required credentials**:
  - `CLICKUP_TOKEN`
- **Callback URL**: N/A
- **API Base**: `https://api.clickup.com/api/v2`

#### Linear
- **Auth**: Personal API Key
- **Dev Portal**: https://linear.app/settings/api
- **Required credentials**:
  - `LINEAR_TOKEN`
- **Callback URL**: N/A
- **API Base**: `https://api.linear.app/graphql` (GraphQL)

---

### Payment

#### Stripe
- **Auth**: API Key (Secret Key)
- **Dev Portal**: https://dashboard.stripe.com/apikeys
- **Required credentials**:
  - `STRIPE_SECRET_KEY` (starts with `sk_`)
  - `STRIPE_PUBLISHABLE_KEY` (starts with `pk_`, for frontend)
  - `STRIPE_WEBHOOK_SECRET` (for webhook verification)
- **Callback URL**: N/A (uses webhooks)
- **Webhook URL**: `https://www.myapiai.com/api/v1/webhooks/stripe`
- **API Base**: `https://api.stripe.com/v1`

#### PayPal
- **Auth**: OAuth 2.0
- **Dev Portal**: https://developer.paypal.com/dashboard
- **Required credentials**:
  - `PAYPAL_CLIENT_ID`
  - `PAYPAL_CLIENT_SECRET`
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/paypal`
- **API Base**: `https://api-m.paypal.com` (live) / `https://api-m.sandbox.paypal.com` (sandbox)

#### Shopify
- **Auth**: OAuth 2.0
- **Dev Portal**: https://partners.shopify.com
- **Required credentials**:
  - `SHOPIFY_CLIENT_ID` (API Key)
  - `SHOPIFY_CLIENT_SECRET` (API Secret Key)
  - `SHOPIFY_STORE` (your-store.myshopify.com)
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/shopify`
- **Scopes**: `read_products`, `write_orders`, etc.
- **API Base**: `https://{store}.myshopify.com/admin/api/2024-01`

#### Square
- **Auth**: OAuth 2.0
- **Dev Portal**: https://developer.squareup.com/apps
- **Required credentials**:
  - `SQUARE_CLIENT_ID` (Application ID)
  - `SQUARE_CLIENT_SECRET` (Application Secret)
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/square`
- **API Base**: `https://api.square.com/v2`

---

### Communication

#### Email/SMTP (Gmail)
- **Auth**: OAuth 2.0 (Gmail API)
- **Dev Portal**: https://console.cloud.google.com
- **Required credentials**:
  - `GMAIL_CLIENT_ID`
  - `GMAIL_CLIENT_SECRET`
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/email`
- **Scopes**: `https://www.googleapis.com/auth/gmail.send`, `gmail.readonly`
- **API Base**: `smtp.gmail.com` (SMTP) or `https://gmail.googleapis.com/gmail/v1` (API)

#### Telegram
- **Auth**: Bot Token
- **Dev Portal**: https://t.me/BotFather
- **Required credentials**:
  - `TELEGRAM_BOT_TOKEN`
- **Callback URL**: N/A (uses webhooks or polling)
- **Webhook URL**: `https://www.myapiai.com/api/v1/webhooks/telegram`
- **API Base**: `https://api.telegram.org/bot{token}`
- **Setup steps**:
  1. Message @BotFather on Telegram
  2. `/newbot` → follow prompts
  3. Copy the bot token to `.env`

#### Signal
- **Auth**: Webhook/REST API
- **Dev Portal**: https://signal.org
- **Required credentials**:
  - `SIGNAL_PHONE_NUMBER`
  - Signal CLI or signal-cli-rest-api instance
- **Callback URL**: N/A
- **API Base**: Self-hosted signal-cli-rest-api

#### Matrix
- **Auth**: Access Token
- **Dev Portal**: Self-hosted or matrix.org
- **Required credentials**:
  - `MATRIX_HOMESERVER` (e.g. `https://matrix.org`)
  - `MATRIX_ACCESS_TOKEN`
  - `MATRIX_USER_ID` (e.g. `@bot:matrix.org`)
- **Callback URL**: N/A
- **API Base**: `https://{homeserver}/_matrix`

#### Mattermost
- **Auth**: OAuth 2.0
- **Dev Portal**: Self-hosted (System Console → Integrations → OAuth 2.0 Applications)
- **Required credentials**:
  - `MATTERMOST_CLIENT_ID`
  - `MATTERMOST_CLIENT_SECRET`
  - `MATTERMOST_URL` (your instance URL)
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/mattermost`
- **API Base**: `https://{instance}/api/v4`

---

### Cloud

#### Amazon AWS
- **Auth**: Access Key + Secret Key
- **Dev Portal**: https://console.aws.amazon.com/iam
- **Required credentials**:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION` (e.g. `us-east-1`)
- **Callback URL**: N/A
- **API Base**: `https://{service}.{region}.amazonaws.com`

#### Microsoft Azure
- **Auth**: OAuth 2.0 (App Registration)
- **Dev Portal**: https://portal.azure.com → App registrations
- **Required credentials**:
  - `AZURE_CLIENT_ID` (Application ID)
  - `AZURE_CLIENT_SECRET`
  - `AZURE_TENANT_ID`
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/azure`
- **API Base**: `https://management.azure.com`

#### Google Cloud
- **Auth**: Service Account Key or API Key
- **Dev Portal**: https://console.cloud.google.com/apis/credentials
- **Required credentials**:
  - `GCP_API_KEY` or
  - `GOOGLE_APPLICATION_CREDENTIALS` (path to service account JSON)
- **Callback URL**: N/A
- **API Base**: `https://www.googleapis.com`

#### DigitalOcean
- **Auth**: Personal Access Token
- **Dev Portal**: https://cloud.digitalocean.com/account/api/tokens
- **Required credentials**:
  - `DIGITALOCEAN_TOKEN`
- **Callback URL**: N/A
- **API Base**: `https://api.digitalocean.com/v2`

---

### Analytics

#### Mixpanel
- **Auth**: Project Token + API Secret
- **Dev Portal**: https://mixpanel.com/settings/project
- **Required credentials**:
  - `MIXPANEL_TOKEN` (project token)
  - `MIXPANEL_API_SECRET` (for export API)
- **Callback URL**: N/A
- **API Base**: `https://api.mixpanel.com`

#### Segment
- **Auth**: Write Key
- **Dev Portal**: https://app.segment.com
- **Required credentials**:
  - `SEGMENT_WRITE_KEY`
- **Callback URL**: N/A
- **API Base**: `https://api.segment.com`

#### Google Analytics
- **Auth**: OAuth 2.0 (via Google)
- **Dev Portal**: https://console.cloud.google.com
- **Required credentials**:
  - `GA_CLIENT_ID` (Google OAuth Client ID)
  - `GA_CLIENT_SECRET`
- **Callback URL**: `https://www.myapiai.com/api/v1/oauth/callback/googleanalytics`
- **Scopes**: `https://www.googleapis.com/auth/analytics.readonly`
- **API Base**: `https://www.googleapis.com/analytics/v3`

---

## Environment Variables Template

```bash
# === SOCIAL MEDIA ===
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
BLUESKY_IDENTIFIER=
BLUESKY_APP_PASSWORD=
MASTODON_CLIENT_ID=
MASTODON_CLIENT_SECRET=
MASTODON_INSTANCE=mastodon.social

# === DEVELOPMENT ===
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
BITBUCKET_CLIENT_ID=
BITBUCKET_CLIENT_SECRET=
AZUREDEVOPS_CLIENT_ID=
AZUREDEVOPS_CLIENT_SECRET=
TRAVISCI_TOKEN=
CIRCLECI_TOKEN=
GITEA_CLIENT_ID=
GITEA_CLIENT_SECRET=
GITEA_INSTANCE=

# === PRODUCTIVITY ===
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
AIRTABLE_TOKEN=
ASANA_CLIENT_ID=
ASANA_CLIENT_SECRET=
MONDAY_TOKEN=
TRELLO_CLIENT_ID=
TRELLO_CLIENT_SECRET=
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=
CLICKUP_TOKEN=
LINEAR_TOKEN=

# === PAYMENT ===
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_STORE=
SQUARE_CLIENT_ID=
SQUARE_CLIENT_SECRET=

# === COMMUNICATION ===
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
TELEGRAM_BOT_TOKEN=
SIGNAL_PHONE_NUMBER=
MATRIX_HOMESERVER=
MATRIX_ACCESS_TOKEN=
MATRIX_USER_ID=
MATTERMOST_CLIENT_ID=
MATTERMOST_CLIENT_SECRET=
MATTERMOST_URL=

# === CLOUD ===
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=
GCP_API_KEY=
DIGITALOCEAN_TOKEN=

# === ANALYTICS ===
MIXPANEL_TOKEN=
MIXPANEL_API_SECRET=
SEGMENT_WRITE_KEY=
GA_CLIENT_ID=
GA_CLIENT_SECRET=
```

---

## Adding a New Service

1. Add seed entry in `src/database.js` → `seedServices()` array
2. Add env vars to `.env`
3. If OAuth: add callback handler in `src/index.js` (the generic `/api/v1/oauth/callback/:service` route handles most)
4. Add service-specific scopes and token exchange logic if needed
5. Update this manual

## OAuth Callback URL Pattern

All OAuth services use the same pattern:
```
https://www.myapiai.com/api/v1/oauth/callback/{service_name}
```

Where `{service_name}` matches the `name` field in the services database (e.g., `google`, `twitter`, `facebook`, `linkedin`).
