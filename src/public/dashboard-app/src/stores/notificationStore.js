import { create } from 'zustand';

export const useNotificationStore = create((set, get) => ({
  // State
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  
  // Toast notifications
  toasts: [],
  
  // Actions
  setNotifications: (notifications) => set({ notifications }),
  setUnreadCount: (count) => set({ unreadCount: count }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  // Fetch notifications
  fetchNotifications: async (masterToken, limit = 50, offset = 0) => {
    if (!masterToken) return;
    
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `/api/v1/notifications?limit=${limit}&offset=${offset}`,
        {
          headers: { Authorization: `Bearer ${masterToken}` },
          credentials: 'include',
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch notifications');
      
      const data = await response.json();
      set({
        notifications: data.notifications || [],
        unreadCount: data.unreadCount || 0,
      });
    } catch (error) {
      set({ error: error.message });
      console.error('Error fetching notifications:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Get unread count
  fetchUnreadCount: async (masterToken) => {
    if (!masterToken) return;
    
    try {
      const response = await fetch('/api/v1/notifications/unread', {
        headers: { Authorization: `Bearer ${masterToken}` },
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        set({ unreadCount: data.unreadCount || 0 });
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  },
  
  // Mark notification as read
  markAsRead: async (masterToken, notificationId) => {
    try {
      const response = await fetch(
        `/api/v1/notifications/${notificationId}/read`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${masterToken}` },
          credentials: 'include',
        }
      );
      
      if (response.ok) {
        set(state => ({
          notifications: state.notifications.map(n =>
            n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  },
  
  // Delete notification
  deleteNotification: async (masterToken, notificationId) => {
    try {
      const response = await fetch(
        `/api/v1/notifications/${notificationId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${masterToken}` },
          credentials: 'include',
        }
      );
      
      if (response.ok) {
        set(state => ({
          notifications: state.notifications.filter(n => n.id !== notificationId),
        }));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  },
  
  // Add toast notification
  addToast: (message, type = 'info', duration = 5000) => {
    const id = Date.now();
    const toast = { id, message, type };
    
    set(state => ({
      toasts: [...state.toasts, toast],
    }));
    
    if (duration > 0) {
      setTimeout(() => {
        set(state => ({
          toasts: state.toasts.filter(t => t.id !== id),
        }));
      }, duration);
    }
    
    return id;
  },
  
  // Remove toast
  removeToast: (id) => set(state => ({
    toasts: state.toasts.filter(t => t.id !== id),
  })),
  
  // Add notification (from real-time events)
  addNotification: (notification) => {
    set(state => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },
}));
