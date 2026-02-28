import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { startOAuthFlow, handleOAuthCallback } from '../utils/oauth';
import { AVAILABLE_SERVICES } from '../utils/oauth';

function Login() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setMasterToken, isAuthenticated } = useAuthStore();

  // Handle OAuth callback on component mount
  useEffect(() => {
    const callback = handleOAuthCallback();
    if (callback) {
      if (callback.status === 'connected') {
        // Token was set by backend, user should now be authenticated
        // Refresh page to reload with new auth
        window.history.replaceState({}, document.title, '/');
      } else if (callback.error) {
        setError(`OAuth error: ${callback.error}`);
        window.history.replaceState({}, document.title, '/');
      }
    }
  }, []);

  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    window.location.href = '/dashboard';
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Verify token by making a test request
      const response = await fetch('/api/v1/tokens', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setMasterToken(token);
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 100);
      } else {
        setError('Invalid master token');
      }
    } catch (err) {
      console.error('Token verification error:', err);
      setError('Failed to verify token');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthClick = async (serviceId) => {
    setError('');
    try {
      await startOAuthFlow(serviceId);
    } catch (err) {
      console.error('OAuth flow error:', err);
      setError(`Failed to start ${serviceId} OAuth flow. Please try again.`);
    }
  };

  const oauthServices = [
    AVAILABLE_SERVICES[0], // Google
    AVAILABLE_SERVICES[1], // GitHub
    { ...AVAILABLE_SERVICES[2] }, // Facebook (if available)
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">MyApi</h1>
          <h2 className="text-xl font-semibold text-slate-300">
            Personal API Dashboard
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            Sign in to manage your APIs, services, and data
          </p>
        </div>

        {/* OAuth Options */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider text-center px-4">
            Sign in with
          </p>
          <div className="grid grid-cols-2 gap-3">
            {oauthServices.map((service) => (
              <button
                key={service.id}
                onClick={() => handleOAuthClick(service.id)}
                className="group relative flex items-center justify-center px-4 py-3 border-2 border-slate-700 rounded-lg font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-200"
                title={`Sign in with ${service.name}`}
              >
                <span className="text-lg mr-2">{service.icon}</span>
                <span className="hidden sm:inline">{service.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-slate-900 text-slate-400">Or continue with token</span>
          </div>
        </div>

        {/* Token Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-lg bg-red-900 bg-opacity-30 border border-red-700 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-200">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="token" className="block text-sm font-medium text-slate-300 mb-2">
              Master Token
            </label>
            <input
              id="token"
              name="token"
              type="password"
              autoComplete="off"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors"
              placeholder="Enter your master token"
            />
            <p className="mt-2 text-xs text-slate-400">
              Don't have a token? Create one from the API dashboard.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Verifying...' : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 space-y-2">
          <p>
            By signing in, you agree to our{' '}
            <a href="#" className="text-blue-400 hover:text-blue-300">
              Terms of Service
            </a>
          </p>
          <p>
            Need help?{' '}
            <a href="#" className="text-blue-400 hover:text-blue-300">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
