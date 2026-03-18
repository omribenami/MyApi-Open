# MyApi QA Swarm & Stabilization Plan

## Objective
Execute a rigorous, automated, and multi-agent testing protocol to ensure MyApi is production-ready, secure, and free of logical or UI bugs. 

## Phase 1: Security & Boundary Testing (Agent 1)
**Focus:** Authentication, Device Approval, Token Scope Enforcement.
- Attempt to bypass the device approval flow.
- Try to access endpoints with expired or invalid tokens.
- Verify that `req.session` and `Authorization: Bearer` logic doesn't conflict.
- Test cross-contamination (e.g., trying to use OAuth tokens for Bearer endpoints).

## Phase 2: UI & Integration Flow Testing (Agent 2)
**Focus:** Dashboard UX, Connector Logic, Preferences saving.
- Spin up a headless browser (Puppeteer/Playwright or via the OpenClaw browser tool).
- Test the full OAuth flow loop (mocking the callback).
- Verify the "Service Preferences" modal saves and loads correctly for multiple services.
- Ensure the UI renders correctly without console errors (specifically the metrics and device approval screens).

## Phase 3: AI Tool Connectivity Testing (Agent 3)
**Focus:** External AI integration points.
- Test Claude/OpenAI's ability to reach `/api/v1/tokens/me/capabilities` using both Bearer headers and `?token=` query parameters.
- Verify the API documentation (`/openapi.json`) correctly maps to the exposed endpoints.
- Ensure standard AI web fetchers can read the endpoints they are authorized for.

## Phase 4: Load & Stress Testing (Agent 4)
**Focus:** System stability under pressure.
- Execute parallel requests to the proxy endpoints.
- Verify that the SQLite database handles concurrent reads/writes without "database locked" errors.
- Ensure rate limits are correctly applied and return 429 status codes.

## Execution
This plan will be executed overnight using spawned `sessions_spawn` agents. Each agent will report its findings into `QA_REPORT.md`. Any critical bugs found will be immediately hotfixed.
