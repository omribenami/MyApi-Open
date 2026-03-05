# MyApi GPT Store Package

Use this folder as your copy-paste source when creating the GPT in OpenAI.

## Where to put this

- Keep these files in the repo at: `docs/gpt-store/`
- In ChatGPT Builder (Create GPT), paste content from:
  - `SYSTEM_INSTRUCTIONS.md` → Instructions field
  - `CONVERSATION_STARTERS.md` → Conversation starters
  - `STORE_LISTING.md` → Name/Description/Listing copy
  - `OPENAPI_SNIPPET.yaml` → Actions schema (import)

## Recommended base URL

Set server URL to:

`https://myapiai.com`

## Publish flow (2-3 min)

1. Open ChatGPT → Explore GPTs → Create
2. Paste system instructions
3. Add conversation starters
4. Configure Actions using OpenAPI snippet
5. Test with a read-only endpoint first (`/api/v1/services`)
6. Publish as private first, then public when stable

## Security recommendation

Start with read-only actions, then expand write actions gradually.
