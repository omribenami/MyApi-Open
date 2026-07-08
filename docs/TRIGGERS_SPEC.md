# Automations (Triggers) — Spec

Turns MyApi from a *pull* gateway (an agent must ask) into a *push* platform:
connected services and schedules **kick off actions on their own**. The platform
itself is the runtime — it never relies on the user's ChatGPT/agent being awake.

## Product principles
- **IFTTT-simple.** A non-technical user builds an automation as one sentence:
  **"When [this] → do [that]."** No cron strings, no JSON, no tokens in the happy path.
- **Two execution modes, user's choice:**
  - **MyApi AI** (default, zero setup) — the platform runs the AI agent for you;
    tokens are metered to your plan/overage. Non-technical users just pick it.
  - **Bring Your Own** (BYO) — drop your Anthropic/OpenAI key into the vault; the
    platform uses it, zero model cost to you. For power users / cost control.
- **Safe when unattended.** No human is watching at 7am, so every *write* runs
  through the existing policy/approval/audit/quota stack; risky actions wait for a
  one-tap approval push.

---

## 1. Schema (SQLite, `initDatabase()` in `src/database.js`)

```sql
CREATE TABLE IF NOT EXISTS triggers (
  id TEXT PRIMARY KEY,                 -- 'trg_' + hex
  workspace_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,

  -- WHEN
  kind TEXT NOT NULL CHECK(kind IN ('schedule','event')),
  schedule_json TEXT,                  -- structured schedule (see §2); kind=schedule
  timezone TEXT DEFAULT 'UTC',
  event_toolkit TEXT,                  -- composio slug e.g. 'gmail'; kind=event
  event_type TEXT,                     -- composio trigger e.g. 'GMAIL_NEW_MESSAGE'

  -- WHAT
  action_type TEXT NOT NULL CHECK(action_type IN ('service_proxy','afp_exec','ai_prompt')),
  action_json TEXT NOT NULL,

  -- AI execution mode (action_type='ai_prompt')
  ai_mode TEXT DEFAULT 'platform' CHECK(ai_mode IN ('platform','byo')),
  ai_model TEXT,                       -- optional override
  ai_vault_token_id TEXT,              -- which vault key to use when ai_mode='byo'

  next_run_at TEXT,
  last_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);
CREATE INDEX IF NOT EXISTS idx_triggers_due   ON triggers(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_triggers_event ON triggers(enabled, event_toolkit, event_type);

CREATE TABLE IF NOT EXISTS trigger_runs (
  id TEXT PRIMARY KEY,                 -- 'run_' + hex
  trigger_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK(status IN ('queued','running','awaiting_approval','done','failed','skipped')),
  trigger_kind TEXT,
  payload_json TEXT,                   -- event payload, or {}
  result_json TEXT,                    -- output / error / token usage
  approval_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_at TEXT,                      -- worker lease (restart/crash recovery)
  created_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY (trigger_id) REFERENCES triggers(id)
);
CREATE INDEX IF NOT EXISTS idx_trigger_runs_claim ON trigger_runs(status, locked_at);
```

Reused as-is: `usage_daily` (quota/overage), `audit_log` (+actor cols), `policy_rules`
(safety), `notifications` (approval push), `vault_tokens` (BYO key), `billing_subscriptions`
(plan gate).

## 2. Structured schedule (no cron in the UI)

`schedule_json`, evaluated by `src/lib/schedule.js → computeNextRun(schedule, tz, from)`:
```
{ type: 'interval', everyMinutes: 30 }
{ type: 'daily',   atHour: 7,  atMinute: 0 }
{ type: 'weekly',  weekday: 1, atHour: 9, atMinute: 0 }   // 0=Sun
{ type: 'monthly', day: 1,     atHour: 8, atMinute: 0 }
{ type: 'cron',    cron: '0 7 * * *' }                     // advanced, optional
```
Timezone-correct via `Intl.DateTimeFormat` (no dep). The UI only ever shows
"Every 30 minutes / Every day at 07:00 / Mondays at 09:00" — cron is an advanced
escape hatch, hidden by default.

## 3. The engine

- **`src/lib/triggerEngine.js`**, started in `index.js` beside the retention/overage `setInterval`s.
- **Scheduler tick (60s):** find due `kind='schedule'` triggers → insert a `queued`
  `trigger_runs` row → recompute `next_run_at`.
- **Worker tick (10s):** atomically claim queued runs via `locked_at` lease
  (better-sqlite3 is synchronous → no in-process race; lease handles restart),
  then dispatch by `action_type`. Retries with backoff via `attempts`.
- **Event ingress (Phase 2):** `POST /api/v1/triggers/composio/webhook` (public,
  HMAC-verified) → match enabled event triggers → enqueue runs with payload.

## 4. Action executor — `src/lib/actionExecutor.js`

`executeAction({ ownerId, workspaceId, actionType, action, actor })` → unified
`{ ok, statusCode, data }`, writing `audit_log` + `trackWorkspaceUsage`:
- `service_proxy` → `proxyComposioService(...)` for Composio toolkits; native via
  `executeServiceMethod(...)` (Phase 1.5 — see §8).
