import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  masterToken: null,
  sessionToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  initialize: async () => {
    const masterToken = localStorage.getItem('masterToken');
    const sessionToken = sessionStorage.getItem('sessionToken');

    if (masterToken) {
      set({ masterToken, sessionToken, isAuthenticated: true });
    }

    // Session-cookie fallback for OAuth login (e.g. Google Workspace)
    try {
      const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
      if (res.ok) {
        const user = await res.json();
        set({ user, isAuthenticated: true, error: null });
      }
    } catch {
      // no-op
    }
  },

  setMasterToken: (token) => {
    localStorage.setItem('masterToken', token);
    set({ masterToken: token, isAuthenticated: true, error: null });
  },

  setSessionToken: (token) => {
    sessionStorage.setItem('sessionToken', token);
    set({ sessionToken: token });
  },

  setUser: (user) => {
    set({ user });
  },

  setLoading: (isLoading) => {
    set({ isLoading });
  },

  setError: (error) => {
    set({ error });
  },

  logout: () => {
    localStorage.removeItem('masterToken');
    sessionStorage.removeItem('sessionToken');
    fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    set({ user: null, masterToken: null, sessionToken: null, isAuthenticated: false, error: null });
  },

  startOAuthFlow: () => {
    set({ isLoading: true });
  },

  completeOAuthFlow: () => {
    set({ isLoading: false });
  },

  clearError: () => {
    set({ error: null });
  },
}));
