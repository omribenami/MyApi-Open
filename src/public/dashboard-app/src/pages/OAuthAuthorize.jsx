import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import apiClient from '../utils/apiClient';

export default function OAuthAuthorize() {
  const { isAuthenticated, user } = useAuthStore();
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState(null);

  // When not authenticated, save the OAuth params so Dashboard can restore them
  // if the user ends up authenticated via Bearer token after the Google sign-in flow.
  useEffect(() => {
    if (!isAuthenticated) {
      const p = new URLSearchParams(window.location.search);
      p.delete('client_name');
      sessionStorage.setItem('pendingOAuthParams', p.toString());
    }
  }, [isAuthenticated]);

  // Parse OAuth params from URL
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client_id') || '';
  const redirectUri = params.get('redirect_uri') || '';
  const state = params.get('state') || '';
  const scope = params.get('scope') || 'full';
  const clientName = params.get('client_name') || clientId || 'External App';

  const handleAuthorize = async () => {
    setStatus('loading');
    setErrorMsg(null);
    try {
      const res = await apiClient.post('/oauth-server/authorize-token', {
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scope,
      });
      // Redirect the popup/window to ChatGPT callback
      window.location.href = res.data.redirectUrl;
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Authorization failed. Please try again.');
      setStatus('error');
    }
  };

  const handleDeny = () => {
    try {
      const url = new URL(redirectUri);
      url.searchParams.set('error', 'access_denied');
      if (state) url.searchParams.set('state', state);
      window.location.href = url.toString();
    } catch {
      setErrorMsg('Invalid redirect URI');
    }
  };

  const displayName = user?.displayName || user?.username || user?.email || 'your account';

  // ── Unauthenticated: show sign-in prompt ─────────────────────────────────────
  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    const googleLoginUrl = `/api/v1/oauth/authorize/google?mode=login&forcePrompt=0&returnTo=${returnTo}&redirect=1`;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 max-w-md w-full shadow-2xl text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
            <span className="text-xl font-bold text-slate-100">MyApi</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Sign in to authorize</h1>
          <p className="text-slate-400 text-sm mb-8">
            <strong className="text-slate-200">{clientName}</strong> wants to connect to your MyApi account.
            Sign in first to continue.
          </p>
          <a
            href={googleLoginUrl}
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
          >
            Sign in with Google
          </a>
        </div>
      </div>
    );
  }

  // ── Authenticated: show consent page ─────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 max-w-md w-full shadow-2xl">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
          <span className="text-xl font-bold text-slate-100">MyApi</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-100 mb-1">Authorize {clientName}</h1>
        <p className="text-slate-400 text-sm mb-6">
          {clientName} is requesting access to your MyApi account.
        </p>

        {/* Signed-in as */}
        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-300 mb-6">
          Authorizing as{' '}
          <span className="font-semibold text-slate-100">{displayName}</span>
        </div>

        {/* Permissions */}
        <ul className="bg-slate-950 border border-slate-800 rounded-lg p-4 mb-6 space-y-2 text-sm text-slate-400">
          {[
            'Read your identity and profile data',
            'Access your services and API connections',
            'Read your personas and knowledge base',
          ].map((perm) => (
            <li key={perm} className="flex items-center gap-2">
              <span className="text-green-500 font-bold">✓</span>
              {perm}
            </li>
          ))}
        </ul>

        {/* Error */}
        {errorMsg && (
          <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
            {errorMsg}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDeny}
            disabled={status === 'loading'}
            className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            Deny
          </button>
          <button
            onClick={handleAuthorize}
            disabled={status === 'loading'}
            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {status === 'loading' ? 'Authorizing…' : 'Authorize'}
          </button>
        </div>
      </div>
    </div>
  );
}
