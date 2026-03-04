import React from 'react';

const sections = [
  { id: 'intro', title: 'Introduction' },
  { id: 'services', title: 'Services' },
  { id: 'vault', title: 'Token Vault' },
  { id: 'access', title: 'Access Tokens' },
  { id: 'personas', title: 'Personas' },
  { id: 'skills', title: 'Skills' },
  { id: 'knowledge', title: 'Knowledge Base' },
  { id: 'marketplace', title: 'Marketplace' },
  { id: 'identity', title: 'Identity' },
  { id: 'users', title: 'User Management' },
];

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl font-bold text-white mb-3">{title}</h2>
      <div className="text-slate-300 leading-relaxed space-y-3 text-sm sm:text-base">{children}</div>
    </section>
  );
}

function PlatformDocs() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Platform Documentation</h1>
        <p className="text-slate-400 mt-2">Everything you need to use MyApi end-to-end.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="lg:sticky lg:top-24 h-max bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-3">Contents</p>
          <nav className="space-y-1">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block px-3 py-2 rounded-md text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        <main className="space-y-10 bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8">
          <Section id="intro" title="Introduction">
            <p>
              MyApi is a personal middleware hub that lets you connect services, store credentials safely, configure AI personas,
              and control access with scoped tokens. The dashboard is split into categories so each responsibility is isolated and easy to manage.
            </p>
          </Section>

          <Section id="services" title="Services">
            <p>
              Connect external providers (Google, GitHub, Slack, etc.) via OAuth. Once connected, MyApi can securely call those services
              through a unified layer so your AI integrations don’t need direct raw credentials in prompts.
            </p>
          </Section>

          <Section id="vault" title="Token Vault">
            <p>
              Store API keys and website/API metadata. Vault records are encrypted at rest and can include discovered API URL + auth scheme.
              Use this for static credentials like OpenAI, Stripe, or custom vendor tokens.
            </p>
          </Section>

          <Section id="access" title="Access Tokens">
            <p>
              Generate guest tokens with scoped permissions. These tokens are what external agents/apps use to call MyApi safely.
              You can regenerate/revoke anytime and limit persona access per token.
            </p>
          </Section>

          <Section id="personas" title="Personas">
            <p>
              Build role-based AI behaviors (system prompts, tone, constraints). You can attach skills and knowledge documents per persona
              so each one has focused context.
            </p>
          </Section>

          <Section id="skills" title="Skills">
            <p>
              Reusable capability packages for personas. Skills define logic/instructions and can be attached/detached to personas without
              rewriting prompts each time.
            </p>
          </Section>

          <Section id="knowledge" title="Knowledge Base">
            <p>
              Upload markdown/txt/pdf files and use them as retrieval context. Documents can be global or persona-attached. Use this for SOPs,
              internal docs, and project memory.
            </p>
          </Section>

          <Section id="marketplace" title="Marketplace">
            <p>
              Discover/install shared skills and listings. This allows fast reuse while keeping your own token and persona controls local.
            </p>
          </Section>

          <Section id="identity" title="Identity">
            <p>
              Maintains USER/SOUL profile context used by your active persona and response style. Update this to tune system behavior globally.
            </p>
          </Section>

          <Section id="users" title="User Management">
            <p>
              Admin area to assign subscription plans per user (free/pro/enterprise). This is used by monetization and future feature-gating.
            </p>
          </Section>
        </main>
      </div>
    </div>
  );
}

export default PlatformDocs;
