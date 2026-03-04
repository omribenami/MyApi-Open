import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { startOAuthFlow, handleOAuthCallback } from '../utils/oauth';
import { AVAILABLE_SERVICES } from '../utils/oauth';
import BrandLogo from '../components/BrandLogo';

const OAuthIcons = {
  google: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
  github: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  ),
  facebook: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
};

const features = [
  {
    title: 'Launch faster',
    desc: 'Unify APIs, tools, and automations in one secure dashboard.',
  },
  {
    title: 'Stay in control',
    desc: 'Manage token access and service permissions with confidence.',
  },
  {
    title: 'Scale with clarity',
    desc: 'Grow from solo workflow to team operations without chaos.',
  },
];

function Login() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [viewMode, setViewMode] = useState('pricing');
  const [billingPlans, setBillingPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const { setMasterToken, setUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const callback = handleOAuthCallback();
    if (callback) {
      if (callback.status === 'connected') {
        fetch('/api/v1/auth/me', { credentials: 'include' })
          .then(async (res) => {
            if (!res.ok) return null;
            return res.json();
          })
          .then((sessionUser) => {
            if (sessionUser) {
              if (sessionUser?.bootstrap?.masterToken) {
                setMasterToken(sessionUser.bootstrap.masterToken);
              }
              setUser(sessionUser);
            }
            window.history.replaceState({}, document.title, '/dashboard/');
            window.location.href = '/dashboard/';
          });
      } else if (callback.error) {
        setError(`OAuth error: ${callback.error}`);
        window.history.replaceState({}, document.title, '/dashboard/');
      }
    }
  }, []);

  useEffect(() => {
    const loadPlans = async () => {
      setPlansLoading(true);
      try {
        const res = await fetch('/api/v1/billing/plans');
        if (!res.ok) {
          setBillingPlans([]);
          return;
        }
        const data = await res.json();
        setBillingPlans(Array.isArray(data?.data) ? data.data : []);
      } catch {
        setBillingPlans([]);
      } finally {
        setPlansLoading(false);
      }
    };
    loadPlans();
  }, []);

  if (isAuthenticated) {
    window.location.href = '/dashboard/';
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/v1/tokens/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (response.ok) {
        const result = await response.json();
        setMasterToken(token);
        localStorage.setItem('sessionToken', token);
        localStorage.setItem('tokenData', JSON.stringify(result.data));
        setTimeout(() => { window.location.href = '/dashboard/'; }, 100);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Invalid token. Please check and try again.');
      }
    } catch {
      setError('Connection failed. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthClick = async (serviceId) => {
    setError('');
    try {
      await startOAuthFlow(serviceId, {
        mode: (serviceId === 'google' || serviceId === 'facebook') ? 'login' : 'connect',
        returnTo: '/dashboard/',
      });
    } catch {
      setError(`Failed to start ${serviceId} login. Please try again.`);
    }
  };

  const handleCheckout = async (plan) => {
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (response.ok) {
        const result = await response.json();
        if (result.url) window.location.href = result.url;
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to initiate checkout.');
      }
    } catch {
      setError('Connection failed. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const oauthServices = [AVAILABLE_SERVICES[0], AVAILABLE_SERVICES[1], AVAILABLE_SERVICES[2]].filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
        <div className="grid gap-8 lg:min-h-[78vh] lg:grid-cols-12 lg:items-center lg:gap-12 xl:gap-16">
          <section className="lg:col-span-5">
            <div className="max-w-xl">
              <BrandLogo size="lg" className="mb-8" />
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-blue-300">MyApi Platform</p>
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-[2.65rem] lg:leading-[1.1]">
                The professional command center for APIs, tokens, and AI workflows.
              </h1>
              <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">
                Connect providers, protect credentials, and run your automation stack from one focused workspace.
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {features.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
                    <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-slate-400 sm:text-sm">
                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5">Encrypted token storage</span>
                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5">OAuth + Master token access</span>
                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5">Self-host friendly</span>
              </div>
            </div>
          </section>

          <section className="lg:col-span-7">
            <div className="rounded-3xl border border-slate-700/80 bg-slate-900/85 p-5 shadow-2xl shadow-black/40 sm:p-7 lg:p-8">
              <div className="mb-6 inline-flex w-full max-w-xs rounded-xl border border-slate-700 bg-slate-900/80 p-1">
                <button
                  onClick={() => setViewMode('pricing')}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${viewMode === 'pricing' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                >
                  Pricing
                </button>
                <button
                  onClick={() => setViewMode('login')}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${viewMode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                >
                  Login
                </button>
              </div>

              {error && (
                <div className="mb-5 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
              )}

              {viewMode === 'login' ? (
                <div className="max-w-xl">
                  <h2 className="text-2xl font-semibold">Welcome back</h2>
                  <p className="mb-6 mt-2 text-sm text-slate-400 sm:text-base">Sign in securely with OAuth or your master token.</p>

                  <div className="space-y-3">
                    {oauthServices.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => handleOAuthClick(service.id)}
                        className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm font-medium text-white transition-colors hover:border-slate-500 hover:bg-slate-800"
                      >
                        <span>{OAuthIcons[service.id] || null}</span>
                        <span>Continue with {service.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="relative my-6">
                    <div className="border-t border-slate-700/80" />
                    <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-slate-900 px-3 text-xs text-slate-500">or use master token</span>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="token" className="mb-2 block text-sm font-medium text-slate-300">Master Token</label>
                      <div className="relative">
                        <input
                          id="token"
                          type={showToken ? 'text' : 'password'}
                          autoComplete="off"
                          required
                          value={token}
                          onChange={(e) => setToken(e.target.value)}
                          className="min-h-[48px] w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 pr-12 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                          placeholder="Paste your master token"
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition hover:text-white"
                          aria-label={showToken ? 'Hide token' : 'Show token'}
                        >
                          {showToken ? '🙈' : '👁️'}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !token}
                      className="min-h-[48px] w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? 'Verifying...' : 'Sign In'}
                    </button>
                  </form>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-semibold">Choose your plan</h2>
                  <p className="mb-6 mt-2 text-sm text-slate-400 sm:text-base">Start free, then upgrade when your automation grows.</p>

                  {plansLoading ? (
                    <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-10 text-center text-sm text-slate-400">Loading plans…</div>
                  ) : billingPlans.length === 0 ? (
                    <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-10 text-center text-sm text-slate-400">No plans available right now. Please try again shortly.</div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {billingPlans.map((plan) => (
                        <div key={plan.id} className={`flex h-full flex-col rounded-2xl border p-5 ${plan.id === 'pro' ? 'border-blue-500/60 bg-blue-500/10' : 'border-slate-700/80 bg-slate-900/60'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                              <p className="mt-1 text-xs leading-relaxed text-slate-400">{plan.description}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-semibold text-white">${plan.priceMonthly}<span className="text-sm font-normal text-slate-400">/mo</span></p>
                            </div>
                          </div>

                          <ul className="mt-4 space-y-2 text-sm text-slate-300">
                            {(plan.features || []).map((feature) => (
                              <li key={feature} className="flex items-start gap-2"><span className="mt-0.5 text-emerald-400">•</span><span>{feature}</span></li>
                            ))}
                          </ul>

                          <button
                            onClick={() => (plan.id === 'free' ? setViewMode('login') : handleCheckout(plan.id))}
                            disabled={loading}
                            className={`mt-5 min-h-[44px] w-full rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${plan.id === 'free' ? 'border border-slate-600 text-slate-200 hover:bg-slate-800' : 'bg-blue-600 text-white hover:bg-blue-500'} disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {plan.id === 'free' ? 'Start Free' : 'Subscribe'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default Login;
