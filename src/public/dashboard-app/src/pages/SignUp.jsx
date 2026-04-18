import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { handleOAuthCallback, AVAILABLE_SERVICES } from '../utils/oauth';
import BrandLogo from '../components/BrandLogo';
import WaitlistForm from '../components/WaitlistForm';
import { clearAuthArtifacts } from '../utils/authRuntime';
import { fetchPublicConfig } from '../utils/publicConfig';

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

function SignUp() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { setMasterToken, setUser, isAuthenticated } = useAuthStore();
  const [betaFull, setBetaFull] = useState(false);
  const [prefillEmail, setPrefillEmail] = useState('');

  useEffect(() => {
    // ?beta=full is set by the OAuth callback when a new signup hits the cap.
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
      // New user — hand off to Login.jsx (at /dashboard/) which has the full profile form.
      // After the form completes it redirects to /dashboard/onboarding.
      window.location.replace(`/dashboard/${window.location.search}`);
    } else if (callback.status === 'confirm_login' || callback.status === 'connected') {
      // Existing user signed in — go straight to dashboard
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
          window.location.replace('/dashboard/');
        })
        .catch(() => setError('Failed to complete sign-in. Please try again.'));
    } else if (callback.error) {
      setError(`OAuth error: ${callback.error}`);
      window.history.replaceState({}, document.title, '/dashboard/signup');
    }
  }, [setMasterToken, setUser]);

  if (isAuthenticated) {
    window.location.replace('/dashboard/');
    return null;
  }

  const handleOAuthClick = (serviceId) => {
    setError('');
    clearAuthArtifacts();
    const params = new URLSearchParams({ mode: 'login', forcePrompt: '1', returnTo: '/dashboard/', redirect: '1' });
    window.location.href = `/api/v1/oauth/authorize/${serviceId}?${params.toString()}`;
  };

  const oauthServices = [AVAILABLE_SERVICES[0], AVAILABLE_SERVICES[1], AVAILABLE_SERVICES[2]].filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-8 sm:py-10 lg:px-12">
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard/login')}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" />
            </svg>
            Back to sign in
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12 xl:gap-16">
          <section className="lg:col-span-5">
            <div className="max-w-xl">
              <BrandLogo size="md" className="mb-6" />
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
                Create your MyApi account
              </h1>
              <p className="mt-4 text-base text-slate-300">
                Your privacy-first AI gateway. Connect services, manage credentials, and give agents exactly the access they need — no more.
              </p>

              <div className="mt-10 space-y-4">
                {[
                  { icon: '🔐', title: 'Encrypted credential storage', desc: 'OAuth tokens and API keys are AES-256 encrypted at rest.' },
                  { icon: '🔗', title: '45+ service integrations', desc: 'GitHub, Google, Slack, Discord, Notion, Linear and many more.' },
                  { icon: '🤖', title: 'Built for AI agents', desc: 'Issue scoped tokens, create personas, build your automation stack.' },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="flex-shrink-0 text-2xl">{item.icon}</div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                      <p className="text-sm text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-sm text-slate-300">
                  <span className="font-semibold text-blue-300">Free tier included</span> — Start building immediately. Upgrade to Pro or Enterprise anytime.
                </p>
              </div>
            </div>
          </section>

          <section className="lg:col-span-7">
            <div className="rounded-3xl border border-slate-700/80 bg-slate-900/85 p-5 shadow-2xl shadow-black/40 sm:p-7 lg:p-8">
              {betaFull ? (
                <WaitlistForm
                  defaultEmail={prefillEmail}
                  title="Sorry — MyApi is at capacity"
                  subtitle="We're running a closed beta and all 50 seats are currently filled. Leave your email and we'll let you know as soon as a spot opens."
                />
              ) : (
              <>
              <div className="mb-6">
                <h2 className="text-2xl font-semibold">Get started</h2>
                <p className="mt-2 text-sm text-slate-400">Choose your preferred sign-in method.</p>
              </div>

              {error && (
                <div className="mb-5 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                {oauthServices.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => handleOAuthClick(service.id)}
                    className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm font-medium text-white transition-colors hover:border-slate-500 hover:bg-slate-800"
                  >
                    <span>{OAuthIcons[service.id] || null}</span>
                    <span>Sign up with {service.name}</span>
                  </button>
                ))}
              </div>

              <div className="mt-6 border-t border-slate-700 pt-6">
                <p className="text-center text-xs text-slate-400">
                  Already have an account?{' '}
                  <a href="/dashboard/login" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                    Sign in
                  </a>
                </p>
              </div>

              <p className="mt-4 text-center text-xs text-slate-500">
                By signing up, you agree to our{' '}
                <a href="/terms" className="text-blue-400 hover:text-blue-300">Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</a>
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
