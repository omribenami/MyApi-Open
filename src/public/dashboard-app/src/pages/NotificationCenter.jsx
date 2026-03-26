import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';

export default function NotificationCenter() {
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const { notifications, fetchNotifications } = useNotificationStore();
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));
  }, [filter, typeFilter, currentWorkspace?.id, fetchNotifications]);

  const { markAsRead, deleteNotification } = useNotificationStore();
  
  const handleMarkAsRead = async (notificationId) => {
    await markAsRead(undefined, notificationId);
    await fetchNotifications();
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/v1/notifications/read-all', {
        method: 'POST',
        credentials: 'include'
      });
      await fetchNotifications();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleDelete = async (notificationId) => {
    await deleteNotification(undefined, notificationId);
    await fetchNotifications();
  };

  const filteredNotifications = notifications.filter(n => {
    if (!searchQuery) return true;
    return (
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.message && n.message.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const notificationTypes = [...new Set(notifications.map(n => n.type))];

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Notifications</h1>
        <p className="text-slate-400 mt-1">Manage all your activity and alerts</p>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {['all', 'unread', 'read'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          {filter === 'unread' && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Type filter */}
        {notificationTypes.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setTypeFilter('')}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === ''
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              All types
            </button>
            {notificationTypes.map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  typeFilter === type
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {type.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Search notifications..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Notifications list */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading notifications...</div>
      ) : filteredNotifications.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No notifications</div>
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map(notif => (
            <div
              key={notif.id}
              className={`p-4 rounded-lg border transition-colors ${
                !notif.isRead
                  ? 'bg-slate-800/50 border-slate-700'
                  : 'bg-slate-900/30 border-slate-800'
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="text-2xl mt-1">{getNotificationIcon(notif.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{notif.title}</h3>
                      <p className="text-xs text-slate-500">
                        {new Date(notif.createdAt * 1000).toLocaleString()}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-1.5"></span>
                    )}
                  </div>
                  {notif.message && (
                    <p className="text-sm text-slate-300 mb-2">{notif.message}</p>
                  )}
                  <div className="flex gap-2 text-xs">
                    <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded">
                      {notif.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-300 transition-colors"
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notif.id)}
                    className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-300 transition-colors"
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
  );
}