- `afp_exec` → `dispatchCommand(deviceId,'exec',{cmd})` (exported from `afp.js`).
- `ai_prompt` → headless loop (§5).
The HTTP `/services/*/proxy` and `/afp/*` routes become thin wrappers over this.

## 5. Headless AI loop (`action_type='ai_prompt'`, Phase 3)

An Anthropic tool-use loop inside the worker; **tools = your existing capabilities**
called in-process (executeAction over Composio/AFP/native). Loop until
`stop_reason !== 'tool_use'`, then deliver per `action.deliver`
(notification | email | a service call).

Model key resolution:
- `ai_mode='platform'` → platform key (`ANTHROPIC_API_KEY`); token usage metered
  into `usage_daily` and billed via the existing overage mechanism.
- `ai_mode='byo'` → decrypt `ai_vault_token_id` from `vault_tokens` and use it; no
  model cost to the platform.
Default model `claude-sonnet-4-6` (background cost/latency), override per trigger.

## 6. Safety brain (reuse `policy_rules` + approvals)

Before any **write** runs unattended: evaluate `policy_rules`
(`block | manual_approval | rate_limit | allow`).
- read / `allow` → execute now.
- `manual_approval` → run `awaiting_approval`; `createNotification(ws, owner,
  'trigger_approval', …)` with approve/deny; resume on tap.
- `block` → `skipped`.
Every run → `audit_log` (`auth_type='trigger'`, actor = trigger id) and counts
toward the quota gate like any agent call.

## 7. API + UX

Routes (`src/routes/triggers.js`, `authenticate` + Pro/Heavy plan-gate):
```
GET/POST/PATCH/DELETE /api/v1/triggers           CRUD
POST   /api/v1/triggers/:id/run                  run now (test)
GET    /api/v1/triggers/:id/runs                 run history
POST   /api/v1/triggers/runs/:id/approve|deny    resume held runs
POST   /api/v1/triggers/composio/webhook         (public, HMAC) event ingress
```
Also surfaced to agents (gateway/context + a `triggers` service entry) so an agent
can create automations on the user's behalf.

**UI (IFTTT-style, Phase 2):** a `When … → Then …` builder.
- **When:** "On a schedule" (friendly picker: every N min / daily / weekly + time)
  or "When something happens in [service]" (event dropdown from connected toolkits).
- **Then:** "Run AI instructions" (a plain-text box: *"summarize my unread email and
  message me"* — with a **MyApi AI / Use my own key** toggle), or "Do a specific
  action" (service + action, prefilled from `getServiceMethods`), or "Run a command
  on [my device]" (AFP).
- A **Test** button runs once immediately and shows the result. Run history with
  status chips. No cron, no JSON, no tokens visible in the default path.

## 8. Phasing
- **Phase 1 (done):** schedule lib + tables + helpers + executor (Composio +
  AFP) + scheduler/worker engine + CRUD/run/runs API, plan-gated, audited,
  quota-counted, tested. No LLM, no UI, no webhook — a working deterministic
  automation engine.
- **Phase 1.5 (pending):** native `service_proxy` — extract token-resolution
  from the inline `/services/:serviceName/proxy` route into the executor.
  Deferred: Composio already shadows the major native services, and the inline
  handler (per-service auth quirks for github/discord/fal + preference
  injection) is too entangled to extract safely without a dedicated pass.
  `executeServiceProxyAction` returns a clear 501 pointing to the Composio
  toolkit in the meantime.
- **Phase 2 (done — UI):** a **3-step visual wizard** for non-technical users at
  `/automations` (`src/public/dashboard-app/src/pages/Automations.jsx`):
  **(1) When** — occurrence cards (once / daily / weekly / monthly / every-N-hours)
  with native date/time pickers and weekday chips; **(2) Which app** — a logo
  grid of the user's *connected* services (like the Services page) plus a
  "General task" option; **(3) What to do** — a plain-English instruction box,
  with the AI engine/provider/key-mode tucked into a collapsed "Advanced" row.
  Every wizard automation is an `ai_prompt` action scoped to the chosen service.
  Plus: list with test-now/pause/delete, and the per-provider AI-key panel.
  NOTE: the connected-services dropdown bug is fixed — `/services` returns
  `{ success, data: [...] }`, so read `res.data.data`. Composio **event-webhook
  ingress is still pending**.
- **Phase 3 (done):** `ai_prompt` headless loop (`src/lib/aiAgent.js`) —
  **provider-agnostic**: Anthropic (Messages API, `claude-opus-4-8`, adaptive
  thinking, `effort: medium`) plus OpenAI and OpenRouter (OpenAI-compatible
  chat-completions via fetch — `gpt-4o` / `openai/gpt-4o` defaults, per-action
  `model` override). Two owner-scoped tools (`call_service`, `run_shell`) reuse
  the executor paths. Each provider works in **platform** mode (env
  `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY`) and **BYO** mode
  (per-user, per-provider key, encrypted via the master-token cipher; stored in
  `user_preferences.automationAi[provider]`). A chosen service is injected into
  the task as context. Result delivered as an in-app notification; token usage
  recorded on the run. AI-usage **metering into Stripe overage is still pending**.
- **Schedule lib** now also supports a one-time `{ type: 'once', at: ISO }` that
  fires once then never again (computeNextRun returns null after it passes).
