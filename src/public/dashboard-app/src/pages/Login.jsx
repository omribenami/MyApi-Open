import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { startOAuthFlow, handleOAuthCallback } from '../utils/oauth';
import { AVAILABLE_SERVICES } from '../utils/oauth';

// Brand SVG icons for OAuth providers
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
  slack: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z" fill="#E01E5A"/>
      <path d="M6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834z" fill="#36C5F0"/>
      <path d="M8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834z" fill="#2EB67D"/>
      <path d="M17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/>
      <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52z" fill="#ECB22E"/>
      <path d="M15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#ECB22E"/>
    </svg>
  ),
  discord: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#5865F2" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.079.11 18.1.132 18.11c2.052 1.507 4.039 2.422 5.993 3.029a.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028c1.961-.607 3.95-1.522 6.002-3.029a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  ),
};

function Login() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [viewMode, setViewMode] = useState('login'); // 'login' | 'pricing'
  const { setMasterToken, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const callback = handleOAuthCallback();
    if (callback) {
      if (callback.status === 'connected') {
        window.history.replaceState({}, document.title, '/dashboard/');
      } else if (callback.error) {
        setError(`OAuth error: ${callback.error}`);
        window.history.replaceState({}, document.title, '/dashboard/');
      }
    }
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
    } catch (err) {
      setError('Connection failed. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthClick = async (serviceId) => {
    setError('');
    try {
      await startOAuthFlow(serviceId);
    } catch (err) {
      setError(`Failed to start ${serviceId} login. Please try again.`);
    }
  };

  const oauthServices = [
    AVAILABLE_SERVICES[0], // google
    AVAILABLE_SERVICES[1], // github
    AVAILABLE_SERVICES[2], // facebook
  ].filter(Boolean);

  const features = [
    {
      icon: (
        <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      title: 'Connect Services',
      desc: 'Google, GitHub, Slack & more',
    },
    {
      icon: (
        <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      ),
      title: 'Token Vault',
      desc: 'API keys with fine-grained scopes',
    },
    {
      icon: (
        <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .26 2.698-1.31 2.698H4.908c-1.57 0-2.311-1.698-1.31-2.698l1.402-1.402m11.8 0L12 13.5l-4.8 1.8" />
        </svg>
      ),
      title: 'AI Personas',
      desc: 'Switch between AI personalities',
    },
    {
      icon: (
        <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      ),
      title: 'Knowledge Base',
      desc: 'Personal AI memory & documents',
    },
  ];

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
        if (result.url) {
          window.location.href = result.url; // Redirect to Stripe Checkout
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to initiate checkout.');
      }
    } catch (err) {
      setError('Connection failed. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex flex-col">
      {/* Header Nav for Toggle */}
      <div className="absolute top-0 right-0 p-6 z-20">
        {viewMode === 'login' ? (
          <button 
            onClick={() => setViewMode('pricing')}
            className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
          >
            View Pricing Plans
          </button>
        ) : (
          <button 
            onClick={() => setViewMode('login')}
            className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
          >
            Back to Login
          </button>
        )}
      </div>

      {/* Ambient glow orbs - CSS only, no JS */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600 rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-indigo-600 rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute top-2/3 left-1/2 w-64 h-64 bg-violet-600 rounded-full opacity-5 blur-3xl"></div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 relative z-10">
        <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-8 lg:gap-16 items-center">

          {/* Left side — Branding & Features */}
          <div className="flex-1 text-center lg:text-left max-w-lg">
            {/* Logo */}
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500 shadow-opacity-25">
                <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-3xl sm:text-4xl font-bold text-white tracking-tight">MyApi</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-semibold text-white mb-3">
              Your Personal API Dashboard
            </h2>
            <p className="text-slate-400 text-base sm:text-lg mb-8 leading-relaxed">
              One dashboard to manage all your APIs, services, tokens, and AI personas.
              made by ai for ai.
            </p>

            {/* Feature cards grid */}
            {viewMode === 'login' && (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {features.map((f, i) => (
                  <div
                    key={i}
                    className="bg-white bg-opacity-5 backdrop-blur-sm border border-white border-opacity-10 rounded-xl p-3 sm:p-4 hover:bg-opacity-10 transition-colors duration-200"
                  >
                    <div className="mb-2">{f.icon}</div>
                    <h3 className="text-sm font-semibold text-white mb-1">{f.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right side — Logic/Pricing Card */}
          <div className="w-full max-w-sm lg:max-w-md">
            {viewMode === 'login' ? (
              <>
                {/* Login Card */}
                <div className="bg-slate-900 bg-opacity-80 backdrop-blur-xl border border-slate-700 border-opacity-50 rounded-2xl p-6 sm:p-8 shadow-2xl">
                  <h3 className="text-xl font-semibold text-white mb-1">Welcome back</h3>
                  <p className="text-sm text-slate-400 mb-6">Sign in to your dashboard</p>

                  {/* Error message */}
                  {error && (
                    <div className="mb-4 rounded-xl bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 p-3 flex items-start gap-2">
                      <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <p className="text-sm text-red-300">{error}</p>
                    </div>
                  )}

                  {/* OAuth Buttons */}
                  <div className="space-y-2.5 mb-6">
                    {oauthServices.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => handleOAuthClick(service.id)}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-700 rounded-xl text-sm font-medium text-white bg-slate-800 bg-opacity-50 hover:bg-opacity-80 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-200 min-h-[44px]"
                      >
                        <span className="flex-shrink-0">{OAuthIcons[service.id] || null}</span>
                        <span>Continue with {service.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-700 border-opacity-50"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-3 text-xs text-slate-500 bg-slate-900 bg-opacity-80">or use master token</span>
                    </div>
                  </div>

                  {/* Token Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="token" className="block text-sm font-medium text-slate-300 mb-1.5">
                        Master Token
                      </label>
                      <div className="relative">
                        <input
                          id="token"
                          type={showToken ? 'text' : 'password'}
                          autoComplete="off"
                          required
                          value={token}
                          onChange={(e) => setToken(e.target.value)}
                          className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-700 bg-slate-800 bg-opacity-50 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 focus:outline-none transition-all duration-200 text-sm min-h-[44px]"
                          placeholder="Paste your master token"
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
                          aria-label={showToken ? 'Hide token' : 'Show token'}
                        >
                          {showToken ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !token}
                      className="w-full px-4 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg min-h-[44px] text-sm"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Verifying...
                        </span>
                      ) : 'Sign In'}
                    </button>
                  </form>

                  {/* Help text */}
                  <p className="mt-4 text-center text-xs text-slate-500">
                    New here? Check the{' '}
                    <a href="https://github.com/omribenami/MyApi" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                      docs
                    </a>
                    {' '}to get started
                  </p>
                </div>
                
                {/* Trust badges */}
                <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Encrypted
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Self-hosted
                  </span>
                  <span>•</span>
                  <span>Open Source</span>
                </div>
              </>
            ) : (
              /* Pricing Card */
              <div className="w-full bg-slate-900 bg-opacity-80 backdrop-blur-xl border border-slate-700 border-opacity-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col lg:flex-row">
                {/* Free Tier */}
                <div className="flex-1 p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-slate-700 border-opacity-50">
                  <h3 className="text-xl font-semibold text-white mb-1">Free</h3>
                  <div className="text-3xl font-bold text-white mb-1">$0 <span className="text-sm text-slate-400 font-normal">/mo</span></div>
                  <p className="text-sm text-slate-400 mb-6">Perfect for individuals getting started</p>
                  
                  <ul className="space-y-3 mb-8 text-sm text-slate-300">
                    <li className="flex gap-2 items-center"><span className="text-emerald-400">✓</span> 1 AI Persona</li>
                    <li className="flex gap-2 items-center"><span className="text-emerald-400">✓</span> 3 Service Connections</li>
                    <li className="flex gap-2 items-center"><span className="text-emerald-400">✓</span> 5MB Knowledge Base</li>
                    <li className="flex gap-2 items-center"><span className="text-emerald-400">✓</span> Basic Token Vault</li>
                  </ul>
                  
                  <button 
                    onClick={() => setViewMode('login')}
                    className="w-full py-2.5 px-4 border border-slate-600 rounded-lg text-slate-200 hover:bg-slate-800 transition-colors font-medium text-sm"
                  >
                    Start Free
                  </button>
                </div>
                
                {/* Pro Tier */}
                <div className="flex-1 p-6 sm:p-8 bg-gradient-to-br from-blue-900/20 to-indigo-900/20 relative border-b lg:border-b-0 lg:border-r border-slate-700 border-opacity-50">
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-bl-lg rounded-tr-xl hidden sm:block">Popular</div>
                  <h3 className="text-xl font-semibold text-blue-300 mb-1">Pro</h3>
                  <div className="text-3xl font-bold text-white mb-1">$15 <span className="text-sm text-blue-300 font-normal opacity-70">/mo</span></div>
                  <p className="text-sm text-blue-200 opacity-80 mb-6">For power users and teams</p>
                  
                  <ul className="space-y-3 mb-8 text-sm text-slate-200">
                    <li className="flex gap-2 items-center"><span className="text-blue-400">✓</span> Unlimited AI Personas</li>
                    <li className="flex gap-2 items-center"><span className="text-blue-400">✓</span> Unlimited Connections</li>
                    <li className="flex gap-2 items-center"><span className="text-blue-400">✓</span> 50MB Knowledge Base</li>
                    <li className="flex gap-2 items-center"><span className="text-blue-400">✓</span> Advanced Token Scopes</li>
                  </ul>
                  
                  <button 
                    onClick={() => handleCheckout('pro')}
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium text-sm shadow-lg shadow-blue-600/30 flex justify-center items-center gap-2"
                  >
                    {loading ? (
                      <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.64-2.25 1.64-1.74 0-2.27-.85-2.34-1.76H7.83c.09 1.69 1.16 2.79 3.07 3.16V19h2.34v-1.67c1.52-.3 2.76-1.36 2.76-2.91.01-1.95-1.5-2.72-3.69-3.28z"/>
                        </svg>
                        Subscribe
                      </>
                    )}
                  </button>
                </div>

                {/* Enterprise Tier */}
                <div className="flex-1 p-6 sm:p-8 bg-slate-900/50 relative">
                  <h3 className="text-xl font-semibold text-purple-300 mb-1">Enterprise</h3>
                  <div className="text-3xl font-bold text-white mb-1">$30 <span className="text-sm text-purple-300 font-normal opacity-70">/mo</span></div>
                  <p className="text-sm text-purple-200 opacity-80 mb-6">Uncapped scale & priority support</p>
                  
                  <ul className="space-y-3 mb-8 text-sm text-slate-200">
                    <li className="flex gap-2 items-center"><span className="text-purple-400">✓</span> Everything in Pro</li>
                    <li className="flex gap-2 items-center"><span className="text-purple-400">✓</span> Unlimited Knowledge Base</li>
                    <li className="flex gap-2 items-center"><span className="text-purple-400">✓</span> Priority API Processing</li>
                    <li className="flex gap-2 items-center"><span className="text-purple-400">✓</span> Dedicated Support</li>
                  </ul>
                  
                  <button 
                    onClick={() => handleCheckout('enterprise')}
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors font-medium text-sm shadow-lg shadow-purple-600/30 flex justify-center items-center gap-2"
                  >
                    {loading ? (
                      <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.64-2.25 1.64-1.74 0-2.27-.85-2.34-1.76H7.83c.09 1.69 1.16 2.79 3.07 3.16V19h2.34v-1.67c1.52-.3 2.76-1.36 2.76-2.91.01-1.95-1.5-2.72-3.69-3.28z"/>
                        </svg>
                        Subscribe
                      </>
                    )}
                  </button>
                  {error && <p className="text-red-400 text-xs mt-3 text-center absolute -bottom-6 left-0 right-0">{error}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
