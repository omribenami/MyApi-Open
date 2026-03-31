import { useState, useEffect } from 'react';

const formatUptime = (uptime) => {
  if (uptime === null || uptime === undefined || uptime === '') return '';
  if (typeof uptime === 'string' && Number.isNaN(Number(uptime))) return uptime;

  const totalSeconds = Math.max(0, Math.floor(Number(uptime)));
  if (!Number.isFinite(totalSeconds)) return String(uptime);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
};
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

function DashboardHome() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const [stats, setStats] = useState({
    tokens: 0,
    vaultTokens: 0,
    connectors: 0,
    myListings: 0,
    personas: 0,
    activePersona: null,
    skills: 0,
    activeSkills: 0,
    kbDocs: 0,
    billingPlan: 'free',
    billingUsagePercent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    const guard = setTimeout(() => setLoading(false), 8000);
    const fetchData = async () => {
      try {
        const headers = masterToken ? { 'Authorization': `Bearer ${masterToken}` } : {};

        // Multi-tenancy: Include workspace context in API calls
        const workspaceId = currentWorkspace?.id;
        if (workspaceId) {
          headers['X-Workspace-ID'] = workspaceId;
        }

        const [healthRes, tokensRes, vaultRes, connectorsRes, myListingsRes, personasRes, skillsRes, kbRes, billingRes] = await Promise.all([
          fetch('/health'),
          fetch('/api/v1/tokens', { headers }).catch(() => ({ ok: false })),
          fetch('/api/v1/vault/tokens', { headers }).catch(() => ({ ok: false })),
          fetch('/api/v1/oauth/status', { headers }).catch(() => ({ ok: false })),
          fetch('/api/v1/marketplace-my', { headers }).catch(() => ({ ok: false })),
          fetch('/api/v1/personas', { headers }).catch(() => ({ ok: false })),
          fetch('/api/v1/skills', { headers }).catch(() => ({ ok: false })),
          fetch('/api/v1/brain/knowledge-base', { headers }).catch(() => ({ ok: false })),
          fetch('/api/v1/billing/current', { headers, credentials: 'include' }).catch(() => ({ ok: false })),
        ]);

        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setHealth(healthData);
        }

        if (tokensRes.ok) {
          const tokensData = await tokensRes.json();
          const allTokens = Array.isArray(tokensData.data) ? tokensData.data : [];
          const activeTokens = allTokens.filter((t) => !t.revokedAt && !t.revoked_at);
          const activeMasterCount = activeTokens.some((t) => t.isMaster || t.scope === 'full') ? 1 : 0;
          const activeGuestCount = activeTokens.filter((t) => !(t.isMaster || t.scope === 'full')).length;
          setStats((s) => ({ ...s, tokens: activeMasterCount + activeGuestCount }));
        }

        if (vaultRes.ok) {
          const vaultData = await vaultRes.json();
          const vaultTokens = vaultData.tokens || vaultData.data || [];
          setStats((s) => ({ ...s, vaultTokens: vaultTokens.length }));
        }

        if (connectorsRes.ok) {
          const connectorsData = await connectorsRes.json();
          const serviceList = connectorsData.services || connectorsData.data || [];
          const connected = serviceList.filter((c) => c.status === 'connected');
          setStats((s) => ({ ...s, connectors: connected.length }));
        }

        if (myListingsRes.ok) {
          const myListingsData = await myListingsRes.json();
          setStats((s) => ({ ...s, myListings: (myListingsData.listings || []).length }));
        }

        if (personasRes.ok) {
          const personasData = await personasRes.json();
          const personas = personasData.data || [];
          const active = personas.find((p) => p.active);
          setStats((s) => ({ ...s, personas: personas.length, activePersona: active?.name || null }));
        }

        if (skillsRes.ok) {
          const skillsData = await skillsRes.json();
          const skills = skillsData.data || [];
          setStats((s) => ({ ...s, skills: skills.length, activeSkills: skills.filter((s) => s.active).length }));
        }

        if (kbRes.ok) {
          const kbData = await kbRes.json();
          const docs = Array.isArray(kbData) ? kbData : (kbData.data || kbData.documents || []);
          setStats((s) => ({ ...s, kbDocs: docs.length }));
        }

        if (billingRes.ok) {
          const billingData = await billingRes.json();
          const plan = billingData.data?.plan || billingData.plan || 'free';
          const usage = billingData.data?.usage || billingData.usage || 0;
          const limit = billingData.data?.limit || billingData.limit || 100;
          const usagePercent = limit > 0 ? Math.round((usage / limit) * 100) : 0;
          setStats((s) => ({ ...s, billingPlan: plan, billingUsagePercent: usagePercent }));
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        clearTimeout(guard);
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => {
      clearTimeout(guard);
      clearInterval(interval);
    };
  }, [masterToken, currentWorkspace?.id]);

  const statCards = [
    {
      label: 'Master Tokens',
      value: stats.tokens,
      link: '/access-tokens',
      description: 'Master & guest tokens',
    },
    {
      label: 'Token Vault',
      value: stats.vaultTokens,
      link: '/tokens',
      description: 'External service credentials',
    },
    {
      label: 'Connected Services',
      value: stats.connectors,
      link: '/services',
      description: 'OAuth and integrations',
    },
    {
      label: 'Personas',
      value: stats.personas,
      link: '/personas',
      description: stats.activePersona ? `Active: ${stats.activePersona}` : 'AI personality profiles',
    },
    {
      label: 'Skills',
      value: stats.skills,
      link: '/skills',
      description: `${stats.activeSkills} active skill${stats.activeSkills !== 1 ? 's' : ''}`,
    },
    {
      label: 'Knowledge Base',
      value: stats.kbDocs,
      link: '/knowledge',
      description: 'Documents & memory',
    },
    {
      label: 'My Listings',
      value: stats.myListings,
      link: '/my-listings',
      description: 'Published to marketplace',
    },
    {
      label: 'Billing Plan',
      value: stats.billingPlan.charAt(0).toUpperCase() + stats.billingPlan.slice(1),
      link: '/settings?section=billing',
      description: `Usage: ${stats.billingUsagePercent}%`,
    },
  ];

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
        <h1 className="text-3xl font-semibold tracking-tight text-slate-100">MyApi Dashboard</h1>
        <p className="mt-1 text-slate-400 text-base">
          Manage APIs, services, and credentials in one place.
        </p>
      </div>

      {/* Status Alert */}
      {health && (
        <div className="rounded-md bg-slate-900 border border-slate-800 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-slate-200">System Status</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border border-emerald-700 text-emerald-300 bg-emerald-900/20">Operational</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {health.uptime && `Uptime: ${formatUptime(health.uptime)}`}
          </p>
        </div>
      )}

      {/* Billing Warning */}
      {stats.billingUsagePercent > 80 && (
        <div className="rounded-md bg-amber-900/20 border border-amber-700 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-amber-200">⚠️ API Usage Warning</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border border-amber-700 text-amber-300 bg-amber-900/20">
              {stats.billingUsagePercent}% used
            </span>
          </div>
          <p className="text-xs text-amber-300/80 mt-2">
            You're approaching your API limit. <Link to="/settings?section=billing" className="underline hover:text-amber-200">Upgrade your plan</Link> to continue.
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <Link
            key={card.label}
            to={card.link}
            className="rounded-md p-5 border border-slate-800 bg-slate-900 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-slate-300">{card.label}</p>
                <p className="text-3xl font-semibold mt-1 text-slate-100">{card.value}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400">{card.description}</p>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-100">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/services"
            className="bg-slate-900 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-md p-5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-semibold text-slate-100">Connect a Service</h3>
                <p className="text-sm text-slate-400">Add OAuth integrations</p>
              </div>
            </div>
          </Link>

          <Link
            to="/access-tokens"
            className="bg-slate-900 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-md p-5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-semibold text-slate-100">Manage Tokens</h3>
                <p className="text-sm text-slate-400">Master token &amp; guest access</p>
              </div>
            </div>
          </Link>

          <Link
            to="/marketplace"
            className="bg-slate-900 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-md p-5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-semibold text-slate-100">Browse Marketplace</h3>
                <p className="text-sm text-slate-400">Discover personas, APIs &amp; skills</p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Documentation & Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Platform Docs */}
        <div className="bg-slate-900 border border-slate-800 rounded-md p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-2 flex items-center gap-2">
            <span className="text-blue-400">📚</span> Platform Documentation
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Learn how to use MyApi to connect services, build custom AI personas, and manage master tokens.
          </p>
          <div className="mt-4">
            <Link to="/platform-docs" className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors">
              Read Platform Docs
            </Link>
          </div>
        </div>

        {/* API Docs */}
        <div className="bg-slate-900 border border-slate-800 rounded-md p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-2 flex items-center gap-2">
            <span className="text-emerald-400">⚡</span> API Docs
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Integrate MyApi directly into your apps. Explore the OpenAPI specs and test endpoints.
          </p>
          <div className="mt-4">
            <Link to="/api-docs" className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded transition-colors">
              View API Docs
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-slate-500 pt-8 border-t border-slate-800">
        <p>
          Need help?{' '}
          <a href="https://discord.gg/WPp4sCN4xB" target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-slate-200">
            Join our Discord
          </a>
          {' '}for support and updates.
        </p>
      </div>
    </div>
  );
}

export default DashboardHome;
