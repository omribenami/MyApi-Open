import { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import BrandLogo from './BrandLogo';
import CookieNotice from './CookieNotice';
import Toast from './Toast';

function NavDropdown({ label, items, isActiveFn, onMobileClick }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasActive = items.some(i => isActiveFn(i.path));
  
  const baseClasses = "inline-flex items-center px-2.5 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all cursor-pointer";
  const activeClasses = "text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]";
  const inactiveClasses = "text-slate-400 hover:text-slate-200";

  return (
    <div className="relative" ref={dropdownRef} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div 
        className={`${baseClasses} ${hasActive ? activeClasses : inactiveClasses}`}
        onClick={() => setOpen(!open)}
      >
        {label}
        <svg className={`ml-1 h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      
      {open && (
        <div className="absolute left-0 top-full pt-1 w-48 z-50">
          <div className="rounded-xl border border-slate-700 bg-slate-900 shadow-xl py-1">
            {items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => { setOpen(false); if (onMobileClick) onMobileClick(); }}
                className={`block px-4 py-2 text-sm transition-all ${
                  isActiveFn(item.path)
                    ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)] bg-slate-800/50'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Layout({ children, onLogout }) {
  const location = useLocation();
  const { user } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

  const tokenData = (() => {
    try { return JSON.parse(localStorage.getItem('tokenData') || '{}'); } catch { return {}; }
  })();
  const isPowerUser = String(user?.email || '').toLowerCase() === 'admin@your.domain.com';

  const isActive = (path) => (path === '/' ? location.pathname === path : location.pathname.startsWith(path));

  const navGroups = [
    {
      label: 'Core',
      items: [
        { path: '/', label: 'Dashboard' },
        { path: '/services', label: 'Services' },
        { path: '/marketplace', label: 'Marketplace' },
      ]
    },
    {
      label: 'Security',
      items: [
        { path: '/tokens', label: 'Token Vault' },
        { path: '/access-tokens', label: 'Master Tokens' },
        { path: '/devices', label: 'Device Management' },
        { path: '/identity', label: 'Identity' },
      ]
    },
    {
      label: 'AI & Data',
      items: [
        { path: '/personas', label: 'Personas' },
        { path: '/skills', label: 'Skills' },
        { path: '/knowledge', label: 'Knowledge' },
      ]
    },
    {
      label: 'Resources',
      items: [
        { path: '/activity', label: 'Activity Log' },
        { path: '/platform-docs', label: 'Platform Docs' },
        { path: '/api-docs', label: 'API Docs' },
      ]
    }
  ];

  if (isPowerUser) {
    navGroups.push({
      label: 'Admin',
      items: [{ path: '/users', label: 'Users' }]
    });
  }

  const avatarUrl = useMemo(() => {
    const fromStorage = localStorage.getItem('profileAvatarUrl');
    return fromStorage || user?.avatarUrl || user?.avatar_url || '';
  }, [user]);

  const displayName = useMemo(() => {
    return user?.display_name || user?.displayName || user?.name || user?.username || 'User';
  }, [user]);

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

            {/* Desktop Navigation */}
            <div className="hidden xl:flex xl:items-center xl:gap-3 flex-1 min-w-0 mx-6">
              {navGroups.map((group) => (
                <NavDropdown 
                  key={group.label} 
                  label={group.label} 
                  items={group.items} 
                  isActiveFn={isActive} 
                />
              ))}
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <Link
                to="/dashboard/notifications"
                className="relative flex items-center justify-center w-10 h-10 rounded-lg border border-slate-700 bg-slate-900 hover:border-slate-600 transition-colors"
                title="Notifications"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {useNotificationStore(state => state.unreadCount) > 0 && (
                  <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center transform translate-x-1 -translate-y-1">
                    {useNotificationStore(state => state.unreadCount) > 9 ? '9+' : useNotificationStore(state => state.unreadCount)}
                  </span>
                )}
              </Link>
            </div>

            {/* User Profile Menu */}
            <div className="relative flex items-center">
              <button
                onClick={() => setAvatarMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 p-1 pr-3 hover:border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="h-8 w-8 rounded-full object-cover border border-slate-700" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center text-sm font-bold border border-slate-600">
                    {(displayName).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline text-sm font-medium text-slate-200 max-w-[120px] truncate">
                  {displayName}
                </span>
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {avatarMenuOpen && (
                <div className="absolute right-0 top-12 w-56 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl py-2 z-50">
                  <div className="px-4 py-3 border-b border-slate-800 mb-2">
                    <p className="text-sm font-medium text-white truncate">{displayName}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.email || user?.username}</p>
                  </div>
                  
                  {userMenuItems.map((item) => (
                    <Link 
                      key={item.path} 
                      to={item.path} 
                      onClick={() => setAvatarMenuOpen(false)} 
                      className={`block px-4 py-2 text-sm transition-all ${isActive(item.path) ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)] bg-slate-800/50' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                    >
                      {item.label}
                    </Link>
                  ))}
                  
                  <div className="border-t border-slate-800 mt-2 pt-2">
                    <button 
                      onClick={handleLogout} 
                      className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-slate-800 hover:text-rose-300 transition-colors"
                    >
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <div className="xl:hidden border-t border-slate-800 bg-slate-900 bg-opacity-95 backdrop-blur-sm shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
              {navGroups.map((group) => (
                <div key={group.label} className="space-y-1">
                  <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{group.label}</h3>
                  {group.items.map((item) => (
                    <Link 
                      key={item.path} 
                      to={item.path} 
                      onClick={() => setMenuOpen(false)} 
                      className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive(item.path) ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)] bg-blue-900/20 border border-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"><div className="rounded-lg">{children}</div></main>

      <footer className="border-t border-slate-800 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3">
          <p className="text-sm text-slate-500 font-medium">MyApi Dashboard v1.0 · © 2026</p>
          <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
            <a href="/privacy" className="hover:text-slate-200 transition-colors">Privacy Policy</a>
            <span aria-hidden="true">·</span>
            <a href="/terms" className="hover:text-slate-200 transition-colors">Terms of Use</a>
          </div>
        </div>
      </footer>
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {useNotificationStore(state => state.toasts).map(toast => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => useNotificationStore(state => state.removeToast(toast.id))}
          />
        ))}
      </div>
      
      <CookieNotice />
    </div>
  );
}

export default Layout;
