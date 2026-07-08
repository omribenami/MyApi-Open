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
  // API-key connect modal (Composio toolkits that authenticate with a pasted key)
  const [apiKeyService, setApiKeyService] = useState(null);
  const [apiKeyValues, setApiKeyValues] = useState({});
  const [apiKeyError, setApiKeyError] = useState(null);
  const [apiKeySubmitting, setApiKeySubmitting] = useState(false);

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
        // Exact name first: Composio virtual services (composio__*) have their own
        // status entry and must not inherit the root composio connector's status —
        // an available-but-not-yet-connected toolkit would otherwise show as
        // "connected" just because some other toolkit is connected.
        const oauthStatus = oauthMap[svc.name] || (svc.byComposio ? null : oauthMap[oauthProviderName]) || {
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
    // API-key Composio toolkits (OpenAI, Anthropic, Perplexity, ...) and native
    // instance services (Home Assistant: URL + long-lived token) collect the
    // user's credentials in a modal instead of redirecting through OAuth.
    const isNativeInstance = !service.byComposio && service.auth_type === 'api_key' && (service.authFields || []).length > 0;
    if (isNativeInstance || (service.byComposio && (service.authMode === 'api_key' || service.auth_type === 'api_key'))) {
      setApiKeyService(service);
      setApiKeyValues({});
      setApiKeyError(null);
      return;
    }
    try {
      const oauthProvider = service.byComposio
        ? "composio"
        : getOAuthProvider(service.name);
      const toolkitOption = service.byComposio && service.connectToolkit
        ? { toolkit: service.connectToolkit }
        : {};
      await startOAuthFlow(oauthProvider, { mode: 'connect', returnTo: '/dashboard/services', ...toolkitOption });
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
      // Native instance services (Home Assistant) disconnect via their own endpoint.
      if (!service.byComposio && service.auth_type === 'api_key' && (service.authFields || []).length > 0) {
        const res = await fetch(`/api/v1/services/${service.name}/connect`, {
          method: 'DELETE',
          credentials: 'include',
          headers: masterToken ? { Authorization: `Bearer ${masterToken}` } : {},
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to disconnect');
        }
        closeRevokeModal();
        await fetchServices();
        return;
      }
      // For Composio services, disconnect the SPECIFIC toolkit — never route
      // through getOAuthProvider, which collapses every composio service to the
      // root "composio" id and would disconnect ALL of them.
      const target = service.byComposio
        ? (service.toolkitSlug || service.name)
        : getOAuthProvider(service.name);
      await oauth.disconnect(target);
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

  const submitApiKey = async () => {
    if (!apiKeyService) return;
    const toolkit = apiKeyService.toolkitSlug || apiKeyService.connectToolkit || apiKeyService.name;
    const fields = apiKeyService.authFields || [];
    // Client-side required check mirrors the backend.
    const missing = fields.find((f) => f.required && !String(apiKeyValues[f.name] || '').trim());
    if (missing) {
      setApiKeyError(`${missing.displayName || missing.name} is required.`);
      return;
    }
    setApiKeySubmitting(true);
    setApiKeyError(null);
    try {
      // Native instance services post to their own connect endpoint; Composio
      // toolkits go through the Composio key exchange.
      const isNative = !apiKeyService.byComposio;
      const res = await fetch(isNative ? `/api/v1/services/${apiKeyService.name}/connect` : '/api/v1/oauth/composio/connect-key', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {}) },
        body: JSON.stringify(isNative ? { fields: apiKeyValues } : { toolkit, fields: apiKeyValues }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to connect');
      setApiKeyService(null);
      setApiKeyValues({});
      showSuccessToast(`${apiKeyService.label} connected successfully!`, 6000);
      await fetchServices();
    } catch (err) {
      setApiKeyError(err.message || 'Failed to connect. Check your key and try again.');
    } finally {
      setApiKeySubmitting(false);
    }
  };

  // Category tabs use slugified keys ('developer-tools', 'business-crm') while
  // some services carry label-form categories ('Developer Tools') — normalize
  // both sides so every service matches its tab.
  const categoryKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const filteredServices = useMemo(() => {
    const base = services.filter((s) => {
      const text = `${s.label} ${s.description || ''} ${s.category_label || s.category || ''}`.toLowerCase();
      const matchesSearch = !searchQuery || text.includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || categoryKey(s.category) === categoryKey(selectedCategory);
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

  const CONFIGURABLE_SERVICES = new Set(['slack','facebook','instagram','twitter','tiktok','linkedin','reddit','discord','fal']);

  // Inline SVGs for brands where simpleicons only provides monochrome but the real logo is multicolor
  const _GOOGLE_SVG = (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
  const _INSTAGRAM_SVG = (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <defs><radialGradient id="ig-sc-grad" cx="30%" cy="107%" r="150%"><stop offset="0%" stopColor="#fdf497"/><stop offset="5%" stopColor="#fdf497"/><stop offset="45%" stopColor="#fd5949"/><stop offset="60%" stopColor="#d6249f"/><stop offset="90%" stopColor="#285AEB"/></radialGradient></defs>
      <path fill="url(#ig-sc-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  );
  const INLINE_OVERRIDES = {
    google: _GOOGLE_SVG, gmail: _GOOGLE_SVG, googledrive: _GOOGLE_SVG,
    googlesheets: _GOOGLE_SVG, googlecalendar: _GOOGLE_SVG, googlephotos: _GOOGLE_SVG,
    googlecontacts: _GOOGLE_SVG, googleanalytics: _GOOGLE_SVG, youtubedatapi: _GOOGLE_SVG,
    instagram: _INSTAGRAM_SVG,
  };

  const ServiceIcon = ({ service, isConnected }) => {
    const inlineSvg = INLINE_OVERRIDES[service.name?.toLowerCase()];
    const fallbacks = service.logoFallbacks || [];
    // service.icon carries the service's own brand logo when the backend provides
    // one (Composio services use logos.composio.dev) — prefer it over the generic
    // brand map so e.g. composio__gmail shows the Gmail logo, not the Google G.
    const [src, setSrc] = useState(service.icon || fallbacks[0] || null);
    const [imgFailed, setImgFailed] = useState(false);

    const handleError = () => {
      const allSrcs = [service.icon, ...fallbacks].filter(Boolean);
      const next = allSrcs.find(f => f !== src);
      if (next) { setSrc(next); } else { setImgFailed(true); }
    };

    const palette = ['#3F6FD8','#D84A4A','#2E8A5F','#C96A1F','#6E4AB0','#1F8DA8','#5A5A5A','#B0326E'];
    const hash = [...(service.name || '')].reduce((a, c) => a + c.charCodeAt(0), 0);
    const letterColor = palette[hash % palette.length];
    const letter = ((service.label || service.name || '?').charAt(0)).toUpperCase();

    return (
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 20, height: 20,
        color: isConnected ? '#22c55e' : 'var(--ink-2)',
        transition: 'color 0.2s',
      }}>
        {inlineSvg ? inlineSvg
          : src && !imgFailed ? (
            <img src={src} alt="" width={20} height={20}
              style={{ objectFit: 'contain', display: 'block' }}
              onError={handleError}
            />
          ) : (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: isConnected ? '#22c55e' : letterColor }}>
              {letter}
            </span>
          )}
      </span>
    );
  };

  const InlineServiceCard = ({ service }) => {
    const isConnected = service.status === 'connected' && !service.loginOnly;
    const isLoginOnly = service.status === 'connected' && !!service.loginOnly;
    const isError = service.status === 'error';
    const isPending = service.status === 'pending';
    const isNotConfigured = service.notConfigured;

    // Third row: same vertical space as the onboarding desc text line
    const btnBase = { fontSize: 11, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4 };
    const dot = <span style={{ color: 'var(--ink-4)', fontSize: 10, lineHeight: 1.4 }}>·</span>;

    let thirdRow;
    if (isConnected) {
      const hasConfig = CONFIGURABLE_SERVICES.has(service.name?.toLowerCase());
      thirdRow = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasConfig && <>
            <button type="button" onClick={() => setConfigService(service)} style={{ ...btnBase, color: 'rgba(34,197,94,0.75)' }}>Manage</button>
            {dot}
          </>}
          <button type="button" onClick={() => openRevokeModal(service.name)} style={{ ...btnBase, color: 'rgba(248,81,73,0.6)' }}>Disconnect</button>
        </div>
      );
    } else if (isLoginOnly) {
      thirdRow = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" onClick={() => handleConnect(service)} style={{ ...btnBase, color: 'var(--accent)' }}>Connect</button>
          {dot}
          <button type="button" onClick={() => openRevokeModal(service.name)} style={{ ...btnBase, color: 'rgba(248,81,73,0.6)' }}>Sign out</button>
        </div>
      );
    } else if (isError) {
      thirdRow = <button type="button" onClick={() => handleConnect(service)} style={{ ...btnBase, color: 'var(--accent)' }}>Reconnect</button>;
    } else if (isPending) {
      thirdRow = <span style={{ fontSize: 11, color: 'var(--amber)', lineHeight: 1.4 }}>Pending…</span>;
    } else {
      thirdRow = (
        <button type="button" onClick={() => !isNotConfigured && handleConnect(service)} disabled={isNotConfigured}
          style={{ ...btnBase, color: isNotConfigured ? 'var(--ink-4)' : 'var(--ink-3)', opacity: isNotConfigured ? 0.45 : 1, cursor: isNotConfigured ? 'not-allowed' : 'pointer' }}
          title={isNotConfigured ? 'Requires server-side configuration' : undefined}>
          Connect
        </button>
      );
    }

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: '16px 8px', borderRadius: 8, position: 'relative',
        background: isConnected ? 'rgba(34,197,94,0.08)' : isError ? 'rgba(248,81,73,0.05)' : 'var(--bg-sunk)',
        border: `1.5px solid ${isConnected ? '#22c55e' : isError ? 'rgba(248,81,73,0.35)' : 'var(--line)'}`,
        transition: 'all 0.2s',
      }}>
        {isConnected && (
          <span style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 999, background: '#22c55e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </span>
        )}
        {isError && (
          <span style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 999, background: 'var(--red)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>!</span>
        )}
        {isPending && (
          <span style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 999, background: 'var(--amber)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>·</span>
        )}

        <ServiceIcon service={service} isConnected={isConnected} />

        <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'center', lineHeight: 1.3, color: isConnected ? '#22c55e' : 'var(--ink)' }}>
          {service.label}
        </span>

        {thirdRow}
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
        <div className="hairline" data-tour="svc-tabs" style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid var(--line)' }}>
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
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '12px' }} data-tour="svc-categories">
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 155px))', gap: 8 }} data-tour="svc-grid">
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

      {/* API-key connect modal (OpenAI, Anthropic, Perplexity, ... via Composio) */}
      {apiKeyService && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px',
        }} onClick={() => !apiKeySubmitting && setApiKeyService(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--bg-raised)', border: '1px solid var(--line)',
            borderRadius: '8px', maxWidth: '440px', width: '100%', padding: '24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
            <h2 className="ink" style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 6px' }}>
              Connect {apiKeyService.label}
            </h2>
            <p className="ink-2" style={{ fontSize: '13px', margin: '0 0 18px', lineHeight: 1.55 }}>
              {apiKeyService.byComposio
                ? `Paste your ${apiKeyService.label} credentials. They are stored securely by Composio and never exposed to agents.`
                : `Enter your ${apiKeyService.label} details. Credentials are stored on your MyApi server and never exposed to agents — the gateway makes the calls on their behalf.`}
            </p>
            {(apiKeyService.authFields || []).map((field) => (
              <div key={field.name} style={{ marginBottom: '14px' }}>
                <label className="ink" style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '5px' }}>
                  {field.displayName || field.name}{field.required ? ' *' : ''}
                </label>
                <input
                  type={field.secret ? 'password' : 'text'}
                  autoComplete="off"
                  value={apiKeyValues[field.name] || ''}
                  onChange={(e) => setApiKeyValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  placeholder={field.secret ? '••••••••••••••••' : ''}
                  className="ui-input"
                  style={{ width: '100%', minHeight: '40px', boxSizing: 'border-box' }}
                />
                {field.description && (
                  <p className="ink-3" style={{ fontSize: '11px', margin: '5px 0 0', lineHeight: 1.45 }}>{field.description}</p>
                )}
              </div>
            ))}
            {apiKeyError && (
              <div style={{
                marginBottom: '16px', padding: '10px 12px',
                background: 'var(--red-bg)', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)', borderRadius: '4px',
              }}>
                <p style={{ fontSize: '12px', color: 'var(--red)', margin: 0 }}>{apiKeyError}</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={() => setApiKeyService(null)} disabled={apiKeySubmitting}
                className="ui-button"
                style={{ flex: 1, justifyContent: 'center', opacity: apiKeySubmitting ? 0.5 : 1 }}>
                Cancel
              </button>
              <button onClick={submitApiKey} disabled={apiKeySubmitting}
                className="ui-button-primary"
                style={{ flex: 1, justifyContent: 'center', opacity: apiKeySubmitting ? 0.5 : 1 }}>
                {apiKeySubmitting ? 'Connecting…' : 'Connect'}
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
