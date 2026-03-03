# MyApi Implementation Tracker (Human + AI UX)

Last updated: 2026-03-02 (CST)
Owner: Roee / Jarvis

## Goal
Make MyApi effortless for both humans and AI agents:
- minimal setup
- self-discoverable API capabilities
- one-click actions where possible
- safe token handling with smart automation

---

## Working Rules
1. Keep this file updated after each meaningful addition.
2. Push to git after each addition.
3. Ship in small, testable phases.

---

## Phase Plan

### Phase 12.1 — AI-native discovery contract
- [ ] `GET /api/v1/capabilities`
- [ ] `GET /api/v1/tokens/me/capabilities`
- [ ] `GET /openapi.json`
- [ ] `GET /.well-known/ai-plugin.json`
- [ ] Scope-aware endpoint visibility
- [ ] Examples + common errors per action

### Phase 12.2 — Vault automation upgrade
- [ ] Extend vault schema with:
  - `base_url`
  - `docs_url`
  - `api_base_path`
  - `auth_scheme`
  - `auth_header_name`
  - `capabilities_json`
  - `last_verified_at`
- [ ] URL+token onboarding flow
- [ ] Auto-discover docs/OpenAPI when possible
- [ ] Optional AI-assisted parsing mode (safe fallback)
- [ ] Tighten auth checks on reveal/decrypt

### Phase 12.3 — One-click UX (human-first)
- [ ] Improve Git skill import flow (auto metadata + fewer steps)
- [ ] One-click publish/install actions where missing
- [ ] Keep duplicate-install prevention intact
- [ ] Quick actions from relevant pages (persona/skills/profile)

### Phase 12.4 — Knowledge Base parity (editor + upload)
- [ ] Upload file option in KB UI (in addition to editor)
- [ ] Backend upload endpoint
- [ ] Parse and store extracted content + file metadata
- [ ] Include source/download metadata for API consumers
- [ ] Storage adapter: S3 via env + local fallback

### Phase 12.5 — Branding consistency
- [ ] Ensure user-visible surfaces say **MyApi** only
- [ ] Remove remaining MyGate wording in app UI/docs

---

## Already Completed (this session)
- [x] Prevent duplicate marketplace skill installs (`2d98f49`)
- [x] Fix dashboard blank page stale asset fallback (`8533fd5`)
- [x] Fix Settings profile infinite spinner (`a4904ee`)
- [x] Fix guest token scope mismatch (`8f9720b`)
- [x] Fix token copy fallback + KB click-to-edit (`b843287`)
- [x] Fix persona docs source endpoint + login tagline (`0432051`)

---

## Change Log
- 2026-03-02: Tracker created.
