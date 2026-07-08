// Tour decks. A step = { target?: CSS selector, path?: route to navigate to first,
// title, body }. Steps with no resolvable target render as a centered popover.

// Cross-page "essentials" tour (the auto / "Take a tour" walkthrough).
// Ordered to follow the sidebar top-to-bottom so the highlight moves steadily
// down the nav instead of jumping around.
export const ESSENTIALS = [
  { target: '[data-tour="dashboard"]', path: '/', title: 'Welcome to MyApi 👋', body: 'This is home base — recent activity, usage metrics, and quick access to everything. A 1-minute tour of the essentials:' },
  { target: '[data-tour="automations"]', path: '/automations', title: 'Automations ✨', body: 'Schedule AI tasks that run across your apps on their own — like a morning email digest.' },
  { target: '[data-tour="activity"]', path: '/activity', title: 'Activity Log', body: 'Every action — by you, an agent, or an automation — is logged here. You’re always in control.' },
  { target: '[data-tour="identity"]', path: '/identity', title: 'Your Identity', body: 'Tell MyApi who you are — name, role, bio, timezone. Agents you authorize use this to act accurately on your behalf.' },
  { target: '[data-tour="personas"]', path: '/personas', title: 'Personas', body: 'Create AI identities with their own personality, knowledge, and skills, and switch between them.' },
  { target: '[data-tour="knowledge"]', path: '/knowledge', title: 'Knowledge Base', body: 'Upload documents and notes that ground your AI in your real context.' },
  { target: '[data-tour="access-tokens"]', path: '/access-tokens', title: 'Access Tokens', body: 'Issue scoped API keys to each agent — exactly the permissions they need, revocable any time.' },
  { target: '[data-tour="vault"]', path: '/tokens', title: 'Token Vault', body: 'Store API keys and credentials encrypted; MyApi uses them for you — agents never see the raw secret.' },
  { target: '[data-tour="services"]', path: '/services', title: 'Connected Services', body: 'Connect 100+ apps once. Agents and automations use them through MyApi — without ever seeing your credentials.' },
  { target: '[data-tour="connectors"]', path: '/connectors', title: 'Connectors', body: 'Plug in AI assistants (ChatGPT, MCP clients) and your own machines via the AFP daemon.' },
  { target: '[data-tour="devices"]', path: '/devices', title: 'Devices', body: 'Every device and agent that uses your tokens. Approve new ones, review activity, and revoke access in a click.' },
  { target: '[data-tour="marketplace"]', path: '/marketplace', title: 'Marketplace', body: 'Discover and install skills, personas, and tokens shared by the community.' },
  { target: '[data-tour="my-listings"]', path: '/my-listings', title: 'My Listings', body: 'Publish your own skills and personas to the marketplace and track how they’re doing.' },
  { target: '[data-tour="take-a-tour"]', path: '/', title: 'Replay any time', body: 'That’s the tour! You can run it again whenever you like — it lives right here as “Take a tour” in the sidebar.' },
  { target: '[data-tour="discord"]', path: '/', title: 'Join our Discord 💬', body: 'Stuck, or have an idea? Hit the Support button up here any time to join our Discord community — the fastest way to reach the MyApi team and other builders.' },
  { target: '[data-tour="page-help"]', path: '/', title: 'Need a hand on a page?', body: 'Every page has its own “?” button up here. Press it for a short, page-specific walkthrough of what each section does. Explore freely — help is always one click away.' },
];

