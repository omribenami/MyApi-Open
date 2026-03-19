import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';

function NotificationCenter() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    deleteNotification,
    addToast,
  } = useNotificationStore();

  const [filter, setFilter] = useState('all'); // all, unread, device, skill, token, service
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (masterToken) {
      fetchNotifications(masterToken, 50, 0);
    }
  }, [masterToken, fetchNotifications]);

  const handleMarkAsRead = (notificationId) => {
    markAsRead(masterToken, notificationId);
    addToast('Notification marked as read', 'success');
  };

  const handleDelete = (notificationId) => {
    deleteNotification(masterToken, notificationId);
    addToast('Notification deleted', 'success');
  };

  const handleLoadMore = () => {
    if (masterToken) {
      fetchNotifications(masterToken, 50, offset + 50);
      setOffset(prev => prev + 50);
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      device_approval_requested: '🔐',
      device_approved: '✅',
      device_revoked: '⛔',
      skill_liked: '❤️',
      skill_used: '▶️',
      persona_invoked: '🤖',
      guest_token_used: '👤',
      token_revoked: '⛔',
      service_connected: '🔗',
    };
    return icons[type] || '🔔';
  };

  const getNotificationColor = (type) => {
    const safeType = String(type || '');
    if (safeType.includes('approval')) return 'border-red-500/30 bg-red-500/5';
    if (safeType.includes('liked')) return 'border-pink-500/30 bg-pink-500/5';
    if (safeType.includes('revoked')) return 'border-red-500/30 bg-red-500/5';
    if (safeType.includes('connected')) return 'border-green-500/30 bg-green-500/5';
    return 'border-blue-500/30 bg-blue-500/5';
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read_at;
    return n.type?.includes(filter);
  });

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Notifications</h1>
        <p className="text-slate-400">
          Stay updated on device approvals, skill activity, and more
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { value: 'all', label: 'All' },
          { value: 'unread', label: `Unread (${unreadCount})` },
          { value: 'device', label: 'Device' },
          { value: 'skill', label: 'Skills' },
          { value: 'token', label: 'Tokens' },
          { value: 'service', label: 'Services' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded whitespace-nowrap text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-3">
        {isLoading && filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
            <p className="text-slate-400 mt-4">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/30 rounded-lg border border-slate-700/30">
            <p className="text-slate-400">No notifications</p>
          </div>
        ) : (
          <>
            {filteredNotifications.map(notification => (
              <div
                key={notification.id}
                className={`border rounded-lg p-4 transition-all ${
                  notification.read_at
                    ? 'border-slate-700/50 bg-slate-900/30'
                    : `${getNotificationColor(notification.type)}`
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-100">
                          {notification.title}
                        </h3>
                        <p className="text-sm text-slate-300 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                          {formatDate(notification.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {!notification.read_at && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
                        )}
                      </div>
                    </div>

                    {/* Notification Actions */}
                    <div className="flex gap-2 mt-3">
                      {notification.action_url && (
                        <a
                          href={notification.action_url}
                          className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          View
                        </a>
                      )}
                      {!notification.read_at && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="text-xs font-semibold text-slate-400 hover:text-slate-300 transition-colors"
                        >
                          Mark as read
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="text-xs font-semibold text-slate-400 hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && filteredNotifications.length > 0 && (
              <div className="text-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded text-sm font-semibold transition-colors"
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default NotificationCenter;
