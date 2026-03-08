# MyApi Services Gateway — Gameplan

**Created:** 2026-03-07 19:45 CST
**Goal:** Make MyApi a centralized OAuth gateway so any AI agent (with a MyApi token) can access users' connected services.

---

## Audit Results — What Already Exists

### ✅ DONE (solid, working)
| Component | Status | Details |
|-----------|--------|---------|
| **Integration Layer** | ✅ Complete | 12 OAuth providers defined with auth/token URLs, retry logic, execution contracts |
| **Service Adapters** | ✅ 6 built | GitHub, Google, Slack, Discord, WhatsApp, Generic OAuth |
| **OAuth Flow (authorize)** | ✅ Working | `GET /api/v1/oauth/authorize/:service` → generates state, redirects to provider |
| **OAuth Flow (callback)** | ✅ Working | `GET /api/v1/oauth/callback/:service` → exchanges code, stores token |
| **OAuth Disconnect** | ✅ Working | `POST /api/v1/oauth/disconnect/:service` → revokes + deletes token |
| **OAuth Status** | ✅ Working | `GET /api/v1/oauth/status` → shows connected services per user |
| **Token Storage** | ✅ Encrypted | `oauth_tokens` table with AES-encrypted access/refresh tokens |
| **Vault** | ✅ Working | Identity, preferences, connectors — all encrypted at rest |
| **DB Schema** | ✅ Complete | `oauth_tokens`, `oauth_status`, `oauth_state_tokens`, `services`, `service_categories`, `service_api_methods` |
| **Service Catalog** | ✅ 45 services | 7 categories (social, dev, productivity, payment, communication, cloud, analytics) |
| **Frontend OAuth** | ✅ Built | `oauth.js` utility, `serviceCatalog.js`, `servicesStore.js` |
| **Execute endpoint** | ✅ Scaffold | `POST /api/v1/services/:serviceName/execute` — exists but returns simulated responses |
| **Generic OAuth Adapter** | ✅ Built | Reusable adapter for Facebook, Instagram, TikTok, Twitter, Reddit, LinkedIn |
| **Duplicate Google tokens** | ⚠️ Cleanup needed | 42 duplicate Google OAuth tokens (most with user_id `oauth_user` instead of real user ID) |

### ❌ BROKEN / MISSING
| Component | Status | Issue |
|-----------|--------|-------|
| **GitHub OAuth credentials** | ❌ Broken | App deleted/invalid — needs new OAuth App from github.com/settings/developers |
| **Service execute (proxy)** | ❌ Simulated | Returns mock `{ simulated: true }` — needs real HTTP proxy to service APIs |
| **Service API methods** | ❌ Empty | `service_api_methods` table has 0 rows — no methods defined for any service |
| **Token refresh** | ❌ Missing | No auto-refresh logic for expired OAuth tokens |
| **TikTok CLIENT_ID** | ❌ Missing | `TIKTOK_CLIENT_ID` not in `.env` (only secret + redirect) |
| **Social media env vars** | ❌ Missing | Facebook, Instagram, Twitter, Reddit, LinkedIn — no CLIENT_ID/SECRET in `.env` |
| **Scope enforcement on proxy** | ❌ Missing | Agent tokens can't be scoped to specific services (e.g., `github:read`) |
| **Token deduplication** | ❌ Missing | Multiple tokens per service/user accumulate instead of being replaced |

---

## Gameplan — Priority Steps

### Phase 1: Fix What's Broken (Foundation)
- [ ] **1.1** Clean up duplicate Google OAuth tokens (keep latest per user_id, delete rest)
- [ ] **1.2** Fix token deduplication — `storeOAuthToken` should UPSERT by `(service_name, user_id)` instead of always inserting
- [ ] **1.3** Add token auto-refresh logic for services with `refresh_token`
- [ ] **1.4** Wait for Omri to create new GitHub OAuth App → update `.env` credentials

### Phase 2: Real Service Proxy (Core Value)
- [ ] **2.1** Build real HTTP proxy in `executeServiceMethod()` — use stored OAuth token to make actual API calls
- [ ] **2.2** Define initial API methods for Google (Gmail, Calendar) and GitHub (repos, user, issues)
- [ ] **2.3** Populate `service_api_methods` with method definitions for top services
- [ ] **2.4** Add response normalization — consistent `{ ok, data, error, meta }` shape

### Phase 3: Service Scope Enforcement
- [ ] **3.1** Extend agent token scope format: `services:github:read`, `services:google:calendar`
- [ ] **3.2** Add scope check middleware before proxy execution
- [ ] **3.3** Dashboard UI for managing per-token service access

### Phase 4: Onboard More Services
- [ ] **4.1** Add missing env vars for social services (TikTok, Facebook, Instagram, LinkedIn, Twitter)
- [ ] **4.2** Create OAuth apps on each platform with MyApi callback URLs
- [ ] **4.3** Test connect/disconnect flow for each service
- [ ] **4.4** Define API methods for social services (post, read, analytics)

### Phase 5: Polish & Security
- [ ] **5.1** Token encryption key rotation support
- [ ] **5.2** Rate limiting per service per user
- [ ] **5.3** Audit log for all proxy calls
- [ ] **5.4** Dashboard: show real-time service status with last API call timestamp

---

## Status Tracker

| Step | Status | Notes | Completed |
|------|--------|-------|-----------|
| 1.1 | ✅ DONE | Purged 40 duplicate tokens, 2 clean remain | 2026-03-07 19:50 |
| 1.2 | ✅ DONE | UPSERT by (service_name, user_id) | 2026-03-07 19:52 |
| 1.3 | ✅ DONE | isTokenExpired + refreshOAuthToken added | 2026-03-07 19:55 |
| 1.4 | ⬜ BLOCKED | Waiting on Omri for GitHub OAuth App | |
| 2.1 | ✅ DONE | Real HTTP proxy in executeServiceMethod + /proxy endpoint | 2026-03-07 20:00 |
| 2.2 | ✅ DONE | GitHub 10, Google 9, Slack 3, Discord 2 methods | 2026-03-07 20:02 |
| 2.3 | ✅ DONE | 24 methods seeded in service_api_methods | 2026-03-07 20:02 |
| 2.4 | ✅ DONE | Consistent {ok, data, error, meta} shape in proxy | 2026-03-07 20:02 |
| 3.1 | ⬜ TODO | | |
| 3.2 | ⬜ TODO | | |
| 3.3 | ⬜ TODO | | |
| 4.1 | ⬜ TODO | | |
| 4.2 | ⬜ TODO | | |
| 4.3 | ⬜ TODO | | |
| 4.4 | ⬜ TODO | | |
| 5.1 | ⬜ TODO | | |
| 5.2 | ⬜ TODO | | |
| 5.3 | ⬜ TODO | | |
| 5.4 | ⬜ TODO | | |
