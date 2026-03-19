# Official Marketplace Skills Inventory

Date: 2026-03-19
Seed tag: `official-seed-2026-03-19`
Insertion path used: `src/database.js -> createMarketplaceListing()`
Marketplace type used: `skill`

## Summary

- Total seeded: **12** official listings
- Providers covered:
  - OpenAI
  - Anthropic
  - Google AI / Gemini
  - Microsoft AI / Azure OpenAI
  - Meta AI
  - Cohere
  - Mistral
  - Perplexity
- Official verification marker: included in each listing payload under:
  - `content.config_json.official = true`
  - `content.config_json.verified_source = true`
  - `content.config_json.source_url = <official URL>`

## MyApi Listing Payload Shape (used)

Each listing was seeded with a content payload compatible with existing marketplace skill patterns:

```json
{
  "skill_name": "...",
  "script_content": "...",
  "version": "1.0.0",
  "category": "integration|automation|analytics|productivity",
  "repo_url": "https://...",
  "config_json": {
    "provider": "...",
    "official": true,
    "verified_source": true,
    "source_type": "official-docs|official-repository",
    "source_url": "https://...",
    "license": "..."
  }
}
```

## Inventory

| ID | Title | Provider | Category Tags | Source URL | License |
|---:|---|---|---|---|---|
| 1 | OpenAI: Function Calling Patterns (Official) | OpenAI | openai, tools, function-calling, official | https://platform.openai.com/docs/guides/function-calling | OpenAI Documentation Terms |
| 2 | OpenAI: Built-in Tools via Responses API (Official) | OpenAI | openai, responses-api, tools, official | https://platform.openai.com/docs/guides/tools | OpenAI Documentation Terms |
| 3 | Anthropic: Claude Tool Use Workflow (Official) | Anthropic | anthropic, claude, tool-use, official | https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview | Anthropic Documentation Terms |
| 4 | Anthropic: Prompt Engineering for Claude (Official) | Anthropic | anthropic, prompting, claude, official | https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview | Anthropic Documentation Terms |
| 5 | Google Gemini API: Function Calling (Official) | Google AI | google, gemini, function-calling, official | https://ai.google.dev/gemini-api/docs/function-calling | Google Developers Site Terms |
| 6 | Google Gemini API: Grounding with Google Search (Official) | Google AI | google, gemini, grounding, search, official | https://ai.google.dev/gemini-api/docs/grounding | Google Developers Site Terms |
| 7 | Microsoft Azure OpenAI: Function Calling (Official) | Microsoft | microsoft, azure-openai, function-calling, official | https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/function-calling | Microsoft Learn Terms |
| 8 | Microsoft Semantic Kernel Connectors (Official Repo) | Microsoft | microsoft, semantic-kernel, connectors, official-repo | https://github.com/microsoft/semantic-kernel | MIT |
| 9 | Meta Llama Stack: Tool Calling (Official) | Meta AI | meta, llama, llama-stack, tool-calling, official-repo | https://github.com/meta-llama/llama-stack | Llama Stack repository license (see source repo) |
| 10 | Cohere: Tool Use in Chat API (Official) | Cohere | cohere, tool-use, chat-api, official | https://docs.cohere.com/docs/tool-use | Cohere Documentation Terms |
| 11 | Mistral: Function Calling Capability (Official) | Mistral | mistral, function-calling, tools, official | https://docs.mistral.ai/capabilities/function_calling/ | Mistral Documentation Terms |
| 12 | Perplexity Sonar API: Official Docs | Perplexity | perplexity, sonar, search, official | https://docs.perplexity.ai/ | Perplexity Documentation Terms |

## Validation

Validation checks performed:

1. Seed script execution completed without errors.
2. DB query confirmed `12` active seeded listings tagged with `official-seed-2026-03-19`.
3. Each seeded listing includes:
   - `type = 'skill'`
   - official source URL in payload
   - official/verified metadata flags in payload
4. Re-run behavior is idempotent by `(title + source_url)` duplicate check in seed script.

## Seed Script

- Script file: `scripts/seed_official_marketplace_skills.js`
- Usage:
  - `node scripts/seed_official_marketplace_skills.js`

Environment override:

- `MARKETPLACE_OWNER_ID` (optional, defaults to `owner`)

## Notes

- No uncertain/non-verifiable items were included.
- Items are limited to official docs/repositories from first-party domains or organization repositories.
