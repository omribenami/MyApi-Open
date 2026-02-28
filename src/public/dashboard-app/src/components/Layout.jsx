import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

function Layout({ children, onLogout }) {
  const location = useLocation();
  const { user } = useAuthStore();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/services', label: 'Services', icon: '🔗' },
    { path: '/tokens', label: 'Token Vault', icon: '🔐' },
    { path: '/personas', label: 'Personas', icon: '🤖' },
    { path: '/identity', label: 'Identity', icon: '🪪' },
    { path: '/knowledge', label: 'Knowledge', icon: '🧠' },
    { path: '/guest', label: 'Guest Access', icon: '🎟️' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      onLogout();
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 backdrop-blur-sm bg-opacity-90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo & Brand */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex-shrink-0 flex items-center gap-2">
                <span className="text-2xl">🔐</span>
                <span className="text-xl font-bold text-white">MyApi</span>
              </Link>

              {/* Navigation Items */}
              <div className="hidden md:flex md:items-center md:gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                      isActive(item.path)
                        ? 'bg-blue-600 bg-opacity-30 text-blue-300 border-l-2 border-blue-500'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 hover:bg-opacity-50'
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-4">
              {user && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 bg-opacity-50">
                  <span className="text-sm text-slate-300">{user.email || 'User'}</span>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden pb-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  isActive(item.path)
                    ? 'bg-blue-600 bg-opacity-30 text-blue-300'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-lg">{children}</div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-slate-500">
            <p>MyApi Dashboard v1.0</p>
            <p className="mt-2">
              © 2024 MyApi. All rights reserved.{' '}
              <a href="#" className="text-blue-400 hover:text-blue-300">
                Privacy Policy
              </a>
              {' • '}
              <a href="#" className="text-blue-400 hover:text-blue-300">
                Terms of Service
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
