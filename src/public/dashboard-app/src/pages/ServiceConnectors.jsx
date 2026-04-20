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
        || (selectedStatus === 'pending' && s.status === 'pending')
        || (selectedStatus === 'error' && s.status === 'error')
        || (selectedStatus === 'available' && s.status !== 'connected' && s.status !== 'pending' && s.status !== 'error');
      return matchesSearch && matchesCategory && matchesStatus && s.label;
    });
    // Sort: connected first, then by label
    return base.sort((a, b) => {
      if (a.status === 'connected' && b.status !== 'connected') return -1;
      if (b.status === 'connected' && a.status !== 'connected') return 1;
      return (a.label || '').localeCompare(b.label || '');
    });
  }, [services, searchQuery, selectedCategory, selectedStatus]);

  const connectedTotal = services.filter(s => s.status === 'connected').length;

  // Status tab definitions
  const statusTabs = [
    { key: 'all', label: 'All', count: services.length },
    { key: 'connected', label: 'Connected', count: services.filter(s => s.status === 'connected').length },
    { key: 'pending', label: 'Pending', count: services.filter(s => s.status === 'pending').length },
    { key: 'error', label: 'Needs attention', count: services.filter(s => s.status === 'error').length },
    { key: 'available', label: 'Available', count: services.filter(s => s.status !== 'connected' && s.status !== 'pending' && s.status !== 'error').length },
  ];

  // Status chip renderer
  const StatusChip = ({ status }) => {
    const map = {
      connected:    { color: 'var(--green)',   bg: 'var(--green-bg)',  label: 'connected' },
      pending:      { color: 'var(--amber)',    bg: 'color-mix(in srgb, var(--amber) 12%, transparent)', label: 'pending' },
      error:        { color: 'var(--accent)',   bg: 'var(--accent-bg)', label: 'needs attention' },
      disconnected: { color: 'var(--ink-3)',    bg: 'transparent',      label: 'not connected' },
    };
    const s = map[status] || map.disconnected;
    const isOutline = status === 'disconnected';
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        fontSize: '11px', fontWeight: 500, lineHeight: 1,
        padding: '3px 8px', borderRadius: '4px',
        color: s.color,
        background: isOutline ? 'transparent' : s.bg,
        border: `1px solid ${isOutline ? 'var(--line)' : s.bg === 'transparent' ? 'var(--line)' : s.color + '33'}`,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: s.color, flexShrink: 0,
        }} />
        {s.label}
      </span>
    );
  };

  // Exact reference ServiceGlyph: bg-raised square, border, colored mono letter
  const Glyph = ({ name, label }) => {
    const palette = ['#3F6FD8','#D84A4A','#2E8A5F','#C96A1F','#6E4AB0','#1F8DA8','#5A5A5A','#B0326E'];
    const hash = [...(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0);
    const color = palette[hash % palette.length];
    const letter = ((label || name || '?').charAt(0)).toUpperCase();
    return (
      <div className="shrink-0 grid place-items-center border hairline bg-raised"
        style={{ width: 36, height: 36, color }}>
        <span className="mono text-[11px] font-semibold" style={{ color }}>{letter}</span>
      </div>
    );
  };

  // Exact reference Chip: square corners, inline-flex, border
  const Chip = ({ tone = 'default', mono: isMono = false, children }) => {
    const toneMap = {
      default: { bg: 'var(--bg-sunk)',           color: 'var(--ink-2)',  border: 'var(--line)' },
      green:   { bg: 'var(--green-bg)',           color: 'var(--green)', border: 'rgba(63,185,80,0.4)' },
      amber:   { bg: 'rgba(210,153,34,0.16)',     color: 'var(--amber)', border: 'rgba(210,153,34,0.4)' },
      accent:  { bg: 'var(--accent-bg)',          color: 'var(--accent)',border: 'rgba(68,147,248,0.4)' },
      outline: { bg: 'transparent',              color: 'var(--ink-2)', border: 'var(--line)' },
    };
    const m = toneMap[tone] || toneMap.default;
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] border${isMono ? ' mono' : ''}`}
        style={{ background: m.bg, color: m.color, borderColor: m.border }}>
        {children}
      </span>
    );
  };

  // Exact reference StatusDot
  const StatusDot = ({ s }) => {
    const c = {
      connected: 'var(--green)', active: 'var(--green)',
      pending: 'var(--amber)', error: 'var(--red)', revoked: 'var(--red)',
      disconnected: 'var(--ink-4)',
    }[s] || 'var(--ink-4)';
    return <span className="tick" style={{ background: c }} />;
  };

  // Service card — exact match to reference ServiceCard
  const InlineServiceCard = ({ service }) => {
    const scopes = service.scopes || [];
    const isConnected = service.status === 'connected';
    const isError = service.status === 'error';
    const isPending = service.status === 'pending';
    const isNotConfigured = service.notConfigured;

    const statusMap = {
      connected:    { chip: 'green',   label: 'connected' },
      pending:      { chip: 'amber',   label: 'pending auth' },
      error:        { chip: 'accent',  label: 'needs attention' },
      disconnected: { chip: 'outline', label: 'not connected' },
    };
    const st = statusMap[service.status] || statusMap.disconnected;

    return (
      <div className="card p-5 flex flex-col">
        <div className="flex items-start gap-3">
          <Glyph name={service.name} label={service.label} />
          <div className="flex-1 min-w-0">
            <span className="ink text-[15px] font-medium">{service.label}</span>
            <div className="text-[11.5px] ink-3 mt-0.5">{service.category_label || service.category || 'Integration'}</div>
          </div>
          <Chip tone={st.chip}><StatusDot s={service.status} />{st.label}</Chip>
        </div>

        <div className="flex-1 mt-4">
          {scopes.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {scopes.slice(0, 4).map(sc => <Chip key={sc} tone="default" mono>{sc}</Chip>)}
              {scopes.length > 4 && <span className="ink-4 text-[10.5px] px-1">{scopes.length - 4}+</span>}
            </div>
          ) : null}
        </div>

        <div className="mt-4 pt-4 border-t hairline-2 flex items-center gap-3 text-[12px] ink-3">
          {isConnected ? (
            <>
              <span className="mono ink-2">{(service.callCount ?? service.calls ?? 0).toLocaleString()}</span>
              <span>calls · {service.connectedAt ? new Date(service.connectedAt).toLocaleDateString() : service.last_used || 'never'}</span>
              <button type="button" onClick={() => setConfigService(service)} className="ml-auto ink-2 hover:ink" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Manage →</button>
              <button type="button" onClick={() => openRevokeModal(service.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--red)' }}>Disconnect</button>
            </>
          ) : isError ? (
            <>
              <span className="accent">auth failed</span>
              <button type="button" onClick={() => handleConnect(service)} className="ml-auto btn btn-accent text-[12px] px-2 py-1">Reconnect</button>
            </>
          ) : isPending ? (
            <>
              <span className="ink-3">waiting for callback</span>
              <button type="button" className="ml-auto ink-2 hover:ink" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Copy OAuth URL</button>
            </>
          ) : (
            <>
              <span className="ink-3">{isNotConfigured ? 'Not configured' : 'OAuth 2.0 · scoped'}</span>
              <button type="button" onClick={() => handleConnect(service)} disabled={isNotConfigured} className="ml-auto btn text-[12px] px-2 py-1" style={{ opacity: isNotConfigured ? 0.45 : 1, cursor: isNotConfigured ? 'not-allowed' : 'pointer' }} title={isNotConfigured ? `${service.label} requires server-side configuration` : undefined}>Connect</button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">

      {/* Section head */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div className="micro" style={{ marginBottom: '8px' }}>GATEWAY · SERVICES</div>
          <h1 className="font-serif ink" style={{ fontSize: '28px', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0 }}>
            Connect once. Forward scoped.
          </h1>
          <p className="ink-2" style={{ marginTop: '8px', fontSize: '15px', maxWidth: '520px', lineHeight: 1.55 }}>
            Raw credentials stay encrypted in the vault. Agents never see them — they proxy through MyApi and receive only the scopes you grant.
          </p>
        </div>
        {connectedTotal > 0 && (
          <div style={{ paddingTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', fontWeight: 500,
              padding: '5px 10px', borderRadius: '4px',
              color: 'var(--green)', background: 'var(--green-bg)',
              border: '1px solid color-mix(in srgb, var(--green) 25%, transparent)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
              {connectedTotal} connected
            </span>
            <span className="ink-4" style={{ fontSize: '12px' }}>{services.length} total</span>
          </div>
        )}
      </div>

      {/* OAuth success banner */}
      {oauthSuccessService && (
        <div style={{
          border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)',
          background: 'var(--green-bg)', borderRadius: '6px',
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <svg style={{ width: 15, height: 15, color: 'var(--green)', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p style={{ fontSize: '13px', color: 'var(--green)', flex: 1 }}>
            <strong style={{ textTransform: 'capitalize' }}>{oauthSuccessService}</strong> connected successfully.
          </p>
          <button type="button" onClick={() => setOauthSuccessService(null)} aria-label="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', opacity: 0.5, padding: '2px' }}>
            <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Alerts */}
      {connectError && (
        <div style={{
          border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)',
          background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
          borderRadius: '6px', padding: '12px 16px',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
        }} role="alert">
          <svg style={{ width: 15, height: 15, color: 'var(--amber)', flexShrink: 0, marginTop: '1px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p style={{ fontSize: '13px', color: 'var(--amber)', flex: 1 }}>{connectError}</p>
          <button onClick={() => setConnectError(null)} aria-label="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber)', opacity: 0.5, padding: '2px' }}>
            <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
      {error && !connectError && (
        <div style={{
          border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
          background: 'var(--red-bg)', borderRadius: '6px',
          padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px',
        }} role="alert">
          <svg style={{ width: 15, height: 15, color: 'var(--red)', flexShrink: 0, marginTop: '1px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <p style={{ fontSize: '13px', color: 'var(--red)', flex: 1 }}>{error}</p>
          <button onClick={() => setError(null)} aria-label="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', opacity: 0.5, padding: '2px' }}>
            <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Tab bar + search */}
      <div>
        <div className="hairline" style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid var(--line)' }}>
          {statusTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedStatus(tab.key)}
              style={{
                padding: '8px 12px', fontSize: '13px', background: 'none', cursor: 'pointer',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                borderBottom: selectedStatus === tab.key ? '2px solid var(--ink)' : '2px solid transparent',
                marginBottom: '-1px',
                color: selectedStatus === tab.key ? 'var(--ink)' : 'var(--ink-3)',
                fontWeight: selectedStatus === tab.key ? 500 : 400,
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="mono ink-4" style={{ fontSize: '11px', marginLeft: '5px' }}>{tab.count}</span>
              )}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px' }}>
            <svg className="ink-4" style={{ width: 13, height: 13, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Filter…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ink-2"
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                width: '140px', fontSize: '12.5px', color: 'var(--ink-2)',
              }}
              aria-label="Search services"
            />
          </div>
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '12px' }}>
            <button type="button" onClick={() => setSelectedCategory('all')}
              style={{
                padding: '3px 10px', borderRadius: '3px', fontSize: '11px', fontWeight: 500,
                background: selectedCategory === 'all' ? 'var(--bg-hover)' : 'transparent',
                color: selectedCategory === 'all' ? 'var(--ink)' : 'var(--ink-3)',
                border: `1px solid ${selectedCategory === 'all' ? 'var(--line-2)' : 'var(--line)'}`,
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.15s',
              }}>
              All
            </button>
            {categories.map((cat) => (
              <button type="button" key={cat.name} onClick={() => setSelectedCategory(cat.name)}
                style={{
                  padding: '3px 10px', borderRadius: '3px', fontSize: '11px', fontWeight: 500,
                  background: selectedCategory === cat.name ? 'var(--bg-hover)' : 'transparent',
                  color: selectedCategory === cat.name ? 'var(--ink)' : 'var(--ink-3)',
                  border: `1px solid ${selectedCategory === cat.name ? 'var(--line-2)' : 'var(--line)'}`,
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.15s',
                }}>
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Service grid */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '64px 0' }} role="status" aria-live="polite">
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            border: '2px solid var(--line-2)', borderTopColor: 'var(--accent)',
            animation: 'spin 0.7s linear infinite',
          }} />
          <p className="ink-4" style={{ fontSize: '12px' }}>Loading services…</p>
        </div>

      ) : filteredServices.length === 0 ? (
        <div style={{
          border: '1px dashed var(--line)', borderRadius: '6px',
          padding: '56px 24px', textAlign: 'center',
        }}>
          <p className="ink-3" style={{ fontSize: '14px' }}>No services match your filters.</p>
          <button type="button"
            onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setSelectedStatus('all'); }}
            className="ink-2"
            style={{
              marginTop: '12px', fontSize: '12px', background: 'none',
              border: 'none', cursor: 'pointer', textDecoration: 'underline',
              textDecorationColor: 'var(--line-2)',
            }}>
            Clear filters
          </button>
        </div>

      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <InlineServiceCard key={service.name} service={service} />
          ))}
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
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px',
        }}>
          <div style={{
            background: 'var(--bg-raised)', border: '1px solid var(--line)',
            borderRadius: '8px', maxWidth: '360px', width: '100%', padding: '24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
            <h2 className="ink" style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 6px' }}>Disconnect service?</h2>
            <p className="ink-2" style={{ fontSize: '13px', margin: '0 0 20px', lineHeight: 1.55 }}>
              <strong className="ink" style={{ textTransform: 'capitalize' }}>{revokeServiceId}</strong> will be disconnected.
              Agents using this connection will lose access.
            </p>
            {error && (
              <div style={{
                marginBottom: '16px', padding: '10px 12px',
                background: 'var(--red-bg)', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
                borderRadius: '4px',
              }}>
                <p style={{ fontSize: '12px', color: 'var(--red)', margin: 0 }}>{error}</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={closeRevokeModal} disabled={isRevoking}
                className="ui-button"
                style={{ flex: 1, justifyContent: 'center', opacity: isRevoking ? 0.5 : 1 }}>
                {error ? 'Close' : 'Cancel'}
              </button>
              <button
                onClick={() => handleRevoke(services.find((s) => s.name === revokeServiceId))}
                disabled={isRevoking}
                className="ui-button-danger"
                style={{ flex: 1, justifyContent: 'center', opacity: isRevoking ? 0.5 : 1 }}>
                {isRevoking ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: '16px', right: '16px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 50 }}>
        {toasts.map((toast) => (
          <Toast key={toast.id} id={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </div>
  );
}

export default ServiceConnectors;
