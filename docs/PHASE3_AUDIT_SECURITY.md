# Phase 3 — Audit & Security

## Scope Completed

- Hardened audit event schema with workspace/user context fields:
  - `workspace_id`, `actor_id`, `actor_type`, `endpoint`, `http_method`, `status_code`
- Added indexed audit querying for workspace + action timelines.
- Added API endpoints:
  - `GET /api/v1/audit/logs` (filters: `actor`, `action`, `resource`, `dateFrom/dateTo`, `limit`, `offset`)
  - `GET /api/v1/audit/summary`
  - `GET /api/v1/security/sessions`
  - `POST /api/v1/security/sessions/revoke` (`{ sessionId }` or `{ all: true }`)
- Added workspace-scoped API logging middleware for sensitive actions.
- Added workspace/user keyed rate limiting on audit/security endpoints.
- Added dashboard UX updates:
  - Activity page now reads from `/api/v1/audit/logs`
  - Settings → Security now shows active sessions + revoke controls.
- Added test coverage for auth/scope, session revoke behavior, and rate-limit enforcement.

## Notes

- No auth/login flow rewrites were made.
- Existing dashboard layouts were preserved; changes are localized to Activity + Settings/Security.
- Session revocation intentionally keeps current session on `all: true` to avoid accidental self-lockout.
