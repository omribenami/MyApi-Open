import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import BrandLogo from './BrandLogo';

function Layout({ children, onLogout }) {
  const location = useLocation();
  const { user } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

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
    { path: '/platform-docs', label: 'Platform Docs' },
    { path: '/api-docs', label: 'API Docs' },
    ...(isPowerUser ? [{ path: '/users', label: 'Users' }] : []),
  ];

  const avatarUrl = useMemo(() => {
    const fromStorage = localStorage.getItem('profileAvatarUrl');
    return fromStorage || user?.avatarUrl || user?.avatar_url || '';
  }, [user]);

  const isActive = (path) => (path === '/' ? location.pathname === path : location.pathname.startsWith(path));

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      onLogout();
      window.location.href = '/';
    }
  };

  const userMenuItems = [
    { path: '/my-listings', label: 'My Listings' },
    { path: '/settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="sticky top-0 z-40 bg-slate-950 border-b border-slate-800/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setMenuOpen(!menuOpen)} className="xl:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" aria-label="Toggle menu">
                {menuOpen ? '✕' : '☰'}
              </button>
              <Link to="/" className="flex-shrink-0 flex items-center gap-2">
                <BrandLogo size="sm" withWordmark={false} className="gap-2" />
                <span className="text-lg font-semibold tracking-tight text-slate-100">MyApi</span>
              </Link>
            </div>

            <div className="hidden xl:flex xl:items-center xl:gap-1.5 flex-1 min-w-0 mx-6">
              {navItems.map((item) => (
                <Link key={item.path} to={item.path} className={`inline-flex items-center px-2.5 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${isActive(item.path) ? 'text-white bg-blue-600 border border-blue-500' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="relative flex items-center">
              <button
                onClick={() => setAvatarMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 hover:border-slate-700"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-slate-700 text-slate-200 grid place-items-center text-xs font-semibold">
                    {(user?.username || user?.email || 'U').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline text-sm text-slate-200 max-w-[160px] truncate">{user?.email || user?.username || 'User'}</span>
              </button>

              {avatarMenuOpen && (
                <div className="absolute right-0 top-12 w-52 rounded-lg border border-slate-700 bg-slate-900 p-1.5 shadow-xl">
                  {userMenuItems.map((item) => (
                    <Link key={item.path} to={item.path} onClick={() => setAvatarMenuOpen(false)} className={`block rounded-md px-3 py-2 text-sm ${isActive(item.path) ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                      {item.label}
                    </Link>
                  ))}
                  <button onClick={handleLogout} className="mt-1 block w-full rounded-md px-3 py-2 text-left text-sm text-rose-300 hover:bg-slate-800">
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {menuOpen && (
          <div className="xl:hidden border-t border-slate-800 bg-slate-900 bg-opacity-95 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 py-2 space-y-1">
              {navItems.concat(userMenuItems).map((item) => (
                <Link key={item.path} to={item.path} onClick={() => setMenuOpen(false)} className={`flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${isActive(item.path) ? 'text-white bg-blue-600 border border-blue-500' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                  {item.label}
                </Link>
              ))}
              <button onClick={handleLogout} className="w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-rose-300 hover:bg-slate-800">Logout</button>
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"><div className="rounded-lg">{children}</div></main>

      <footer className="border-t border-slate-800 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="text-center text-sm text-slate-500"><p>MyApi Dashboard v1.0 · © 2026</p></div></div>
      </footer>
    </div>
  );
}

export default Layout;
