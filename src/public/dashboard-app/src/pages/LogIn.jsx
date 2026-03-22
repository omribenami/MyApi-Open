import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { handleOAuthCallback } from '../utils/oauth';
import { AVAILABLE_SERVICES } from '../utils/oauth';
import BrandLogo from '../components/BrandLogo';
import { clearAuthArtifacts } from '../utils/authRuntime';

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

function LogIn() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const { setMasterToken, setUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Handle OAuth callback
    const callback = handleOAuthCallback();
    if (callback) {
      if (callback.status === 'confirm_login' || callback.status === 'connected') {
        // Confirm the OAuth login (if a token is present) then fetch user and redirect
        const confirmToken = callback.token;
        const doConfirm = confirmToken
          ? fetch('/api/v1/oauth/confirm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ token: confirmToken }),
            }).then(async (res) => {
              if (!res.ok) return null;
              return res.json();
            })
          : Promise.resolve({ ok: true });

        doConfirm
          .then(() =>
            fetch('/api/v1/auth/me', { credentials: 'include' })
              .then(async (res) => {
                if (!res.ok) return null;
                return res.json();
              })
          )
          .then((sessionUser) => {
            if (sessionUser) {
              if (sessionUser?.bootstrap?.masterToken) {
                setMasterToken(sessionUser.bootstrap.masterToken);
              }
              // Extract user object from response (not the entire response)
              setUser(sessionUser.user || sessionUser);
            }
            window.history.replaceState({}, document.title, '/dashboard/');
            window.location.href = '/dashboard/';
          })
          .catch(() => {
            setError('Failed to complete login. Please try again.');
          });
      } else if (callback.status === 'pending_2fa') {
        setTwoFactorRequired(true);
        setError('Enter your authenticator code to complete sign-in.');
        window.history.replaceState({}, document.title, '/dashboard/login');
        setTimeout(() => {
          const authInput = document.getElementById('twoFactorCode');
          if (authInput) {
            authInput.focus();
            authInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      } else if (callback.error) {
        setError(`OAuth error: ${callback.error}`);
        window.history.replaceState({}, document.title, '/dashboard/login');
      }
    }
  }, [setMasterToken, setUser]);

  if (isAuthenticated) {
    window.location.href = '/dashboard/';
    return null;
  }

  const handleOAuthClick = async (serviceId) => {
    setError('');
    clearAuthArtifacts();
    const params = new URLSearchParams({ mode: 'login', forcePrompt: '1', returnTo: '/dashboard/', redirect: '1' });
    window.location.href = `/api/v1/oauth/authorize/${serviceId}?${params.toString()}`;
  };

  const handleTwoFactorChallenge = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/2fa/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: twoFactorCode.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || 'Invalid 2FA code. Please try again.');
        return;
      }

      const sessionUser = result?.data?.user || null;
      const masterToken = result?.data?.bootstrap?.masterToken || null;
      if (masterToken) setMasterToken(masterToken);
      if (sessionUser) setUser(sessionUser);
      window.location.href = '/dashboard/';
    } catch {
      setError('Failed to verify 2FA code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const oauthServices = [AVAILABLE_SERVICES[0], AVAILABLE_SERVICES[1], AVAILABLE_SERVICES[2]].filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-8 sm:py-10 lg:px-12">
        {/* Back to Landing */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        <div className="mx-auto max-w-lg">
          <div className="mb-8 text-center">
            <BrandLogo size="md" className="mb-6 justify-center" />
            <h1 className="text-3xl font-semibold">Welcome back</h1>
            <p className="mt-2 text-slate-400">Sign in to your MyApi account</p>
          </div>

          <div className="rounded-3xl border border-slate-700/80 bg-slate-900/85 p-5 shadow-2xl shadow-black/40 sm:p-7 lg:p-8">
            {error && (
              <div className="mb-5 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {twoFactorRequired ? (
              <form onSubmit={handleTwoFactorChallenge} className="space-y-4">
                <div>
                  <label htmlFor="twoFactorCode" className="mb-2 block text-sm font-medium text-slate-300">
                    Authenticator Code
                  </label>
                  <input
                    id="twoFactorCode"
                    type="text"
                    autoComplete="one-time-code"
                    required
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    className="min-h-[48px] w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                    placeholder="Enter 6-digit code"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !twoFactorCode.trim()}
                  className="min-h-[48px] w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify 2FA & Sign In'}
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                {oauthServices.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => handleOAuthClick(service.id)}
                    disabled={loading}
                    className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm font-medium text-white transition-colors hover:border-slate-500 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>{OAuthIcons[service.id] || null}</span>
                    <span>Continue with {service.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6 border-t border-slate-700 pt-6">
              <p className="text-center text-xs text-slate-400 mb-4">
                Don't have an account? <a href="/dashboard/signup" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">Create one</a>
              </p>
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-slate-400">
            <a href="/privacy" className="hover:text-slate-200 transition-colors">Privacy Policy</a>
            <span className="mx-2">·</span>
            <a href="/terms" className="hover:text-slate-200 transition-colors">Terms of Use</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LogIn;
