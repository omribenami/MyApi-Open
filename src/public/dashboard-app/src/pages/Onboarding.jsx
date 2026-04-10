import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import BrandLogo from '../components/BrandLogo';

function Onboarding() {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Welcome, 2: Quick Setup, 3: Complete
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      window.location.href = '/dashboard/';
    }
  }, [isAuthenticated]);

  const handleSkipOnboarding = () => {
    setLoading(true);
    window.location.href = '/dashboard/';
  };

  const handleGoToDashboard = () => {
    setLoading(true);
    window.location.href = '/dashboard/';
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-8 sm:py-10 lg:px-12">

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="grid gap-8 lg:min-h-[80vh] lg:grid-cols-12 lg:items-center lg:gap-12">
            <section className="lg:col-span-5">
              <BrandLogo size="lg" className="mb-8" />
              <h1 className="text-4xl font-semibold leading-tight mb-6">Welcome to MyApi!</h1>
              <p className="text-xl text-slate-300 mb-8 leading-relaxed">
                Your privacy-first AI gateway is ready. Let's get you set up.
              </p>
              <ul className="space-y-4 mb-10">
                {[
                  'Connect 45+ services securely via OAuth',
                  'Manage all your tokens in one encrypted vault',
                  'Create personas and knowledge bases for AI agents',
                  'Issue scoped tokens — your real credentials never leave',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="flex-shrink-0 mt-1 text-emerald-400">✓</span>
                    <span className="text-slate-200">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-slate-400">
                Takes about 2 minutes. You can always explore at your own pace.
              </p>
            </section>

            <section className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-700/80 bg-slate-900/85 p-8 shadow-2xl shadow-black/40 space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600/20 border border-blue-500/30 mb-4">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                      <polyline points="13 2 13 9 20 9" />
                      <path d="M9 15h6" /><path d="M9 11h6" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-semibold mb-4">Your account is ready!</h2>
                  <p className="text-slate-400 mb-8">
                    Let's connect your first service and explore what MyApi can do for you.
                  </p>
                </div>
                <div className="space-y-3 pt-4">
                  <button
                    onClick={() => setStep(2)}
                    className="w-full min-h-[48px] rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition-all hover:bg-blue-500 active:scale-95"
                  >
                    Let's Connect Your First Service
                  </button>
                  <button
                    onClick={handleSkipOnboarding}
                    disabled={loading}
                    className="w-full min-h-[48px] rounded-xl border border-slate-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:border-slate-500 hover:bg-slate-800/50 disabled:opacity-50"
                  >
                    Skip and Go to Dashboard
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Step 2: Connect a Service */}
        {step === 2 && (
          <div className="grid gap-8 lg:min-h-[80vh] lg:grid-cols-12 lg:items-center lg:gap-12">
            <section className="lg:col-span-5">
              <h1 className="text-4xl font-semibold leading-tight mb-6">Connect Your First Service</h1>
              <p className="text-lg text-slate-300 mb-8">
                Head to the Services page to connect GitHub, Google, Slack, or any of 45+ integrations.
              </p>
              <div className="space-y-4">
                {[
                  { icon: '🐙', title: 'GitHub', desc: 'Repos, issues, pull requests — all accessible to your agents.' },
                  { icon: '💬', title: 'Slack', desc: 'Send messages, read channels, trigger workflows.' },
                  { icon: '🔵', title: 'Google Workspace', desc: 'Gmail, Calendar, Drive, Docs and more.' },
                ].map((s) => (
                  <div key={s.title} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                    <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                      <span>{s.icon}</span> {s.title}
                    </h3>
                    <p className="text-sm text-slate-400">{s.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-700/80 bg-slate-900/85 p-8 shadow-2xl shadow-black/40">
                <h2 className="text-2xl font-semibold mb-2 text-center">Ready to connect?</h2>
                <p className="text-slate-400 text-center mb-8">
                  You can connect services now, or do it later from the Services page in the sidebar.
                </p>
                <div className="space-y-3">
                  <a
                    href="/dashboard/services"
                    className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition-all hover:bg-blue-500"
                  >
                    Go to Services
                  </a>
                  <button
                    onClick={() => setStep(3)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:border-slate-500 hover:bg-slate-800/50"
                  >
                    Skip for Now
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Step 3: All Done */}
        {step === 3 && (
          <div className="grid gap-8 lg:min-h-[80vh] lg:grid-cols-12 lg:items-center lg:gap-12">
            <section className="lg:col-span-5">
              <h1 className="text-4xl font-semibold leading-tight mb-6">You're all set!</h1>
              <p className="text-lg text-slate-300 mb-8">
                Explore the dashboard to manage tokens, create personas, and build your AI stack.
              </p>
              <div className="space-y-4">
                {[
                  { icon: '🔗', title: 'Service Connectors', desc: 'Manage all connected services' },
                  { icon: '🔐', title: 'Token Vault', desc: 'Securely store third-party API keys' },
                  { icon: '🤖', title: 'Personas', desc: 'Create AI identities with scoped access' },
                  { icon: '📚', title: 'Knowledge Base', desc: 'Upload docs that ground your agents' },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <span className="text-2xl flex-shrink-0">{item.icon}</span>
                    <div>
                      <h3 className="font-semibold text-white">{item.title}</h3>
                      <p className="text-sm text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-700/80 bg-slate-900/85 p-8 shadow-2xl shadow-black/40 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-600/20 border border-emerald-500/30 mb-6">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="text-3xl font-semibold mb-3">All Set!</h2>
                <p className="text-slate-400 mb-8 text-lg">
                  Start connecting services, managing tokens, and building AI workflows.
                </p>
                <button
                  onClick={handleGoToDashboard}
                  disabled={loading}
                  className="w-full min-h-[48px] rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition-all hover:bg-blue-500 disabled:opacity-50 active:scale-95"
                >
                  {loading ? 'Loading...' : 'Go to Dashboard'}
                </button>
              </div>
            </section>
          </div>
        )}

      </div>
    </div>
  );
}

export default Onboarding;
