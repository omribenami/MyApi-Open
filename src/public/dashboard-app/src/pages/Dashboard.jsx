import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import AlertBanner from '../components/AlertBanner';
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
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // State management
  const [metrics, setMetrics] = useState({
    approvedDevices: 0,
    pendingApprovals: 0,
    connectedServices: 0,
    apiUptime: 0,
    lastError: null,
    activeTokens: 0,
    recentActivity: [],
  });

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch dashboard metrics from backend
  const fetchMetrics = async () => {
    try {
      const headers = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
      const response = await apiClient.get('/api/v1/dashboard/metrics', { headers });
      setMetrics(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err);
      setError('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  // Setup WebSocket for real-time alerts
  const setupWebSocket = () => {
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
      await apiClient.post(`/api/v1/devices/approve/${deviceId}`, 
        { device_name: 'Approved Device' }, 
        { headers }
      );
      fetchMetrics();
      navigate('/device-management');
    } catch (err) {
      console.error('Failed to approve device:', err);
    }
  };

  // Initial setup
  useEffect(() => {
    fetchMetrics();
    setupWebSocket();

    // Refresh metrics every 30 seconds
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
  }, [masterToken]);

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

        {/* Card 2: API Health */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 backdrop-blur p-6 hover:border-slate-600/50 transition-all duration-200">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">
                API Health
              </h3>
            </div>
            <p className="text-2xl font-bold text-slate-100 tracking-tight">
              {metrics.apiUptime.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-400 mt-1">Uptime</p>
          </div>
          <div className="pt-4 border-t border-slate-700/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Active Tokens</span>
              <span className="text-sm font-semibold text-slate-200">{metrics.activeTokens}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Status</span>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                metrics.lastError 
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                  : 'bg-green-500/10 text-green-400 border border-green-500/20'
              }`}>
                <span className={`w-2 h-2 rounded-full ${metrics.lastError ? 'bg-red-400' : 'bg-green-400'}`}></span>
                {metrics.lastError ? 'Error' : 'Operational'}
              </span>
            </div>
          </div>
          <Link
            to="/settings"
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            View Logs
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Card 3: Connected Services */}
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
            to="/settings"
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            View All
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
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
            to="/settings"
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
              Need help? Check our documentation or contact our support team.
            </p>
            <Link
              to="/platform-docs"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
            >
              Get Support
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
