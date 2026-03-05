# Services ENV and API Matrix

This matrix covers the **active integration layer** in this repo:

1. OAuth/token connectors wired in `src/index.js` (`oauthAdapters`)
2. Adapter-specific ENV bindings in `src/services/*.js`
3. Service catalog metadata seeded in `src/database.js` (`seedServices`)

---

## 1) Runtime integration standards (applies to all services)

- Standardized service shape is built in: `src/services/integration-layer.js` via `buildServiceDefinition()`
- Standardized execution contract is defined in: `src/services/integration-layer.js` (`DEFAULT_EXECUTION_CONTRACT`)
- Request validation is enforced in: `validateExecutionInput()`
- Execution response normalization is enforced in: `executeServiceMethod()` + `normalizeExecutionError()`
- API endpoints using this layer:
  - `GET /api/v1/services`
  - `GET /api/v1/services/:name`
  - `GET /api/v1/services/:serviceId/methods`
  - `POST /api/v1/services/:serviceName/execute`

---

## 2) OAuth / connector matrix (service-by-service)

> Notes:
> - `oauthConfig` file support is loaded from `config/oauth.json` in `src/index.js`.
> - ENV values are preferred in production; config file fallback is useful for local/dev.
> - `*_REDIRECT_URI` should be HTTPS in production.

| Service | Category | Auth Type | Required ENV Keys | Optional ENV Keys | Sample Value Format | Code Usage | Auth URL | Token URL | API Base / Docs |
|---|---|---|---|---|---|---|---|---|---|
| Google | productivity/identity | oauth2 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `GOOGLE_REDIRECT_URI` | `123.apps.googleusercontent.com`, secret string, `https://api.example.com/api/v1/oauth/callback/google` | `src/services/google-adapter.js` ctor + exchange/revoke/verify | `https://accounts.google.com/o/oauth2/v2/auth` | `https://oauth2.googleapis.com/token` | API: `https://www.googleapis.com` Docs: `https://developers.google.com/identity/protocols/oauth2` |
| GitHub | dev | oauth2 | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | `GITHUB_REDIRECT_URI` | OAuth app client id/secret, callback URL | `src/services/github-adapter.js` | `https://github.com/login/oauth/authorize` | `https://github.com/login/oauth/access_token` | API: `https://api.github.com` Docs: `https://docs.github.com/en/apps/oauth-apps` |
| Slack | communication | oauth2 | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | `SLACK_REDIRECT_URI` | Slack app credentials + callback URL | `src/services/slack-adapter.js` | `https://slack.com/oauth/v2/authorize` | `https://slack.com/api/oauth.v2.access` | API: `https://slack.com/api` Docs: `https://api.slack.com/authentication/oauth-v2` |
| Discord | communication | oauth2 | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | `DISCORD_REDIRECT_URI` | Discord app credentials + callback URL | `src/services/discord-adapter.js` | `https://discord.com/api/oauth2/authorize` | `https://discord.com/api/oauth2/token` | API: `https://discord.com/api` Docs: `https://discord.com/developers/docs/topics/oauth2` |
| WhatsApp (Business API) | communication | bearer/token | `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_API_TOKEN` | `WHATSAPP_WEBHOOK_TOKEN` | numeric business account ID, long-lived access token, webhook verify token | `src/services/whatsapp-adapter.js` | N/A (token-based flow) | N/A (token supplied manually) | API root should be `https://graph.facebook.com` Docs: `https://developers.facebook.com/docs/whatsapp` |
| Facebook | social | oauth2 | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | `FACEBOOK_REDIRECT_URI` | Meta app credentials + callback URL | `src/index.js` (`GenericOAuthAdapter`) | `https://www.facebook.com/v19.0/dialog/oauth` | `https://graph.facebook.com/v19.0/oauth/access_token` | API: `https://graph.facebook.com` Docs: `https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow` |
| Instagram | social | oauth2 | `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET` | `INSTAGRAM_REDIRECT_URI` | Instagram app credentials + callback URL | `src/index.js` (`GenericOAuthAdapter`) | `https://api.instagram.com/oauth/authorize` | `https://api.instagram.com/oauth/access_token` | API: `https://graph.instagram.com` Docs: `https://developers.facebook.com/docs/instagram-basic-display-api/getting-started` |
| TikTok | social | oauth2 | `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET` | `TIKTOK_REDIRECT_URI` | TikTok app key/secret + callback URL | `src/index.js` (`GenericOAuthAdapter`) | `https://www.tiktok.com/v2/auth/authorize/` | `https://open.tiktokapis.com/v2/oauth/token/` | API: `https://open.tiktokapis.com` Docs: `https://developers.tiktok.com/doc/login-kit-web` |
| X / Twitter | social | oauth2 | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` | `TWITTER_REDIRECT_URI` | OAuth2 client credentials + callback URL | `src/index.js` (`GenericOAuthAdapter`, basic token auth style) | `https://twitter.com/i/oauth2/authorize` | `https://api.twitter.com/2/oauth2/token` | API: `https://api.twitter.com/2` Docs: `https://developer.x.com/en/docs/authentication/oauth-2-0/authorization-code` |
| Reddit | social | oauth2 | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | `REDDIT_REDIRECT_URI` | Reddit app credentials + callback URL | `src/index.js` (`GenericOAuthAdapter`) | `https://www.reddit.com/api/v1/authorize` | `https://www.reddit.com/api/v1/access_token` | API: `https://oauth.reddit.com` Docs: `https://github.com/reddit-archive/reddit/wiki/OAuth2` |
| LinkedIn | social/professional | oauth2 | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | `LINKEDIN_REDIRECT_URI` | LinkedIn app credentials + callback URL | `src/index.js` (`GenericOAuthAdapter`) | `https://www.linkedin.com/oauth/v2/authorization` | `https://www.linkedin.com/oauth/v2/accessToken` | API: `https://api.linkedin.com` Docs: `https://learn.microsoft.com/linkedin/shared/authentication/authorization-code-flow` |

---

## 3) Local/dev vs production notes

### Local/dev

- Redirect URIs may use localhost, e.g. `http://localhost:4500/api/v1/oauth/callback/<service>`
- `config/oauth.json` can be used for convenience while developing.
- If providers require HTTPS even in test mode, use a tunnel and set redirect URIs accordingly.

### Production

- Use HTTPS callbacks only.
- Keep all secrets in environment/secret manager (not in repo or `oauth.json`).
- Rotate credentials periodically and after suspected leakage.
- Enforce strict CORS origins and secure session cookie settings.

---

## 4) Important compatibility notes discovered during hardening

1. **WhatsApp naming mismatch in old examples**
   - Current adapter expects: `WHATSAPP_API_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_WEBHOOK_TOKEN`
   - Older env examples may mention different names (`WHATSAPP_ACCESS_TOKEN`, etc.).

2. **Facebook env names**
   - Integration layer uses `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET` in code.
   - Older examples may use `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`.

3. **Service catalog vs OAuth-enabled connectors**
   - `seedServices()` includes many catalog entries for discoverability.
   - OAuth runtime connectivity is currently defined by `oauthAdapters` in `src/index.js`.

---

## 5) Service catalog metadata source

All seeded catalog services (category/auth type/api endpoint/docs URL) are defined in:

- `src/database.js` → `seedServices()`

This is the authoritative source for:
- `category`
- `auth_type`
- `api_endpoint`
- `documentation_url`

Execution metadata for each service is normalized at runtime via:
- `src/services/integration-layer.js`
