# ChatGPT + MyApi

Connect ChatGPT to your MyApi account — identity, personas, knowledge base, and 90+
connected services. Authorization is OAuth-based: you sign in once in the browser and
never paste tokens.

> **Canonical guide:** [`connectors/openai/README.md`](connectors/openai/README.md).
> This file is just a pointer; if anything here disagrees with that guide, the guide wins.

---

## Easiest: use the published GPT

No setup at all — open the published **MyApi Assistant** GPT and sign in when prompted:

https://chatgpt.com/g/g-69a90f35a0888191ae6346c9b129b9a8-myapi-assistant

## Build your own GPT

1. Go to [chatgpt.com](https://chatgpt.com) → **My GPTs** → **Create a GPT** → **Configure**
2. **Instructions:** copy [`connectors/openai/system-prompt.md`](connectors/openai/system-prompt.md)
3. **Actions** → **Create new action** → **Import from URL**:
   ```
   https://www.myapiai.com/api/v1/oauth-server/openapi.yaml
   ```
   This always serves the current API surface for the deployment you point it at.
4. **Authentication:** OAuth —
   - **Authorization URL:** `https://www.myapiai.com/api/v1/oauth-server/authorize`
   - **Token URL:** `https://www.myapiai.com/api/v1/oauth-server/token`
   - Client ID/secret and the full walkthrough are in
     [`connectors/openai/README.md`](connectors/openai/README.md)

ChatGPT connector callbacks are pre-registered by the server — there is no manual
"copy the callback URL into `.env` and restart" step.

## What it can do

The GPT discovers capabilities at runtime: `listServices` → `getServiceMethods` →
`callServiceProxy` (Composio-backed services are `composio__{toolkit}`), plus the
`/api/v1/afp/*` operations for your own enrolled machines, identity, personas,
knowledge base, and memory.

## Deprecated

The old flow (paste a `myapi_` bearer token into a GPT action, import the
root-level `openapi-chatgpt-schema.yaml`) is gone. The schema lives at
[`connectors/openai/openapi.yaml`](connectors/openai/openapi.yaml) — import it via
the live spec URL above, which always serves the current version. The interactive
setup tools (`chatgpt-setup-tool.html`, `chatgpt-setup-cli.js`) that automated the
token-paste flow have been removed.

## Support

- Issues: https://github.com/omribenami/MyApi/issues
- Email: support@myapiai.com
