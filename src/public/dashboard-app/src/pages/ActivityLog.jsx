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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const getMethodColor = (method) => {
    switch ((method || '').toUpperCase()) {
      case 'GET': return 'var(--ink-2)';
      case 'POST': return 'var(--accent)';
      case 'DELETE': return 'var(--ink)';
      case 'PUT': return 'var(--amber)';
      case 'PATCH': return 'var(--amber)';
      default: return 'var(--ink-3)';
    }
  };

  const getStatusColor = (statusCode) => {
    const code = Number(statusCode);
    if (code >= 200 && code < 300) return 'var(--ink-3)';
    if (code >= 400 && code < 500) return 'var(--amber)';
    if (code >= 500) return 'var(--red)';
    return 'var(--ink-4)';
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
        <div className="micro mb-2">ACCOUNT · ACTIVITY</div>
        <h1 className="font-serif text-[20px] sm:text-[28px] font-medium tracking-tight ink">Activity Log.</h1>
        <p className="ink-3 text-sm mt-1">
          View all token usage, skill executions, persona invocations, and other activities
        </p>
      </div>

      {/* Filters */}
      <div className="ui-card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div>
            <label className="micro block mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ui-input w-full"
            />
          </div>

          {/* Action Type */}
          <div>
            <label className="micro block mb-2">Action</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="ui-input w-full"
            >
              <option value="">All Actions</option>
              {actionTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Resource Type */}
          <div>
            <label className="micro block mb-2">Resource</label>
            <select
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
              className="ui-input w-full"
            >
              <option value="">All Resources</option>
              {resourceTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Result */}
          <div>
            <label className="micro block mb-2">Result</label>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="ui-input w-full"
            >
              <option value="">All Results</option>
              {results.map(res => (
                <option key={res} value={res}>{res}</option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="micro block mb-2">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="ui-input w-full"
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
        <div
          className="px-4 py-3 rounded text-sm"
          style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', color: 'var(--red)' }}
        >
          {error}
        </div>
      )}

      {/* Activity List */}
      <div>
        {loading && totalLoaded === 0 ? (
          <div className="text-center py-12">
            <div
              className="inline-block h-8 w-8 animate-spin rounded-full border-2"
              style={{ borderColor: 'var(--line)', borderTopColor: 'var(--accent)' }}
            />
            <p className="ink-3 mt-4 text-sm">Loading activity...</p>
          </div>
        ) : filteredActivity.length === 0 ? (
          <div
            className="text-center py-12 rounded"
            style={{ border: '1px solid var(--line)' }}
          >
            <p className="ink-3 text-sm">No activity found. Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <div className="rounded overflow-hidden" style={{ border: '1px solid var(--line)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sunk" style={{ borderBottom: '1px solid var(--line)' }}>
                    <th className="px-4 py-3 text-left micro">Action</th>
                    <th className="px-4 py-3 text-left micro hidden md:table-cell">Resource</th>
                    <th className="px-4 py-3 text-left micro hidden sm:table-cell">Actor</th>
                    <th className="px-4 py-3 text-left micro">Status</th>
                    <th className="px-4 py-3 text-left micro hidden lg:table-cell">Time</th>
                    <th className="px-4 py-3 text-left micro hidden lg:table-cell">IP</th>
                    <th className="px-4 py-3 text-left micro hidden xl:table-cell">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivity.map((item, index) => (
                    <tr key={`${item.id}-${index}`} className="row row-cell">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base flex-shrink-0">{getActionIcon(item.action)}</span>
                          <span
                            className="text-xs mono font-medium"
                            style={{ color: getMethodColor(item.method) }}
                          >
                            {item.action}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="text-xs ink-2">{item.resource || '—'}</span>
                      </td>

                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <span className="text-xs ink-3">
                          {item.actorType}{item.actor ? ` (${item.actor})` : ''}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className="text-xs mono font-semibold"
                          style={{ color: getStatusColor(item.statusCode) }}
                        >
                          {item.statusCode || 'N/A'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <span className="text-xs ink-4">{formatDate(item.timestamp)}</span>
                      </td>

                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        {item.ip && <code className="text-xs mono ink-3">{item.ip}</code>}
                      </td>

                      <td className="px-4 py-3.5 hidden xl:table-cell">
                        {item.details && (
                          <details>
                            <summary className="text-xs accent cursor-pointer hover:opacity-80">
                              Show details
                            </summary>
                            <pre
                              className="mt-2 p-2 rounded text-xs overflow-auto ink-2"
                              style={{ background: 'var(--bg-sunk)', maxWidth: '260px' }}
                            >
                              {typeof item.details === 'string'
                                ? item.details
                                : JSON.stringify(item.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="text-center pt-4">
                <button
                  onClick={() => fetchActivityLog(false)}
                  disabled={loading}
                  className="ui-button-primary px-4 py-2 text-sm disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}

            {!hasMore && activity.length > 0 && (
              <p className="text-center ink-3 text-sm py-4">
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
