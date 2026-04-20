import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';

function NotificationDropdown({ open, onClose }) {
  const masterToken = useAuthStore((state) => state.masterToken);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const dropdownRef = useRef(null);
  const {
    notifications,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    deleteNotification,
  } = useNotificationStore();

  const [offset, setOffset] = useState(0);
  const [displayLimit] = useState(15);
  const [hasMore, setHasMore] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    if (open) {
      fetchNotifications(masterToken, displayLimit, 0);
      setOffset(0);
    }
  }, [open, masterToken, fetchNotifications, displayLimit, currentWorkspace?.id]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Check if there are more notifications to load
    setHasMore(notifications.length >= displayLimit);
  }, [notifications, displayLimit]);

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

  const handleLoadMore = () => {
    const newOffset = offset + displayLimit;
    fetchNotifications(masterToken, displayLimit, newOffset);
    setOffset(newOffset);
  };

  const getNotificationIcon = (type) => {
    const svgClass = "w-4 h-4";
    const icons = {
      device_approval_requested: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
      device_approved: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      security_device_approved: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      device_revoked: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
      security_device_revoked: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
      skill_liked: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
      skill_used: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      persona_invoked: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
      guest_token_used: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
      token_revoked: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
      service_connected: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
      oauth_connected: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
      oauth_disconnected: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
      service_disconnected: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
      team_invitation: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
      billing_quota_warning: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
      error: <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    };
    return icons[type] || <svg className={svgClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
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
      className="card thin-scroll"
      style={{
        ...(isMobile ? {
          position: 'fixed', top: '56px', left: '8px', right: '8px',
          width: 'auto', maxWidth: 'calc(100vw - 16px)',
        } : {
          position: 'absolute', top: '100%', right: '0px',
          width: '360px', marginTop: '8px',
        }),
        maxHeight: '480px',
        display: 'flex', flexDirection: 'column',
        zIndex: 50,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span className="micro">Notifications</span>
        <button
          onClick={onClose}
          className="ink-3"
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '2px' }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Notifications list */}
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {isLoading && !notifications.length ? (
          <div style={{ padding: '32px 16px', textAlign: 'center' }} className="ink-3 text-[13px]">
            Loading...
          </div>
        ) : error ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--red)' }} className="text-[13px]">
            {error}
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center' }} className="ink-3 text-[13px]">
            No notifications
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--line-2)]">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                style={{
                  padding: '10px 16px',
                  background: !notification.read_at ? 'var(--bg-sunk)' : 'transparent',
                  cursor: 'default',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = !notification.read_at ? 'var(--bg-sunk)' : 'transparent'}
              >
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="ink-3 shrink-0" style={{ marginTop: '2px' }}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="ink text-[13px] font-medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {notification.title || notification.type.replace(/_/g, ' ')}
                    </p>
                    <p className="ink-2 text-[12px] mt-0.5" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {notification.message}
                    </p>
                    <p className="mono ink-4 text-[11px] mt-0.5">
                      {formatTime(notification.created_at)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0, alignItems: 'flex-start' }}>
                    {!notification.read_at && (
                      <>
                        <span className="tick shrink-0 mt-1.5" style={{ background: 'var(--accent)' }} />
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: 'var(--ink-3)' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--ink)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-3)'}
                          title="Mark as read"
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(notification.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: 'var(--ink-3)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--ink)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-3)'}
                      title="Delete"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Load more button */}
      {notifications.length > 0 && hasMore && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--line-2)', flexShrink: 0 }}>
          <button
            onClick={handleLoadMore}
            disabled={isLoading}
            className="w-full btn btn-ghost text-[12px]"
            style={{ width: '100%', justifyContent: 'center', opacity: isLoading ? 0.5 : 1 }}
          >
            {isLoading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

export default NotificationDropdown;
