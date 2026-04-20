import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { handleOAuthCallback } from '../utils/oauth';
import { AVAILABLE_SERVICES } from '../utils/oauth';
import BrandLogo from '../components/BrandLogo';
import { clearAuthArtifacts } from '../utils/authRuntime';

const OAuthIcons = {
  google: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
  github: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  ),
  facebook: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
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
    const callback = handleOAuthCallback();
    if (callback) {
      if (callback.status === 'confirm_login' || callback.status === 'connected') {
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
      } else if (callback.status === 'signup_required') {
        window.location.replace(`/dashboard/${window.location.search}`);
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
      const pendingReturnTo = result?.data?.pendingReturnTo || null;
      if (masterToken) setMasterToken(masterToken);
      if (sessionUser) setUser(sessionUser);
      if (pendingReturnTo && pendingReturnTo.startsWith('/dashboard/')) {
        window.location.href = pendingReturnTo;
      } else {
        window.location.href = '/dashboard/';
      }
    } catch {
      setError('Failed to verify 2FA code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const oauthServices = [AVAILABLE_SERVICES[0], AVAILABLE_SERVICES[1], AVAILABLE_SERVICES[2]].filter(Boolean);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      {/* Back */}
      <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--ink-2)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-3)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo + heading */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <BrandLogo size="md" className="mb-6 justify-center" />
          <h1 className="font-serif" style={{ fontSize: '28px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.1, marginBottom: '8px' }}>
            {twoFactorRequired ? 'Two-factor auth' : 'Welcome back'}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: 0 }}>
            {twoFactorRequired
              ? 'Enter your authenticator code to continue.'
              : 'Sign in to your MyApi account'}
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '24px' }}>
          {error && (
            <div style={{
              marginBottom: '16px',
              padding: '10px 14px',
              borderRadius: '6px',
              background: 'var(--red-bg)',
              border: '1px solid var(--red)',
              color: 'var(--red)',
              fontSize: '13px',
              lineHeight: 1.5
            }}>
              {error}
            </div>
          )}

          {twoFactorRequired ? (
            <form onSubmit={handleTwoFactorChallenge} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label htmlFor="twoFactorCode" style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--ink-2)', marginBottom: '6px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Authenticator code
                </label>
                <input
                  id="twoFactorCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  className="ui-input"
                  style={{ width: '100%', fontSize: '20px', letterSpacing: '0.2em', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}
                  placeholder="000000"
                  maxLength={8}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !twoFactorCode.trim()}
                className="btn-primary"
                style={{ width: '100%', minHeight: '40px', fontSize: '14px', fontWeight: 500, marginTop: '4px' }}
              >
                {loading ? 'Verifying…' : 'Verify & sign in'}
              </button>
              <button
                type="button"
                onClick={() => { setTwoFactorRequired(false); setError(''); setTwoFactorCode(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: '12px', textAlign: 'center', padding: '4px' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--ink-2)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-3)'}
              >
                ← Back to sign in
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {oauthServices.map((service) => (
                <button
                  key={service.id}
                  onClick={() => handleOAuthClick(service.id)}
                  disabled={loading}
                  className="btn"
                  style={{ width: '100%', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '14px' }}
                >
                  <span style={{ flexShrink: 0 }}>{OAuthIcons[service.id] || null}</span>
                  <span>Continue with {service.name}</span>
                </button>
              ))}
            </div>
          )}

          {!twoFactorRequired && (
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--line)', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: 0 }}>
                No account?{' '}
                <a href="/?signup=true" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                  Create one
                </a>
              </p>
            </div>
          )}
        </div>

        {/* Footer links */}
        <div style={{ marginTop: '24px', textAlign: 'center', display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <a href="/privacy" style={{ fontSize: '12px', color: 'var(--ink-4)', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--ink-3)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-4)'}>
            Privacy
          </a>
          <span style={{ color: 'var(--line)', fontSize: '12px' }}>·</span>
          <a href="/terms" style={{ fontSize: '12px', color: 'var(--ink-4)', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--ink-3)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-4)'}>
            Terms
          </a>
        </div>
      </div>
    </div>
  );
}

export default LogIn;
