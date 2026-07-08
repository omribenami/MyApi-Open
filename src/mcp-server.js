/**
 * ⚠️ DEPRECATED & DISABLED — DO NOT USE ⚠️
 *
 * This was the original MyApi MCP server. It authenticated agents purely from a
 * `MYAPI_USER_ID` environment variable with NO cryptographic proof of ownership —
 * any process that could set that env var could read another user's data straight
 * from the SQLite file. That trust model is fundamentally insecure and is the exact
 * thing the new connection design removes.
 *
 * It has been replaced by the ASC (Agentic Secure Connection) MCP:
 *
 *     packages/myapi-asc-mcp/
 *
 * ASC gives each agent its own Ed25519 keypair (stored 0600 in ~/.myapi/). Every
 * request is signed; the private key never leaves the agent host and NO bearer
 * token is ever handed to the agent/model — so the agent cannot leak or "give away"
 * a credential it never holds. The user approves the key once from the dashboard
 * (Devices), after which the key is the permanent credential.
 *
 * Migration:
 *   1. Remove any `myapi` entry pointing at this file from your MCP config.
 *   2. Add the ASC MCP instead:
 *        {
 *          "mcpServers": {
 *            "myapi": {
 *              "command": "npx",
 *              "args": ["-y", "@myapi/asc-mcp"],
 *              "env": { "MYAPI_TOKEN": "myapi_...   (one-time, removable after approval)" }
 *            }
 *          }
 *        }
 *   3. Call the `myapi_status` tool once and approve the key at
 *      https://www.myapiai.com/dashboard/devices.
 *
 * This stub intentionally refuses to start so the insecure path can never run.
 */

'use strict';

const MESSAGE = [
  '',
  '╳ MyApi MCP (src/mcp-server.js) is DISABLED — it used an insecure',
  '  MYAPI_USER_ID trust model with no request signing.',
  '',
  '→ Use the ASC MCP instead: packages/myapi-asc-mcp  (npx -y @myapi/asc-mcp)',
  '  It signs every request with a per-agent Ed25519 key; no access token is',
  '  ever exposed to the agent. Approve the key at /dashboard/devices.',
  '',
].join('\n');

// Refuse to run regardless of how it is invoked (stdio MCP host or direct node).
console.error(MESSAGE);
process.exit(1);
