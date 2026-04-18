import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useServicesStore } from '../stores/servicesStore';
import ServiceCard from '../components/ServiceCard';
import ServiceConfigModal from '../components/ServiceConfigModal';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { startOAuthFlow } from '../utils/oauth';
import { oauth } from '../utils/apiClient';
import { normalizeService } from '../utils/serviceCatalog';
import { getOAuthProvider } from '../utils/oauthProviderMap';

function ServiceConnectors() {
  const navigate = useNavigate();
  const masterToken = useAuthStore((state) => state.masterToken);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const {
    services, setServices, setIsLoading, isLoading, error, setError,
    openRevokeModal, closeRevokeModal, showRevokeModal, revokeServiceId,
  } = useServicesStore();

  const { toasts, removeToast, showSuccessToast, showErrorToast, showInfoToast } = useToast();

  const [isRevoking, setIsRevoking] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [categories, setCategories] = useState([]);
  const [oauthSuccessService, setOauthSuccessService] = useState(null);
  const [configService, setConfigService] = useState(null);

  useEffect(() => {
    fetchCategories();
    fetchServices();

    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get('oauth_status');
    const oauthService = params.get('oauth_service');

    if (oauthStatus === 'connected' && oauthService) {
      setOauthSuccessService(oauthService);
      showSuccessToast(`${oauthService.charAt(0).toUpperCase() + oauthService.slice(1)} connected successfully!`, 6000);
      navigate('/services', { replace: true });
      const timer = setTimeout(() => fetchServices(), 1500);
      return () => clearTimeout(timer);
    }
    if (oauthStatus === 'signup_required' || oauthStatus === 'confirm_login') {
      showInfoToast(`Completing ${oauthService} setup...`);
    }
  }, [masterToken, navigate, showSuccessToast, showInfoToast, currentWorkspace?.id]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/v1/services/categories');
      if (res.ok) { const d = await res.json(); setCategories(d.data || []); }
    } catch { /* silent */ }
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
      setServices(allServices.map((svc) => {
        const oauthProviderName = getOAuthProvider(svc.name);
        const oauthStatus = oauthMap[oauthProviderName] || {
          status: svc.status, enabled: !svc.notConfigured, auth_type: svc.auth_type,
        };
        return normalizeService(svc, oauthStatus);
      }));
    } catch {
      const message = 'Could not load services. Please refresh the page.';
      setError(message);
      showErrorToast(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (service) => {
    setConnectError(null);
    if (service.notConfigured) {
      setConnectError(`${service.label} is not configured on the server. Add the required environment keys to enable this integration.`);
      return;
    }
    try {
      const oauthProvider = getOAuthProvider(service.name);
      await startOAuthFlow(oauthProvider, { mode: 'connect', returnTo: '/dashboard/services' });
    } catch {
      const message = `Failed to connect ${service.label}. Please try again.`;
      setError(message);
      showErrorToast(message);
    }
  };

  const handleRevoke = async (service) => {
    setIsRevoking(true);
    setError(null);
    try {
      const oauthProvider = getOAuthProvider(service.name);
      await oauth.disconnect(oauthProvider);
      closeRevokeModal();
      await fetchServices();
    } catch (err) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Unknown error';
      setError(`Failed to disconnect: ${errorMsg}`);
      showErrorToast(`Failed to disconnect: ${errorMsg}`);
    } finally {
      setIsRevoking(false);
    }
  };

  const filteredServices = useMemo(() => {
    const base = services.filter((s) => {
      const text = `${s.label} ${s.description || ''} ${s.category_label || s.category || ''}`.toLowerCase();
      const matchesSearch = !searchQuery || text.includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all'
        || (selectedStatus === 'connected' && s.status === 'connected')
        || (selectedStatus === 'available' && s.status !== 'connected');
      return matchesSearch && matchesCategory && matchesStatus && s.label;
    });
    // Sort: connected first, then by label
    return base.sort((a, b) => {
      if (a.status === 'connected' && b.status !== 'connected') return -1;
      if (b.status === 'connected' && a.status !== 'connected') return 1;
      return (a.label || '').localeCompare(b.label || '');
    });
  }, [services, searchQuery, selectedCategory, selectedStatus]);

  const connectedServices = filteredServices.filter(s => s.status === 'connected');
  const availableServices = filteredServices.filter(s => s.status !== 'connected');
  const connectedTotal = services.filter(s => s.status === 'connected').length;
  const showSectionHeaders = connectedServices.length > 0 && availableServices.length > 0;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">Services & Integrations</h1>
          <p className="mt-1 text-sm text-slate-500 max-w-lg leading-relaxed">
            Connect your accounts once — tokens stored encrypted, usable by any agent.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-0.5">
          {connectedTotal > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {connectedTotal} connected
            </span>
          ) : null}
          <span className="text-xs text-slate-600">{services.length} services</span>
        </div>
      </div>

      {/* OAuth success banner */}
      {oauthSuccessService && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 flex items-center gap-3">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-300 flex-1">
            <span className="font-semibold capitalize">{oauthSuccessService}</span> connected successfully.
          </p>
          <button type="button" onClick={() => setOauthSuccessService(null)}
            className="text-emerald-500/40 hover:text-emerald-400 transition-colors" aria-label="Dismiss">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search services…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:border-slate-600 focus:outline-none transition-colors"
              aria-label="Search services"
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg shrink-0">
            {[
              { key: 'all', label: 'All' },
              { key: 'connected', label: 'Connected' },
              { key: 'available', label: 'Available' },
            ].map((s) => (
              <button key={s.key} type="button" onClick={() => setSelectedStatus(s.key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedStatus === s.key
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-500 hover:text-slate-300'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-wrap">
            <button type="button" onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-slate-700 text-slate-100 border-slate-600'
                  : 'text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300'
              }`}>
              All
            </button>
            {categories.map((cat) => (
              <button type="button" key={cat.name} onClick={() => setSelectedCategory(cat.name)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap ${
                  selectedCategory === cat.name
                    ? 'bg-slate-700 text-slate-100 border-slate-600'
                    : 'text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                }`}>
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Alerts */}
      {connectError && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3" role="alert">
          <svg className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-sm text-amber-300 flex-1">{connectError}</p>
          <button onClick={() => setConnectError(null)} className="text-amber-500/40 hover:text-amber-300 transition-colors" aria-label="Dismiss">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
      {error && !connectError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-start gap-3" role="alert">
          <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500/40 hover:text-red-300 transition-colors" aria-label="Dismiss">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Service list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
          <div className="flex flex-col items-center gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-slate-800 border-t-blue-500 animate-spin" />
            <p className="text-xs text-slate-600">Loading services…</p>
          </div>
        </div>

      ) : filteredServices.length === 0 ? (
        <div className="rounded-xl border border-slate-800 border-dashed py-14 text-center">
          <p className="text-sm text-slate-500">No services match your filters.</p>
          <button type="button"
            onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setSelectedStatus('all'); }}
            className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            Clear filters
          </button>
        </div>

      ) : (
        <div className="space-y-1.5">
          {/* Connected group */}
          {connectedServices.length > 0 && (
            <>
              {showSectionHeaders && (
                <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest px-1 pb-1">
                  Connected · {connectedServices.length}
                </p>
              )}
              {connectedServices.map((service) => (
                <ServiceCard
                  key={service.name}
                  service={service}
                  onConnect={handleConnect}
                  onRevoke={() => openRevokeModal(service.name)}
                  onConfigure={() => setConfigService(service)}
                />
              ))}
            </>
          )}

          {/* Spacer between groups */}
          {showSectionHeaders && <div className="pt-2" />}

          {/* Available group */}
          {availableServices.length > 0 && (
            <>
              {showSectionHeaders && (
                <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest px-1 pb-1">
                  Available · {availableServices.length}
                </p>
              )}
              {availableServices.map((service) => (
                <ServiceCard
                  key={service.name}
                  service={service}
                  onConnect={handleConnect}
                  onRevoke={() => openRevokeModal(service.name)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Service config modal */}
      <ServiceConfigModal
        isOpen={!!configService}
        service={configService}
        onClose={() => setConfigService(null)}
        onSave={() => setConfigService(null)}
      />

      {/* Disconnect confirm modal */}
      {showRevokeModal && revokeServiceId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-white mb-1">Disconnect service?</h2>
            <p className="text-sm text-slate-400 mb-5">
              <span className="font-semibold text-slate-200 capitalize">{revokeServiceId}</span> will be disconnected.
              Agents using this connection will lose access.
            </p>
            {error && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={closeRevokeModal} disabled={isRevoking}
                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-300 font-medium rounded-lg transition-colors disabled:opacity-50">
                {error ? 'Close' : 'Cancel'}
              </button>
              <button
                onClick={() => handleRevoke(services.find((s) => s.name === revokeServiceId))}
                disabled={isRevoking}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-sm text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
                {isRevoking ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <Toast key={toast.id} id={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </div>
  );
}

export default ServiceConnectors;
