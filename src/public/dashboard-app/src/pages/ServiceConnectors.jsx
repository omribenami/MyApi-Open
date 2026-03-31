import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useServicesStore } from '../stores/servicesStore';
import ServiceCard from '../components/ServiceCard';
import ServiceDetailModal from '../components/ServiceDetailModal';
import ServiceConfigModal from '../components/ServiceConfigModal';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { startOAuthFlow } from '../utils/oauth';
import { oauth } from '../utils/apiClient';
import { normalizeService, getStatusMeta, formatAuthTypeLabel } from '../utils/serviceCatalog';
import { getOAuthProvider } from '../utils/oauthProviderMap';

function ServiceConnectors() {
  const navigate = useNavigate();
  const masterToken = useAuthStore((state) => state.masterToken);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
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

  const { toasts, removeToast, showSuccessToast, showErrorToast, showInfoToast } = useToast();

  const [isRevoking, setIsRevoking] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [categories, setCategories] = useState([]);
  const [selectedServiceDetail, setSelectedServiceDetail] = useState(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [serviceToConfig, setServiceToConfig] = useState(null);
  const [oauthSuccessService, setOauthSuccessService] = useState(null);

  useEffect(() => {
    fetchCategories();
    fetchServices();
    
    // Check if we just completed an OAuth flow
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get('oauth_status');
    const oauthService = params.get('oauth_service');
    
    if (oauthStatus === 'connected' && oauthService) {
      // Show prominent success banner and toast
      setOauthSuccessService(oauthService);
      showSuccessToast(`✅ ${oauthService.charAt(0).toUpperCase() + oauthService.slice(1)} connected successfully!`, 6000);
      
      // Clear OAuth params from URL via React Router to prevent re-triggering on re-renders
      navigate('/services', { replace: true });
      
      // Refetch services to reflect the newly connected service
      const timer = setTimeout(() => {
        console.log('[OAuth] Detected completed flow, refetching services...');
        fetchServices();
      }, 1500);
      return () => clearTimeout(timer);
    }
    
    if (oauthStatus === 'signup_required' || oauthStatus === 'confirm_login') {
      showInfoToast(`Completing ${oauthService} setup...`);
    }
  }, [masterToken, navigate, showSuccessToast, showInfoToast, currentWorkspace?.id]);


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

      // Map services and use the OAuth provider name to look up status
      setServices(allServices.map((svc) => {
        const oauthProviderName = getOAuthProvider(svc.name);
        const oauthStatus = oauthMap[oauthProviderName] || {
          status: svc.status,
          enabled: !svc.notConfigured,
          auth_type: svc.auth_type,
        };
        return normalizeService(svc, oauthStatus);
      }));
    } catch (err) {
      console.error('Failed to fetch services:', err);
      const message = 'Could not load services. Please refresh the page.';
      setError(message);
      showErrorToast(message);
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
    } catch {
      // Fallback to currently-loaded service data.
    }

    setSelectedServiceDetail(service);
  };

  const handleConnect = async (service) => {
    setConnectError(null);

    if (service.auth_type === 'api_key') {
      setServiceToConfig(service);
      setIsConfigModalOpen(true);
      return;
    }

    if (service.notConfigured) {
      setConnectError(
        `${service.label} is not configured on the server yet. Add required env keys shown in details to enable this integration.`
      );
      return;
    }

    setError(null);
    try {
      // Map service name to OAuth provider (e.g., "googleanalytics" -> "google")
      const oauthProvider = getOAuthProvider(service.name);
      
      console.log(`[Connect] Service: ${service.name}, OAuth Provider: ${oauthProvider}`);
      
      await startOAuthFlow(oauthProvider, { mode: 'connect', returnTo: '/dashboard/services' });
    } catch (err) {
      console.error('OAuth flow error:', err);
      const message = `Failed to connect ${service.label}. Please try again.`;
      setError(message);
      showErrorToast(message);
    }
  };

  const handleRevoke = async (service) => {
    setIsRevoking(true);
    setError(null);

    try {
      // Map service name to OAuth provider (e.g., "googleanalytics" -> "google")
      const oauthProvider = getOAuthProvider(service.name);
      
      console.log(`[Disconnect] Service: ${service.name}, OAuth Provider: ${oauthProvider}`);
      
      const response = await oauth.disconnect(oauthProvider);
      console.log(`[Disconnect] Response:`, response);
      
      closeRevokeModal();
      await fetchServices();
    } catch (err) {
      console.error('Failed to revoke service:', err);
      // Show error but allow user to close modal
      const errorMsg = err?.response?.data?.error || err?.message || 'Unknown error';
      const message = `Failed to disconnect: ${errorMsg}`;
      setError(message);
      showErrorToast(message);
      // Don't close modal on error - let user see the error and retry or close manually
    } finally {
      setIsRevoking(false);
    }
  };

  const handleConfigure = (service) => {
    setServiceToConfig(service);
    setIsConfigModalOpen(true);
  };

  const handleConfigSave = (preferences) => {
    console.log(`[Config] Saved preferences for ${serviceToConfig.name}:`, preferences);
    // Refresh services if needed
    fetchServices();
  };

  const filteredServices = useMemo(() => {
    return services.filter((s) => {

      const text = `${s.label} ${s.description || ''} ${s.category_label || s.category || ''}`.toLowerCase();
      const matchesSearch = !searchQuery || text.includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all'
        || (selectedStatus === 'connected' && s.status === 'connected')
        || (selectedStatus === 'available' && s.status !== 'connected');

      return matchesSearch && matchesCategory && matchesStatus && s.label;
    });
  }, [services, searchQuery, selectedCategory, selectedStatus]);

  const summary = {
    total: services.length,
    connected: services.filter((s) => s.status === 'connected').length,
    available: services.filter((s) => s.status !== 'connected').length,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Services & Integrations</h1>
        <p className="mt-3 text-base text-slate-400">Discover, connect, and manage all your service integrations in one unified dashboard. Monitor connection status and handle authentication securely.</p>
      </div>

      {/* OAuth Success Banner */}
      {oauthSuccessService && (
        <div className="rounded-xl border border-emerald-500/50 bg-gradient-to-r from-emerald-900/40 to-emerald-800/20 backdrop-blur-sm p-5 flex items-center gap-4 shadow-lg shadow-emerald-900/20">
          <div className="flex-shrink-0">
            <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-emerald-200">
              {oauthSuccessService.charAt(0).toUpperCase() + oauthSuccessService.slice(1)} connected successfully!
            </p>
            <p className="text-sm text-emerald-400/80 mt-0.5">
              Your service is now active and ready to use. You can manage it below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOauthSuccessService(null)}
            className="flex-shrink-0 p-2 rounded-lg text-emerald-400/70 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryTile label="Total Services" value={summary.total} icon="📦" />
        <SummaryTile label="Connected" value={summary.connected} tone="emerald" icon="✓" />
        <SummaryTile label="Available" value={summary.available} tone="blue" icon="→" />
      </div>

      <section className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800/60 to-slate-800/30 backdrop-blur-sm p-6 space-y-5" aria-label="Service filters">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="search"
            placeholder="Search services, descriptions, or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-3 bg-slate-900/80 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
            aria-label="Search services"
          />
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedStatus('all');
            }}
            className="px-4 py-3 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500 font-medium transition-all duration-200"
          >
            Clear Filters
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-300">Filter by Status</p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'All Services' },
              { key: 'connected', label: 'Connected' },
              { key: 'available', label: 'Available' },
            ].map((status) => (
              <button
                key={status.key}
                type="button"
                onClick={() => setSelectedStatus(status.key)}
                className={`px-4 py-2.5 rounded-full text-sm font-medium border transition-all duration-200 ${
                  selectedStatus === status.key
                    ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                    : 'bg-slate-700/40 text-slate-300 border-slate-600 hover:bg-slate-700/60 hover:border-slate-500'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        {categories.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-slate-700">
            <p className="text-sm font-semibold text-slate-300">Filter by Category</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap font-medium transition-all duration-200 ${
                  selectedCategory === 'all' 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                    : 'bg-slate-700/40 text-slate-300 border border-slate-600 hover:bg-slate-700/60'
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap font-medium transition-all duration-200 ${
                    selectedCategory === cat.name 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                      : 'bg-slate-700/40 text-slate-300 border border-slate-600 hover:bg-slate-700/60'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-slate-400 font-medium" aria-live="polite">
            Showing <span className="text-white font-semibold">{filteredServices.length}</span> service{filteredServices.length !== 1 ? 's' : ''}
          </p>
        </div>
      </section>

      {connectError && <Alert tone="amber" message={connectError} onDismiss={() => setConnectError(null)} />}
      {error && !connectError && <Alert tone="red" message={error} onDismiss={() => setError(null)} />}

      {isLoading ? (
        <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800/40 to-slate-800/20 backdrop-blur-sm p-12 text-center" role="status" aria-live="polite">
          <div className="flex justify-center mb-4">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-blue-500" />
          </div>
          <p className="text-slate-400 font-medium">Loading your services…</p>
          <p className="text-sm text-slate-500 mt-2">This may take a moment</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-600 bg-gradient-to-br from-slate-800/20 to-slate-800/10 backdrop-blur-sm p-12 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-white font-semibold text-lg">No services match your filters.</p>
          <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">Try adjusting your search terms, clearing category filters, or changing the status filter to see more results.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.name}
                service={service}
                onConnect={handleConnect}
                onRevoke={() => openRevokeModal(service.name)}
                onDetails={openServiceDetails}
                onConfigure={handleConfigure}
              />
            ))}

            {/* Coming Soon Card */}
            <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/40 backdrop-blur-sm p-6 hover:border-slate-600/50 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col items-center justify-center min-h-[280px]">
              <div className="text-center space-y-4">
                <div className="text-5xl">🚀</div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">More Services Coming</h3>
                  <p className="text-sm text-slate-400 mt-2">Stay tuned for exciting new integrations</p>
                </div>
                <div className="pt-4 border-t border-slate-700/30">
                  <p className="text-xs text-slate-500">Have a service in mind?</p>
                  <a href="https://discord.gg/WPp4sCN4xB" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer mt-1 inline-block">Request it on Discord →</a>
                </div>
              </div>
            </div>
          </div>

          <section className="hidden xl:block rounded-2xl border border-slate-700 overflow-hidden bg-slate-800/40 backdrop-blur-sm shadow-lg">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700">
                <tr className="text-slate-200 text-left">
                  <th className="px-6 py-4 font-semibold">Service</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Auth Type</th>
                  <th className="px-6 py-4 font-semibold">API Endpoint</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((service, idx) => {
                  const statusMeta = getStatusMeta(service.status, service.notConfigured);
                  return (
                    <tr
                      key={`row-${service.name}`}
                      className={`border-t border-slate-700 hover:bg-slate-700/40 cursor-pointer transition-all duration-200 ${idx % 2 === 0 ? 'bg-slate-800/20' : 'bg-slate-800/10'}`}
                      onClick={() => openServiceDetails(service)}
                    >
                      <td className="px-6 py-4 text-white font-medium">{service.label}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${statusMeta.className}`}>
                          <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-300 uppercase text-xs font-mono tracking-wide">{service.auth_type_label || formatAuthTypeLabel(service.auth_type)}</td>
                      <td className="px-6 py-4 text-slate-400 font-mono text-xs break-all max-w-xs">{service.api_endpoint || '—'}</td>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">⚠️</div>
              <h2 className="text-2xl font-bold text-white mb-2">Disconnect Service?</h2>
            </div>
            <p className="text-slate-400 text-center mb-8">
              You're about to disconnect <span className="font-semibold text-red-300 capitalize">{revokeServiceId}</span>. Any integrations relying on this connection will stop working.
            </p>
            {error && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-700/50 rounded-lg">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={closeRevokeModal}
                disabled={isRevoking}
                className="flex-1 px-4 py-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {error ? 'Close' : 'Cancel'}
              </button>
              <button
                onClick={() => handleRevoke(services.find((s) => s.name === revokeServiceId))}
                disabled={isRevoking}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 shadow-lg shadow-red-600/20"
              >
                {isRevoking ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ServiceConfigModal
        isOpen={isConfigModalOpen}
        service={serviceToConfig}
        onClose={() => {
          setIsConfigModalOpen(false);
          setServiceToConfig(null);
        }}
        onSave={handleConfigSave}
      />

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryTile({ label, value, tone = 'slate', icon = '📊' }) {
  const tones = {
    slate: {
      bg: 'bg-gradient-to-br from-slate-700/50 to-slate-800/50',
      border: 'border-slate-700',
      text: 'text-slate-100',
      accent: 'text-slate-400'
    },
    emerald: {
      bg: 'bg-gradient-to-br from-emerald-900/40 to-emerald-950/20',
      border: 'border-emerald-700/50',
      text: 'text-emerald-100',
      accent: 'text-emerald-400/80'
    },
    blue: {
      bg: 'bg-gradient-to-br from-blue-900/40 to-blue-950/20',
      border: 'border-blue-700/50',
      text: 'text-blue-100',
      accent: 'text-blue-400/80'
    },
    amber: {
      bg: 'bg-gradient-to-br from-amber-900/40 to-amber-950/20',
      border: 'border-amber-700/50',
      text: 'text-amber-100',
      accent: 'text-amber-400/80'
    },
  };

  const tone_config = tones[tone] || tones.slate;

  return (
    <div className={`rounded-xl border ${tone_config.border} ${tone_config.bg} backdrop-blur-sm p-5 hover:border-slate-600 transition-all duration-200 shadow-sm hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className={`text-sm font-medium tracking-wide ${tone_config.accent}`}>{label}</p>
          <p className={`text-3xl font-bold mt-2 ${tone_config.text}`}>{value}</p>
        </div>
        <div className="text-3xl opacity-60 ml-3">{icon}</div>
      </div>
    </div>
  );
}

function Alert({ tone, message, onDismiss }) {
  const tones = {
    red: {
      bg: 'bg-gradient-to-r from-red-900/30 to-red-900/10',
      border: 'border-red-700/50',
      text: 'text-red-200',
      icon: '⚠️'
    },
    amber: {
      bg: 'bg-gradient-to-r from-amber-900/30 to-amber-900/10',
      border: 'border-amber-700/50',
      text: 'text-amber-200',
      icon: '⚡'
    },
  };

  const tone_config = tones[tone] || tones.red;

  return (
    <div className={`rounded-xl border ${tone_config.border} ${tone_config.bg} backdrop-blur-sm p-5 shadow-lg`} role="alert">
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">{tone_config.icon}</span>
        <p className={`text-sm flex-1 font-medium ${tone_config.text}`}>{message}</p>
        <button 
          onClick={onDismiss} 
          className="text-xl leading-none opacity-60 hover:opacity-100 transition-opacity flex-shrink-0" 
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default ServiceConnectors;
