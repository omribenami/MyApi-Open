
const CONNECTORS = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    provider: 'OpenAI',
    description: 'Ask ChatGPT questions about your MyApi data. Click Connect, sign in, and start chatting — no setup required.',
    href: 'https://chatgpt.com/g/g-69a90f35a0888191ae6346c9b129b9a8-myapi-assistant',
    logo: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387 2.019-1.168a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.411-.663zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
      </svg>
    ),
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    borderColor: 'border-green-400/20',
    status: 'available',
  },
  {
    id: 'claude',
    href: null,
    name: 'Claude',
    provider: 'Anthropic',
    description: 'Connect Claude AI agents to your MyApi account. Coming soon.',
    logo: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M17.304 3.541 12.001 17.51 6.697 3.541H3L9.999 21h4.003L21 3.541h-3.696z"/>
      </svg>
    ),
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/20',
    status: 'coming_soon',
  },
  {
    id: 'copilot',
    href: null,
    name: 'GitHub Copilot',
    provider: 'Microsoft',
    description: 'Expose your MyApi data to Copilot extensions. Coming soon.',
    logo: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/20',
    status: 'coming_soon',
  },
];

export default function Connectors() {

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">AI Connectors</h1>
        <p className="mt-1 text-slate-400 text-sm max-w-2xl">
          Connect external AI assistants to your MyApi account using OAuth. Users authorize once — no tokens to paste, no manual setup.
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONNECTORS.map(c => (
          <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 hover:border-slate-700 transition-colors">
            <div className="flex items-start justify-between">
              <div className={`p-2.5 rounded-xl ${c.bgColor} border ${c.borderColor}`}>
                <div className={c.color}>{c.logo}</div>
              </div>
              {c.status === 'available' ? (
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-400/10 text-green-400 border border-green-400/20">Available</span>
              ) : (
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-700/50 text-slate-500 border border-slate-700">Coming soon</span>
              )}
            </div>

            <div className="flex-1">
              <h3 className="font-semibold text-slate-100">{c.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{c.provider}</p>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">{c.description}</p>
            </div>

            {c.status === 'available' ? (
              <a
                href={c.href}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors text-center block"
              >
                Connect →
              </a>
            ) : (
              <div className="w-full py-2 px-4 rounded-lg bg-slate-800 text-slate-600 text-sm font-medium text-center border border-slate-700 cursor-default">
                Notify me when ready
              </div>
            )}
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <h2 className="font-semibold text-slate-200 mb-5">How connectors work</h2>
        <div className="grid gap-6 sm:grid-cols-3 mb-6">
          {[
            { n: '1', title: 'Click Connect', body: 'Hit the Connect button on any available AI connector. You\'ll be taken directly to the AI service.' },
            { n: '2', title: 'Sign in to the AI service', body: 'Authorize the connection when prompted. Your MyApi data is shared securely via OAuth — no tokens to copy or paste.' },
            { n: '3', title: 'Start asking questions', body: 'You\'re ready to go. The AI assistant can now read your MyApi data and answer questions in plain language.' },
          ].map(item => (
            <div key={item.n} className="flex gap-3">
              <span className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{item.n}</span>
              <div>
                <p className="font-medium text-slate-300 text-sm">{item.title}</p>
                <p className="text-slate-500 mt-1 text-sm leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-800 pt-5">
          <p className="text-xs font-medium text-slate-400 mb-3">Example questions to ask</p>
          <div className="flex flex-wrap gap-2">
            {[
              'What\'s my current persona?',
              'Show me my knowledge base',
              'Which services am I connected to?',
              'What access tokens do I have?',
              'Summarize my recent activity',
              'What workspaces am I part of?',
            ].map(q => (
              <span key={q} className="text-xs px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">"{q}"</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
