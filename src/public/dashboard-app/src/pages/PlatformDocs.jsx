import React from 'react';

const sections = [
  { id: 'intro', title: 'Introduction' },
  { id: 'services', title: 'Services (OAuth Connectors)' },
  { id: 'vault', title: 'Token Vault' },
  { id: 'access', title: 'Master Tokens' },
  { id: 'personas', title: 'Personas' },
  { id: 'skills', title: 'Skills' },
  { id: 'knowledge', title: 'Knowledge Base' },
  { id: 'marketplace', title: 'Marketplace' },
  { id: 'identity', title: 'Identity' },
  { id: 'users', title: 'User Management (Power User)' },
];

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <div className="text-slate-300 leading-relaxed space-y-4 text-sm sm:text-base">{children}</div>
    </section>
  );
}

function Block({ title, children }) {
  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 sm:p-5">
      <h3 className="text-white font-semibold mb-2">{title}</h3>
      <div className="text-slate-300 text-sm space-y-2">{children}</div>
    </div>
  );
}

function PlatformDocs() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Platform Documentation</h1>
        <p className="text-slate-400 mt-2">
          Full practical guide: what each category does, all key options, how to use it, and real use-case examples.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <aside className="lg:sticky lg:top-24 h-max bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-3">Guide Contents</p>
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
              MyApi is your control layer between AI agents and your external tools/data. Instead of giving raw credentials directly to AI,
              you centralize everything here and enforce permissions with scoped tokens, personas, and plan limits.
            </p>
            <Block title="Typical workflow">
              <ul className="list-disc pl-5 space-y-1">
                <li>Connect external services (OAuth)</li>
                <li>Add secure API credentials to Token Vault</li>
                <li>Create personas + attach skills/docs</li>
                <li>Issue guest access tokens with exact permissions</li>
                <li>Monitor usage and adjust plans/security</li>
              </ul>
            </Block>
          </Section>

          <Section id="services" title="Services (OAuth Connectors)">
            <Block title="Definition">
              <p>OAuth-based integrations (Google, GitHub, Slack, etc.) used by MyApi to act with user-approved access.</p>
            </Block>
            <Block title="Main options">
              <ul className="list-disc pl-5 space-y-1">
                <li>Connect/disconnect service</li>
                <li>View current connection status</li>
                <li>Use service execution routes through MyApi</li>
              </ul>
            </Block>
            <Block title="How to use">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Go to Services</li>
                <li>Click connect on provider</li>
                <li>Finish OAuth consent flow</li>
                <li>Verify status is connected</li>
              </ol>
            </Block>
            <Block title="Use case examples">
              <ul className="list-disc pl-5 space-y-1">
                <li>AI assistant fetches GitHub repo metadata</li>
                <li>Automate Slack notifications based on events</li>
              </ul>
            </Block>
          </Section>

          <Section id="vault" title="Token Vault">
            <Block title="Definition">
              <p>Encrypted storage for external API keys/secrets with optional API URL discovery metadata.</p>
            </Block>
            <Block title="Main options">
              <ul className="list-disc pl-5 space-y-1">
                <li>Add token (name, URL, API URL optional, token value)</li>
                <li>Scan website for likely API URL</li>
                <li>Reveal/copy/delete token</li>
              </ul>
            </Block>
            <Block title="How to use">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Add a provider token</li>
                <li>Use Scan or set API URL manually</li>
                <li>Save and test in your workflows</li>
              </ol>
            </Block>
            <Block title="Use case examples">
              <ul className="list-disc pl-5 space-y-1">
                <li>Store OpenAI/Anthropic/Stripe API keys once for all personas</li>
                <li>Keep tokens rotated without changing all client scripts</li>
              </ul>
            </Block>
          </Section>

          <Section id="access" title="Master Tokens">
            <Block title="Definition">
              <p>Scoped tokens for external clients/agents to use MyApi safely.</p>
            </Block>
            <Block title="Main options">
              <ul className="list-disc pl-5 space-y-1">
                <li>Create guest token with scope + expiration</li>
                <li>Reveal/copy/regenerate guest token</li>
                <li>Regenerate master token</li>
                <li>Revoke tokens</li>
              </ul>
            </Block>
            <Block title="Use case examples">
              <ul className="list-disc pl-5 space-y-1">
                <li>Issue read-only token to a third-party automation</li>
                <li>Issue persona-limited token to an AI agent</li>
              </ul>
            </Block>
          </Section>

          <Section id="personas" title="Personas">
            <Block title="Definition">
              <p>Role-specific AI identities (prompt behavior + attached context).</p>
            </Block>
            <Block title="Main options">
              <ul className="list-disc pl-5 space-y-1">
                <li>Create/update persona</li>
                <li>Activate persona</li>
                <li>Attach docs and skills</li>
              </ul>
            </Block>
            <Block title="Use case examples">
              <ul className="list-disc pl-5 space-y-1">
                <li>“Senior Engineer” persona for technical guidance</li>
                <li>“Support Agent” persona with customer KB only</li>
              </ul>
            </Block>
          </Section>

          <Section id="skills" title="Skills">
            <Block title="Definition">
              <p>Capability modules attached to personas to extend what they can do.</p>
            </Block>
            <Block title="Main options">
              <ul className="list-disc pl-5 space-y-1">
                <li>Create/edit/activate skills</li>
                <li>Attach documents to a skill</li>
                <li>Attach skills to personas (plan-limited)</li>
              </ul>
            </Block>
            <Block title="Use case examples">
              <ul className="list-disc pl-5 space-y-1">
                <li>Deployment skill for CI/CD workflows</li>
                <li>“Report builder” skill for recurring summaries</li>
              </ul>
            </Block>
          </Section>

          <Section id="knowledge" title="Knowledge Base">
            <Block title="Definition">
              <p>Document store used by the Brain context layer for retrieval and grounded responses.</p>
            </Block>
            <Block title="Main options">
              <ul className="list-disc pl-5 space-y-1">
                <li>Create text doc manually</li>
                <li>Upload txt/md/pdf files</li>
                <li>Preview/delete docs and check attachments</li>
              </ul>
            </Block>
            <Block title="Use case examples">
              <ul className="list-disc pl-5 space-y-1">
                <li>Company SOP docs for AI compliance answers</li>
                <li>Product specs used by a product-manager persona</li>
              </ul>
            </Block>
          </Section>

          <Section id="marketplace" title="Marketplace">
            <Block title="Definition">
              <p>Catalog of reusable skills/personas/listings to install or publish.</p>
            </Block>
            <Block title="Main options">
              <ul className="list-disc pl-5 space-y-1">
                <li>Browse listings</li>
                <li>View your listings</li>
                <li>Publish/update/remove listings</li>
              </ul>
            </Block>
          </Section>

          <Section id="identity" title="Identity">
            <Block title="Definition">
              <p>Owner profile context passed into interactions and persona behavior.</p>
            </Block>
            <Block title="Main options">
              <ul className="list-disc pl-5 space-y-1">
                <li>Edit user identity metadata</li>
                <li>Tune base behavior and profile defaults</li>
              </ul>
            </Block>
          </Section>

          <Section id="users" title="User Management (Power User)">
            <Block title="Definition">
              <p>Admin-only area to control user plans and monetization state.</p>
            </Block>
            <Block title="Main options">
              <ul className="list-disc pl-5 space-y-1">
                <li>View users</li>
                <li>Change user plan (free/pro/enterprise)</li>
                <li>Plan changes propagate to enforcement limits</li>
              </ul>
            </Block>
          </Section>
        </main>
      </div>
    </div>
  );
}

export default PlatformDocs;
