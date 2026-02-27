---
name: gateway-tokens
description: Manage Personal and Guest token generation, scoping, and revocation for MyApi access control. Use when creating tokens, validating scope, or revoking access.
---

# Gateway Tokens

This skill manages the token layer of MyApi:
- Personal Token (master key for user's personal AI)
- Guest Tokens (ephemeral, scoped access)
- Token revocation and lifecycle

## When to Use
- You need to create or validate an access token
- A third-party needs scoped access to user data
- You require one-click revocation of external access

## Bundled Resources
- scripts/ (token generation, validation, revocation)
- references/ (scope definitions, token formats)
- assets/ (templates)
