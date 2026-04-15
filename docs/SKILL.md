# SKILL.md Format Specification

`SKILL.md` is the documentation contract for a MyApi skill. It lives as the `script_content`
field on the skill record and is served as raw markdown at:

```
GET /api/v1/skills/:id/skill.md
```

AI agents read this to understand what a skill does, what parameters it accepts, and what to
expect back. Humans use it to discover, audit, and maintain skills. Every skill must have one.

---

## Canonical Template

Copy this template when creating a new skill. Replace every `{...}` placeholder.

```markdown
# {Skill Name}

> {One sentence: what this skill does and why it exists.}

**Version**: {1.0.0}
**Author**: {GitHub username or "local"}
**Category**: {automation | data | communication | identity | services | custom}
**License**: {MIT | Apache 2.0 | GPL | Proprietary | Custom}
**Origin**: {local | github | marketplace}
**Repo**: {https://github.com/... or omit}

---

## What This Skill Does

{2–4 sentences. What data does it touch? What action does it perform? What problem does it
solve? Avoid vague language like "manages things". Be specific.}

---

## Scope Requirements

| Scope | Required For |
|-------|-------------|
| `skills:read` | Reading skill metadata |
| `{scope}` | {What it enables} |

---

## Inputs

{If this skill is invoked via script_content or an external call, document parameters here.
If the skill is purely declarative (documentation-only), write "This skill is documentation-only
and has no direct invocation inputs."}

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `{param}` | string | Yes | — | {Description} |
| `{param}` | integer | No | 0 | {Description} |

---

## Outputs

{Describe the shape of the response. Include a JSON example.}

```json
{
  "result": "...",
  "data": {}
}
```

---

## Examples

### Example 1: {Name}

```bash
# {What this example demonstrates}
curl -s -X GET https://www.myapiai.com/api/v1/skills/{id}/skill.md \
  -H "Authorization: Bearer <token>"
```

**Response:**
```
{Expected output}
```

### Example 2: {Name}

{Another example if the skill has multiple modes.}

---

## Config (`config_json`)

{If the skill uses config_json, document the expected shape here. Otherwise omit.}

```json
{
  "key": "value"
}
```

---

## Versioning

Versions are snapshots of the skill at a point in time. Create a version before making
breaking changes:

```
POST /api/v1/skills/:id/versions
{ "releaseNotes": "What changed" }
```

---

## Error Handling

| Status | Condition |
|--------|-----------|
| 403 | Token lacks `skills:read` scope |
| 404 | Skill not found or not owned by caller |
| 403 | Bundle token — skill not attached to the active persona |

---

## Notes

- {Any side effects, rate limits, or safety constraints}
- {External services required, e.g. "Requires GitHub OAuth connected"}
- {Any data privacy implications}
```

---

## Field Reference

These map directly to columns on the `skills` table.

| Field | Type | Notes |
|-------|------|-------|
| `name` | string (required) | Unique within owner. Used as directory name on disk (`CLAUDE_SKILLS_DIR/{name}/SKILL.md`). |
| `description` | string | Short one-liner shown in UI and skill listings. |
| `version` | semver string | Default `1.0.0`. Bump via `POST /api/v1/skills/:id/versions`. |
| `author` | string | GitHub username or freeform. |
| `category` | string | Grouping label. Default `custom`. |
| `script_content` | markdown | The full SKILL.md content. Served by `GET /:id/skill.md`. |
| `config_json` | JSON object | Arbitrary config the skill reads at runtime. |
| `repo_url` | URL | GitHub repo for the skill source, if any. |
| `active` | boolean | Whether the skill is enabled. |
| `origin_type` | `local \| github \| marketplace` | Where the skill came from. |
| `origin_owner` | string | GitHub username or MyApi user ID of original author. |
| `is_fork` | boolean | True if forked from another skill. |
| `upstream_repo_url` | URL | The repo this was forked from. |
| `license` | string | Controls fork/sell/modify permissions. See below. |

---

## Licenses

| License | Fork | Sell | Modify | Attribution |
|---------|------|------|--------|-------------|
| MIT | ✓ | ✓ | ✓ | required |
| Apache 2.0 | ✓ | ✓ | ✓ | required |
| GPL | ✓ | ✗ | ✓ | required |
| Proprietary | ✗ | ✓ | ✗ | not required |
| Custom | ✗ | ✗ | ✗ | required |

---

## API Reference

All endpoints require `Authorization: Bearer <token>`. Base URL: `https://www.myapiai.com`

