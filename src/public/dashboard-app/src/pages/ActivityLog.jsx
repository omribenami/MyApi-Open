import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import apiClient from '../utils/apiClient';

function ActivityLog() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalLoaded, setTotalLoaded] = useState(0);
  
  // Filters
  const [actionType, setActionType] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [result, setResult] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('all');
  
  // Real-time updates via WebSocket
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const actionTypes = [
    'token_used', 'token_revoked', 'skill_executed', 'persona_invoked', 'guest_token_used',
    'device_approval_requested', 'device_approved', 'device_revoked', 'service_connected', 'skill_liked', 'persona_liked'
  ];

  const resourceTypes = [
    'token', 'skill', 'persona', 'device', 'service', 'guest_token'
  ];

  const results = ['success', 'failure', 'failed', 'pending'];

  // Get date filter
  const getDateFilter = () => {
    if (dateRange === 'all') return null;

    const now = new Date();
    const days = {
      '1day': 1,
      '7days': 7,
      '30days': 30,
      '60days': 60,
    };

    const daysAgo = days[dateRange] || 7;
    const afterDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return afterDate.toISOString();
  };

  // Fetch activity log
  const fetchActivityLog = async (isNewSearch = true) => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(50),
        offset: String(isNewSearch ? 0 : offset),
        ...(actionType && { action: actionType }),
        ...(resourceType && { resource: resourceType }),
      });

      const afterDate = getDateFilter();
      if (afterDate) {
        params.set('dateFrom', afterDate);
      }

      const response = await apiClient.get(`/audit/logs?${params.toString()}`);
      const payload = response?.data || {};
      const newActivityRaw = payload.data || [];
      const newActivity = Array.isArray(newActivityRaw) ? newActivityRaw : [];

      if (isNewSearch) {
        setActivity(newActivity);
        setOffset(50);
        setTotalLoaded(newActivity.length);
      } else {
        setActivity(prev => [...prev, ...newActivity]);
        setOffset(prev => prev + 50);
        setTotalLoaded(prev => prev + newActivity.length);
      }

      setHasMore(newActivity.length === 50);
    } catch (err) {
      console.error('Failed to fetch activity log:', err);
      setError('Failed to load activity log. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load and filter changes
  useEffect(() => {
    setOffset(0);
    setActivity([]);
    if (isAuthenticated) {
      fetchActivityLog(true);
    }
  }, [isAuthenticated, actionType, resourceType, result, dateRange, currentWorkspace?.id]);

  // WebSocket for real-time updates
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
        console.log('WebSocket connected for activity');
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
          
          if (data.type === 'activity:new') {
            // Add new activity to the top
            setActivity(prev => [data.activity, ...prev]);
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
        reconnectTimeoutRef.current = setTimeout(() => {
          setupWebSocket();
        }, 3000);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to setup WebSocket:', err);
    }
  };

  useEffect(() => {
    setupWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [masterToken]);

  // Filter activity by search query
  const filteredActivity = activity.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (item.resource || '').toLowerCase().includes(query) ||
      (item.action || '').toLowerCase().includes(query) ||
      (item.actor || '').toLowerCase().includes(query) ||
      (item.endpoint || '').toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getResultColor = (res) => {
    const colors = {
      success: 'text-green-400',
      failure: 'text-red-400',
      failed: 'text-red-400',
      pending: 'text-amber-400',
    };
    return colors[res] || 'text-slate-400';
  };

  const getActionIcon = (actionType) => {
    const icons = {
      token_used: '🔑',
      token_revoked: '🛑',
      skill_executed: '⚡',
      persona_invoked: '🤖',
      guest_token_used: '👤',
      device_approval_requested: '🆕',
      device_approved: '✅',
      device_revoked: '⛔',
      service_connected: '🔗',
      skill_liked: '❤️',
      persona_liked: '❤️',
    };
    return icons[actionType] || '📋';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Activity Log</h1>
        <p className="text-slate-400">
          View all token usage, skill executions, persona invocations, and other activities
        </p>
      </div>

      {/* Filters */}
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase">Search</label>
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Action Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase">Action</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Actions</option>
              {actionTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Resource Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase">Resource</label>
            <select
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Resources</option>
              {resourceTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Result */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase">Result</label>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Results</option>
              {results.map(res => (
                <option key={res} value={res}>{res}</option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All time</option>
              <option value="1day">Last 24 hours</option>
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
              <option value="60days">Last 60 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Activity List */}
      <div className="space-y-3">
        {loading && totalLoaded === 0 ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
            <p className="text-slate-400 mt-4">Loading activity...</p>
          </div>
        ) : filteredActivity.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/30 rounded-lg border border-slate-700/30">
            <p className="text-slate-400">No activity found. Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            {filteredActivity.map((item, index) => (
              <div key={`${item.id}-${index}`} className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600/50 transition-all">
                <div className="flex items-start gap-4">
                  <div className="text-2xl flex-shrink-0">
                    {getActionIcon(item.action)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-sm font-semibold text-slate-100">
                        {item.action}
                      </h3>
                      <span className={`text-xs font-bold ${getResultColor((item.statusCode || 0) < 400 ? 'success' : 'failed')}`}>
                        {item.statusCode || 'N/A'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-400">
                      <p><span className="text-slate-500">Resource:</span> {item.resource}</p>
                      <p><span className="text-slate-500">Actor:</span> {item.actorType} {item.actor ? `(${item.actor})` : ''}</p>
                      <p><span className="text-slate-500">Time:</span> {formatDate(item.timestamp)}</p>
                      {item.ip && <p><span className="text-slate-500">IP:</span> {item.ip}</p>}
                    </div>
                    
                    {item.details && (
                      <details className="mt-2">
                        <summary className="text-xs text-blue-400 cursor-pointer hover:text-blue-300">
                          Show details
                        </summary>
                        <pre className="mt-2 bg-slate-800 p-2 rounded text-xs overflow-auto text-slate-300">
                          {typeof item.details === 'string' 
                            ? item.details 
                            : JSON.stringify(item.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && (
              <div className="text-center pt-4">
                <button
                  onClick={() => fetchActivityLog(false)}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded text-sm font-semibold transition-colors"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}

            {!hasMore && activity.length > 0 && (
              <p className="text-center text-slate-400 text-sm py-4">
                Showing {totalLoaded} activities
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ActivityLog;
