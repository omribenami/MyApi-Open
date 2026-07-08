# MyApi Open-Core Boundary

Last updated: 2026-06-30

This document defines the intended product boundary between **MyApi Open** (community edition) and **MyApi Cloud / Commercial**.

It exists for three reasons:

1. to reduce confusion between the public repository and the managed product
2. to make licensing intent clear
3. to give contributors a stable rule for what belongs in the open repo

## Design principle

Open what developers need in order to trust, extend, self-host, and adopt the platform.

Keep closed what primarily exists to operate, monetize, support, and defend the managed service at scale.

## Open

The following belong in **MyApi Open** by default:

- core API gateway and auth middleware
- scoped access tokens and approval flows
- ASC / AFP primitives and self-hosting access paths
- generic service connector framework
- generic OAuth integration patterns
- personas, knowledge, skills, and token-scoped agent workflows
- self-hosting docs, deployment manifests, and local developer tooling
- generic Composio adapter code and toolkit mapping logic
- examples, templates, and extension points needed by self-hosters

## Closed

The following belong in **MyApi Cloud / Commercial** by default:

- billing, subscriptions, invoicing, and plan enforcement operations
- trust & safety operations, abuse controls, and risk heuristics specific to the hosted service
- managed tenant provisioning and internal account-operations tooling
- proprietary hosted-only admin experiences and enterprise controls that are not required for self-hosting
- cloud support tooling, incident tooling, and internal operational dashboards
- internal analytics and commercial reporting systems
- production secrets, managed auth-config inventories, and hosted provider provisioning flows
- commercial packaging around managed connectors and hosted support

## Maybe

The following should be judged case-by-case:

- advanced enterprise controls that are valuable to self-hosters but may also be monetizable
- curated defaults that are useful publicly but tied to proprietary support workflows
- convenience UX that is not a moat by itself, but may expose internal operating assumptions

Default rule: if a feature is primarily about **developer adoption**, bias toward open. If it is primarily about **cloud monetization or operations**, bias toward closed.

## Composio decision

### What should be open

We should be comfortable open-sourcing:

- the generic Composio integration layer
- toolkit discovery and normalization logic
- public schema mapping
- self-host setup instructions
- local configuration formats

### What should stay closed

We should keep closed:

- managed Composio tenant operations
- proprietary hosted auth-config provisioning
- default hosted account inventories and internal IDs
- cloud-only abuse controls, quotas, and trust rules around third-party actions
- commercial support and provisioning workflows layered on top of Composio

### Why

Composio by itself is not the moat.

The moat is the control plane around it: approvals, auditability, provisioning, billing alignment, abuse handling, and the hosted operator experience. Opening the adapter is good for trust. Giving away the hosted operating layer is not.

## Licensing intent

- **MyApi Open** remains AGPL-3.0.
- **MyApi Cloud / Commercial** may contain proprietary code, internal operations code, or separately licensed modules not distributed in this repository.
- Hosted-service legal terms apply to the managed service, not automatically to self-hosted deployments.

## Contributor rule of thumb

Before adding a feature to the public repo, ask:

1. Does a self-hoster need this to run a credible instance?
2. Does this primarily create developer trust or extension value?
3. Would shipping this reveal hosted-only operational or monetization internals?

If the answers are (1) yes and (2) yes and (3) no, it likely belongs in MyApi Open.
