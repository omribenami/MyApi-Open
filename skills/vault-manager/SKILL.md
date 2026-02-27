---
name: vault-manager
description: Orchestrates the Vault data layer by managing Identity Docs (USER.md), Live Connectors, and Preference Engine with a privacy-first approach.
---

# Vault Manager

This skill coordinates the data vault components for MyApi:
- Identity Docs (USER.md)
- Live Connectors (read-only to external data sources)
- Preference Engine (tone, cadence, scheduling)

## When to Use
- You need to assemble the user's Dynamic Context for a request
- You require data minimization and privacy controls before exposing any data

## Bundled Resources
- scripts/ (optional utilities)
- references/ (data schemas, mappings)
- assets/ (templates or sample data)
