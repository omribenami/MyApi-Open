import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import BrandLogo from './BrandLogo';

function Layout({ children, onLogout }) {
  const location = useLocation();
  const { user } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const tokenData = (() => {
    try { return JSON.parse(localStorage.getItem('tokenData') || '{}'); } catch { return {}; }
  })();
  const isPowerUser = tokenData?.scope === 'full';

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/services', label: 'Services' },
    { path: '/tokens', label: 'Token Vault' },
    { path: '/access-tokens', label: 'Access Tokens' },
    { path: '/personas', label: 'Personas' },
    { path: '/skills', label: 'Skills' },
    { path: '/identity', label: 'Identity' },
    { path: '/knowledge', label: 'Knowledge' },
    { path: '/marketplace', label: 'Marketplace' },
    { path: '/my-listings', label: 'My Listings' },
    { path: '/platform-docs', label: 'Platform Docs' },
    { path: '/api-docs', label: 'API Docs' },
    ...(isPowerUser ? [{ path: '/users', label: 'Users' }] : []),
    { path: '/settings', label: 'Settings' },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      onLogout();
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-slate-950 border-b border-slate-800/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo & Hamburger */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Hamburger button - mobile only */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="xl:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Toggle menu"
              >
                {menuOpen ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>

              <Link to="/" className="flex-shrink-0 flex items-center gap-2">
                <BrandLogo size="sm" withWordmark={false} className="gap-2" />
                <span className="text-lg font-semibold tracking-tight text-slate-100">MyApi</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden xl:flex xl:items-center xl:gap-1.5 flex-1 min-w-0 mx-6">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`inline-flex items-center px-2.5 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                    isActive(item.path)
                      ? 'text-white bg-blue-600/25 border border-blue-400/50 shadow-[0_0_12px_rgba(59,130,246,0.45)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {user && (
                <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-800 bg-slate-900 max-w-[220px]">
                  <span className="text-sm text-slate-300 truncate">{user.email || 'User'}</span>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:text-slate-100 bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="xl:hidden border-t border-slate-800 bg-slate-900 bg-opacity-95 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 py-2 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                    isActive(item.path)
                      ? 'text-white bg-blue-600/25 border border-blue-400/50 shadow-[0_0_12px_rgba(59,130,246,0.35)]'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="rounded-lg">{children}</div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-slate-500">
            <p>MyApi Dashboard v1.0 · © 2026</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
