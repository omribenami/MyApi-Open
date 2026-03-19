import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import BrandLogo from '../components/BrandLogo';

function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Welcome, 2: Quick Setup, 3: Marketplace Tour
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    // Only show onboarding for first-time users
    if (!isAuthenticated) {
      window.location.href = '/dashboard/';
      return;
    }
  }, [isAuthenticated]);

  const handleSkipOnboarding = async () => {
    setLoading(true);
    try {
      // Mark onboarding as complete and redirect to dashboard
      window.location.href = '/dashboard/';
    } finally {
      setLoading(false);
    }
  };

  const handleStartOnboarding = () => {
    setStep(2);
  };

  const handleGoToDashboard = async () => {
    setLoading(true);
    try {
      // Mark onboarding as complete and redirect to dashboard
      window.location.href = '/dashboard/';
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-8 sm:py-10 lg:px-12">
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="grid gap-8 lg:min-h-[80vh] lg:grid-cols-12 lg:items-center lg:gap-12">
            <section className="lg:col-span-5">
              <BrandLogo size="lg" className="mb-8" />
              <h1 className="text-4xl font-semibold leading-tight mb-6">
                Welcome to MyApi!
              </h1>
              <p className="text-xl text-slate-300 mb-8 leading-relaxed">
                Your professional command center for APIs, tokens, and AI workflows is ready.
              </p>

              <ul className="space-y-4 mb-10">
                {[
                  'Connect multiple services securely',
                  'Manage all your tokens in one place',
                  'Run automations and workflows',
                  'Scale from solo to team operations',
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="flex-shrink-0 mt-1 text-emerald-400">✓</span>
                    <span className="text-slate-200">{item}</span>
                  </li>
                ))}
              </ul>

              <p className="text-sm text-slate-400 mb-8">
                Let's get you started with a quick setup. You can always explore at your own pace.
              </p>
            </section>

            <section className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-700/80 bg-slate-900/85 p-8 shadow-2xl shadow-black/40 space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600/20 border border-blue-500/30 mb-4">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                      <polyline points="13 2 13 9 20 9" />
                      <path d="M9 15h6" />
                      <path d="M9 11h6" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-semibold mb-4">You're all set!</h2>
                  <p className="text-slate-400 mb-8">
                    Your account has been created successfully. Let's connect your first service and explore what MyApi can do for you.
                  </p>
                </div>

                <div className="space-y-3 pt-4">
                  <button
                    onClick={handleStartOnboarding}
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

        {/* Step 2: Quick Setup */}
        {step === 2 && (
          <div className="grid gap-8 lg:min-h-[80vh] lg:grid-cols-12 lg:items-center lg:gap-12">
            <section className="lg:col-span-5">
              <h1 className="text-4xl font-semibold leading-tight mb-6">
                Connect Your First Service
              </h1>
              <p className="text-lg text-slate-300 mb-8">
                Start by connecting a service. You can add more later.
              </p>

              <div className="space-y-6">
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
                  <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <span className="text-lg">🔐</span> GitHub
                  </h3>
                  <p className="text-sm text-slate-400">Connect your GitHub account to manage repositories and automations.</p>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
                  <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <span className="text-lg">💬</span> Slack
                  </h3>
                  <p className="text-sm text-slate-400">Connect Slack to send notifications and run commands from messages.</p>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
                  <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <span className="text-lg">🔵</span> Google Workspace
                  </h3>
                  <p className="text-sm text-slate-400">Connect Gmail, Calendar, and other Google services.</p>
                </div>
              </div>
            </section>

            <section className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-700/80 bg-slate-900/85 p-8 shadow-2xl shadow-black/40">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-semibold mb-2">Services Marketplace</h2>
                  <p className="text-slate-400">Choose a service to connect or browse all available options.</p>
                </div>

                <div className="space-y-3 mb-8">
                  <button className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-slate-800/70 px-6 py-3 text-sm font-medium text-white transition-colors hover:border-slate-500 hover:bg-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-3">
                      <span>🐙</span>
                      <span>GitHub</span>
                    </span>
                    <span className="text-slate-400">→</span>
                  </button>

                  <button className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-slate-800/70 px-6 py-3 text-sm font-medium text-white transition-colors hover:border-slate-500 hover:bg-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-3">
                      <span>💬</span>
                      <span>Slack</span>
                    </span>
                    <span className="text-slate-400">→</span>
                  </button>

                  <button className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-slate-800/70 px-6 py-3 text-sm font-medium text-white transition-colors hover:border-slate-500 hover:bg-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-3">
                      <span>🔵</span>
                      <span>Google Workspace</span>
                    </span>
                    <span className="text-slate-400">→</span>
                  </button>

                  <button className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-slate-800/70 px-6 py-3 text-sm font-medium text-white transition-colors hover:border-slate-500 hover:bg-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-3">
                      <span>🎮</span>
                      <span>Discord</span>
                    </span>
                    <span className="text-slate-400">→</span>
                  </button>
                </div>

                <div className="border-t border-slate-700 pt-6 space-y-3">
                  <button
                    onClick={() => setStep(3)}
                    className="w-full min-h-[44px] rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-500"
                  >
                    Continue
                  </button>

                  <button
                    onClick={handleSkipOnboarding}
                    className="w-full min-h-[44px] rounded-xl border border-slate-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:border-slate-500 hover:bg-slate-800/50"
                  >
                    Skip
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 3 && (
          <div className="grid gap-8 lg:min-h-[80vh] lg:grid-cols-12 lg:items-center lg:gap-12">
            <section className="lg:col-span-5">
              <h1 className="text-4xl font-semibold leading-tight mb-6">
                You're ready to go!
              </h1>
              <p className="text-lg text-slate-300 mb-8">
                Your MyApi workspace is fully set up. Explore all features and customize your experience.
              </p>

              <div className="space-y-4">
                {[
                  { icon: '🔗', title: 'Service Connectors', desc: 'Manage all connected services and their credentials' },
                  { icon: '🔐', title: 'Token Vault', desc: 'Securely store and organize your API tokens' },
                  { icon: '🤖', title: 'Personas', desc: 'Create AI personas for different automation tasks' },
                  { icon: '💎', title: 'Marketplace', desc: 'Discover and share automation workflows' },
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-3">
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
                  Your account is ready. Start connecting services, managing tokens, and automating your workflows.
                </p>

                <button
                  onClick={handleGoToDashboard}
                  disabled={loading}
                  className="w-full min-h-[48px] rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition-all hover:bg-blue-500 disabled:opacity-50 active:scale-95"
                >
                  {loading ? 'Loading...' : 'Go to Dashboard'}
                </button>

                <p className="text-xs text-slate-500 mt-6">
                  You can always find these tutorials in the Help section of your dashboard.
                </p>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default Onboarding;