```
GET    /api/v1/skills                         List all skills (scope: skills:read)
GET    /api/v1/skills/:id                     Get skill details + versions + fork info
GET    /api/v1/skills/:id/skill.md            Fetch SKILL.md content as raw markdown
PUT    /api/v1/skills/:id/skill.md            Set SKILL.md content (JSON or raw text)
POST   /api/v1/skills                         Create a skill (scope: skills:write)
PUT    /api/v1/skills/:id                     Update skill fields (scope: skills:write)
DELETE /api/v1/skills/:id                     Delete a skill (scope: skills:write)

GET    /api/v1/skills/:id/versions            List version history
POST   /api/v1/skills/:id/versions            Snapshot current version

POST   /api/v1/skills/:id/fork                Fork a skill (respects license.canFork)
GET    /api/v1/skills/:id/forks               List forks of a skill

GET    /api/v1/skills/licenses                Available license types

POST   /api/v1/skills/:id/verify-ownership    Claim GitHub authorship
```

**Persona attachment:**
```
GET    /api/v1/personas/:id/skills            Skills attached to a persona
POST   /api/v1/personas/:id/skills            Attach a skill to a persona  { skillId }
DELETE /api/v1/personas/:id/skills/:skillId   Detach a skill from a persona
```

**Marketplace:**
```
GET    /api/v1/marketplace/listings           Browse published skills
POST   /api/v1/marketplace/listings/:id/install  Install a marketplace skill
```

---

## Writing for AI Agents

When an AI agent calls `GET /api/v1/skills/:id/skill.md`, it receives this document verbatim.
Write SKILL.md as if briefing a capable but uninformed colleague:

- **Lead with intent.** The first sentence should say exactly what the skill does.
- **Be concrete about inputs and outputs.** Vague docs produce wrong API calls.
- **Include a working curl example.** Agents learn by example.
- **State scope requirements explicitly.** If a scope is missing, the agent gets a 403 with no
  context — your docs are the context.
- **Note side effects.** If the skill sends a Slack message, writes to Drive, or calls an
  external service, say so. The approval gate relies on agents accurately describing their intent.

---

## Worked Example — `github-open-issues`

```markdown
# github-open-issues

> Fetches open issues from a GitHub repository using the owner's connected GitHub OAuth token.

**Version**: 1.2.0
**Author**: omribenami
**Category**: services
**License**: MIT
**Origin**: local

---

## What This Skill Does

Calls the GitHub Issues API through MyApi's OAuth proxy and returns a list of open issues for
any repository the owner has read access to. Use this to give AI agents visibility into active
development work without exposing the GitHub token directly.

---

## Scope Requirements

| Scope | Required For |
|-------|-------------|
| `skills:read` | Reading this skill's definition |
| `services:github:read` | Proxying to the GitHub API |

---

## Inputs

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `owner` | string | Yes | — | GitHub username or org (e.g. `octocat`) |
| `repo` | string | Yes | — | Repository name (e.g. `hello-world`) |
| `state` | string | No | `open` | Issue state: `open`, `closed`, or `all` |
| `per_page` | integer | No | 10 | Max results (1–100) |

---

## Outputs

Returns GitHub's issue objects filtered to: `number`, `title`, `state`, `created_at`,
`updated_at`, `html_url`, `labels`, `assignees`.

```json
{
  "success": true,
  "issues": [
    {
      "number": 42,
      "title": "Fix auth middleware timeout",
      "state": "open",
      "created_at": "2026-03-01T10:00:00Z",
      "html_url": "https://github.com/octocat/hello-world/issues/42",
      "labels": [{ "name": "bug" }],
      "assignees": [{ "login": "omribenami" }]
    }
  ]
}
```

---

## Examples

### Fetch open issues for a repo

```bash
curl -s -X POST https://www.myapiai.com/api/v1/services/github/proxy \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/repos/octocat/hello-world/issues?state=open&per_page=10",
    "method": "GET"
  }'
```

---

## Error Handling

| Status | Condition |
|--------|-----------|
| 403 | Token lacks `services:github:read` scope |
| 403 | GitHub not connected — owner must connect at /dashboard/services |
| 404 | Repository not found or no read access |

---

## Notes

- Read-only. Does not create or modify issues.
- Requires GitHub OAuth connected with at least `repo` scope.
- Results are not cached — each call hits GitHub's API directly.
```

---

## Disk Layout (Claude Skills Dir)

When `CLAUDE_SKILLS_DIR` is set, skills can also be loaded from disk:

```
/app/claude-skills/
  {skill-name}/
    SKILL.md         ← falls back here if script_content is empty
```

The DB `script_content` takes precedence. Disk is the fallback.
