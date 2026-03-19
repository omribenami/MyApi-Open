import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { handleOAuthCallback, AVAILABLE_SERVICES } from '../utils/oauth';
import BrandLogo from '../components/BrandLogo';

const OAuthIcons = {
  google: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>),
  github: (<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>),
  facebook: (<svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>),
};

const userMdExample = `# USER.md\n\n## Who I am\n- Name: Your name\n- Preferred name: What the assistant should call you\n- Timezone: e.g. America/Chicago\n\n## Current projects\n- Project A: short goal\n- Project B: blockers / context\n\n## Preferences\n- Communication style\n- Priorities\n- Any personal context worth remembering`;

const soulMdExample = `# SOUL.md\n\n## Assistant style\n- Tone: friendly / direct / concise\n- Format: bullets, short answers, etc.\n\n## Boundaries\n- What the assistant should never do\n- Privacy expectations\n\n## Working preferences\n- How proactive to be\n- When to ask before acting\n- How to handle reminders and follow-ups`;

function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('login');
  const [step, setStep] = useState(1);
  const [oauthConnected, setOauthConnected] = useState(false);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [signupData, setSignupData] = useState({
    displayName: '', preferredName: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', bio: '', userMdContent: '', soulMdContent: '',
  });

  const { setMasterToken, setUser, isAuthenticated } = useAuthStore();
  const oauthServices = useMemo(() => [AVAILABLE_SERVICES[0], AVAILABLE_SERVICES[1], AVAILABLE_SERVICES[2]].filter(Boolean), []);

  const goDashboard = () => { window.history.replaceState({}, document.title, '/dashboard/home'); window.location.href = '/dashboard/home'; };

  useEffect(() => {
    const callback = handleOAuthCallback();
    if (!callback) return;

    if (callback.status === 'connected') {
      fetch('/api/v1/auth/me', { credentials: 'include' })
        .then(async (res) => (res.ok ? res.json() : null))
        .then((sessionUser) => {
          if (sessionUser) {
            if (sessionUser?.bootstrap?.masterToken) setMasterToken(sessionUser.bootstrap.masterToken);
            setUser(sessionUser);
          }

          const shouldOnboard = callback.mode === 'signup' || sessionUser?.isFirstLogin || !sessionUser?.user?.onboardingCompleted;
          if (shouldOnboard) {
            setTab('signup');
            setStep(2);
            setOauthConnected(true);
            setSignupData((prev) => ({
              ...prev,
              displayName: sessionUser?.user?.displayName || prev.displayName,
              preferredName: sessionUser?.user?.preferredName || prev.preferredName,
              timezone: sessionUser?.user?.timezone || prev.timezone,
              bio: sessionUser?.user?.bio || prev.bio,
            }));
            window.history.replaceState({}, document.title, '/dashboard/');
            return;
          }
          goDashboard();
        });
    } else if (callback.status === 'pending_2fa') {
      setTwoFactorRequired(true);
      setTab('login');
      setError('Enter your authenticator code to complete sign-in.');
      window.history.replaceState({}, document.title, '/dashboard/');
    } else if (callback.error) {
      setError(`OAuth error: ${callback.error}`);
      window.history.replaceState({}, document.title, '/dashboard/');
    }
  }, [setMasterToken, setUser]);

  if (isAuthenticated && tab !== 'signup') {
    goDashboard();
    return null;
  }

  const handleOAuthClick = (serviceId, mode = 'login') => {
    setError('');
    const params = new URLSearchParams({ mode, returnTo: '/dashboard/home', redirect: '1' });
    window.location.href = `/api/v1/oauth/authorize/${serviceId}?${params.toString()}`;
  };

  const handleTwoFactorChallenge = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/2fa/challenge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ code: twoFactorCode.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setError(result.error || 'Invalid 2FA code. Please try again.');
      const sessionUser = result?.data?.user || null;
      const masterToken = result?.data?.bootstrap?.masterToken || null;
      if (masterToken) setMasterToken(masterToken);
      if (sessionUser) setUser(sessionUser);
      goDashboard();
    } catch {
      setError('Failed to verify 2FA code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const completeSignup = async () => {
    setError('');
    setLoading(true);
    try {
      const body = {
        ...signupData,
        displayName: signupData.displayName || signupData.preferredName || 'User',
      };
      const res = await fetch('/api/v1/auth/signup/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to complete signup');
      goDashboard();
    } catch (e) {
      setError(e.message || 'Failed to complete signup');
    } finally {
      setLoading(false);
    }
  };

  const stepValid = () => {
    if (step === 1) return oauthConnected;
    if (step === 2) return Boolean((signupData.displayName || signupData.preferredName || '').trim());
    if (step === 3) return Boolean((signupData.userMdContent || '').trim());
    if (step === 4) return Boolean((signupData.soulMdContent || '').trim());
    return true;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
        <div className="grid gap-8 lg:min-h-[78vh] lg:grid-cols-12 lg:items-center lg:gap-12 xl:gap-16">
          <section className="lg:col-span-5">
            <div className="max-w-xl">
              <BrandLogo size="lg" className="mb-8" />
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-blue-300">MyApi Platform</p>
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-[2.65rem] lg:leading-[1.1]">The professional command center for APIs, tokens, and AI workflows.</h1>
              <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">Connect providers, protect credentials, and run your automation stack from one focused workspace.</p>
            </div>
          </section>

          <section className="lg:col-span-7">
            <div className="rounded-3xl border border-slate-700/80 bg-slate-900/85 p-5 shadow-2xl shadow-black/40 sm:p-7 lg:p-8">
              <div className="mb-6 inline-flex w-full max-w-xs rounded-xl border border-slate-700 bg-slate-900/80 p-1">
                <button onClick={() => { setTab('login'); setError(''); }} className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${tab === 'login' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>Login</button>
                <button onClick={() => { setTab('signup'); setStep(1); setError(''); }} className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${tab === 'signup' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>Signup</button>
              </div>

              {error && <div className="mb-5 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

              {tab === 'login' ? (
                <div className="max-w-xl">
                  <h2 className="text-2xl font-semibold">Welcome back</h2>
                  <p className="mb-6 mt-2 text-sm text-slate-400 sm:text-base">Sign in securely with OAuth.</p>

                  {twoFactorRequired ? (
                    <form onSubmit={handleTwoFactorChallenge} className="space-y-4">
                      <input id="twoFactorCode" type="text" autoComplete="one-time-code" required value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} className="min-h-[48px] w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25" placeholder="Enter 6-digit code" />
                      <button type="submit" disabled={loading || !twoFactorCode.trim()} className="min-h-[48px] w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Verifying...' : 'Verify 2FA & Sign In'}</button>
                    </form>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {oauthServices.map((service) => (
                          <button key={service.id} onClick={() => handleOAuthClick(service.id, 'login')} className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm font-medium text-white transition-colors hover:border-slate-500 hover:bg-slate-800">
                            <span>{OAuthIcons[service.id] || null}</span><span>Continue with {service.name}</span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-4 text-center text-sm text-slate-400">Need an account? <button type="button" onClick={() => { setTab('signup'); setStep(1); setError(''); }} className="text-blue-400 hover:text-blue-300 font-medium">Go to signup</button></p>
                    </>
                  )}
                </div>
              ) : (
                <div className="max-w-2xl">
                  <h2 className="text-2xl font-semibold">Create your account</h2>
                  <p className="mb-3 mt-2 text-sm text-slate-400">Guided setup in 5 simple steps.</p>
                  <p className="mb-6 text-xs text-slate-500">Step {step} of 5</p>

                  {step === 1 && (
                    <div className="space-y-3">
                      {oauthServices.map((service) => (
                        <button key={service.id} onClick={() => handleOAuthClick(service.id, 'signup')} className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm font-medium text-white transition-colors hover:border-slate-500 hover:bg-slate-800">
                          <span>{OAuthIcons[service.id] || null}</span><span>Continue with {service.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-3">
                      <input value={signupData.displayName} onChange={(e) => setSignupData((s) => ({ ...s, displayName: e.target.value }))} placeholder="Display Name" className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3" />
                      <input value={signupData.preferredName} onChange={(e) => setSignupData((s) => ({ ...s, preferredName: e.target.value }))} placeholder="Preferred Name (optional)" className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3" />
                      <input value={signupData.timezone} onChange={(e) => setSignupData((s) => ({ ...s, timezone: e.target.value }))} placeholder="Timezone" className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3" />
                      <textarea value={signupData.bio} onChange={(e) => setSignupData((s) => ({ ...s, bio: e.target.value }))} placeholder="Short bio" className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 min-h-[110px]" />
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-300">USER.md helps your assistant understand who you are: projects, preferences, and context.</p>
                      <textarea value={signupData.userMdContent} onChange={(e) => setSignupData((s) => ({ ...s, userMdContent: e.target.value }))} placeholder={userMdExample} className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 min-h-[220px] placeholder:text-slate-500" />
                    </div>
                  )}

                  {step === 4 && (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-300">SOUL.md defines assistant tone, style, and boundaries.</p>
                      <textarea value={signupData.soulMdContent} onChange={(e) => setSignupData((s) => ({ ...s, soulMdContent: e.target.value }))} placeholder={soulMdExample} className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 min-h-[220px] placeholder:text-slate-500" />
                    </div>
                  )}

                  {step === 5 && (
                    <div className="space-y-3 text-sm text-slate-300">
                      <div className="rounded-xl border border-slate-700 p-4">Display Name: <span className="text-white">{signupData.displayName || signupData.preferredName || 'User'}</span></div>
                      <div className="rounded-xl border border-slate-700 p-4">Preferred Name: <span className="text-white">{signupData.preferredName || '—'}</span></div>
                      <div className="rounded-xl border border-slate-700 p-4">Timezone: <span className="text-white">{signupData.timezone || 'UTC'}</span></div>
                      <div className="rounded-xl border border-slate-700 p-4">USER.md: <span className="text-white">{signupData.userMdContent ? 'Provided' : 'Skipped'}</span></div>
                      <div className="rounded-xl border border-slate-700 p-4">SOUL.md: <span className="text-white">{signupData.soulMdContent ? 'Provided' : 'Skipped'}</span></div>
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap gap-3">
                    {step > 1 && step < 5 && <button onClick={() => setStep((v) => Math.max(1, v - 1))} className="rounded-xl border border-slate-600 px-4 py-2 text-sm">Back</button>}
                    {step < 5 && <button onClick={() => setStep((v) => v + 1)} disabled={!stepValid()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">Next</button>}
                    {step === 5 && <button onClick={completeSignup} disabled={loading} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">{loading ? 'Finishing...' : 'Finish & Go to dashboard'}</button>}

                    {[2, 3, 4].includes(step) && (
                      <button onClick={completeSignup} disabled={loading} className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:text-white">Skip for now and continue to dashboard</button>
                    )}
                  </div>
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
