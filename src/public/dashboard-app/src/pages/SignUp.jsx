import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { handleOAuthCallback, AVAILABLE_SERVICES } from '../utils/oauth';
import WaitlistForm from '../components/WaitlistForm';
import { clearAuthArtifacts } from '../utils/authRuntime';
import { fetchPublicConfig } from '../utils/publicConfig';
import SigningIn from './SigningIn';

const OAuthIcons = {
  google: (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
  github: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  ),
  facebook: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
};

function LogoMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="su-logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4A8CFF"/>
          <stop offset="100%" stopColor="#6058FF"/>
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#su-logo-grad)"/>
      <path d="M36 14 L25 31 H34 L30 50 L44 29 H35 L36 14 Z" fill="none" stroke="#FFFFFF" strokeWidth="3.6" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

function SignUp() {
  const [error, setError] = useState('');
  const { setMasterToken, setUser, isAuthenticated } = useAuthStore();
  const [betaFull, setBetaFull] = useState(false);
  const [prefillEmail, setPrefillEmail] = useState('');
  const [processingService, setProcessingService] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('beta') === 'full') {
      setBetaFull(true);
      setPrefillEmail(params.get('email') || '');
      return;
    }
    let cancelled = false;
    fetchPublicConfig().then((cfg) => {
      if (!cancelled && cfg?.beta && cfg.betaFull) setBetaFull(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const callback = handleOAuthCallback();
    if (!callback) return;

    if (callback.status === 'signup_required') {
      setProcessingService(callback.service || 'google');
      fetch('/api/v1/auth/oauth-signup/pending', { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(async (payload) => {
          const data = payload?.data || {};
          const nonce = data.nonce || '';
          if (!nonce) {
            setProcessingService(null);
            setError('Sign-up session expired. Please try again.');
            window.history.replaceState({}, document.title, '/dashboard/signup');
            return;
          }
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
          const r = await fetch('/api/v1/auth/oauth-signup/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              oauthSignupConfirm: true,
              oauthSignupNonce: nonce,
              displayName: data.name || '',
              email: data.email || '',
              username: data.recommendedUsername || '',
              timezone: tz,
              termsAccepted: true,
            }),
          });
          const result = await r.json().catch(() => ({}));
          if (r.ok) {
            try {
              localStorage.removeItem('myapi_onboarding_dismissed');
              localStorage.removeItem('__myapi_logged_out__');
            } catch { /* ignore */ }
            window.location.href = '/dashboard/onboarding';
          } else if (result?.code === 'BETA_FULL') {
            const em = encodeURIComponent(result.email || data.email || '');
            window.location.href = `/dashboard/signup?beta=full${em ? `&email=${em}` : ''}`;
          } else {
            setProcessingService(null);
            setError(result?.error || 'Failed to create account. Please try again.');
            window.history.replaceState({}, document.title, '/dashboard/signup');
          }
        })
        .catch(() => {
          setProcessingService(null);
          setError('Failed to complete sign-up. Please try again.');
          window.history.replaceState({}, document.title, '/dashboard/signup');
        });
    } else if (callback.status === 'confirm_login' || callback.status === 'connected') {
      setProcessingService(callback.service || 'google');
      const confirmToken = callback.token;
      const doConfirm = confirmToken
        ? fetch('/api/v1/oauth/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token: confirmToken }),
          }).then((r) => (r.ok ? r.json() : null))
        : Promise.resolve({ ok: true });

      doConfirm
        .then(() => fetch('/api/v1/auth/me', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)))
        .then((sessionUser) => {
          if (sessionUser?.user) {
            if (sessionUser.bootstrap?.masterToken) setMasterToken(sessionUser.bootstrap.masterToken);
            setUser(sessionUser.user);
          }
          const user = sessionUser?.user || sessionUser;
          if (user?.needsOnboarding) {
            window.location.replace('/dashboard/onboarding');
          } else {
            window.location.replace('/dashboard/');
          }
        })
        .catch(() => {
          setProcessingService(null);
          setError('Failed to complete sign-in. Please try again.');
          window.history.replaceState({}, document.title, '/dashboard/signup');
        });
    } else if (callback.error) {
      setError(`OAuth error: ${callback.error}`);
      window.history.replaceState({}, document.title, '/dashboard/signup');
    }
  }, [setMasterToken, setUser]);

  if (isAuthenticated) {
    window.location.replace('/dashboard/');
    return null;
  }

  if (processingService) {
    return (
      <SigningIn
        serviceKey={processingService}
        onCancel={() => { window.location.href = '/'; }}
      />
    );
  }

  const handleOAuthClick = (serviceId) => {
    setError('');
    clearAuthArtifacts();
    try { localStorage.removeItem('__myapi_logged_out__'); } catch { /* ignore */ }
    const params = new URLSearchParams({ mode: 'login', forcePrompt: '1', returnTo: '/dashboard/signup', redirect: '1' });
    window.location.href = `/api/v1/oauth/authorize/${serviceId}?${params.toString()}`;
  };

  const oauthServices = [AVAILABLE_SERVICES[0], AVAILABLE_SERVICES[1], AVAILABLE_SERVICES[2]].filter(Boolean);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)', fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
      <div className="max-w-[1100px] mx-auto px-6 py-12">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-12">
          <LogoMark />
          <span className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>MyApi</span>
        </div>

        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Left: marketing copy */}
          <section className="lg:col-span-5">
            <div className="max-w-md">
              <div
                className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full text-[11px] font-medium tracking-wide"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-2)', border: '1px solid var(--line)', background: 'var(--bg-raised)' }}
              >
                <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--green)', display: 'inline-block' }} />
                OPEN BETA
              </div>
              <h1 className="text-[32px] font-semibold leading-tight tracking-tight" style={{ color: 'var(--ink)' }}>
                Welcome to the<br/>MyApi beta.
              </h1>
              <p className="mt-4 text-[14.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                Connect services once, hand scoped tokens to your agents, and keep every credential in an encrypted vault. Free while we build it with you — your data stays yours.
              </p>

              <div className="mt-8 space-y-5">
                {[
                  { icon: '⚡', title: 'AES-256-GCM vault', desc: 'OAuth tokens and API keys encrypted with 600k PBKDF2 iterations at rest.' },
                  { icon: '🔗', title: '100+ service integrations', desc: 'GitHub, Google, Slack, Discord, Notion, Stripe and 100+ more — OAuth once, proxy forever.' },
                  { icon: '🤖', title: 'Built for AI agents', desc: 'Issue scoped tokens per agent, create personas, build automation that respects limits.' },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <span className="text-lg flex-shrink-0">{item.icon}</span>
                    <div>
                      <div className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>{item.title}</div>
                      <p className="text-[13px] mt-0.5" style={{ color: 'var(--ink-3)' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-md px-4 py-3" style={{ background: 'var(--accent-bg)', border: '1px solid rgba(68,147,248,0.3)' }}>
                <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
                  <span className="font-semibold" style={{ color: 'var(--accent)' }}>Open beta — free access.</span>
                  {' '}Every feature is unlocked at no cost while we build.
                </p>
                <p className="text-[12.5px] mt-2 leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                  The beta breathes: seats are limited, so accounts that go inactive are gently released after a heads-up to make room for people waiting to get in.
                </p>
              </div>
            </div>
          </section>

          {/* Right: auth panel */}
          <section className="lg:col-span-7">
            <div className="ui-card p-6 sm:p-8">
              {betaFull ? (
                <>
                  <h2 className="text-[20px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>The beta is full right now — sorry!</h2>
                  <p className="text-[13.5px] mb-4 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                    Every beta seat is currently taken. But spots open up regularly — the beta breathes: inactive accounts are released after a heads-up, and we invite people from the waitlist to fill the space.
                  </p>
                  <div className="mb-5 rounded-md px-4 py-3" style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line)' }}>
                    <p className="text-[13px] mb-2" style={{ color: 'var(--ink-2)' }}>
                      Join our Discord — early testers usually hear about open spots there first.
                    </p>
                    <a
                      href="https://discord.gg/WPp4sCN4xB"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 text-[13.5px] font-medium rounded-md"
                      style={{ background: '#5865F2', color: '#fff', textDecoration: 'none' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.332-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z"/></svg>
                      Join the Discord
                    </a>
                  </div>
                  <WaitlistForm
                    defaultEmail={prefillEmail}
                    title="Join the waitlist"
                    subtitle="Leave your email and we'll notify you the moment a seat opens up."
                  />
                </>
              ) : (
                <>
                  <h2 className="text-[20px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Join the beta</h2>
                  <p className="text-[13.5px] mb-6" style={{ color: 'var(--ink-2)' }}>Create your free account with one click — no credit card.</p>

                  {error && (
                    <div className="mb-5 px-4 py-3 text-[13px] rounded-md" style={{ border: '1px solid var(--red)', background: 'var(--red-bg)', color: 'var(--red)' }}>
                      {error}
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {oauthServices.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => handleOAuthClick(service.id)}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-[13.5px] font-medium rounded-md transition-colors"
                        style={{ border: '1px solid var(--line)', background: 'var(--bg-raised)', color: 'var(--ink)', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-raised)'}
                      >
                        <span className="flex-shrink-0">{OAuthIcons[service.id] || null}</span>
                        <span>Continue with {service.name}</span>
                      </button>
                    ))}
                  </div>

                  <p className="mt-6 text-center text-[12px]" style={{ color: 'var(--ink-4)' }}>
                    By continuing, you agree to our{' '}
                    <a href="/legal/terms.html" style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>Terms</a>
                    {' '}and{' '}
                    <a href="/legal/privacy.html" style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>Privacy Policy</a>
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
