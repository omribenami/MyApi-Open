import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'oauth_connected':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zm0 2a1 1 0 00-1 1v2.5H5.5a1 1 0 000 2H7V12a1 1 0 002 0v-2h1.5a1 1 0 000-2H9V5.5a1 1 0 00-1-1z" fill="var(--accent)"/>
        </svg>
      );
    case 'skill_installed':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8.93 1.1L10.87 5l4.21.61-3.04 2.97.72 4.19L8 10.64l-4.76 2.13.72-4.19L.92 5.61l4.21-.61L7.07 1.1a1.07 1.07 0 011.86 0z" fill="var(--amber)"/>
        </svg>
      );
    case 'team_invite':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M5 3.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm6 1a2 2 0 100 4 2 2 0 000-4zM1 12c0-1.66 1.79-3 4-3s4 1.34 4 3H1zm8.5-.5c1.1 0 3.5.56 3.5 1.5v.5h-3.43A3.9 3.9 0 009.1 12a4.4 4.4 0 00-.6-.5z" fill="var(--green)"/>
        </svg>
      );
    case 'billing':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="3" width="14" height="10" rx="2" stroke="var(--amber)" strokeWidth="1.5"/>
          <path d="M1 6h14" stroke="var(--amber)" strokeWidth="1.5"/>
        </svg>
      );
    case 'security':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L2 3.5v4c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5v-4L8 1z" stroke="var(--red)" strokeWidth="1.5" fill="none"/>
          <path d="M5.5 8l1.5 1.5L10.5 6" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1a5.5 5.5 0 00-5.5 5.5c0 1.5-.5 2.5-1 3.5h13c-.5-1-1-2-1-3.5A5.5 5.5 0 008 1zM6.5 14a1.5 1.5 0 003 0H6.5z" fill="var(--ink-2)"/>
        </svg>
      );
  }
};

const getTypeColor = (type) => {
  switch (type) {
    case 'security': return 'var(--red)';
    case 'billing': return 'var(--amber)';
    case 'team_invite': return 'var(--green)';
    case 'skill_installed': return 'var(--amber)';
    case 'oauth_connected': return 'var(--accent)';
    default: return 'var(--ink-3)';
  }
};

export default function NotificationCenter() {
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const { notifications, fetchNotifications } = useNotificationStore();
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
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
    if (filter === 'unread' && n.isRead) return false;
    if (filter === 'read' && !n.isRead) return false;
    if (typeFilter && n.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        (n.message && n.message.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const notificationTypes = [...new Set(notifications.map(n => n.type))];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-4 mb-2">
        <div className="flex-1 min-w-0">
          <div className="micro mb-2">OVERVIEW</div>
          <h1 className="font-serif text-[22px] sm:text-[34px] leading-[1.05] tracking-tight ink font-medium">Notifications</h1>
          <p className="mt-2 text-[15px] ink-2 max-w-[60ch]">
            Activity from your workspace — device approvals, token events, and security alerts.
            {unreadCount > 0 && (
              <span className="mono ml-3 text-[12px]" style={{ color: 'var(--accent)' }}>{unreadCount} unread</span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Status filter row */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {['all', 'unread', 'read'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="btn"
              style={filter === f ? {
                background: 'var(--accent)',
                color: '#fff',
                borderColor: 'var(--accent)'
              } : {}}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          {filter === 'unread' && unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="btn"
              style={{ color: 'var(--green)', borderColor: 'var(--green)', opacity: 0.85 }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: '4px' }}>
                <path d="M1.5 6l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Mark all as read
            </button>
          )}
        </div>

        {/* Type filter row */}
        {notificationTypes.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setTypeFilter('')}
              className="btn"
              style={typeFilter === '' ? {
                background: 'var(--bg-hover)',
                color: 'var(--ink)',
                borderColor: 'var(--line)'
              } : {}}
            >
              <span className="micro">All types</span>
            </button>
            {notificationTypes.map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className="btn"
                style={typeFilter === type ? {
                  background: 'var(--bg-hover)',
                  color: 'var(--ink)',
                  borderColor: 'var(--line)'
                } : {}}
              >
                <span
                  className="tick"
                  style={{ background: getTypeColor(type), marginRight: '6px' }}
                />
                <span className="micro">{type.replace(/_/g, ' ')}</span>
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
          className="ui-input"
          style={{ width: '100%', maxWidth: '480px' }}
        />
      </div>

      {/* Notifications list */}
      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 0',
          color: 'var(--ink-3)',
          fontSize: '14px'
        }}>
          Loading notifications...
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '64px 0',
          color: 'var(--ink-3)'
        }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }}>
            <path d="M20 4a14 14 0 00-14 14c0 4-1.5 6.5-2.5 9h33c-1-2.5-2.5-5-2.5-9A14 14 0 0020 4zM16.5 36a3.5 3.5 0 007 0H16.5z" fill="var(--ink-3)"/>
          </svg>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink-2)', margin: '0 0 4px' }}>
            No notifications
          </p>
          <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: 0 }}>
            {searchQuery ? 'Try a different search term' : "You're all caught up"}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {filteredNotifications.map(notif => (
            <div
              key={notif.id}
              className="card"
              style={{
                padding: '14px 16px',
                borderRadius: '6px',
                background: notif.isRead ? 'var(--bg-raised)' : 'var(--bg-hover)',
                borderColor: notif.isRead ? 'var(--line-2)' : 'var(--line)',
                transition: 'border-color 0.15s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                {/* Icon */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'var(--bg-sunk)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px'
                }}>
                  {getNotificationIcon(notif.type)}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: notif.isRead ? 'var(--ink-2)' : 'var(--ink)'
                      }}>
                        {notif.title}
                      </span>
                      {!notif.isRead && (
                        <span style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          flexShrink: 0
                        }} />
                      )}
                    </div>
                    <span style={{
                      fontSize: '11px',
                      color: 'var(--ink-3)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}>
                      {new Date(notif.createdAt * 1000).toLocaleString()}
                    </span>
                  </div>

                  {notif.message && (
                    <p style={{
                      fontSize: '13px',
                      color: 'var(--ink-2)',
                      margin: '0 0 8px',
                      lineHeight: '1.5'
                    }}>
                      {notif.message}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span
                      className="micro"
                      style={{
                        padding: '2px 7px',
                        borderRadius: '4px',
                        background: 'var(--bg-sunk)',
                        border: '1px solid var(--line-2)',
                        color: getTypeColor(notif.type)
                      }}
                    >
                      {notif.type.replace(/_/g, ' ')}
                    </span>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      {!notif.isRead && (
                        <button
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="btn btn-ghost"
                          style={{ padding: '4px 8px', minHeight: '28px', fontSize: '12px', color: 'var(--green)' }}
                          title="Mark as read"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M1.5 6l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notif.id)}
                        className="btn btn-ghost"
                        style={{ padding: '4px 8px', minHeight: '28px', fontSize: '12px', color: 'var(--ink-3)' }}
                        title="Delete"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
