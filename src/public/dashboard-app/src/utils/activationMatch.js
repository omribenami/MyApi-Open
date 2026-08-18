/**
 * Activation matching table: most-used AI → best MCP connector + suggested services.
 * Used by the first-win onboarding flow. Keep this as the single source of truth
 * so Connectors / marketing copy cannot drift.
 */

export const ACTIVATION_AIS = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    hint: 'CLI / terminal',
    connector: 'quick',
    connectorTitle: 'Quick Connect (MCP)',
    connectorWhy: 'Claude Code speaks MCP natively. A one-time enroll code installs myapi-asc-mcp — no token is ever shown to the agent.',
    services: ['github', 'gmail', 'notion'],
    mcpConfigHint: 'Add the generated MCP server to ~/.claude.json (or project .mcp.json) and restart Claude Code.',
  },
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    hint: 'Desktop app',
    connector: 'quick',
    connectorTitle: 'Quick Connect (MCP)',
    connectorWhy: 'Claude Desktop reads mcpServers from its config. Paste the generated block, restart, then call myapi_status.',
    services: ['gmail', 'googlecalendar', 'notion'],
    mcpConfigHint: 'Claude Desktop → Settings → Developer → Edit Config. Restart the app after saving.',
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    hint: 'Custom GPT / Actions',
    connector: 'oauth',
    connectorTitle: 'OAuth PKCE installer',
    connectorWhy: 'ChatGPT Actions need a Bearer token. Run the one-line installer on your machine, then paste the printed token into the GPT.',
    services: ['gmail', 'notion', 'googlecalendar'],
    mcpConfigHint: 'Prefer Custom GPT Actions with Authorization: Bearer. MCP is optional via a local bridge.',
  },
  {
    id: 'grok',
    label: 'Grok',
    hint: 'xAI',
    connector: 'quick',
    connectorTitle: 'Quick Connect (MCP)',
    connectorWhy: 'Grok can load MCP servers. Generate an enroll code, add the MCP block, then call myapi_status to confirm.',
    services: ['twitter', 'gmail', 'github'],
    mcpConfigHint: 'Add the myapi MCP server in Grok\u2019s connected tools, then restart the session.',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    hint: 'IDE',
    connector: 'quick',
    connectorTitle: 'Quick Connect (MCP)',
    connectorWhy: 'Cursor MCP config is a JSON file. The enroll code is single-use and expires in 15 minutes.',
    services: ['github', 'notion', 'linear'],
    mcpConfigHint: 'Cursor Settings → MCP. Save and reload the window.',
  },
  {
    id: 'openclaw',
    label: 'OpenClaw / Hermes',
    hint: 'Local agent',
    connector: 'asc',
    connectorTitle: 'ASC local MCP daemon',
    connectorWhy: 'OpenClaw already lives on your machine. ASC installs a signed local MCP on 127.0.0.1:9587 — the private key never leaves the host.',
    services: ['github', 'gmail', 'discord'],
    mcpConfigHint: 'Point the agent at http://127.0.0.1:9587/mcp after the daemon is approved in Devices.',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    hint: 'Google',
    connector: 'quick',
    connectorTitle: 'Quick Connect (MCP)',
    connectorWhy: 'Gemini extensions / MCP clients can enroll with a one-time code the same way other agents do.',
    services: ['gmail', 'googledrive', 'googlecalendar'],
    mcpConfigHint: 'Add the MCP server in Gemini\u2019s tool settings and start a new chat.',
  },
  {
    id: 'codex',
    label: 'Codex / OpenAI Codex',
    hint: 'Coding agent',
    connector: 'quick',
    connectorTitle: 'Quick Connect (MCP)',
    connectorWhy: 'Codex-style agents pick up MCP from project config. Enroll once, then the agent can hit GitHub through MyApi.',
    services: ['github', 'notion', 'linear'],
    mcpConfigHint: 'Drop the MCP block into the agent\u2019s config and restart the session.',
  },
  {
    id: 'other',
    label: 'Other / not sure',
    hint: 'We\u2019ll pick a default',
    connector: 'quick',
    connectorTitle: 'Quick Connect (MCP)',
    connectorWhy: 'Quick Connect works with any MCP-capable agent. If yours cannot run MCP, use the OAuth installer instead.',
    services: ['gmail', 'github', 'notion'],
    mcpConfigHint: 'If your agent has no MCP support, switch to OAuth PKCE on this step.',
  },
];

