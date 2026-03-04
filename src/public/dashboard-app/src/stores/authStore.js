import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  masterToken: null,
  sessionToken: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    const masterToken = localStorage.getItem('masterToken');
    const sessionToken = sessionStorage.getItem('sessionToken');

    if (masterToken) {
      set({ masterToken, sessionToken, isAuthenticated: true });
    }

    // Session-cookie fallback for OAuth login (e.g. Google/Facebook)
    try {
      const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
      if (res.ok) {
        const payload = await res.json();
        const user = payload?.data || payload;
        let bootstrapToken = payload?.bootstrap?.masterToken;

        if (!bootstrapToken) {
          try {
            const bootRes = await fetch('/api/v1/tokens/master/bootstrap', { method: 'POST', credentials: 'include' });
            if (bootRes.ok) {
              const bootData = await bootRes.json();
              bootstrapToken = bootData?.data?.token || null;
            }
          } catch {
            // no-op
          }
        }

        if (bootstrapToken) {
          localStorage.setItem('masterToken', bootstrapToken);
        }
        set({
          user,
          masterToken: bootstrapToken || masterToken || null,
          isAuthenticated: true,
          error: null,
          isInitialized: true,
        });
        return;
      }
    } catch {
      // no-op
    }

    set({ isInitialized: true });
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
    set({ user, isAuthenticated: !!user });
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
    set({ user: null, masterToken: null, sessionToken: null, isAuthenticated: false, isInitialized: true, error: null });
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
