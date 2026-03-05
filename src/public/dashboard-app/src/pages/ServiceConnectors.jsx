import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useServicesStore } from '../stores/servicesStore';
import ServiceCard from '../components/ServiceCard';
import ServiceDetailModal from '../components/ServiceDetailModal';
import { startOAuthFlow } from '../utils/oauth';
import { oauth } from '../utils/apiClient';
import { normalizeService, getStatusMeta } from '../utils/serviceCatalog';

function ServiceConnectors() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const {
    services,
    setServices,
    setIsLoading,
    isLoading,
    error,
    setError,
    openRevokeModal,
    closeRevokeModal,
    showRevokeModal,
    revokeServiceId,
  } = useServicesStore();

  const [isRevoking, setIsRevoking] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [categories, setCategories] = useState([]);
  const [selectedServiceDetail, setSelectedServiceDetail] = useState(null);

  useEffect(() => {
    fetchCategories();
    fetchServices();
  }, [masterToken]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/v1/services/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchServices = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [servicesRes, oauthStatusRes] = await Promise.all([
        fetch('/api/v1/services', { credentials: 'include' }),
        fetch('/api/v1/oauth/status', {
          credentials: 'include',
          headers: masterToken ? { Authorization: `Bearer ${masterToken}` } : {},
        }),
      ]);
      if (!servicesRes.ok) throw new Error('Failed to fetch services');

      const data = await servicesRes.json();
      const allServices = data.data || [];
      const oauthData = oauthStatusRes.ok ? await oauthStatusRes.json() : { services: [] };
      const oauthMap = Object.fromEntries((oauthData.services || []).map((s) => [s.name, s]));

      setServices(allServices.map((svc) => normalizeService(svc, oauthMap[svc.name])));
    } catch (err) {
      console.error('Failed to fetch services:', err);
      setError('Could not load services. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  const openServiceDetails = async (service) => {
    try {
      const detailRes = await fetch(`/api/v1/services/${service.name}`, { credentials: 'include' });
      if (detailRes.ok) {
        const detail = await detailRes.json();
        const merged = { ...service, ...(detail.data || {}) };
        setSelectedServiceDetail(normalizeService(merged, { status: service.status, enabled: !service.notConfigured }));
        return;
      }
    } catch (_) {
      // Fallback to currently-loaded service data.
    }

    setSelectedServiceDetail(service);
  };

  const handleConnect = async (service) => {
    setConnectError(null);

    if (service.notConfigured) {
      setConnectError(
        `${service.label} is not configured on the server yet. Add required env keys shown in details to enable this integration.`
      );
      return;
    }

    setError(null);
    try {
      await startOAuthFlow(service.name, { mode: 'connect', returnTo: '/dashboard/services' });
    } catch (err) {
      console.error('OAuth flow error:', err);
      setError(`Failed to connect ${service.name}. Please try again.`);
    }
  };

  const handleRevoke = async (service) => {
    setIsRevoking(true);
    setError(null);

    try {
      await oauth.disconnect(service.name);
      closeRevokeModal();
      await fetchServices();
    } catch (err) {
      console.error('Failed to revoke service:', err);
      setError(`Failed to disconnect ${service.name}. Please try again.`);
    } finally {
      setIsRevoking(false);
    }
  };

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const text = `${s.label} ${s.description || ''} ${s.category_label || s.category || ''}`.toLowerCase();
      const matchesSearch = !searchQuery || text.includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all'
        || (selectedStatus === 'connected' && s.status === 'connected')
        || (selectedStatus === 'needs_setup' && s.notConfigured)
        || (selectedStatus === 'available' && s.status !== 'connected' && !s.notConfigured);

      return matchesSearch && matchesCategory && matchesStatus && s.label;
    });
  }, [services, searchQuery, selectedCategory, selectedStatus]);

  const summary = {
    total: services.length,
    connected: services.filter((s) => s.status === 'connected').length,
    available: services.filter((s) => s.status !== 'connected' && !s.notConfigured).length,
    needsSetup: services.filter((s) => s.notConfigured).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Services</h1>
        <p className="mt-2 text-slate-400">Browse integrations, check connection state, and manage auth in one place.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryTile label="Total" value={summary.total} />
        <SummaryTile label="Connected" value={summary.connected} tone="emerald" />
        <SummaryTile label="Available" value={summary.available} tone="blue" />
        <SummaryTile label="Needs Setup" value={summary.needsSetup} tone="amber" />
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-800/70 p-4 space-y-4" aria-label="Service filters">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="search"
            placeholder="Search by service, description, or category"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            aria-label="Search services"
          />
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedStatus('all');
            }}
            className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700"
          >
            Reset
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'connected', label: 'Connected' },
            { key: 'available', label: 'Available' },
            { key: 'needs_setup', label: 'Needs Setup' },
          ].map((status) => (
            <button
              key={status.key}
              type="button"
              onClick={() => setSelectedStatus(status.key)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                selectedStatus === status.key
                  ? 'bg-blue-600/20 text-blue-200 border-blue-500/70'
                  : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
                selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
                  selectedCategory === cat.name ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        <p className="text-sm text-slate-400" aria-live="polite">
          {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''} shown
        </p>
      </section>

      {connectError && <Alert tone="amber" message={connectError} onDismiss={() => setConnectError(null)} />}
      {error && !connectError && <Alert tone="red" message={error} onDismiss={() => setError(null)} />}

      {isLoading ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-10 text-center" role="status" aria-live="polite">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
          <p className="mt-3 text-slate-400">Loading services…</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-600 bg-slate-800/40 p-10 text-center">
          <p className="text-white font-medium">No services match your filters.</p>
          <p className="text-sm text-slate-400 mt-1">Try clearing filters or searching by another keyword.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.name}
                service={service}
                onConnect={handleConnect}
                onRevoke={() => openRevokeModal(service.name)}
                onDetails={openServiceDetails}
              />
            ))}
          </div>

          <section className="hidden xl:block rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900">
                <tr className="text-slate-300 text-left">
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Auth</th>
                  <th className="px-4 py-3">API Base URL</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((service) => {
                  const statusMeta = getStatusMeta(service.status, service.notConfigured);
                  return (
                    <tr
                      key={`row-${service.name}`}
                      className="border-t border-slate-700 bg-slate-800 hover:bg-slate-700/70 cursor-pointer"
                      onClick={() => openServiceDetails(service)}
                    >
                      <td className="px-4 py-3 text-white">{service.label}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${statusMeta.className}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 uppercase text-xs">{service.auth_type || 'unknown'}</td>
                      <td className="px-4 py-3 text-slate-300 font-mono text-xs break-all">{service.api_endpoint || 'N/A'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      <ServiceDetailModal
        service={selectedServiceDetail}
        onClose={() => setSelectedServiceDetail(null)}
        onConnect={handleConnect}
        onRevoke={() => {
          if (selectedServiceDetail) {
            openRevokeModal(selectedServiceDetail.name);
            setSelectedServiceDetail(null);
          }
        }}
      />

      {showRevokeModal && revokeServiceId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white mb-2">Disconnect Service?</h2>
            <p className="text-slate-400 text-sm mb-4">
              Disconnect <span className="font-semibold text-white capitalize">{revokeServiceId}</span>? Integrations that rely on it will stop.
            </p>
            <div className="flex gap-3">
              <button
                onClick={closeRevokeModal}
                disabled={isRevoking}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevoke(services.find((s) => s.name === revokeServiceId))}
                disabled={isRevoking}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isRevoking ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-700 bg-slate-800/60 text-slate-100',
    emerald: 'border-emerald-700/40 bg-emerald-500/10 text-emerald-200',
    blue: 'border-blue-700/40 bg-blue-500/10 text-blue-200',
    amber: 'border-amber-700/40 bg-amber-500/10 text-amber-200',
  };

  return (
    <div className={`rounded-lg border p-3 ${tones[tone] || tones.slate}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function Alert({ tone, message, onDismiss }) {
  const tones = {
    red: 'bg-red-900/30 border-red-700 text-red-200',
    amber: 'bg-amber-900/30 border-amber-700 text-amber-200',
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone] || tones.red}`} role="alert">
      <div className="flex items-start gap-3">
        <p className="text-sm flex-1">{message}</p>
        <button onClick={onDismiss} className="text-lg leading-none opacity-80 hover:opacity-100" aria-label="Dismiss">×</button>
      </div>
    </div>
  );
}

export default ServiceConnectors;
