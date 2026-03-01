import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

function DashboardHome() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const [stats, setStats] = useState({
    tokens: 0,
    connectors: 0,
  });
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!masterToken) return;

      try {
        const headers = { 'Authorization': `Bearer ${masterToken}` };

        const [healthRes, tokensRes, connectorsRes] = await Promise.all([
          fetch('/health'),
          fetch('/api/v1/tokens', { headers }).catch(() => ({ ok: false })),
          fetch('/api/v1/oauth/status', { headers }).catch(() => ({ ok: false })),
        ]);

        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setHealth(healthData);
        }

        if (tokensRes.ok) {
          const tokensData = await tokensRes.json();
          setStats((s) => ({ ...s, tokens: tokensData.data?.length || 0 }));
        }

        if (connectorsRes.ok) {
          const connectorsData = await connectorsRes.json();
          const serviceList = connectorsData.services || connectorsData.data || [];
          const connected = serviceList.filter((c) => c.status === 'connected');
          setStats((s) => ({ ...s, connectors: connected.length }));
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [masterToken]);

  const statCards = [
    {
      label: 'Access Tokens',
      value: stats.tokens,
      icon: '🔑',
      color: 'blue',
      link: '/access-tokens',
      description: 'Master & guest tokens',
    },
    {
      label: 'Connected Services',
      value: stats.connectors,
      icon: '🔗',
      color: 'green',
      link: '/services',
      description: 'OAuth and integrations',
    },
  ];

  const colorMap = {
    blue: 'from-blue-600 to-blue-700',
    green: 'from-green-600 to-green-700',
    purple: 'from-purple-600 to-purple-700',
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
          <p className="mt-4 text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white">Welcome to MyApi</h1>
        <p className="mt-2 text-slate-400 text-lg">
          Manage your personal APIs, services, and credentials in one place
        </p>
      </div>

      {/* Status Alert */}
      {health && (
        <div className="rounded-lg bg-green-900 bg-opacity-30 border border-green-700 p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✓</span>
            <div>
              <h3 className="text-sm font-medium text-green-200">System Status</h3>
              <p className="text-xs text-green-300 mt-1">
                All systems operational. {health.uptime && `Uptime: ${health.uptime}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {statCards.map((card) => (
          <Link
            key={card.label}
            to={card.link}
            className={`bg-gradient-to-br ${colorMap[card.color]} rounded-lg p-6 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer group`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-medium opacity-90">{card.label}</p>
                <p className="text-3xl font-bold mt-2">{card.value}</p>
              </div>
              <div className="text-3xl opacity-50 group-hover:opacity-75 transition-opacity">
                {card.icon}
              </div>
            </div>
            <p className="text-xs opacity-80">{card.description}</p>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/services"
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 rounded-lg p-6 transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔗</span>
              <div>
                <h3 className="font-semibold text-white">Connect a Service</h3>
                <p className="text-sm text-slate-400">Add OAuth integrations</p>
              </div>
            </div>
          </Link>

          <Link
            to="/access-tokens"
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 rounded-lg p-6 transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔑</span>
              <div>
                <h3 className="font-semibold text-white">Manage Tokens</h3>
                <p className="text-sm text-slate-400">Master token &amp; guest access</p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
        <h2 className="text-xl font-semibold text-white mb-4">Getting Started</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                1
              </span>
              <span className="font-medium text-white">Connect Services</span>
            </div>
            <p className="text-slate-400">
              Start by connecting to external services like Google, GitHub, or Slack using OAuth.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                2
              </span>
              <span className="font-medium text-white">Create Tokens</span>
            </div>
            <p className="text-slate-400">
              Generate API tokens with specific scopes and permissions for secure access.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                3
              </span>
              <span className="font-medium text-white">Manage & Monitor</span>
            </div>
            <p className="text-slate-400">
              Track all API usage, audit logs, and manage permissions from one dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-slate-500 pt-8 border-t border-slate-800">
        <p>
          Need help? Check our{' '}
          <a href="#" className="text-blue-400 hover:text-blue-300">
            documentation
          </a>{' '}
          or{' '}
          <a href="#" className="text-blue-400 hover:text-blue-300">
            contact support
          </a>
        </p>
      </div>
    </div>
  );
}

export default DashboardHome;
