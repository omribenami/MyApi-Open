---
name: identity-docs-ingestion
description: Ingest Identity Docs (USER.md) into the Vault with provenance tracking and structured transformation. Ensure data quality and versioning for user identity data.
---

# Identity Docs Ingestion

This skill handles ingestion of USER.md identity docs into the Vault, transforming free-form content into structured fields and recording provenance.

## When to Use
- A new USER.md is created or an existing one is updated.
- You need to normalize identity data for the Vault context.

## Bundled Resources
- scripts/ (ingest scripts)
- references/ (data schemas for identity data)
- assets/ (templates or sample data)
