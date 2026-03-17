import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AlertBanner from '../components/AlertBanner';
import { useAuthStore } from '../stores/authStore';

/**
 * Dashboard - Main dashboard with real-time alerts and key metrics
 * Features:
 * - Real-time alert banner with WebSocket support
 * - 4 key metric cards (Security Status, API Health, Connected Services, Recent Activity)
 * - Quick action buttons
 * - Responsive grid layout
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
      const response = await axios.get('/api/v1/dashboard/metrics', { headers });
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
              title: '⚠️ New Device Requesting Access',
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
              title: '🟡 Rate Limit Warning',
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
                title: `🟡 ${data.serviceName} Error`,
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
      await axios.post(`/api/v1/devices/approve/${deviceId}`, 
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Security Status */}
        <div className="rounded-md border border-slate-800 bg-slate-900 p-6 hover:border-slate-700 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                Security Status
              </h3>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-slate-100">
                  {metrics.approvedDevices}
                </span>
                <span className="text-sm text-slate-400">approved</span>
              </div>
            </div>
            <span className="text-2xl">🔒</span>
          </div>
          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Pending Approvals:</span>
              <span className={metrics.pendingApprovals > 0 ? 'text-yellow-400 font-semibold' : ''}>
                {metrics.pendingApprovals}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Last Activity:</span>
              <span className="text-slate-300">
                {metrics.lastActivityTime
                  ? new Date(metrics.lastActivityTime).toLocaleDateString()
                  : 'Never'}
              </span>
            </div>
          </div>
          <Link
            to="/device-management"
            className="mt-4 inline-block text-blue-400 hover:text-blue-300 text-xs font-medium"
          >
            Manage Devices →
          </Link>
        </div>

        {/* Card 2: API Health */}
        <div className="rounded-md border border-slate-800 bg-slate-900 p-6 hover:border-slate-700 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                API Health
              </h3>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-slate-100">
                  {metrics.apiUptime.toFixed(1)}%
                </span>
                <span className="text-sm text-slate-400">uptime</span>
              </div>
            </div>
            <span className="text-2xl">⚡</span>
          </div>
          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Active Tokens:</span>
              <span className="text-slate-300">{metrics.activeTokens}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={metrics.lastError ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'}>
                {metrics.lastError ? 'Error' : 'Operational'}
              </span>
            </div>
          </div>
          {metrics.lastError && (
            <p className="mt-2 text-xs text-red-400">
              Last error: {metrics.lastError.substring(0, 50)}...
            </p>
          )}
          <Link
            to="/settings"
            className="mt-4 inline-block text-blue-400 hover:text-blue-300 text-xs font-medium"
          >
            View Logs →
          </Link>
        </div>

        {/* Card 3: Connected Services */}
        <div className="rounded-md border border-slate-800 bg-slate-900 p-6 hover:border-slate-700 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                Connected Services
              </h3>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-slate-100">
                  {metrics.connectedServices}
                </span>
                <span className="text-sm text-slate-400">active</span>
              </div>
            </div>
            <span className="text-2xl">🔗</span>
          </div>
          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Total Services:</span>
              <span className="text-slate-300">{metrics.totalServices || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="text-green-400 font-semibold">Connected</span>
            </div>
          </div>
          <Link
            to="/services"
            className="mt-4 inline-block text-blue-400 hover:text-blue-300 text-xs font-medium"
          >
            Manage Services →
          </Link>
        </div>

        {/* Card 4: Recent Activity */}
        <div className="rounded-md border border-slate-800 bg-slate-900 p-6 hover:border-slate-700 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                Recent Activity
              </h3>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-slate-100">
                  {metrics.recentActivity?.length || 0}
                </span>
                <span className="text-sm text-slate-400">events</span>
              </div>
            </div>
            <span className="text-2xl">📊</span>
          </div>
          <div className="space-y-2 text-xs">
            {metrics.recentActivity && metrics.recentActivity.length > 0 ? (
              metrics.recentActivity.slice(0, 3).map((activity, idx) => (
                <div key={idx} className="text-slate-400 truncate">
                  • {activity.description}
                </div>
              ))
            ) : (
              <p className="text-slate-400">No recent activity</p>
            )}
          </div>
          <Link
            to="/settings"
            className="mt-4 inline-block text-blue-400 hover:text-blue-300 text-xs font-medium"
          >
            View All →
          </Link>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-100">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Approve Pending Devices */}
          <Link
            to="/device-management"
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-md p-4 transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="font-semibold text-slate-100 group-hover:text-slate-50">
                  Approve Pending Devices
                </h3>
                <p className="text-sm text-slate-400">
                  {metrics.pendingApprovals > 0
                    ? `${metrics.pendingApprovals} device(s) waiting`
                    : 'No pending devices'}
                </p>
              </div>
            </div>
          </Link>

          {/* Add Service */}
          <Link
            to="/services"
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-md p-4 transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">➕</span>
              <div>
                <h3 className="font-semibold text-slate-100 group-hover:text-slate-50">
                  Connect a Service
                </h3>
                <p className="text-sm text-slate-400">
                  Add OAuth or API integrations
                </p>
              </div>
            </div>
          </Link>

          {/* View Logs */}
          <Link
            to="/settings"
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-md p-4 transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <h3 className="font-semibold text-slate-100 group-hover:text-slate-50">
                  View Activity Logs
                </h3>
                <p className="text-sm text-slate-400">
                  Audit and debug records
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* System Status Footer */}
      <div className="mt-12 pt-8 border-t border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Documentation</h3>
            <p className="text-xs text-slate-400 mb-3">
              Learn how to use MyApi to connect services and build custom AI personas.
            </p>
            <Link
              to="/platform-docs"
              className="text-blue-400 hover:text-blue-300 text-xs font-medium"
            >
              Read Platform Docs →
            </Link>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">API Reference</h3>
            <p className="text-xs text-slate-400 mb-3">
              Integrate MyApi directly into your applications with our OpenAPI specs.
            </p>
            <Link
              to="/api-docs"
              className="text-blue-400 hover:text-blue-300 text-xs font-medium"
            >
              View API Docs →
            </Link>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Support</h3>
            <p className="text-xs text-slate-400 mb-3">
              Need help? Check our documentation or contact support.
            </p>
            <Link
              to="/platform-docs"
              className="text-blue-400 hover:text-blue-300 text-xs font-medium"
            >
              Get Help →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
