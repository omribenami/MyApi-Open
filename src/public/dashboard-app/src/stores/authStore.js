import { create } from 'zustand';

const readCookie = (name) => {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create((set) => ({
  user: null,
  masterToken: null,
  sessionToken: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    let masterToken = null;
    let sessionToken = null;

    try {
      masterToken = localStorage.getItem('masterToken');
      sessionToken = sessionStorage.getItem('sessionToken');
    } catch {
      // Storage access can fail on corrupted browser storage; continue with cookie bootstrap path.
    }

    // CRITICAL: Check for active session FIRST, before validating any Bearer tokens.
    // If session is active, clear any stale masterToken to prevent device approval conflicts.
    try {
      const sessionCheckRes = await fetch('/api/v1/auth/me', { credentials: 'include' });
      if (sessionCheckRes.ok) {
        // Session auth is active. Don't use Bearer token auth.
        try {
          localStorage.removeItem('masterToken');
          localStorage.removeItem('tokenData');
        } catch {}
        set({ masterToken: null, sessionToken: null, isAuthenticated: true, isInitialized: true, error: null });
        return;
      }
    } catch {
      // no-op; session check failed, continue with token validation
    }

    // If we already have a token stored, validate it before trusting local state.
    if (masterToken) {
      try {
        const validateRes = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${masterToken}` },
          credentials: 'include',
        });

        if (validateRes.ok) {
          set({ masterToken, sessionToken, isAuthenticated: true, isInitialized: true, error: null });
          return;
        }
      } catch {
        // no-op
      }

      // Stale/invalid token: clear and continue with fallback bootstrap path.
      try {
        localStorage.removeItem('masterToken');
        localStorage.removeItem('tokenData');
        sessionStorage.removeItem('sessionToken');
      } catch {
        // no-op
      }
      masterToken = null;
      sessionToken = null;
    }

    // Fallback for OAuth callback flow when session-cookie auth is flaky across redirects.
    // Backend sets myapi_master_token intentionally as JS-readable cookie.
    const cookieMasterToken = readCookie('myapi_master_token');
    if (cookieMasterToken) {
      try {
        localStorage.setItem('masterToken', cookieMasterToken);
      } catch {
        // Ignore storage errors; still continue with in-memory auth.
      }
      set({ masterToken: cookieMasterToken, isAuthenticated: true, isInitialized: true, error: null });
      return;
    }

    // Also check for myapi_user cookie set during OAuth callback (contains session user info).
    const cookieUser = readCookie('myapi_user');
    if (cookieUser) {
      try {
        const user = JSON.parse(decodeURIComponent(cookieUser));
        set({ user, isAuthenticated: true, isInitialized: true, error: null });
        return;
      } catch {
        // Ignore parse errors; continue with session/bearer fallback.
      }
    }

    // Session-cookie fallback for OAuth login (e.g. Google/Facebook)
    // ONLY bootstrap if we don't have a stored token
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
          masterToken: bootstrapToken || null,
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
    try {
      localStorage.setItem('masterToken', token);
    } catch {
      // Keep in-memory auth state even if storage is temporarily unavailable.
    }
    set({ masterToken: token, isAuthenticated: true, error: null });
  },

  setSessionToken: (token) => {
    try {
      sessionStorage.setItem('sessionToken', token);
    } catch {
      // Ignore storage failures; keep token in memory for this runtime.
    }
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
    try {
      localStorage.removeItem('masterToken');
      sessionStorage.removeItem('sessionToken');
    } catch {
      // Ignore storage cleanup failures on logout.
    }
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
