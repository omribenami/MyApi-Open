# MyApi — Conceptual Platform Architecture

The Core Vision
- Build a server-side abstraction layer that centralizes the user's digital identity data and offers a secure API surface for clients and agents to interact with the identity on behalf of the user.
- Serve as a Single Source of Truth (SSOT) for all AI entities (personal or external) communicating with the user.
- Emphasize security, privacy by design, and user sovereignty over data.

## 1) Architecture Overview (Three-Tier)

### A. The Vault (Data Layer)
- Dynamic Context storage: Identity Docs, Live Connectors, Preference Engine.
- Identity Docs: USER.md files describing who I am, core values, professional and personal history.
- Live Connectors: Read-Only connections to the user's data sources (journal, GitHub, LinkedIn, personal sources).
- Preference Engine: stores tone, technology preferences, cadence, and scheduling.

### B. The Gateway (Management Layer)
- API surface that enforces access control and tokens.
- Personal Token: Master key for the user's personal AI; full read/write access to data for operational tasks.
- Guest Tokens: ephemeral tokens with scoped permissions for third parties.

### C. The Personal Brain (Logic Layer)
- The middleware/mediator that routes requests, ensures privacy, and evaluates access.
- It does not generate content directly; it reasons about what to expose and how to present it to the requester.
- When a request reaches the API, the brain decides if the requester is authorized and what to show.

## 2) Data Model & Data Flows

- Identity Docs live at USER.md in the user's workspace.
- Live Connectors provide read-only streams to external sources.
- Preferences are stored in a structured format for style, tempo, and scheduling.
- Data flow: Client request -> Personal Brain evaluation -> Gateway -> Vault -> Identity Docs/Live Connectors -> Response

## 3) Security & Privacy

- Zero-Knowledge by design: user data remains in user control (self-hosted or private cloud).
- Audit Log: records every access and action; visible to user.
- Revoke: one-click token revocation to cut external access permanently.

## 4) MVP Roadmap

- Phase 1: Core Vault, Gateway, and Brain scaffolding. Identity Docs ingestion from USER.md, support for Personal and Guest Tokens, basic audit logging.
- Phase 2: Live Connector integration (safe read-only sources), basic UI (dashboard), basic policies.
- Phase 3: Zero-Knowledge enhancements, improved audit trails, revocation UX, and self-hosting considerations.

## 5) Team Roles (Proposed)
- Identity Architect
- Security Engineer
- Platform Engineer
- Privacy Officer
- UX/UX-Data Engineer

## 6) Risks & Considerations
- Privacy exposure from external connectors
- Token leakage and privilege escalation
- Data consistency across vault and connectors

## 7) Reference & Next Steps
- Create the SKILL(s) to bootstrap the platform, starting with three core modules: Vault, Gateway, Brain.
