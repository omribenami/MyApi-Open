---
name: personal-brain
description: The Personal Brain mediator/gatekeeper for MyApi. Evaluates incoming API requests, checks authorization, decides what data to expose based on token scope and privacy policies. Use when routing requests through the logic layer.
---

# Personal Brain

The mediator layer of MyApi. It sits between the Gateway and the Vault.

## Responsibilities
- Evaluate every incoming request against token scope and privacy policies
- Decide what subset of the Vault data to expose
- Format responses appropriate to the requester's authorization level
- Log all decisions to the Audit Trail

## How It Works
1. Request arrives at the Gateway with a token
2. Gateway validates the token and passes the request + scope to the Brain
3. Brain checks: Is this requester allowed to see this data? How should it be presented?
4. Brain fetches relevant data from the Vault (only what's needed)
5. Brain returns the filtered, formatted response to the Gateway

## Privacy Principles
- Never expose more than the token scope allows
- Apply data minimization: even within scope, only return what's relevant to the query
- Redact PII for guest tokens unless explicitly scoped
- All decisions are logged for audit

## Bundled Resources
- scripts/ (request evaluation logic)
- references/ (privacy policies, scope mappings)
