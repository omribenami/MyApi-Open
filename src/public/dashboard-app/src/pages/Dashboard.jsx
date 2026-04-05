import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import AlertBanner from '../components/AlertBanner';
import PendingInvitations from '../components/PendingInvitations';
import { useAuthStore } from '../stores/authStore';

/**
 * Dashboard - Professional enterprise-grade dashboard with real-time alerts
 * Features:
 * - Professional real-time alert system (WebSocket)
 * - 4 key metric cards with clear data hierarchy
 * - Quick action buttons
 * - Responsive grid layout
 * - Enterprise SaaS styling (AWS/Vercel/Stripe inspired)
 */
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
  });

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [twoFAEnabled, setTwoFAEnabled] = useState(null);

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

  // Fetch dashboard metrics from backend
  const fetchMetrics = async () => {
    if (!isAuthenticated) return;
    try {
      const response = await apiClient.get('/dashboard/metrics');
      setMetrics(response.data?.data || response.data);
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
        // Send authentication token if available
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
          
          // Handle device pending approval alert
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

            // Refresh metrics to update pending approvals count
            fetchMetrics();
          }
          // Handle rate limit warning
          else if (data.type === 'rate_limit:warning') {
            const newAlert = {
              id: `alert-${Date.now()}`,
              severity: 'warning',
              title: 'Rate Limit Warning',
              message: `You're approaching rate limits: ${data.message}`,
              timestamp: new Date(),
            };
            setAlerts((prev) => [newAlert, ...prev]);
          }
          // Handle service status
          else if (data.type === 'service:status') {
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

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        // Attempt reconnect after 3 seconds
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

  // Handle OAuth redirect params: forward to the intended target page (e.g. /services)
  // The OAuth callback always redirects to /dashboard/?oauth_status=...&next=...
  // but the ServiceConnectors page needs to receive those params to show the result.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get('oauth_status');
    const oauthService = params.get('oauth_service');

    // pending_2fa during an OAuth authorize flow — the Bearer token already authenticates
    // the user, so skip 2FA and redirect back to the authorize consent page if we have
    // the original OAuth params stored in sessionStorage.
    if (oauthStatus === 'pending_2fa') {
      const storedOAuthParams = sessionStorage.getItem('pendingOAuthParams');
      if (storedOAuthParams) {
        sessionStorage.removeItem('pendingOAuthParams');
        navigate(`/authorize?${storedOAuthParams}`, { replace: true });
      }
      // Clear the pending_2fa params from URL to avoid re-triggering
      window.history.replaceState({}, document.title, '/dashboard/');
      return;
    }

    if (oauthStatus && oauthService) {
      const rawNext = params.get('next');
      let targetPath = '/services'; // default

      if (rawNext) {
        const decoded = decodeURIComponent(rawNext);
        // Router basename is /dashboard, so strip that prefix
        const routerPath = decoded.replace(/^\/dashboard/, '') || '/services';
        targetPath = routerPath || '/services';
      }

      // Forward relevant OAuth params to the target page
      const forwardedParams = new URLSearchParams();
      forwardedParams.set('oauth_status', oauthStatus);
      forwardedParams.set('oauth_service', oauthService);
      if (params.get('mode')) forwardedParams.set('mode', params.get('mode'));
      if (params.get('error')) forwardedParams.set('error', params.get('error'));

      navigate(`${targetPath}?${forwardedParams.toString()}`, { replace: true });
    }
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial setup
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    fetchMetrics();
    fetch2FAStatus();
    setupWebSocket();

    const metricsInterval = setInterval(fetchMetrics, 30000);

    return () => {
      clearInterval(metricsInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [masterToken, isAuthenticated, currentWorkspace?.id]);

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
    <div className="space-y-6">
      {/* 2FA Warning Banner */}
      {twoFAEnabled === false && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex items-center gap-4">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-200">
              🔒 Two-Factor Authentication (2FA) is strongly recommended
            </p>
            <p className="text-xs text-amber-300 mt-1">
              Protect your account by enabling 2FA in Settings → Security. This adds an extra layer of protection against unauthorized access.
            </p>
          </div>
          <Link
            to="/settings?tab=security"
            className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 rounded transition-colors"
          >
            Enable 2FA
          </Link>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-100">
          Dashboard
        </h1>
        <p className="mt-1 text-slate-400 text-base">
          Monitor your API security and operational status
        </p>
      </div>

      {/* Real-time Alert Banner */}
      <AlertBanner
        alerts={alerts}
        onDismiss={handleDismissAlert}
        onApprove={handleApproveDevice}
      />

      {/* Pending Invitations */}
      <PendingInvitations />

      {/* Getting Started Checklist — shown for new users until all 4 items are done */}
      {user?.needsOnboarding && (
        <div className="rounded-lg border border-blue-700/40 bg-blue-950/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-blue-400 text-lg">🚀</span>
            <h3 className="text-white font-semibold text-sm">Getting started</h3>
            <span className="ml-auto text-xs text-slate-500">Complete these to unlock the full platform</span>
          </div>
          <div className="space-y-2">
            {[
              { done: !!(user?.displayName), label: 'Complete your profile', href: '/identity' },
              { done: (metrics.connectedServices || 0) > 0, label: 'Connect a service', href: '/services' },
              { done: (metrics.knowledge || 0) > 0, label: 'Add a memory or knowledge doc', href: '/memory' },
              { done: (metrics.personas || 0) > 0, label: 'Create a persona', href: '/personas' },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  item.done
                    ? 'opacity-50 pointer-events-none'
                    : 'hover:bg-blue-900/30 cursor-pointer'
                }`}
              >
                <span className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center text-xs ${
                  item.done ? 'bg-green-600 border-green-600 text-white' : 'border-slate-600 text-transparent'
                }`}>
                  {item.done ? '✓' : ''}
                </span>
                <span className={`text-sm ${item.done ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                  {item.label}
                </span>
                {!item.done && (
                  <svg className="ml-auto w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="rounded-md bg-red-950/50 border border-red-700 p-4">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Main Grid - 4 Key Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Security Status */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 backdrop-blur p-6 hover:border-slate-600/50 transition-all duration-200">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">
                Security
              </h3>
            </div>
            <p className="text-2xl font-bold text-slate-100 tracking-tight">
              {metrics.approvedDevices}
            </p>
            <p className="text-xs text-slate-400 mt-1">Approved Devices</p>
          </div>
          <div className="pt-4 border-t border-slate-700/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Pending Approvals</span>
              <span className={`text-sm font-semibold ${metrics.pendingApprovals > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                {metrics.pendingApprovals}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Last Activity</span>
              <span className="text-xs text-slate-300">
                {metrics.lastActivityTime
                  ? new Date(metrics.lastActivityTime).toLocaleDateString()
                  : 'None'}
              </span>
            </div>
          </div>
          <Link
            to="/device-management"
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            View Details
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Card 2: Connected Services */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 backdrop-blur p-6 hover:border-slate-600/50 transition-all duration-200">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">
                Services
              </h3>
            </div>
            <p className="text-2xl font-bold text-slate-100 tracking-tight">
              {metrics.connectedServices}
            </p>
            <p className="text-xs text-slate-400 mt-1">Connected</p>
          </div>
          <div className="pt-4 border-t border-slate-700/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Total Services</span>
              <span className="text-sm font-semibold text-slate-200">{metrics.totalServices || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Status</span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                Connected
              </span>
            </div>
          </div>
          <Link
            to="/services"
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            Manage Services
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Card 4: Recent Activity */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 backdrop-blur p-6 hover:border-slate-600/50 transition-all duration-200">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">
                Activity
              </h3>
            </div>
            <p className="text-2xl font-bold text-slate-100 tracking-tight">
              {metrics.recentActivity?.length || 0}
            </p>
            <p className="text-xs text-slate-400 mt-1">Recent Events</p>
          </div>
          <div className="pt-4 border-t border-slate-700/30">
            <div className="space-y-2">
              {metrics.recentActivity && metrics.recentActivity.length > 0 ? (
                metrics.recentActivity.slice(0, 2).map((activity, idx) => (
                  <p key={idx} className="text-xs text-slate-400 truncate">
                    {activity.description}
                  </p>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic">No recent activity</p>
              )}
            </div>
          </div>
          <Link
            to="/activity"
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            View All
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* AI & Data Section - Personas, Skills, Marketplace, Knowledge */}
      <div className="space-y-4 mt-12">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">AI & Data</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Personas Card */}
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 backdrop-blur p-6 hover:border-slate-600/50 transition-all duration-200">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Personas</h3>
              </div>
              <p className="text-2xl font-bold text-slate-100 tracking-tight">{metrics.personas || 0}</p>
              <p className="text-xs text-slate-400 mt-1">Active</p>
            </div>
            <div className="pt-4 border-t border-slate-700/30">
              <p className="text-xs text-slate-400 mb-3">AI agents and personas</p>
            </div>
            <Link
              to="/personas"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              Manage
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Skills Card */}
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 backdrop-blur p-6 hover:border-slate-600/50 transition-all duration-200">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Skills</h3>
              </div>
              <p className="text-2xl font-bold text-slate-100 tracking-tight">{metrics.skills || 0}</p>
              <p className="text-xs text-slate-400 mt-1">Available</p>
            </div>
            <div className="pt-4 border-t border-slate-700/30">
              <p className="text-xs text-slate-400 mb-3">Capabilities and tools</p>
            </div>
            <Link
              to="/skills"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              Browse
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Marketplace Card */}
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 backdrop-blur p-6 hover:border-slate-600/50 transition-all duration-200">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Marketplace</h3>
              </div>
              <p className="text-2xl font-bold text-slate-100 tracking-tight">{metrics.marketplace || 0}</p>
              <p className="text-xs text-slate-400 mt-1">Listings</p>
            </div>
            <div className="pt-4 border-t border-slate-700/30">
              <p className="text-xs text-slate-400 mb-3">Buy and sell skills</p>
            </div>
            <Link
              to="/marketplace"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              Explore
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Knowledge Base Card */}
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 backdrop-blur p-6 hover:border-slate-600/50 transition-all duration-200">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C6.5 6.253 2 10.998 2 17s4.5 10.747 10 10.747c5.5 0 10-4.998 10-10.747S17.5 6.253 12 6.253z" />
                  </svg>
                </div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Knowledge</h3>
              </div>
              <p className="text-2xl font-bold text-slate-100 tracking-tight">{metrics.knowledge || 0}</p>
              <p className="text-xs text-slate-400 mt-1">Documents</p>
            </div>
            <div className="pt-4 border-t border-slate-700/30">
              <p className="text-xs text-slate-400 mb-3">Context and data</p>
            </div>
            <Link
              to="/knowledge"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              View
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className="space-y-4 mt-8">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Approve Pending Devices */}
          <Link
            to="/device-management"
            className="group rounded-lg border border-slate-700/50 bg-slate-900/30 hover:bg-slate-800/50 hover:border-slate-600/50 p-4 transition-all duration-200"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/20 transition-colors">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-100 group-hover:text-slate-50 transition-colors">
                  Approve Devices
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {metrics.pendingApprovals > 0
                    ? `${metrics.pendingApprovals} waiting for approval`
                    : 'All devices approved'}
                </p>
              </div>
            </div>
          </Link>

          {/* Add Service */}
          <Link
            to="/services"
            className="group rounded-lg border border-slate-700/50 bg-slate-900/30 hover:bg-slate-800/50 hover:border-slate-600/50 p-4 transition-all duration-200"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/20 transition-colors">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-100 group-hover:text-slate-50 transition-colors">
                  Connect Service
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Add OAuth or API integrations
                </p>
              </div>
            </div>
          </Link>

          {/* View Logs */}
          <Link
            to="/activity"
            className="group rounded-lg border border-slate-700/50 bg-slate-900/30 hover:bg-slate-800/50 hover:border-slate-600/50 p-4 transition-all duration-200"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500/20 transition-colors">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-100 group-hover:text-slate-50 transition-colors">
                  View Logs
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Audit and debug activity records
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* System Status Footer */}
      <div className="mt-12 pt-8 border-t border-slate-800/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-3">Documentation</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Learn how to use MyApi to connect services and build custom AI personas.
            </p>
            <Link
              to="/platform-docs"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
            >
              Read Docs
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-3">API Reference</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Integrate MyApi directly into your applications with our OpenAPI specs.
            </p>
            <Link
              to="/api-docs"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
            >
              View API Docs
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-3">Support</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Need help? Join our Discord community for support and updates.
            </p>
            <a
              href="https://discord.gg/WPp4sCN4xB"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
            >
              Get Support
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