export const ACTIVATION_SERVICES = [
  { id: 'google', name: 'Google', desc: 'Gmail, Drive, Calendar' },
  { id: 'github', name: 'GitHub', desc: 'Repos, issues, PRs' },
  { id: 'gmail', name: 'Gmail', desc: 'Inbox and send' },
  { id: 'googlecalendar', name: 'Calendar', desc: 'Events and availability' },
  { id: 'googledrive', name: 'Drive', desc: 'Files and docs' },
  { id: 'slack', name: 'Slack', desc: 'Messages, channels' },
  { id: 'notion', name: 'Notion', desc: 'Docs, databases' },
  { id: 'discord', name: 'Discord', desc: 'Servers, messages' },
  { id: 'linear', name: 'Linear', desc: 'Issues and projects' },
  { id: 'linkedin', name: 'LinkedIn', desc: 'Profile, posts' },
  { id: 'twitter', name: 'Twitter / X', desc: 'Posts, DMs' },
];

export const MCP_RECOVERY = [
  {
    id: 'code-expired',
    title: 'Enroll code expired',
    body: 'Codes last 15 minutes and work once. Generate a new setup prompt and paste it again. Do not reuse an old code.',
  },
  {
    id: 'not-restarted',
    title: 'Agent did not pick up MCP',
    body: 'Most clients only load mcpServers at startup. Save the config, fully quit the app (not just the window), and reopen it.',
  },
  {
    id: 'npx-blocked',
    title: 'npx / myapi-asc-mcp failed',
    body: 'The agent host needs Node.js and outbound npm access. Run `npx -y myapi-asc-mcp` once in a terminal on that machine to confirm it installs.',
  },
  {
    id: 'daemon-down',
    title: 'ASC daemon not listening',
    body: 'For OpenClaw / local ASC: confirm `curl -s http://127.0.0.1:9587/status` works. Re-run the install script if the port is closed.',
  },
  {
    id: 'pending-approval',
    title: 'Waiting in Devices',
    body: 'Some methods leave a pending device. Open Devices and click Approve. Then call myapi_status again.',
  },
  {
    id: 'scope-403',
    title: 'Connected but getting 403',
    body: 'The agent enrolled with a scoped token. Either generate a new prompt with Full access, or connect the service the call needs.',
  },
];

export function getAiById(id) {
  return ACTIVATION_AIS.find((a) => a.id === id) || ACTIVATION_AIS.find((a) => a.id === 'other');
}

export function suggestedServicesFor(aiIds) {
  const ids = Array.isArray(aiIds) ? aiIds : [aiIds];
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    const ai = getAiById(id);
    for (const svc of ai.services || []) {
      if (!seen.has(svc)) {
        seen.add(svc);
        out.push(svc);
      }
    }
  }
  return out;
}

export function buildTestDrivePrompts({ ai, services = [] }) {
  const name = ai?.label || 'your agent';
  const svcList = services.length ? services.join(', ') : 'your connected services';
  return [
    {
      id: 'status',
      title: 'Prove the connection',
      prompt: `Call the MyApi myapi_status tool (or GET /api/v1/gateway/context). Summarize who I am, which services are connected, and confirm you are enrolled. Do not take any other action.`,
    },
    {
      id: 'first-read',
      title: 'First useful read',
      prompt: `Using MyApi (not your own credentials), list a short summary of my ${svcList} that I would actually care about right now. Ask me before writing or sending anything.`,
    },
    {
      id: 'ask-first',
      title: 'Stay in the loop',
      prompt: `From now on, treat MyApi as the source of my identity, memory, and connected apps. Before any write (email, issue, post), describe the action and wait for my yes. I am using ${name}.`,
    },
  ];
}

export const POST_WIN_FEATURES = [
  { title: 'Personas', desc: 'Tone and role overlays (SOUL.md) your agents adopt per task.', route: '/personas' },
  { title: 'Scoped tokens', desc: 'Least-privilege credentials per agent. Everything else returns 403.', route: '/access-tokens' },
  { title: 'Knowledge', desc: 'Upload briefs and SOPs so agents stop guessing.', route: '/knowledge' },
  { title: 'Automations', desc: 'Scheduled or event-driven tasks MyApi runs on its own.', route: '/automations' },
];
