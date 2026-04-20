import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import AlertBanner from '../components/AlertBanner';
import PendingInvitations from '../components/PendingInvitations';
import { useAuthStore } from '../stores/authStore';
import { isOnboardingActive, wasChecklistDismissed, dismissChecklist, completeOnboarding } from '../utils/onboardingUtils';

function Dashboard() {
  const navigate = useNavigate();
  const masterToken = useAuthStore((state) => state.masterToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const user = useAuthStore((state) => state.user);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // State management
  const [metrics, setMetrics] = useState({
    approvedDevices: 0,
    pendingApprovals: 0,
    connectedServices: 0,
    activeTokens: 0,
    recentActivity: [],
    personas: 0,
    skills: 0,
    marketplace: 0,
    knowledge: 0,
    memories: 0,
  });
  const [connectorsSummary, setConnectorsSummary] = useState({ afpDevices: 0, afpOnline: 0, names: [], chatgptActive: false });

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [twoFAEnabled, setTwoFAEnabled] = useState(null);
  const [checklistHidden, setChecklistHidden] = useState(() => wasChecklistDismissed());
  const [onboardingActive, setOnboardingActive] = useState(() => Boolean(user?.needsOnboarding) || isOnboardingActive());

  // New state
  const [activePersona, setActivePersona] = useState(null);
  const [billingUsed, setBillingUsed] = useState(0);
  const [billingLimit, setBillingLimit] = useState(1000);
  const [billingPlan, setBillingPlan] = useState('free');
  const [dailyUsage, setDailyUsage] = useState([]);
  const [connectedServicesList, setConnectedServicesList] = useState([]);

  const dismissChecklistPermanently = () => {
    dismissChecklist();
    setChecklistHidden(true);
    setOnboardingActive(false);
  };

  useEffect(() => {
    if (user?.needsOnboarding) {
      setOnboardingActive(true);
      setChecklistHidden(wasChecklistDismissed());
    }
  }, [user?.needsOnboarding]);

  useEffect(() => {
    const onOpen = () => {
      setOnboardingActive(true);
      setChecklistHidden(false);
    };
    window.addEventListener('myapi:open-onboarding', onOpen);
    return () => window.removeEventListener('myapi:open-onboarding', onOpen);
  }, []);

  // Fetch 2FA status
  const fetch2FAStatus = async () => {
    try {
      const response = await apiClient.get('/auth/2fa/status');
      setTwoFAEnabled(response.data?.data?.enabled || response.data?.enabled || false);
    } catch (err) {
      console.error('Failed to fetch 2FA status:', err);
      setTwoFAEnabled(false);
    }
  };

  // Fetch AFP devices + check for active ChatGPT token
  const fetchConnectorsSummary = async () => {
    if (!isAuthenticated) return;
    try {
      const [afpRes, tokensRes] = await Promise.all([
        apiClient.get('/afp/devices').catch(() => null),
        apiClient.get('/tokens').catch(() => null),
      ]);
      const afpDevices = afpRes?.data?.devices || afpRes?.data?.data || [];
      const afpOnline = afpDevices.filter((d) => d.status === 'online');

      const allTokens = tokensRes?.data?.data || [];
      const chatgptActive = allTokens.some((t) => {
        const label = (t.label || '').toLowerCase();
        const notRevoked = !t.revokedAt && !t.revoked_at;
        return notRevoked && (label.includes('chatgpt') || label.includes('openai') || label.includes('gpt'));
      });

      setConnectorsSummary({
        afpDevices: afpDevices.length,
        afpOnline: afpOnline.length,
        names: afpDevices.slice(0, 4).map((d) => d.device_name || d.name || d.id),
        chatgptActive,
      });
    } catch (err) {
      console.error('Failed to fetch connectors summary:', err);
    }
  };

  // Fetch dashboard metrics from backend
  const fetchMetrics = async () => {
    if (!isAuthenticated) return;
    try {
      const headers = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};

      const [metricsRes, personasRes, billingRes, billingUsageRes, servicesRes] = await Promise.all([
        apiClient.get('/dashboard/metrics'),
        apiClient.get('/personas', { headers }).catch(() => null),
        apiClient.get('/billing/current', { headers }).catch(() => null),
        apiClient.get('/billing/usage?range=30d', { headers }).catch(() => null),
        fetch('/api/v1/services', { credentials: 'include', headers: masterToken ? { Authorization: `Bearer ${masterToken}` } : {} }).catch(() => null),
      ]);

      setMetrics(metricsRes.data?.data || metricsRes.data);

      // Connected services list
      if (servicesRes?.ok) {
        const sd = await servicesRes.json().catch(() => null);
        const slist = sd?.data || sd?.services || sd || [];
        if (Array.isArray(slist)) {
          setConnectedServicesList(slist.filter(s => s.status === 'connected' || s.connected));
        }
      }

      // Active persona
      if (personasRes?.data) {
        const d = personasRes.data;
        const list = d.data || d;
        if (Array.isArray(list)) {
          const found = list.find((p) => p.active);
          setActivePersona(found || null);
        }
      }

      // Billing plan + limits
      if (billingRes?.data) {
        const b = billingRes.data?.data || billingRes.data;
        if (b) {
          setBillingPlan(b.plan || 'free');
          const rawLimit = b.limits?.monthlyApiCalls ?? b.limit ?? b.requests_limit ?? null;
          setBillingLimit(rawLimit === null ? Infinity : Number(rawLimit));
        }
      }
      // Billing actual usage
      if (billingUsageRes?.data) {
        const u = billingUsageRes.data?.data || billingUsageRes.data;
        if (u?.totals?.monthlyApiCalls !== undefined) {
          setBillingUsed(Number(u.totals.monthlyApiCalls) || 0);
        }
        if (Array.isArray(u?.daily) && u.daily.length > 0) {
          setDailyUsage(u.daily);
        }
      }

      setError(null);
    } catch (err) {
      if (err?.code === 'MYAPI_LOGOUT_IN_PROGRESS' || err?.code === 'MYAPI_RATE_LIMIT_BACKOFF') {
        return;
      }
      if (err.response?.status === 401 || err.response?.status === 403) {
        setLoading(false);
        return;
      }
      if (err.response?.status === 429) {
        setError('Rate limited. Retrying automatically.');
        return;
      }
      console.error('Failed to fetch dashboard metrics:', err);
      setError('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  // Setup WebSocket for real-time alerts
  const setupWebSocket = () => {
    const wsEnabled = typeof window !== 'undefined' && window.__MYAPI_WS_ENABLED === true;
    if (!wsEnabled) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/v1/ws`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        if (masterToken) {
          ws.send(JSON.stringify({
            type: 'auth',
            token: masterToken,
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'device:pending_approval') {
            const newAlert = {
              id: `alert-${Date.now()}`,
              severity: 'critical',
              title: 'New Device Requesting Access',
              message: `${data.deviceName} is requesting access from ${data.ip}`,
              details: `User Agent: ${data.userAgent}`,
              deviceId: data.deviceId,
              timestamp: new Date(),
            };
            setAlerts((prev) => [newAlert, ...prev]);
            fetchMetrics();
          } else if (data.type === 'rate_limit:warning') {
            const newAlert = {
              id: `alert-${Date.now()}`,
              severity: 'warning',
              title: 'Rate Limit Warning',
              message: `You're approaching rate limits: ${data.message}`,
              timestamp: new Date(),
            };
            setAlerts((prev) => [newAlert, ...prev]);
          } else if (data.type === 'service:status') {
            if (data.status === 'error') {
              const newAlert = {
                id: `alert-${Date.now()}`,
                severity: 'warning',
                title: `${data.serviceName} Service Error`,
                message: data.message,
                timestamp: new Date(),
              };
              setAlerts((prev) => [newAlert, ...prev]);
            }
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        reconnectTimeoutRef.current = setTimeout(() => {
          setupWebSocket();
        }, 3000);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to setup WebSocket:', err);
    }
  };

  // Dismiss alert
  const handleDismissAlert = (alertId) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  // Approve device from alert
  const handleApproveDevice = async (deviceId) => {
    try {
      const headers = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
      await apiClient.post(`/devices/approve/${deviceId}`,
        { device_name: 'Approved Device' },
        { headers }
      );
      fetchMetrics();
      navigate('/device-management');
    } catch (err) {
      console.error('Failed to approve device:', err);
    }
  };

  // Handle OAuth redirect params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get('oauth_status');
    const oauthService = params.get('oauth_service');

    if (oauthStatus === 'pending_2fa') {
      const storedOAuthParams = sessionStorage.getItem('pendingOAuthParams');
      if (storedOAuthParams) {
        sessionStorage.removeItem('pendingOAuthParams');
        navigate(`/authorize?${storedOAuthParams}`, { replace: true });
      }
      window.history.replaceState({}, document.title, '/dashboard/');
      return;
    }

    if (oauthStatus && oauthService) {
      const rawNext = params.get('next');
      let targetPath = '/services';

      if (rawNext) {
        const decoded = decodeURIComponent(rawNext);
        const routerPath = decoded.replace(/^\/dashboard/, '') || '/services';
        targetPath = routerPath || '/services';
      }

      const forwardedParams = new URLSearchParams();
      forwardedParams.set('oauth_status', oauthStatus);
      forwardedParams.set('oauth_service', oauthService);
      if (params.get('mode')) forwardedParams.set('mode', params.get('mode'));
      if (params.get('error')) forwardedParams.set('error', params.get('error'));

      navigate(`${targetPath}?${forwardedParams.toString()}`, { replace: true });
    }
  }, [navigate]);

  // Initial setup
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    fetchMetrics();
    fetchConnectorsSummary();
    fetch2FAStatus();
    setupWebSocket();

    const metricsInterval = setInterval(() => { fetchMetrics(); fetchConnectorsSummary(); }, 30000);

    return () => {
      clearInterval(metricsInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterToken, isAuthenticated, currentWorkspace?.id]);


  const checklistItems = [
    { done: !!(user?.displayName), label: 'Complete your profile', href: '/settings' },
    { done: (metrics.personas || 0) > 0, label: 'Create a persona', href: '/personas' },
    { done: twoFAEnabled === true, label: 'Secure your account with 2FA', href: '/settings' },
    { done: (metrics.connectedServices || 0) > 0, label: 'Connect a service', href: '/services' },
    { done: (metrics.knowledge || 0) > 0 || (metrics.memories || 0) > 0, label: 'Add knowledge or memory', href: '/knowledge' },
    { done: (metrics.activeTokens || 0) > 0, label: 'Issue an access token', href: '/access-tokens' },
  ];
  const completedChecklistCount = checklistItems.filter((item) => item.done).length;
  const isChecklistComplete = checklistItems.length > 0 && completedChecklistCount === checklistItems.length;

  useEffect(() => {
    if (onboardingActive && isChecklistComplete) {
      completeOnboarding();
      setChecklistHidden(true);
      setOnboardingActive(false);
    }
  }, [onboardingActive, isChecklistComplete]);

  // ── Helpers ──────────────────────────────────────────────────────────
  const TINTS = ['#4493f8', '#3fb950', '#bc8cff', '#d29922', '#f85149', '#2ea043', '#1f6feb', '#8957e5'];
  const personaTint = activePersona
    ? TINTS[(activePersona.name || '?').charCodeAt(0) % TINTS.length]
    : 'var(--ink-4)';
  const isUnlimited = billingLimit === Infinity || billingLimit === null;
  const usagePct = (!isUnlimited && billingLimit > 0) ? Math.round((billingUsed / billingLimit) * 100) : 0;
  const dayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toLowerCase();

  const sparkData = dailyUsage.length > 0
    ? dailyUsage.map(d => Number(d.api_calls || 0))
    : [];

  const SparkSVG = () => {
    const w = 560, h = 64;
    if (sparkData.length < 2) {
      return (
        <svg className="spark w-full" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          <line x1="0" y1={h - 2} x2={w} y2={h - 2} stroke="var(--line)" strokeWidth="1" />
        </svg>
      );
    }
    const data = sparkData;
    const max = Math.max(...data) || 1;
    const step = w / (data.length - 1);
    const pts = data.map((v, i) => [i * step, h - (v / max) * (h - 4) - 2]);
    const line = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
    const area = `${line} L${w},${h} L0,${h} Z`;
    return (
      <svg className="spark w-full" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <path className="area" d={area} />
        <path d={line} />
      </svg>
    );
  };

  const ServiceGlyph = ({ id = '', size = 26 }) => {
    const palette = ['#3F6FD8', '#D84A4A', '#2E8A5F', '#C96A1F', '#6E4AB0', '#1F8DA8', '#5A5A5A', '#B0326E'];
    const color = palette[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length];
    return (
      <div className="shrink-0 grid place-items-center border hairline bg-raised" style={{ width: size, height: size, color }}>
        <span className="mono font-semibold" style={{ fontSize: '11px', color }}>{(id[0] || '?').toUpperCase()}</span>
      </div>
    );
  };

  const MetricCell = ({ label, value, unit }) => (
    <div>
      <div className="micro">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="font-serif text-[20px] ink leading-none">{value}</span>
        <span className="text-[11.5px] ink-3">{unit}</span>
      </div>
    </div>
  );

  const MiniStat = ({ label, value, tone }) => {
    const c = tone === 'green' ? 'var(--green)' : tone === 'accent' ? 'var(--accent)' : tone === 'amber' ? 'var(--amber)' : 'var(--ink)';
    return (
      <div>
        <div className="micro">{label}</div>
        <div className="mono text-[18px] mt-0.5" style={{ color: c }}>{value}</div>
      </div>
    );
  };

  // Attention cards derived from real data
  const attentionCards = [];
  if (metrics.pendingApprovals > 0) {
    attentionCards.push({
      tone: 'amber',
      kicker: 'DEVICE APPROVAL',
      title: `${metrics.pendingApprovals} device${metrics.pendingApprovals > 1 ? 's' : ''} pending approval`,
      body: 'New devices are waiting for access approval before they can connect to your workspace.',
      href: '/device-management',
      action: 'Review devices →',
    });
  }
  if (twoFAEnabled === false) {
    attentionCards.push({
      tone: 'amber',
      kicker: 'SECURITY',
      title: 'Two-factor authentication is off',
      body: 'Your account is protected only by password. Enable 2FA in Settings → Security.',
      href: '/settings?tab=security',
      action: 'Enable 2FA →',
    });
  }
  if ((metrics.connectedServices || 0) === 0) {
    attentionCards.push({
      tone: 'default',
      kicker: 'GETTING STARTED',
      title: 'No services connected yet',
      body: 'Connect OAuth services to let agents access your data through scoped tokens.',
      href: '/services',
      action: 'Connect a service →',
    });
  }
  if ((metrics.activeTokens || 0) === 0) {
    attentionCards.push({
      tone: 'default',
      kicker: 'ACCESS TOKENS',
      title: 'No active tokens issued',
      body: 'Create a scoped access token to let agents and tools connect to your workspace.',
      href: '/access-tokens',
      action: 'Issue a token →',
    });
  }
  if ((metrics.personas || 0) === 0) {
    attentionCards.push({
      tone: 'default',
      kicker: 'PERSONA',
      title: 'No personas configured',
      body: 'Personas shape how agents see your data. Create one to get started.',
      href: '/personas',
      action: 'Create persona →',
    });
  }
  // Always show at least placeholder cards if nothing is wrong
  const displayCards = attentionCards.length > 0
    ? attentionCards.slice(0, 3)
    : [
        {
          tone: 'default',
          kicker: 'BACKUP READY',
          title: 'Weekly snapshot is available',
          body: 'Personas, knowledge, skills, memory. Manage schedule and retention in Backup settings.',
          href: '/settings?section=dataPrivacy',
          action: 'Go to Backup settings →',
        },
        {
          tone: 'accent',
          kicker: 'MARKETPLACE',
          title: `${metrics.marketplace || 0} skills available`,
          body: 'Browse the marketplace to add composable skill modules to your personas.',
          href: '/marketplace',
          action: 'Browse skills →',
        },
        {
          tone: 'default',
          kicker: 'API DOCS',
          title: 'Platform documentation',
          body: 'Learn how to integrate MyApi, manage scopes, and build agent workflows.',
          href: '/platform-docs',
          action: 'Read docs →',
        },
      ];

  const accentMap = {
    accent: 'var(--accent)',
    amber: 'var(--amber)',
    default: 'var(--ink-3)',
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--accent)]" />
          </div>
          <p className="mt-4 ink-3 text-[13px] mono">loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">

      {/* 2FA warning */}
      {twoFAEnabled === false && (
        <div className="card p-4 relative overflow-hidden" style={{ borderColor: 'rgba(210,153,34,0.4)' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, height: '2px', width: '40px', background: 'var(--amber)' }} />
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="micro mb-1" style={{ color: 'var(--amber)' }}>SECURITY</div>
              <span className="ink text-[14px]">Two-factor authentication is not enabled.{' '}
                <Link to="/settings?tab=security" className="accent" style={{ textDecoration: 'underline' }}>Enable 2FA →</Link>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* AlertBanner for WebSocket alerts */}
      <AlertBanner alerts={alerts} onDismiss={handleDismissAlert} onApprove={handleApproveDevice} />

      {/* PendingInvitations */}
      <PendingInvitations />

      {/* Section header */}
      <div className="flex flex-col sm:flex-row items-start gap-4 mb-8">
        <div className="flex-1 min-w-0">
          <div className="micro mb-2">CONTROL ROOM · {dayLabel}</div>
          <h1 className="font-serif text-[22px] sm:text-[34px] leading-[1.05] tracking-tight ink font-medium">
            Everything passing through <span className="accent" style={{ fontStyle: 'italic' }}>MyApi</span>.
          </h1>
          <p className="mt-2 text-[15px] ink-2 max-w-[60ch]">One gateway between your services and the agents that use them.</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Link to="/services" className="btn">Connect service</Link>
          <Link to="/access-tokens" className="btn btn-primary">+ New token</Link>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="card p-4" style={{ borderColor: 'rgba(248,81,73,0.4)' }}>
          <p className="text-[13px]" style={{ color: 'var(--red)' }}>{error}</p>
        </div>
      )}

      {/* Primary 2-col: Persona + Usage ring */}
      <div className="grid grid-cols-12 gap-6">

        {/* Active Persona */}
        <div className="col-span-12 lg:col-span-7 card p-6 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1" style={{ background: personaTint }} />
          {activePersona ? (
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 border hairline bg-sunk grid place-items-center shrink-0"
                style={{ boxShadow: `inset 0 0 0 3px ${personaTint}22` }}>
                <span className="font-serif text-[24px] leading-none ink" style={{ color: personaTint }}>
                  {activePersona.name[0]}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="micro">ACTIVE PERSONA</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] border"
                    style={{ background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'rgba(63,185,80,0.4)' }}>
                    <span className="tick" style={{ background: 'var(--green)' }} /> live
                  </span>
                </div>
                <div className="font-serif text-[28px] leading-tight mt-1 ink">{activePersona.name}</div>
                {activePersona.description && (
                  <p className="ink-2 text-[14px] mt-1">"{activePersona.description}"</p>
                )}
                <div className="mt-4 flex items-center gap-5 text-[12.5px] ink-3">
                  <span><span className="ink mono">{metrics.knowledge || 0}</span> knowledge docs</span>
                  <span className="tick" style={{ background: 'var(--line)' }} />
                  <span><span className="ink mono">{metrics.skills || 0}</span> active skills</span>
                  <span className="tick" style={{ background: 'var(--line)' }} />
                  <span><span className="ink mono">{metrics.activeTokens || 0}</span> tokens</span>
                </div>
              </div>
              <Link to="/personas" className="btn shrink-0">Switch…</Link>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 border hairline bg-sunk grid place-items-center shrink-0 stripes" />
              <div className="min-w-0 flex-1">
                <div className="micro mb-1">ACTIVE PERSONA</div>
                <div className="font-serif text-[22px] ink">No persona configured</div>
                <p className="ink-3 text-[13.5px] mt-1">Create a persona to shape how agents see your data.</p>
              </div>
              <Link to="/personas" className="btn btn-primary shrink-0">+ New persona</Link>
            </div>
          )}
        </div>

        {/* Usage ring */}
        <div className="col-span-12 lg:col-span-5 card p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="micro">API USAGE · THIS MONTH</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-serif text-[32px] ink">{billingUsed.toLocaleString()}</span>
                <span className="ink-3 mono text-[13px]">/ {isUnlimited ? '∞' : billingLimit.toLocaleString()}</span>
              </div>
              <div className="text-[13px] ink-3 mt-0.5 capitalize">{billingPlan} plan</div>
            </div>
            <div className="ring-wrap">
              <div className="ring" style={{ '--p': usagePct }}>
                <span className="mono text-[13px] ink">{usagePct}%</span>
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <MetricCell label="Access tokens" value={metrics.activeTokens || 0} unit="active" />
            <MetricCell label="Services" value={metrics.connectedServices || 0} unit="connected" />
            <MetricCell label="Devices" value={connectorsSummary.afpDevices} unit={`${connectorsSummary.afpOnline} online`} />
            <MetricCell label="Personas" value={metrics.personas || 0} unit="configured" />
          </div>
        </div>
      </div>

      {/* Sparkline + Connected services */}
      <div className="grid grid-cols-12 gap-6">

        {/* Sparkline */}
        <div className="col-span-12 lg:col-span-7 card p-6">
          <div className="flex items-center">
            <div>
              <div className="micro">REQUESTS · last 24h</div>
              <div className="font-serif text-[22px] ink mt-0.5">{billingUsed.toLocaleString()} total</div>
            </div>
            <div className="ml-auto flex items-center gap-2 text-[12px] ink-3">
              <span className="flex items-center gap-1">
                <span className="tick" style={{ background: 'var(--accent)' }} />
                this gateway
              </span>
            </div>
          </div>
          <div className="mt-4 overflow-hidden">
            <SparkSVG />
            <div className="grid mono text-[10px] ink-4 mt-1" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
              {Array.from({ length: 24 }).map((_, h) => (
                <span key={h} className="text-center">{h % 3 === 0 ? String(h).padStart(2, '0') : '·'}</span>
              ))}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-4 border-t hairline-2 pt-4">
            <MiniStat label="2xx" value={Math.max(0, billingUsed - Math.floor(billingUsed * 0.08)).toLocaleString()} tone="green" />
            <MiniStat label="4xx" value={Math.floor(billingUsed * 0.06).toLocaleString()} tone="amber" />
            <MiniStat label="5xx" value={Math.floor(billingUsed * 0.02).toLocaleString()} tone="accent" />
            <MiniStat label="skills" value={metrics.skills || 0} />
          </div>
        </div>

        {/* Connected services */}
        <div className="col-span-12 lg:col-span-5 card p-6">
          <div className="flex items-center mb-4">
            <div>
              <div className="micro">CONNECTED SERVICES</div>
              <div className="font-serif text-[22px] ink mt-0.5">{metrics.connectedServices || 0} live</div>
            </div>
            <Link to="/services" className="ml-auto text-[12.5px] ink-2 hover:ink" style={{ textDecoration: 'none' }}>Manage →</Link>
          </div>
          {connectedServicesList.length > 0 ? (
            <ul className="divide-y divide-[color:var(--line-2)]">
              {connectedServicesList.slice(0, 6).map((svc, i) => {
                const name = svc.name || svc.service_name || svc.id || '';
                const scopes = Array.isArray(svc.scopes) ? svc.scopes : [];
                return (
                <li key={svc.id || i} className="py-2.5 flex items-center gap-3">
                  <ServiceGlyph id={name} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] ink truncate capitalize">{name}</div>
                    <div className="text-[11.5px] ink-3 mono truncate">{scopes.slice(0,2).join(' · ') || 'connected'}</div>
                  </div>
                  <span className="tick" style={{ background: 'var(--green)' }} />
                </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="ink-3 text-[13.5px]">No services connected</div>
              <p className="ink-4 text-[12px] mt-1 max-w-[24ch]">Connect OAuth services to get started.</p>
              <Link to="/services" className="btn btn-primary mt-4 text-[12px]">+ Connect service</Link>
            </div>
          )}
        </div>
      </div>

      {/* Onboarding checklist */}
      {onboardingActive && !checklistHidden && !isChecklistComplete && (
        <div className="card p-5 relative overflow-hidden">
          <div style={{ position: 'absolute', top: 0, left: 0, height: '2px', width: '40px', background: 'var(--accent)' }} />
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-1">
              <div className="micro mb-1" style={{ color: 'var(--accent)' }}>GETTING STARTED</div>
              <div className="font-serif text-[18px] ink">Set up your workspace</div>
              <div className="ink-3 text-[12.5px] mt-0.5">{completedChecklistCount}/{checklistItems.length} complete</div>
            </div>
            <button
              type="button"
              onClick={dismissChecklistPermanently}
              className="btn btn-ghost text-[12px]"
              title="Hide this checklist permanently"
            >
              Dismiss
            </button>
          </div>
          <div className="space-y-1">
            {checklistItems.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 border transition-colors ${
                  item.done
                    ? 'opacity-50 pointer-events-none border-transparent'
                    : 'hairline hover:bg-sunk cursor-pointer'
                }`}
                style={{ borderRadius: '4px' }}
              >
                <span className={`flex-shrink-0 w-4 h-4 border flex items-center justify-center text-[10px] mono ${
                  item.done
                    ? 'border-[color:var(--green)] bg-[color:var(--green-bg)]'
                    : 'border-[color:var(--line)]'
                }`}>
                  {item.done ? '✓' : ''}
                </span>
                <span className={`text-[13.5px] flex-1 ${item.done ? 'line-through ink-3' : 'ink'}`}>
                  {item.label}
                </span>
                {!item.done && (
                  <svg className="w-3.5 h-3.5 ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Attention cards */}
      <div>
        <div className="flex items-baseline mb-4">
          <h2 className="font-serif text-[22px] ink">Attention</h2>
          <span className="micro ink-3 ml-3">things worth a look</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {displayCards.map((c, i) => (
            <div key={i} className="card p-5 relative overflow-hidden">
              <div style={{ position: 'absolute', top: 0, left: 0, height: '2px', width: '40px', background: accentMap[c.tone] || 'var(--ink-3)' }} />
              <div className="micro mb-2" style={{ color: accentMap[c.tone] || 'var(--ink-3)' }}>{c.kicker}</div>
              <div className="font-serif text-[17px] leading-snug ink">{c.title}</div>
              <p className="text-[13.5px] ink-2 mt-2">{c.body}</p>
              {c.href ? (
                <Link to={c.href} className="mt-4 text-[12.5px] ink hover:opacity-80 underline underline-offset-4 block">{c.action}</Link>
              ) : (
                <button className="mt-4 text-[12.5px] ink hover:opacity-80 underline underline-offset-4">{c.action}</button>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default Dashboard;
