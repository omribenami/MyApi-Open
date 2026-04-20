import React, { useState, useEffect } from 'react';

// ─── Nav groups ───────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Getting Started',
    items: [
      { id: 'what-is-myapi', title: 'What is MyApi?' },
      { id: 'quickstart',    title: 'Quick Start' },
    ],
  },
  {
    label: 'Your Data',
    items: [
      { id: 'identity', title: 'Identity & Profile' },
      { id: 'memory',   title: 'Memory' },
    ],
  },
  {
    label: 'AI Brain',
    items: [
      { id: 'personas',   title: 'Personas' },
      { id: 'knowledge',  title: 'Knowledge Base' },
      { id: 'skills',     title: 'Skills & Marketplace' },
    ],
  },
  {
    label: 'Connections',
    items: [
      { id: 'services', title: 'Connected Services' },
      { id: 'afp',      title: 'AFP Connector' },
      { id: 'asc',      title: 'ASC — Secure Agent Auth' },
    ],
  },
  {
    label: 'Access & Security',
    items: [
      { id: 'access-tokens', title: 'Access Tokens & Scopes' },
      { id: 'vault',         title: 'Token Vault' },
      { id: 'devices',       title: 'Device Management' },
    ],
  },
  {
    label: 'Team & Admin',
    items: [
      { id: 'team',     title: 'Team Workspaces' },
      { id: 'activity', title: 'Activity Log & Audit' },
      { id: 'backup',   title: 'Backup & Data Portability' },
    ],
  },
  {
    label: 'Developer',
    items: [
      { id: 'agent-integration', title: 'AI Agent Integration' },
    ],
  },
];

// ─── Helper components ────────────────────────────────────────────────────────

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <h2 className="text-2xl font-semibold pb-3 ink" style={{ borderBottom: '1px solid var(--line)' }}>{title}</h2>
      <div className="leading-relaxed space-y-4 text-sm sm:text-base ink-2">{children}</div>
    </section>
  );
}

function Block({ title, accent, children }) {
  return (
    <div className="ui-card p-4 sm:p-5" style={accent ? { borderLeft: '3px solid var(--accent)' } : {}}>
      {title && <h3 className="font-semibold mb-2 text-sm sm:text-base ink">{title}</h3>}
      <div className="text-sm space-y-2 ink-2">{children}</div>
    </div>
  );
}

function Callout({ type = 'info', children }) {
  const containerStyles = {
    info:    { background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: '6px' },
    tip:     { background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: '6px' },
    warning: { background: 'var(--amber-bg, #fffbeb)', border: '1px solid var(--amber)', borderRadius: '6px' },
  };
  const labelStyles = {
    info:    { color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent)' },
    tip:     { color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--green)' },
    warning: { color: 'var(--amber)', background: 'var(--amber-bg, #fffbeb)', border: '1px solid var(--amber)' },
  };
  const textStyles = {
    info:    { color: 'var(--accent)' },
    tip:     { color: 'var(--green)' },
    warning: { color: 'var(--amber)' },
  };
  const labels = { info: 'Note', tip: 'Tip', warning: 'Warning' };
  return (
    <div className="p-4 text-sm flex gap-3" style={containerStyles[type]}>
      <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 h-max mt-0.5" style={labelStyles[type]}>
        {labels[type]}
      </span>
      <div className="leading-relaxed" style={textStyles[type]}>{children}</div>
    </div>
  );
}

function CodeSnip({ children }) {
  return (
    <pre className="px-4 py-3 font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed ink-2" style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: '6px' }}>
      {children}
    </pre>
  );
}

function DocsTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto" style={{ border: '1px solid var(--line)', borderRadius: '6px' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--bg-sunk)' }}>
            {headers.map((h, i) => (
              <th key={i} className="text-left py-2.5 px-4 text-xs uppercase tracking-wide font-semibold ink-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--line)', background: i % 2 === 1 ? 'var(--bg-sunk)' : 'transparent' }}>
              {row.map((cell, j) => (
                <td key={j} className="py-2.5 px-4 align-top ink-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function PlatformDocs() {
  const [activeId, setActiveId] = useState('what-is-myapi');

  useEffect(() => {
    const allIds = NAV_GROUPS.flatMap(g => g.items.map(i => i.id));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: '-15% 0px -70% 0px' }
    );
    allIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-serif text-[20px] sm:text-[28px] font-medium tracking-tight ink">Platform Documentation</h1>
        <p className="ink-3 mt-2">
          Everything you need to know about MyApi — what each feature does, how to use it, and real-world examples.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">

        {/* ── Sidebar nav ── */}
        <aside className="lg:sticky lg:top-24 h-max ui-card p-4">
          <p className="micro mb-3 px-1">Contents</p>
          <nav className="space-y-3">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-xs uppercase tracking-wide font-semibold px-3 mb-1 ink-4">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="block px-3 py-1.5 rounded text-sm transition-colors"
                      style={
                        activeId === item.id
                          ? { background: 'var(--accent-bg)', color: 'var(--accent)', fontWeight: 500 }
                          : { color: 'var(--ink-3)' }
                      }
                    >
                      {item.title}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* ── Content ── */}
        <main className="space-y-12 ui-card p-6 sm:p-8 min-w-0">

          {/* ── What is MyApi ── */}
          <Section id="what-is-myapi" title="What is MyApi?">
            <p>
              MyApi is your personal control layer between AI agents and everything you use online. Instead of pasting
              raw credentials into every AI tool, you connect your services once and issue agents scoped tokens — or
              better yet, let them authenticate via cryptographic keypair signing so no secret ever touches the wire.
              Your data stays private, every action is logged, and your entire agent setup can be backed up and
              restored in seconds.
            </p>

            <Block title="The problems it solves">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-red-400 font-medium mb-2 text-xs uppercase tracking-wide">Without MyApi</p>
                  <ul className="list-disc pl-4 space-y-1 ink-3">
                    <li>Raw credentials pasted into every AI tool — one leak = full exposure</li>
                    <li>No way to revoke a single agent's access without rotating everything</li>
                    <li>Tokens sitting in environment variables, readable by anyone with server access</li>
                    <li>No audit trail — no idea what agents actually did</li>
                    <li>Agent context is shallow — agents know nothing real about you</li>
                    <li>Your entire setup lives in one place, no backup, no recovery path</li>
                    <li>Moving to a new machine means rebuilding everything from scratch</li>
                  </ul>
                </div>
                <div>
                  <p className="text-green-400 font-medium mb-2 text-xs uppercase tracking-wide">With MyApi</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Connect services once, proxy requests forever — credentials never leave</li>
                    <li>Revoke any agent's access instantly, without affecting anything else</li>
                    <li>ASC: agents authenticate by cryptographic signature — no raw secret ever transmitted</li>
                    <li>Full immutable audit log of every API action, filterable and exportable</li>
                    <li>Personas + memory + knowledge give agents deep, accurate context about you</li>
                    <li>One-click ZIP export of your entire agent ecosystem — personas, memory, skills</li>
                    <li>Import on any MyApi instance in seconds — migrate or restore effortlessly</li>
                  </ul>
                </div>
              </div>
            </Block>

            <Block title="Core concepts at a glance">
              <DocsTable
                headers={['Concept', 'What it is']}
                rows={[
                  ['Services', 'OAuth integrations (Google, GitHub, Slack, etc.) that MyApi can proxy on your behalf'],
                  ['Personas', 'AI identities with distinct personalities, attached knowledge, and skills'],
                  ['Skills', 'Capability modules you can build, install, and attach to personas'],
                  ['Tokens', 'Scoped API keys you issue to agents — they control exactly what can be accessed'],
                  ['Knowledge', 'Documents and memory that ground your AI interactions in your actual context'],
                ]}
              />
            </Block>

            <Block title="Typical workflow">
              <ol className="list-decimal pl-5 space-y-2">
                <li><span className="ink font-medium">Connect your services</span> — link Google, GitHub, Slack, or any of the 45+ supported integrations via OAuth</li>
                <li><span className="ink font-medium">Build your personas</span> — create AI identities tailored to different roles (engineer, assistant, support agent)</li>
                <li><span className="ink font-medium">Add knowledge and memory</span> — attach documents and long-term context that personas can draw on</li>
                <li><span className="ink font-medium">Issue a guest token</span> — create a scoped key for each agent or app, with only the permissions they need</li>
                <li><span className="ink font-medium">Monitor and adjust</span> — watch the activity log, approve new devices, revoke access at any time</li>
              </ol>
            </Block>

            <Block title="Who is it for">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="ui-card p-3">
                  <p className="font-semibold mb-1 ink">AI developers</p>
                  <p className="text-xs ink-3">Building agents that need real user data — get a unified proxy to 45+ services with one token</p>
                </div>
                <div className="ui-card p-3">
                  <p className="font-semibold mb-1 ink">Power users</p>
                  <p className="text-xs ink-3">Automating your digital life — centralize credentials, build personas, and audit everything</p>
                </div>
                <div className="ui-card p-3">
                  <p className="font-semibold mb-1 ink">Teams</p>
                  <p className="text-xs ink-3">Sharing controlled AI access across a workspace with role-based permissions and audit trails</p>
                </div>
              </div>
            </Block>
          </Section>

          {/* ── Quick Start ── */}
          <Section id="quickstart" title="Quick Start">
            <p>Get up and running in a few minutes. You don't need to configure everything at once — start with one service and one token.</p>

            <Block title="Step 1 — Connect a service">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Go to <span className="ink font-medium">Services</span> in the sidebar</li>
                <li>Find the service you want (e.g. Google, GitHub)</li>
                <li>Click <span className="ink font-medium">Connect</span> — you'll be taken through OAuth</li>
                <li>After approving, you'll see the service listed as <span className="text-green-400">Connected</span></li>
              </ol>
            </Block>

            <Block title="Step 2 — Create a persona">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Go to <span className="ink font-medium">Personas</span> in the AI Brain section</li>
                <li>Click <span className="ink font-medium">Create New Persona</span></li>
                <li>Give it a name and describe its role and personality in the soul content field</li>
                <li>Click <span className="ink font-medium">Set as Active</span> to make it the default for API calls</li>
              </ol>
            </Block>

            <Block title="Step 3 — Issue a guest token">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Go to <span className="ink font-medium">Access Tokens</span></li>
                <li>Click <span className="ink font-medium">Create Guest Token</span></li>
                <li>Choose a label (e.g. "My Claude Agent") and select the scopes you want to allow</li>
                <li>Copy the token — it won't be shown again</li>
              </ol>
            </Block>

            <Block title="Step 4 — Make your first API call">
              <p className="mb-3">Use your guest token to call any connected service through the MyApi proxy:</p>
              <CodeSnip>{`curl -X POST https://your-myapi-host/api/v1/services/google/proxy \\
  -H "Authorization: Bearer YOUR_GUEST_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "path": "/gmail/v1/users/me/messages",
    "method": "GET"
  }'`}</CodeSnip>
            </Block>

            <Callout type="tip">
              Building an AI agent? See the <a href="#agent-integration" className="underline font-medium">AI Agent Integration</a> section for the full developer guide, including the handshake approval flow and capabilities discovery.
            </Callout>
          </Section>

          {/* ── Identity ── */}
          <Section id="identity" title="Identity & Profile">
            <p>
              Your identity profile is the foundation of every interaction MyApi enables. It's a structured record of
              who you are — your name, role, timezone, interests, and professional context. This information is
              assembled into a <span className="ink font-medium">USER.md</span> document that gets injected
              into AI context automatically, so agents always have accurate background about you.
            </p>

            <Block title="What you can store">
              <ul className="list-disc pl-5 space-y-1">
                <li>Full name, display name, email</li>
                <li>Location and timezone (used for scheduling-aware responses)</li>
                <li>Occupation, current role, and professional focus</li>
                <li>GitHub profile URL and personal website</li>
                <li>A free-form bio or "about me" section</li>
                <li>Avatar / profile photo</li>
              </ul>
            </Block>

            <Block title="How agents use your identity">
              <p>
                Every API request carries your assembled identity context. When an agent asks "what's my current project?" or "who am I?",
                the answer comes from this profile. Personas can also draw on identity data to generate contextually
                appropriate responses — a persona playing your "engineering self" will anchor its answers to your
                actual tech stack and experience level.
              </p>
            </Block>

            <Callout type="info">
              Your identity data never leaves your MyApi instance unless you explicitly issue a token that includes the <span className="font-medium">basic</span> or <span className="font-medium">professional</span> scope. Guest tokens without these scopes cannot access your profile.
            </Callout>
          </Section>

          {/* ── Memory ── */}
          <Section id="memory" title="Memory">
            <p>
              Memory is persistent, unstructured context — notes, observations, and facts that survive across sessions.
              You can add memories manually, or AI agents can write them on your behalf when they learn something
              worth keeping. Think of it as a running notebook that every persona can read from.
            </p>

            <Block title="Memory sources">
              <p className="mb-3">Every memory entry is tagged with where it came from:</p>
              <DocsTable
                headers={['Source', 'Color', 'Meaning']}
                rows={[
                  ['user', <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">user</span>, 'Added directly by you from the dashboard'],
                  ['chatgpt', <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-300 border border-green-500/30">chatgpt</span>, 'Written by a ChatGPT agent or GPT plugin'],
                  ['claude', <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">claude</span>, 'Written by a Claude agent'],
                  ['jarvis', <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30">jarvis</span>, 'Written by a Jarvis / local AI agent'],
                  ['gemini', <span className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">gemini</span>, 'Written by a Gemini agent'],
                  ['github copilot', <span className="px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-300 border border-gray-500/30">copilot</span>, 'Written by a GitHub Copilot extension'],
                  ['api', <span className="px-2 py-0.5 rounded-full text-xs ink-3" style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line)' }}>api</span>, 'Written programmatically via the API'],
                ]}
              />
            </Block>

            <Block title="How to use memory">
              <ul className="list-disc pl-5 space-y-1">
                <li>Create a memory from the <span className="ink font-medium">Memory</span> page — paste any text and save</li>
                <li>Browse entries by source or scroll through the feed</li>
                <li>Click any entry to edit it inline</li>
                <li>Delete entries that are no longer relevant</li>
                <li>Agents can write new memories via <code className="mono px-1 rounded text-xs">POST /api/v1/memory</code></li>
              </ul>
            </Block>

            <Block title="Use cases">
              <ul className="list-disc pl-5 space-y-1">
                <li>Ongoing project context — "I'm building a Rust CLI tool for log parsing"</li>
                <li>Preferences agents have learned — "I prefer bullet points over paragraphs"</li>
                <li>Important facts to remember — "My team's standup is at 9am UTC on weekdays"</li>
                <li>Notes from past conversations you want agents to recall</li>
              </ul>
            </Block>
          </Section>

          {/* ── Personas ── */}
          <Section id="personas" title="Personas">
            <p>
              A persona is a distinct AI identity that you configure to behave a specific way. Each persona has its own
              soul content (a description of its role, personality, and communication style), its own set of attached
              knowledge documents, and its own skills. When an agent calls MyApi with an active persona set, all
              responses are shaped by that persona's configuration.
            </p>

            <Block title="Creating a persona">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Click <span className="ink font-medium">Create New Persona</span> on the Personas page</li>
                <li>Give it a name (e.g. "Senior Engineer") and a short description</li>
                <li>Write the <span className="ink font-medium">soul content</span> — describe the persona's role, tone, expertise, and how it should respond</li>
                <li>Toggle it <span className="text-green-400">Active</span> when you want it to be the default for API calls</li>
              </ol>
            </Block>

            <Block title="Attaching resources">
              <p>Personas become more powerful when you connect them to context:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><span className="ink font-medium">Knowledge documents</span> — attach SOPs, specs, or reference material so the persona can answer from your actual context</li>
                <li><span className="ink font-medium">Skills</span> — attach capability modules that define what the persona can do (see the Skills section)</li>
              </ul>
              <p className="mt-2 ink-3 text-xs">A persona only sees the documents and skills explicitly attached to it — other personas' context stays isolated.</p>
            </Block>

            <Block title="Setting the active persona">
              <p>
                Only one persona is "active" at a time. When an AI agent calls <code className="mono px-1 rounded text-xs">GET /api/v1/gateway/context</code>,
                the response includes the active persona's soul content, attached knowledge, and assembled user context.
                You can switch the active persona from the persona detail view.
              </p>
            </Block>

            <Block title="Use cases">
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { name: '"Senior Engineer"', desc: 'Deep technical context, code-first communication style, attached architecture docs' },
                  { name: '"Support Agent"', desc: 'Friendly tone, product knowledge base attached, empathetic communication style' },
                  { name: '"Personal Assistant"', desc: 'Broad context, calendar access, preference-aware, casual tone' },
                ].map(p => (
                  <div key={p.name} className="ui-card p-3">
                    <p className="font-semibold text-xs mb-1 ink">{p.name}</p>
                    <p className="text-xs ink-3">{p.desc}</p>
                  </div>
                ))}
              </div>
            </Block>
          </Section>

          {/* ── Knowledge Base ── */}
          <Section id="knowledge" title="Knowledge Base">
            <p>
              The knowledge base is where you store documents that ground your AI interactions in real, specific
              context. Instead of explaining your tech stack or product from scratch every time, you write it
              down once and attach it to the personas that need it.
            </p>

            <Block title="What goes here">
              <ul className="list-disc pl-5 space-y-1">
                <li>Standard operating procedures (SOPs) and runbooks</li>
                <li>Product specifications and technical architecture docs</li>
                <li>Customer FAQ and support knowledge</li>
                <li>Project context, goals, and constraints</li>
                <li>Reference material agents should be able to cite</li>
              </ul>
            </Block>

            <Block title="Supported formats">
              <ul className="list-disc pl-5 space-y-1">
                <li>Type or paste text directly in the dashboard editor</li>
                <li>Upload <span className="ink font-medium">.txt</span>, <span className="ink font-medium">.md</span>, or <span className="ink font-medium">.pdf</span> files</li>
                <li>Documents are stored and searchable immediately after creation</li>
              </ul>
            </Block>

            <Block title="Attaching to personas">
              <p>
                Documents don't automatically become available to all personas. You explicitly attach each document
                to the persona(s) that should have access — this keeps context clean and prevents one agent
                from leaking another persona's internal knowledge.
              </p>
            </Block>

            <Block title="Use cases">
              <ul className="list-disc pl-5 space-y-1">
                <li>Compliance and HR policies attached to a "Policy Assistant" persona</li>
                <li>Product specs and roadmap attached to a "Product Manager" persona</li>
                <li>Your team's on-call runbook attached to an "SRE" persona</li>
                <li>Personal notes and goals attached to a "Life OS" persona</li>
              </ul>
            </Block>
          </Section>

          {/* ── Skills ── */}
          <Section id="skills" title="Skills & Marketplace">
            <p>
              Skills are capability modules that extend what a persona can do. Each skill has a name, a description,
              and optionally a script and configuration. You can build your own, install them from the marketplace,
              and attach them to any persona.
            </p>

            <Block title="What skills are">
              <p>
                Think of a skill as a "how to" module: it tells a persona what it's capable of and how to do it.
                A "Deploy to Production" skill might contain the steps, context, and safety checks an agent needs
                to safely trigger a deployment. A "Report Builder" skill might contain templates and data sources
                for generating weekly summaries.
              </p>
            </Block>

            <Block title="Creating a skill">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Go to <span className="ink font-medium">Skills</span> in the sidebar</li>
                <li>Click <span className="ink font-medium">Create Skill</span> and give it a name, description, and category</li>
                <li>Optionally paste a script or configuration JSON</li>
                <li>Use <span className="ink font-medium">Scan Repository</span> to auto-discover metadata from a GitHub URL</li>
                <li>Attach the skill to one or more personas</li>
              </ol>
            </Block>

            <Block title="Marketplace">
              <p>
                The marketplace is a community catalog of published skills, personas, and tokens. You can:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Browse and search listings by type and category</li>
                <li>Install a listing with one click — it appears in your library immediately</li>
                <li>Rate and review listings you've used</li>
                <li>Publish your own skills publicly (see <span className="ink font-medium">My Listings</span> in the sidebar)</li>
              </ul>
            </Block>

            <Block title="Publishing your skills">
              <p>
                To publish a skill to the marketplace, go to <span className="ink font-medium">My Listings</span> and
                create a listing. You can set a description, category, license (MIT, Apache 2.0, GPL, etc.), tags,
                and optionally a price. Published skills can be updated or unpublished at any time.
              </p>
            </Block>

            <Callout type="info">
              The number of skills you can attach to a single persona depends on your plan. Check your plan limits under Settings.
            </Callout>
          </Section>

          {/* ── Services ── */}
          <Section id="services" title="Connected Services">
            <p>
              Services are the external platforms MyApi connects to on your behalf. Once connected, any agent
              with the right scope can call those services through the MyApi proxy — without ever seeing
              your raw credentials.
            </p>

            <Block title="OAuth vs. API key">
              <DocsTable
                headers={['Type', 'How it works', 'Examples']}
                rows={[
                  ['OAuth', 'You authorize MyApi via the provider\'s consent flow. Tokens are stored encrypted and auto-refreshed.', 'Google, GitHub, Slack, Notion, LinkedIn'],
                  ['API Key / Vault', 'You paste the credential once into the Token Vault. MyApi retrieves it securely for each proxy request.', 'Stripe, fal.ai, custom services'],
                ]}
              />
            </Block>

            <Block title="45+ supported services">
              <DocsTable
                headers={['Category', 'Services']}
                rows={[
                  ['Productivity', 'Google (Gmail, Drive, Calendar, Sheets), Notion, Microsoft 365, Dropbox, Asana, Trello, ClickUp'],
                  ['Developer', 'GitHub, GitLab, Travis CI'],
                  ['Communication', 'Slack, Discord, WhatsApp, Twitch, Mastodon, Bluesky'],
                  ['Social', 'Twitter/X, Facebook, Instagram, LinkedIn, TikTok, Reddit, YouTube'],
                  ['Business', 'HubSpot, Salesforce, Jira, Zendesk, Zoom'],
                  ['Finance', 'Stripe (API key via Vault)'],
                  ['AI / Media', 'fal.ai (image generation)'],
                ]}
              />
            </Block>

            <Block title="Connecting a service">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Go to <span className="ink font-medium">Services</span> in the sidebar</li>
                <li>Search or filter to find the service you want</li>
                <li>Click <span className="ink font-medium">Connect</span> — you'll be redirected to the provider's OAuth consent page</li>
                <li>Approve the requested permissions</li>
                <li>You'll be returned to MyApi with the service showing as <span className="text-green-400">Connected</span></li>
              </ol>
            </Block>

            <Block title="What agents can do with it">
              <p>
                After connection, any agent with a <span className="ink font-medium">services:write</span> scoped
                token can call the service through the proxy endpoint. MyApi handles authentication transparently —
                the agent sends a request describing what it wants, and MyApi forwards it with your OAuth token
                attached. No credentials are ever exposed to the agent.
              </p>
            </Block>

            <Block title="Revoking access">
              <p>
                Click <span className="ink font-medium">Disconnect</span> on any service to immediately revoke
                MyApi's access. The OAuth token is deleted and all future proxy calls to that service will fail.
                This does not affect the service itself — you remain logged in to Google, GitHub, etc.
              </p>
            </Block>
          </Section>

          {/* ── AFP ── */}
          <Section id="afp" title="AFP Connector">
            <p>
              AFP (API File Protocol) is a persistent connection between MyApi and your local machine. It's a
              lightweight daemon that runs in the background, maintains a WebSocket connection to your MyApi
              instance, and allows approved agents to interact with your local filesystem and run commands.
            </p>

            <Block title="What AFP enables">
              <ul className="list-disc pl-5 space-y-1">
                <li>Agents can list, read, and write files on your local machine</li>
                <li>Persistent connection — no re-authentication required</li>
                <li>Commands and file operations are logged in the Activity Log</li>
                <li>Scope-limited: you control which directories are accessible</li>
              </ul>
            </Block>

            <Block title="Installing AFP">
              <p>
                Go to <span className="ink font-medium">Connectors</span> in the sidebar and download the AFP
                desktop app or daemon binary for your platform (Windows, macOS, or Linux). The installer guides
                you through connecting it to your MyApi instance via OAuth — no token pasting required.
              </p>
            </Block>

            <Block title="Security">
              <ul className="list-disc pl-5 space-y-1">
                <li>A new AFP device must be approved before it can be used — you'll see it appear in Device Management</li>
                <li>All file access is scoped to the paths you configure in the daemon</li>
                <li>Every file operation and command execution is written to your audit log</li>
              </ul>
            </Block>

            <Callout type="warning">
              Shell command execution via AFP requires a Pro or Enterprise plan. File system access is available on all plans.
            </Callout>
          </Section>

          {/* ── Access Tokens ── */}
          <Section id="access-tokens" title="Access Tokens & Scopes">
            <p>
              Tokens are how you grant access to MyApi. Your master token has full access — everything else
              is a scoped guest token with exactly the permissions you specify.
            </p>

            <Block title="Master token">
              <p>
                Generated automatically when you first log in, your master token gives full access to all
                MyApi endpoints. It's shown blurred in the dashboard — click reveal to copy it. Treat it
                like a password: don't paste it into third-party tools directly. Instead, create a guest
                token with the minimum scopes needed.
              </p>
              <p className="mt-2 ink-3 text-xs">You can regenerate your master token at any time. Existing guest tokens are not affected.</p>
            </Block>

            <Block title="Guest tokens">
              <p>
                Guest tokens are scoped, expirable tokens you issue for specific agents or applications.
                When creating one you choose which permissions it carries, how long it lasts, and optionally
                which personas it can access.
              </p>
            </Block>

            <Block title="Available scopes">
              <DocsTable
                headers={['Scope', 'What it grants']}
                rows={[
                  [<code className="font-mono text-xs text-blue-300">basic</code>, 'Name, role, company — public identity information'],
                  [<code className="font-mono text-xs text-blue-300">professional</code>, 'Skills, education, experience'],
                  [<code className="font-mono text-xs text-blue-300">availability</code>, 'Calendar events and timezone information'],
                  [<code className="font-mono text-xs text-blue-300">personas</code>, 'Access to public persona profiles'],
                  [<code className="font-mono text-xs text-blue-300">knowledge</code>, 'Knowledge base documents and context read access'],
                  [<code className="font-mono text-xs text-blue-300">chat</code>, 'Conversation history and messaging'],
                  [<code className="font-mono text-xs text-blue-300">skills:read</code>, 'Read-only access to skills'],
                  [<code className="font-mono text-xs text-blue-300">skills:write</code>, 'Create and manage skills'],
                  [<code className="font-mono text-xs text-blue-300">services:read</code>, 'Read OAuth service connection status'],
                  [<code className="font-mono text-xs text-blue-300">services:write</code>, 'Trigger service proxy calls on connected services'],
                ]}
              />
            </Block>

            <Block title="Token expiration">
              <p>
                Set an expiration when creating a guest token (default: 168 hours / 1 week). Once expired,
                the token is automatically rejected. You can also revoke any token manually from the Access
                Tokens page at any time — revocation is immediate.
              </p>
            </Block>

            <Callout type="tip">
              Best practice: create one token per agent and grant only the scopes that agent actually needs. If a token is compromised, you can revoke just that one — everything else keeps working.
            </Callout>
          </Section>

          {/* ── Vault ── */}
          <Section id="vault" title="Token Vault">
            <p>
              The Token Vault is encrypted storage for third-party API keys — OpenAI, Stripe, AWS, or anything
              else that doesn't use OAuth. Store a key once and every agent or persona that needs it can use
              it through MyApi without ever seeing the raw value.
            </p>

            <Block title="What it stores">
              <ul className="list-disc pl-5 space-y-1">
                <li>API keys from any provider (OpenAI, Anthropic, Stripe, AWS, Twilio, SendGrid, etc.)</li>
                <li>Custom service credentials that don't have an OAuth flow</li>
                <li>Any secret you want accessible to agents but not exposed directly</li>
              </ul>
            </Block>

            <Block title="AES-256 encryption">
              <p>
                Every token in the Vault is encrypted with AES-256-GCM before being written to the database.
                The encryption key is separate from your OAuth token key — even if someone accessed your database
                file directly, vault tokens would not be readable. Tokens are never written to logs or included
                in proxied response bodies.
              </p>
            </Block>

            <Block title="API URL discovery">
              <p>
                When adding a token, you can paste the provider's website URL and click <span className="ink font-medium">Discover API</span>.
                MyApi will analyze the site and attempt to identify the API base URL and authentication scheme,
                saving you from looking it up manually.
              </p>
            </Block>

            <Block title="Rotation made easy">
              <p>
                Update a vault token once and all agents that use it get the new credential immediately — no
                hunting down which scripts have the old key hardcoded. This makes key rotation a one-step operation.
              </p>
            </Block>
          </Section>

          {/* ── Devices ── */}
          <Section id="devices" title="Device Management">
            <p>
              Any browser session, CLI client, or AFP daemon that connects to your MyApi is tracked as a device.
              New devices aren't granted access automatically — they go through an approval flow that you control.
            </p>

            <Block title="What is a device">
              <ul className="list-disc pl-5 space-y-1">
                <li>A browser tab or session (when you log into the dashboard)</li>
                <li>A CLI tool or script using a Bearer token</li>
                <li>An AFP daemon running on your local machine</li>
                <li>Any external app or agent making API calls</li>
              </ul>
            </Block>

            <Block title="Approval flow">
              <ol className="list-decimal pl-5 space-y-1">
                <li>A new device makes its first request to MyApi</li>
                <li>MyApi fingerprints the device (browser, IP, User-Agent) and creates a pending approval</li>
                <li>You receive a notification in the dashboard (and optionally by email)</li>
                <li>You approve or reject from the <span className="ink font-medium">Device Management</span> page</li>
                <li>Approved devices proceed; rejected devices are blocked</li>
              </ol>
            </Block>

            <Block title="Approved vs. pending">
              <p>
                The Device Management page has two tabs: <span className="ink font-medium">Approved</span> (devices you've already cleared)
                and <span className="ink font-medium">Pending</span> (requests waiting for your decision).
                You can rename approved devices to keep track of them, and revoke access at any time.
              </p>
            </Block>

            <Block title="Revoking a device">
              <p>
                Click <span className="ink font-medium">Revoke</span> on any approved device to immediately
                block all future requests from it. Any in-flight requests using that device's token will also
                be rejected. The device can request approval again if it tries to reconnect.
              </p>
            </Block>
          </Section>

          {/* ── Team Workspaces ── */}
          <Section id="team" title="Team Workspaces">
            <p>
              Workspaces let you share controlled access to MyApi across a team. Each workspace is a fully isolated
              environment with its own personas, services, tokens, and settings — members in one workspace cannot
              see another workspace's data.
            </p>

            <Block title="Workspaces">
              <p>
                You can create multiple workspaces (e.g. "Personal", "Work", "Client Projects") and switch between
                them from the workspace switcher in the top navigation. Everything you configure — services,
                personas, knowledge, tokens — belongs to the workspace that was active when you created it.
              </p>
            </Block>

            <Block title="Roles">
              <DocsTable
                headers={['Role', 'What they can do']}
                rows={[
                  ['Owner', 'Full control — manage members, billing, and all workspace settings. Cannot be removed.'],
                  ['Admin', 'Manage members and settings. Can create/delete personas, services, tokens.'],
                  ['Member', 'Create and use personas, knowledge, and skills. Cannot manage members or billing.'],
                  ['Viewer', 'Read-only access to workspace resources. Cannot create or modify anything.'],
                ]}
              />
            </Block>

            <Block title="Inviting members">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Go to <span className="ink font-medium">Team Settings</span> in the sidebar</li>
                <li>Click <span className="ink font-medium">Invite Member</span></li>
                <li>Enter their email and select a role</li>
                <li>They'll receive an invitation email and can join from the link</li>
              </ol>
            </Block>

            <Callout type="info">
              Multi-workspace support and team collaboration features are available on the Enterprise plan.
            </Callout>
          </Section>

          {/* ── Activity Log ── */}
          <Section id="activity" title="Activity Log & Audit">
            <p>
              Every API action taken through MyApi is logged in the Activity Log — what happened, when, by which
              token, on which resource, and whether it succeeded. This is your audit trail.
            </p>

            <Block title="What gets logged">
              <ul className="list-disc pl-5 space-y-1">
                <li>Every token used for a request (master or guest)</li>
                <li>Service proxy calls — which service, which endpoint, result</li>
                <li>Persona invocations and context assembly calls</li>
                <li>Device approval and revocation events</li>
                <li>Authentication events — login, logout, 2FA setup</li>
                <li>Token creation, rotation, and revocation</li>
                <li>Knowledge base and persona modifications</li>
              </ul>
            </Block>

            <Block title="Filtering the log">
              <p>Use the filter controls to narrow down the log by:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><span className="ink font-medium">Action type</span> — token_used, service_proxy, device_approved, etc.</li>
                <li><span className="ink font-medium">Resource type</span> — token, service, persona, device, skill</li>
                <li><span className="ink font-medium">Result</span> — success, failure, or pending</li>
                <li><span className="ink font-medium">Date range</span> — last 24 hours, 7 days, 30 days, or all time</li>
                <li><span className="ink font-medium">Search</span> — free-text search across log entries</li>
              </ul>
            </Block>

            <Block title="Real-time updates">
              <p>
                The activity log updates in real time via WebSocket. New events appear at the top as they happen,
                with an auto-reconnect mechanism if the connection drops.
              </p>
            </Block>

            <Block title="Immutability">
              <p>
                The audit log is append-only at the database level. Neither you nor any agent can edit or delete
                log entries — this is a deliberate security property that ensures the log can be trusted as a
                faithful record of what happened.
              </p>
            </Block>

            <Block title="Export">
              <p>
                The activity log is included in any data export. Go to <span className="ink font-medium">Settings → Export Data</span> to
                download a full export package (JSON or ZIP) that includes an audit summary.
              </p>
            </Block>
          </Section>

          {/* ── ASC ── */}
          <Section id="asc" title="ASC — Agentic Secure Connection">
            <p>
              ASC (Agentic Secure Connection) is MyApi's cryptographic authentication method for AI agents.
              Instead of an agent holding a raw Bearer token that could be stolen from an environment variable
              or intercepted in transit, the agent holds an <span className="ink font-medium">Ed25519 private key</span> and
              signs every request. MyApi verifies the signature — no raw secret ever crosses the wire.
            </p>

            <Block title="Why ASC matters">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="ink-3 font-medium mb-2 text-xs uppercase tracking-wide">Standard Bearer token</p>
                  <ul className="list-disc pl-4 space-y-1 ink-3 text-xs">
                    <li>Token stored in environment variable — readable by anyone with server access</li>
                    <li>If intercepted, attacker can replay it indefinitely</li>
                    <li>No proof the request came from the intended agent</li>
                  </ul>
                </div>
                <div>
                  <p className="text-green-400 font-medium mb-2 text-xs uppercase tracking-wide">ASC (cryptographic signing)</p>
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    <li>Private key never leaves the agent — only the signature travels</li>
                    <li>Each signature includes a timestamp — replayed requests are rejected</li>
                    <li>Only the agent with the matching private key can produce valid signatures</li>
                  </ul>
                </div>
              </div>
            </Block>

            <Block title="How it works">
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  <span className="ink font-medium">Agent generates a keypair</span> — an Ed25519 public/private key pair is created locally on the agent's machine. The private key never leaves.
                </li>
                <li>
                  <span className="ink font-medium">Register the public key</span> — the agent calls <code className="mono px-1 rounded text-xs">POST /api/v1/agentic/asc/register</code> with its base64-encoded public key.
                </li>
                <li>
                  <span className="ink font-medium">Approve in the dashboard</span> — the key appears as a pending device in Device Management. You approve it once.
                </li>
                <li>
                  <span className="ink font-medium">Sign every request</span> — the agent signs a message of <code className="mono px-1 rounded text-xs">"timestamp:token_id"</code> and includes three headers:
                  <CodeSnip>{`X-Agent-PublicKey:  <base64 Ed25519 public key>
X-Agent-Signature: <base64 signature of "timestamp:token_id">
X-Agent-Timestamp: <unix timestamp in seconds>`}</CodeSnip>
                </li>
                <li>
                  <span className="ink font-medium">MyApi verifies</span> — the signature is checked against the registered public key. The timestamp must be within 60 seconds of server time to prevent replay attacks.
                </li>
              </ol>
            </Block>

            <Block title="Replay protection">
              <p>
                The timestamp in every signed message must be within <span className="ink font-medium">60 seconds</span> of the server's
                clock. If someone intercepts a valid request and tries to replay it 61 seconds later, MyApi
                rejects it outright. This means a stolen signature packet has a maximum useful lifetime of
                one minute — and only against the exact same endpoint with the same token.
              </p>
            </Block>

            <Block title="Registering a key">
              <CodeSnip>{`POST /api/v1/agentic/asc/register
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "public_key": "<base64-encoded Ed25519 public key>",
  "label": "My Production Agent"
}`}</CodeSnip>
              <p className="mt-3 ink-3 text-xs">
                Accepts both raw (32-byte) and SPKI DER (44-byte) Ed25519 public keys, base64-encoded.
                The registered key appears in Device Management where you approve it before the agent can use it.
              </p>
            </Block>

            <Callout type="tip">
              ASC is the recommended authentication method for any long-running or production agent. Bearer tokens are fine for development and testing; ASC is the right choice when security matters.
            </Callout>
          </Section>

          {/* ── Backup & Data Portability ── */}
          <Section id="backup" title="Backup & Data Portability">
            <p>
              MyApi makes it easy to take a complete snapshot of your agent ecosystem — every persona, knowledge document,
              memory entry, skill, and identity record — and restore it on any MyApi instance. Whether you're migrating
              to a new server, creating a safety backup before a major change, or sharing a configured setup with someone,
              it takes one click to export and one upload to restore.
            </p>

            <Block title="What's included in a backup">
              <DocsTable
                headers={['Section', 'What gets exported']}
                rows={[
                  ['Profile', 'Your identity data, USER.md, and SOUL.md'],
                  ['Personas', 'All persona definitions with soul content and metadata'],
                  ['Knowledge Base', 'Every document in your knowledge base (text + files)'],
                  ['Skills', 'All skill definitions, scripts, and configurations'],
                  ['Settings', 'Account preferences and configuration'],
                  ['Audit summary', 'High-level summary of account activity'],
                ]}
              />
              <p className="mt-3 ink-3 text-xs">Token secrets are never exported — credentials stay protected. Service OAuth tokens are excluded by design.</p>
            </Block>

            <Block title="Export formats">
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <span className="ink font-medium">JSON (v2)</span> — a single structured file, easy to read or process programmatically. Useful for inspecting your data or building integrations.
                </li>
                <li>
                  <span className="ink font-medium">ZIP (v3 portable package)</span> — a structured archive with separate files per section, a <code className="mono px-1 rounded text-xs">manifest.json</code>, and a <code className="mono px-1 rounded text-xs">checksums.sha256</code> for integrity verification. This is the format used for import.
                </li>
              </ul>
            </Block>

            <Block title="How to export">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Go to <span className="ink font-medium">Settings → Export Data</span></li>
                <li>Choose your format (JSON or ZIP)</li>
                <li>Click <span className="ink font-medium">Download</span> — the file is generated and downloaded immediately</li>
              </ol>
              <p className="mt-2 ink-3 text-xs">Or via the API: <code className="mono px-1 rounded text-xs">GET /api/v1/export?format=zip&mode=portable</code></p>
            </Block>

            <Block title="How to import">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Go to <span className="ink font-medium">Settings → Import Data</span></li>
                <li>Upload a ZIP export file (v3 format)</li>
                <li>MyApi validates the archive and shows you what will be imported</li>
                <li>Confirm — personas, knowledge docs, and skills are restored</li>
              </ol>
            </Block>

            <Callout type="info">
              Import is account-scoped. A ZIP exported from one account can only be imported back into the same account — this prevents accidental or malicious data injection across accounts.
            </Callout>

            <Callout type="tip">
              Back up before making big changes to your persona setup or knowledge base. It takes seconds and gives you a clean rollback point.
            </Callout>
          </Section>

          {/* ── Agent Integration ── */}
          <Section id="agent-integration" title="AI Agent Integration">
            <p>
              MyApi is designed from the ground up for AI agents. Whether you're building a Claude tool use flow,
              a ChatGPT custom action, or a custom agent, the same API works for all of them.
            </p>

            <Block title="How agents authenticate">
              <p className="mb-3">All agent requests use a Bearer token in the Authorization header:</p>
              <CodeSnip>{`Authorization: Bearer myapi_8e04fdb632ee790fe5e95263bf4049a1c0865af0...`}</CodeSnip>
              <p className="mt-3">Create a guest token from the Access Tokens page and give it the scopes your agent needs. Share only that token — not your master token.</p>
            </Block>

            <Block title="Service proxy">
              <p className="mb-3">
                Call any of your connected services through the proxy endpoint. MyApi attaches your OAuth token
                transparently — the agent never handles credentials:
              </p>
              <CodeSnip>{`POST /api/v1/services/{service}/proxy
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "path": "/gmail/v1/users/me/messages",
  "method": "GET",
  "query": { "maxResults": 10 }
}`}</CodeSnip>
              <p className="mt-3 ink-3 text-xs">Replace <code className="mono px-1 rounded">{`{service}`}</code> with any connected service ID: <code className="mono px-1 rounded">google</code>, <code className="mono px-1 rounded">github</code>, <code className="mono px-1 rounded">slack</code>, etc.</p>
            </Block>

            <Block title="First access — the approval flow">
              <p className="mb-3">
                The first time an agent makes a request, MyApi fingerprints the device and puts it in a pending
                approval state. The agent receives a <span className="ink font-medium">403</span> with guidance:
              </p>
              <CodeSnip>{`{
  "error": "Access pending approval",
  "status": "pending",
  "message": "Approval notification sent to account owner.",
  "what_to_do": "Wait for user approval (check back in 5 min)"
}`}</CodeSnip>
              <p className="mt-3">
                Once you approve the device from the Device Management page, the same request succeeds.
                Subsequent requests from the same device do not require re-approval.
              </p>
            </Block>

            <Block title="Capabilities discovery">
              <p className="mb-3">Agents can auto-discover what your MyApi instance supports:</p>
              <CodeSnip>{`# Plugin manifest (OpenAI-compatible)
GET /.well-known/ai-plugin.json

# OpenAPI spec (all endpoints)
GET /openapi.json

# Runtime capabilities (connected services, active persona)
GET /api/v1/capabilities
Authorization: Bearer YOUR_TOKEN`}</CodeSnip>
            </Block>

            <Block title="Context endpoint">
              <p className="mb-3">
                Pull the assembled persona + memory + identity context in one call — useful for grounding an
                agent at the start of a conversation:
              </p>
              <CodeSnip>{`GET /api/v1/gateway/context
Authorization: Bearer YOUR_TOKEN`}</CodeSnip>
              <p className="mt-3 ink-3 text-xs">Returns the active persona's soul content, attached knowledge summary, user identity, and recent memory — assembled and ready to use as a system prompt.</p>
            </Block>

            <Callout type="tip">
              For the full API reference including every endpoint, request/response schema, and error codes, see the <a href="/dashboard/api-docs" className="underline font-medium">API Docs</a> page in the sidebar.
            </Callout>
          </Section>

        </main>
      </div>
    </div>
  );
}

export default PlatformDocs;
