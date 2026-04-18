import { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import BrandLogo from './BrandLogo';
import CookieNotice from './CookieNotice';
import Toast from './Toast';
import NotificationDropdown from './NotificationDropdown';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import PlanLimitModal from './PlanLimitModal';

function NavDropdown({ label, items, isActiveFn, onMobileClick }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const hasActive = items.some(i => isActiveFn(i.path));

  const baseClasses = "inline-flex items-center px-2.5 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all";
  const activeClasses = "text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]";
  const inactiveClasses = "text-slate-400 hover:text-slate-200";

  return (
    <div className="relative" ref={dropdownRef} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        className={`${baseClasses} ${hasActive ? activeClasses : inactiveClasses}`}
        onClick={() => setOpen(!open)}
      >
        {label}
        <svg className={`ml-1 h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full pt-1 w-48 z-50">
          <div className="rounded-xl border border-slate-700 bg-slate-900 shadow-xl py-1">
            {items.map((item) =>
              item.external ? (
                <a
                  key={item.path}
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { setOpen(false); if (onMobileClick) onMobileClick(); }}
                  className="block px-4 py-2 text-sm transition-all text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  {item.label}
                </a>
              ) : (
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
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Layout({ children, onLogout }) {
  const location = useLocation();
  const { user } = useAuthStore();
  const masterToken = useAuthStore((state) => state.masterToken);
  const unreadCount = useNotificationStore(state => state.unreadCount);
  const fetchUnreadCount = useNotificationStore(state => state.fetchUnreadCount);
  const toasts = useNotificationStore(state => state.toasts) || [];
  const removeToast = useNotificationStore(state => state.removeToast);
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const avatarMenuRef = useRef(null);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handleClickOutside = (e) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [avatarMenuOpen]);

  // Fetch unread notification count on mount and periodically
  useEffect(() => {
    fetchUnreadCount(masterToken);
    const interval = setInterval(() => fetchUnreadCount(masterToken), 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchUnreadCount, masterToken]);

  const tokenData = (() => {
    try { return JSON.parse(localStorage.getItem('tokenData') || '{}'); } catch { return {}; }
  })();
  const isPowerUser = !!user?.isPowerUser;
  const effectivePlan = String(user?.plan || tokenData?.plan || 'free').toLowerCase();
  const hasEnterpriseAccess = effectivePlan === 'enterprise';

  const isActive = (path) => (path === '/' ? location.pathname === path : location.pathname.startsWith(path));

  const navGroups = [
    {
      label: 'Overview',
      items: [
        { path: '/', label: 'Dashboard' },
        { path: '/activity', label: 'Activity Log' },
        { path: '/notifications', label: 'Notifications' },
      ]
    },
    {
      label: 'AI & Brain',
      items: [
        { path: '/identity', label: 'Identity' },
        { path: '/memory', label: 'Memory' },
        { path: '/personas', label: 'Personas' },
        { path: '/knowledge', label: 'Knowledge' },
        { path: '/skills', label: 'Skills' },
      ]
    },
    {
      label: 'Access',
      items: [
        { path: '/access-tokens', label: 'Access Tokens' },
        { path: '/tokens', label: 'Token Vault' },
        { path: '/devices', label: 'Device Management' },
      ]
    },
    {
      label: 'Integrations',
      items: [
        { path: '/services', label: 'Services' },
        { path: '/connectors', label: 'Connectors' },
        { path: '/marketplace', label: 'Marketplace' },
      ]
    },
    {
      label: 'Resources',
      items: [
        { path: '/platform-docs', label: 'Platform Docs' },
        { path: '/api-docs', label: 'API Docs' },
        { path: 'https://discord.gg/WPp4sCN4xB', label: 'Get Support', external: true },
      ]
    }
  ];

  // Enterprise settings: visible only to enterprise plan
  if (hasEnterpriseAccess) {
    navGroups.push({
      label: 'Workspace',
      items: [
        { path: '/enterprise', label: 'Enterprise (SSO+RBAC)' },
      ]
    });
  }

  if (isPowerUser) {
    navGroups.push({
      label: 'Admin',
      items: [
        { path: '/users', label: 'Users' },
        { path: '/beta', label: 'Beta' }
      ]
    });
  }

  const avatarUrl = useMemo(() => {
    const fromStorage = localStorage.getItem('profileAvatarUrl');
    return fromStorage || user?.avatarUrl || user?.avatar_url || '';
  }, [user]);

  const displayName = useMemo(() => {
    return user?.displayName || user?.display_name || user?.name || user?.username || 'User';
  }, [user]);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      onLogout();
    }
  };

  const userMenuItems = [
    { path: '/settings/team', label: 'Teams & Members' },
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

            {/* Right side controls */}
            <div className="flex items-center gap-1">
              {/* Marketplace Icon */}
              <Link
                to="/marketplace"
                className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                  isActive('/marketplace')
                    ? 'text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/40'
                    : 'text-amber-500 hover:text-amber-400 hover:bg-amber-500/10'
                }`}
                title="Marketplace"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
              </Link>

              {/* Notification Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)}
                  className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                    notificationDropdownOpen
                      ? 'text-white bg-blue-600/20 ring-1 ring-blue-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title="Notifications"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                <NotificationDropdown
                  open={notificationDropdownOpen}
                  onClose={() => setNotificationDropdownOpen(false)}
                />
              </div>

              {/* User Profile Menu */}
              <div className="relative" ref={avatarMenuRef}>
                <button
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={avatarMenuOpen}
                  onClick={() => setAvatarMenuOpen((v) => !v)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    avatarMenuOpen
                      ? 'text-white bg-blue-600/20 ring-1 ring-blue-500/40'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:inline max-w-[110px] truncate">{displayName}</span>
                  <svg className={`h-3.5 w-3.5 text-slate-400 flex-shrink-0 transition-transform ${avatarMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {avatarMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl py-2 z-50">
                    <div className="px-4 py-3 border-b border-slate-800">
                      <p className="text-sm font-medium text-white truncate">{displayName}</p>
                      <p className="text-xs text-slate-400 truncate">{user?.email || user?.username}</p>
                    </div>

                    <WorkspaceSwitcher variant="menu" />

                    {userMenuItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setAvatarMenuOpen(false)}
                        className={`block px-4 py-2 text-sm transition-all ${isActive(item.path) ? 'text-blue-400 bg-slate-800/50' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                      >
                        {item.label}
                      </Link>
                    ))}

                    <div className="border-t border-slate-800 mt-2 pt-2">
                      <button
                        type="button"
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
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <div className="xl:hidden border-t border-slate-800 bg-slate-900 bg-opacity-95 backdrop-blur-sm shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
              {navGroups.map((group) => (
                <div key={group.label} className="space-y-1">
                  <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{group.label}</h3>
                  {group.items.map((item) =>
                    item.external ? (
                      <a
                        key={item.path}
                        href={item.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive(item.path) ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)] bg-blue-900/20 border border-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                      >
                        {item.label}
                      </Link>
                    )
                  )}
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
            <span aria-hidden="true">·</span>
            <a href="https://discord.gg/WPp4sCN4xB" target="_blank" rel="noopener noreferrer" className="hover:text-slate-200 transition-colors">Get Support</a>
          </div>
        </div>
      </footer>
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
      
      <CookieNotice />
      <PlanLimitModal />
    </div>
  );
}

export default Layout;
