---
name: myapi-gateway
description: Call any of a user's connected services (Gmail, GitHub, Slack, Home Assistant, and 100+ more) through the MyApi gateway with one Bearer token, scoped permissions, and a full audit log.
license: MIT
---

# MyApi Gateway Skill

MyApi is a personal API gateway: the user connects their services once, and you
(the agent) act through a single authenticated API instead of managing per-service
OAuth.

## Authentication

Send `Authorization: Bearer <token>` on every request. To obtain a token, follow
`/auth.md` at the origin root (OAuth 2.0 code flow with PKCE, dashboard-issued
token, or the `myapi-asc-mcp` device keypair flow).

**Before performing any action on the user's behalf, describe what you intend to
do and wait for explicit approval.**

## Core endpoints

Base URL: `/api/v1/` — full spec at `/openapi.json`.

- `GET /api/v1/tokens/me/capabilities` — what your token can do (start here)
- `GET /api/v1/services` — the user's connected services
- `POST /api/v1/services/{name}/proxy` — call a provider-native REST path:
  `{ "path": "/gmail/v1/users/me/messages", "method": "GET" }`.
  MyApi attaches the stored credentials; you never see them.
- `GET /api/v1/services/{name}/resources` — pickable sub-resources (repos,
  channels, calendars) when the token uses resource sub-scopes
- `GET /api/v1/brain/knowledge-base` — the user's knowledge documents
- `GET /api/v1/identity` — the user's profile the agent may read

## Scopes and errors

Scopes are hierarchical (`full` > `services:*` > `services:{name}:read|write`).

- `401` — token missing/invalid/revoked
- `403` — scope insufficient, or device awaiting approval at `/dashboard/devices`
- `429` — per-agent usage limit reached; back off until the reported reset

Every call is written to the user's audit log with your agent identity attached.
