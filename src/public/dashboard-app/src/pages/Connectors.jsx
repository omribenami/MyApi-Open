import { useState, useEffect } from 'react';
import apiClient from '../utils/apiClient';

const BASE = window.location.origin;

const CONNECTORS = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    provider: 'OpenAI',
    description: 'Let ChatGPT Custom GPTs access your MyApi data via OAuth. Users authorize once — no tokens to paste.',
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

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="ml-2 px-2 py-0.5 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors flex-shrink-0"
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}

function CredentialRow({ label, value, secret }) {
  const [show, setShow] = useState(false);
  const display = secret ? (show ? value : '••••••••••••••••') : value;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-700/50 last:border-0 gap-3">
      <span className="text-xs text-slate-500 w-36 flex-shrink-0">{label}</span>
      <div className="flex items-center min-w-0 flex-1">
        <code className="text-xs text-blue-300 font-mono truncate">{display}</code>
        {secret && (
          <button onClick={() => setShow(v => !v)} className="ml-2 text-xs text-slate-500 hover:text-slate-300 flex-shrink-0">
            {show ? 'Hide' : 'Show'}
          </button>
        )}
        <CopyButton text={value} />
      </div>
    </div>
  );
}

function SetupStep({ n, title, body, active, onClick }) {
  return (
    <button onClick={onClick} className="w-full text-left">
      <div className={`border rounded-xl p-4 transition-all ${active ? 'border-blue-500/40 bg-blue-500/5' : 'border-slate-700/60 hover:border-slate-600'}`}>
        <div className="flex items-center gap-3">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${active ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}>{n}</span>
          <span className="text-sm font-medium text-slate-200">{title}</span>
        </div>
        {active && <p className="mt-3 ml-9 text-sm text-slate-400 leading-relaxed">{body}</p>}
      </div>
    </button>
  );
}

function ChatGPTDrawer({ credentials, onClose }) {
  const [step, setStep] = useState(0);

  const openApiUrl = `${BASE}/api/v1/oauth-server/openapi.yaml`;

  const steps = [
    {
      title: 'Go to ChatGPT → My GPTs → Create a GPT',
      body: 'Open chat.openai.com → click your avatar → "My GPTs" → "Create a GPT" → switch to the Configure tab.',
    },
    {
      title: 'Fill in name, description, and instructions',
      body: 'Name: "MyApi Assistant". Copy the system prompt from chatgpt-app/system-prompt.md in your MyApi repository. Add conversation starters: "What\'s my current persona?", "Show me my knowledge base", "Which services am I connected?"',
    },
    {
      title: 'Create new Action → set Authentication to OAuth',
      body: 'In Configure → "Create new action" → Authentication → OAuth. Fill in the credentials shown on the left. For Client Secret: check your server startup logs for the line "[OAuthServer] Client secret:" — or set CHATGPT_OAUTH_CLIENT_SECRET in your .env to lock it in.',
    },
    {
      title: 'Import the OpenAPI schema',
      body: `In the Schema field, click "Import from URL" and paste:\n${openApiUrl}\n\nOr download it and paste the YAML directly.`,
    },
    {
      title: 'Copy the Callback URL → add it to your .env',
      body: 'After saving the Action, ChatGPT shows a Callback URL like: https://chatgpt.com/aip/g-XXXX/oauth/callback\n\nAdd it to your server .env as:\nCHATGPT_OAUTH_REDIRECT_URIS=https://chatgpt.com/aip/g-XXXX/oauth/callback\n\nThen restart your server.',
    },
    {
      title: 'Save → Publish to GPT Store',
      body: 'Save the GPT. Set visibility to "Everyone" to list in the Store, or "Anyone with link" for a private URL. Add a profile picture and set the Privacy Policy URL to: https://www.myapiai.com/chatgpt-privacy',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-400/10 border border-green-400/20 flex items-center justify-center text-green-400 text-sm font-bold">G</div>
            <h2 className="text-lg font-semibold text-slate-100">Set up ChatGPT Connector</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800">✕</button>
        </div>

        <div className="p-6 grid sm:grid-cols-2 gap-6">
          {/* Left: Credentials */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">OAuth Credentials</h3>
              <p className="text-xs text-slate-500 mb-3">Paste these into the ChatGPT Action Authentication form.</p>
              {credentials ? (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <CredentialRow label="Client ID" value={credentials.client_id} />
                  <CredentialRow label="Authorization URL" value={credentials.authorization_url} />
                  <CredentialRow label="Token URL" value={credentials.token_url} />
                  <CredentialRow label="Scope" value={credentials.scope} />
                  <div className="pt-3 text-xs text-slate-500 leading-relaxed">
                    <strong className="text-slate-400">Client Secret:</strong> Check your server startup logs for <code className="text-blue-300">&#91;OAuthServer&#93; Client secret:</code> — or set <code className="text-blue-300">CHATGPT_OAUTH_CLIENT_SECRET</code> in <code className="text-blue-300">.env</code>.
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-sm text-slate-500">
                  Could not load credentials. Make sure the server is running.
                </div>
              )}
            </div>

            {/* OpenAPI schema */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">OpenAPI Schema</h3>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
                <p className="text-xs text-slate-500">Import this URL directly into the ChatGPT Actions schema editor.</p>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                  <code className="text-xs text-blue-300 font-mono truncate flex-1">{openApiUrl}</code>
                  <CopyButton text={openApiUrl} />
                </div>
                <a
                  href={openApiUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  View / download schema
                </a>
              </div>
            </div>

            {/* Privacy policy */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Privacy Policy URL</h3>
              <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-2.5">
                <code className="text-xs text-blue-300 font-mono truncate flex-1">{BASE}/chatgpt-privacy</code>
                <CopyButton text={`${BASE}/chatgpt-privacy`} />
              </div>
            </div>
          </div>

          {/* Right: Step-by-step */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Setup guide</h3>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <SetupStep
                  key={i}
                  n={i + 1}
                  title={s.title}
                  body={s.body}
                  active={step === i}
                  onClick={() => setStep(step === i ? -1 : i)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Connectors() {
  const [credentials, setCredentials] = useState(null);
  const [loadingCreds, setLoadingCreds] = useState(true);
  const [setupOpen, setSetupOpen] = useState(false);

  useEffect(() => {
    apiClient.get('/oauth-server/credentials')
      .then(res => setCredentials(res.data))
      .catch(() => setCredentials(null))
      .finally(() => setLoadingCreds(false));
  }, []);

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
              <button
                onClick={() => setSetupOpen(true)}
                disabled={loadingCreds}
                className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loadingCreds ? 'Loading…' : 'Set up connector →'}
              </button>
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
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { n: '1', title: 'You set up the GPT once', body: 'Create a Custom GPT in ChatGPT with your MyApi OAuth credentials and the provided API schema.' },
            { n: '2', title: 'Users authorize in one click', body: 'When someone uses the GPT, ChatGPT prompts them to sign in. They approve on the MyApi consent page — done forever.' },
            { n: '3', title: 'Revoke anytime', body: 'ChatGPT holds the token securely. Users can revoke access anytime from MyApi Dashboard → Token Vault.' },
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
      </div>

      {setupOpen && <ChatGPTDrawer credentials={credentials} onClose={() => setSetupOpen(false)} />}
    </div>
  );
}
