import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

export default function NotificationBell() {
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch unread count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await fetch('/api/v1/notifications/unread-count', { 
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        if (!res.ok) {
          console.warn(`Notification count fetch failed: ${res.status}`);
          return;
        }
        const data = await res.json();
        setUnreadCount(data?.data?.unreadCount || data?.unreadCount || 0);
      } catch (err) {
        console.error('Error fetching unread count:', err);
        setUnreadCount(0);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [currentWorkspace?.id]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/notifications?limit=10&offset=0', { 
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        if (!res.ok) {
          console.warn(`Notifications fetch failed: ${res.status}`);
          setNotifications([]);
          return;
        }
        const data = await res.json();
        const notificationsList = data?.data || data?.notifications || [];
        setNotifications(Array.isArray(notificationsList) ? notificationsList : []);
      } catch (err) {
        console.error('Error fetching notifications:', err);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [isOpen, currentWorkspace?.id]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await fetch(`/api/v1/notifications/${notificationId}/read`, {
        method: 'POST',
        credentials: 'include'
      });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await fetch(`/api/v1/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'oauth_connected': return '🔐';
      case 'skill_installed': return '⚙️';
      case 'team_invite': return '👥';
      case 'billing': return '💳';
      case 'security': return '🛡️';
      default: return '📢';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative inline-flex items-center justify-center w-10 h-10 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors"
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-slate-400">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">No notifications</div>
            ) : (
              <div className="divide-y divide-slate-700">
                {notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`p-3 hover:bg-slate-800/50 transition-colors ${
                      !notif.isRead ? 'bg-slate-800/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5">{getNotificationIcon(notif.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{notif.title}</p>
                        {notif.message && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{notif.message}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-2">
                          {new Date(notif.createdAt * 1000).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {!notif.isRead && (
                          <button
                            onClick={() => handleMarkAsRead(notif.id)}
                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-300 transition-colors"
                            title="Mark as read"
                          >
                            ✓
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notif.id)}
                          className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-300 transition-colors"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-700 bg-slate-900/50 text-center">
            <a
              href="/dashboard/notifications"
              className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              View all notifications
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
