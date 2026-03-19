import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';

function NotificationDropdown({ open, onClose }) {
  const masterToken = useAuthStore((state) => state.masterToken);
  const dropdownRef = useRef(null);
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

  const [filter, setFilter] = useState('all');
  const [displayNotifications, setDisplayNotifications] = useState([]);

  useEffect(() => {
    if (open && masterToken) {
      fetchNotifications(masterToken, 50, 0);
    }
  }, [open, masterToken, fetchNotifications]);

  useEffect(() => {
    if (filter === 'all') {
      setDisplayNotifications(notifications);
    } else if (filter === 'unread') {
      setDisplayNotifications(notifications.filter((n) => !n.read_at));
    } else {
      setDisplayNotifications(notifications.filter((n) => n.type === filter));
    }
  }, [notifications, filter]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, onClose]);

  const handleMarkAsRead = (notificationId) => {
    markAsRead(masterToken, notificationId);
  };

  const handleDelete = (notificationId) => {
    deleteNotification(masterToken, notificationId);
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
      service_disconnected: '🔌',
      error: '⚠️',
    };
    return icons[type] || '📢';
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!open) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute top-12 max-h-96 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col z-50"
      style={{
        right: '-320px',
        width: '384px',
        maxWidth: 'calc(100vw - 32px)',
        minWidth: '280px',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900 rounded-t-xl">
        <h3 className="text-sm font-semibold text-white">Notifications</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Filter tabs */}
      <div className="px-4 py-2 border-b border-slate-800 flex gap-2 overflow-x-auto bg-slate-900">
        {['all', 'unread', 'device_approval_requested', 'service_connected', 'error'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-1 text-xs rounded font-medium whitespace-nowrap transition-all ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="overflow-y-auto flex-1">
        {isLoading && !notifications.length ? (
          <div className="px-4 py-8 text-center text-slate-500">
            <p className="text-sm">Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-red-400">
            <p className="text-sm">{error}</p>
          </div>
        ) : displayNotifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-500">
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {displayNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`px-4 py-3 hover:bg-slate-800 transition-colors ${
                  !notification.read_at ? 'bg-slate-800/50' : ''
                }`}
              >
                <div className="flex gap-3">
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {notification.title || notification.type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatTime(notification.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {!notification.read_at && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                        title="Mark as read"
                      >
                        ✓
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(notification.id)}
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {displayNotifications.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-900 rounded-b-xl">
          <button
            onClick={() => {
              // Mark all as read
              displayNotifications.forEach((n) => {
                if (!n.read_at) {
                  markAsRead(masterToken, n.id);
                }
              });
            }}
            className="w-full px-3 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            Mark all as read
          </button>
        </div>
      )}
    </div>
  );
}

export default NotificationDropdown;