// Per-page short manuals (no `path` — they run on the page you're already on).
// Each step targets a real in-page sub-component (data-tour anchor) to help users
// find their way around — never the page title or a left-nav button. A step whose
// target isn't on screen falls back to a centered popover.
export const PAGE_TOURS = {
  '/': [
    { target: '[data-tour="dash-kpis"]', title: 'Your account at a glance', body: 'Total API calls, active devices, error rate, and rate-limits over the selected window. Agent, automation, and token activity counts here — browsing the dashboard never does.' },
    { target: '[data-tour="dash-donut"]', title: 'Calls by device — then by service', body: 'Each slice is one of your devices or agents. Click a slice to drill into exactly what that client is calling, and the whole page follows your selection.' },
    { target: '[data-tour="dash-insights"]', title: 'Insights & alerts', body: 'Anomalies worth a look — rate-limited clients, error spikes, idle devices — plus any announcements from the MyApi team.' },
    { target: '[data-tour="dash-table"]', title: 'Every client, audited', body: 'Each device or agent holding a scoped token, with its calls, status, top service, and error rate. Select a row to focus the dashboard on it.' },
  ],
  '/automations': [
    { target: '[data-tour="auto-settings"]', title: 'AI engine & credits', body: 'Pick a provider, bring your own key (free) or use the MyApi assistant (credits), and set a spend limit or auto-reload.' },
    { target: '[data-tour="auto-new"]', title: 'Create an automation', body: 'Build it in three steps — When it runs, Who (which apps it can use), and What it should do in plain English.' },
    { title: 'Your automations', body: 'Each row shows its schedule and task. Run it now to test, pause/resume, edit, or delete — any time.' },
  ],
  '/services': [
    { target: '[data-tour="svc-tabs"]', title: 'Filter & search', body: 'Switch between Connected, Available, and more — or search to find a specific app.' },
    { target: '[data-tour="svc-categories"]', title: 'Browse by category', body: 'Productivity, Developer Tools, Communication, Social, Business & CRM…' },
    { target: '[data-tour="svc-grid"]', title: 'Connect an app', body: 'Click a service to connect (OAuth or one-click Composio). Agents and automations then use it through MyApi — your credentials never leave.' },
  ],
  '/connectors': [
    { target: '[data-tour="conn-goals"]', title: 'Pick a path', body: 'Choose what you want to connect: chat with your data via an assistant, let an agent use this computer (AFP), or wire up an agentic AI with its own key.' },
    { target: '[data-tour="conn-assistants"]', title: 'AI assistants', body: 'Authorize external AI tools (ChatGPT, MCP clients) once — no tokens to paste — so they can act with scoped access.' },
    { target: '[data-tour="conn-connections"]', title: 'Your connections', body: 'Everything connected to your account lives here — computers, agents, and keys — each with a live status dot and one-click revoke.' },
  ],
  '/access-tokens': [
    { target: '[data-tour="tok-master"]', title: 'Master token', body: 'Your full-access, never-expiring key — keep it secret. Used for trusted automation and admin.' },
    { target: '[data-tour="tok-new"]', title: 'Issue a scoped token', body: 'Create a guest token with only the scopes an agent needs — revocable any time without touching anything else.' },
  ],
  '/tokens': [
    { target: '[data-tour="vault-actions"]', title: 'Add a secret', body: 'Store an API token, or a username/password credential, for any external service. Everything is encrypted at rest (AES-256-GCM).' },
    { target: '[data-tour="vault-list"]', title: 'Your stored secrets', body: 'Each row is a key MyApi attaches to outgoing requests for you — agents never see the raw value. Reveal, edit, or delete any one here.' },
  ],
  '/activity': [
    { target: '[data-tour="act-filters"]', title: 'Filter the log', body: 'Narrow by action, resource, actor, result, and date — or search by name/ID.' },
    { target: '[data-tour="act-table"]', title: 'Every action, audited', body: 'Who did what, when, and from which device — by you, an agent, or an automation. Scroll right for time, IP, and details.' },
  ],
  '/devices': [
    { target: '[data-tour="dev-tabs"]', title: 'Approve & review devices', body: 'Switch between approved devices, pending approvals, and activity. Approve or revoke any device or agent that uses your tokens.' },
  ],
  '/identity': [
    { target: '[data-tour="id-form"]', title: 'Edit your profile', body: 'Fill in your name, role, bio, and timezone. This writes your USER.md identity file that authorized agents read to act as you.' },
    { target: '[data-tour="id-preview"]', title: 'Live preview', body: 'See exactly how your identity appears to agents before you save — what they know about who they’re acting for.' },
  ],
  '/knowledge': [
    { target: '[data-tour="kb-actions"]', title: 'Add documents', body: 'Upload a file or write a new document — markdown-first, encrypted, versioned. Attach it to specific personas so agents reason over your real context.' },
    { target: '[data-tour="kb-search"]', title: 'Search & filter', body: 'Find documents by text, narrow by source, or re-sort once your library grows.' },
    { target: '[data-tour="kb-table"]', title: 'Your documents', body: 'Every document you’ve added. Click a row to view, edit, or manage which personas can see it.' },
  ],
  '/personas': [
    { target: '[data-tour="persona-new"]', title: 'Create a persona', body: 'Each persona is a soul file plus the knowledge and skills attached to it — build different ones for different roles.' },
    { target: '[data-tour="persona-list"]', title: 'Switch personas', body: 'Search and select among your personas. The active one shapes every API response until you switch.' },
    { target: '[data-tour="persona-detail"]', title: 'Shape the selected persona', body: 'Edit its personality, and attach the knowledge documents and skills it’s allowed to use.' },
  ],
  '/memory': [
    { target: '[data-tour="mem-actions"]', title: 'Add a memory', body: 'Write a long-lived fact, or upload a MEMORY.md file. These persist across every session so agents remember between conversations.' },
    { target: '[data-tour="mem-list"]', title: 'What’s remembered', body: 'Every stored memory, scoped to a persona. Edit any entry inline, or forget it one at a time.' },
  ],
  '/skills': [
    { target: '[data-tour="skills-new"]', title: 'Create a skill', body: 'Wrap one or more service calls behind a natural-language intent — a reusable action agents can invoke from a Git repo.' },
    { target: '[data-tour="skills-grid"]', title: 'Your skills', body: 'Each card is a capability you can edit, enable/disable, or attach to a persona.' },
  ],
  '/marketplace': [
    { target: '[data-tour="mkt-counters"]', title: 'What’s available', body: 'A running count of community-published skills, personas, and tokens you can install.' },
    { target: '[data-tour="mkt-search"]', title: 'Search & sort', body: 'Find listings by name and sort by most recent, most popular, or most used.' },
    { target: '[data-tour="mkt-grid"]', title: 'Browse & install', body: 'Click any listing to see details, ratings, and install it into your own account.' },
  ],
  '/notifications': [
    { target: '[data-tour="notif-filters"]', title: 'Filter your alerts', body: 'Switch between all/unread/read, narrow by type, or search — alerts come from automations, security events, and account activity.' },
    { target: '[data-tour="notif-list"]', title: 'Your notifications', body: 'Each item is one event. Click to mark read or open the related action.' },
  ],
};

const ALIASES = { '/device-management': '/devices' };

export function getPageTour(pathname) {
  const path = (ALIASES[pathname] || pathname || '/').replace(/\/+$/, '') || '/';
  if (PAGE_TOURS[path]) return PAGE_TOURS[path];
  return [{ target: 'h1', title: 'About this page', body: 'This page is part of your MyApi dashboard. For a full walkthrough, use “Take a tour” in the sidebar.' }];
}
