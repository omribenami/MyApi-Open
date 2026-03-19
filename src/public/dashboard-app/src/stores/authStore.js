import { create } from 'zustand';

const readCookie = (name) => {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
};

// Circuit breaker: prevent endless /auth/me retry loops
let authMeFailureCount = 0;
const resetAuthMeFailureCountOnSuccess = () => { authMeFailureCount = 0; };
const incrementAuthMeFailureCount = () => { authMeFailureCount++; };

export const useAuthStore = create((set) => ({
  user: null,
  masterToken: null,
  sessionToken: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    try {
      // Circuit breaker: if /auth/me has failed 2+ times, skip remaining attempts
      if (authMeFailureCount >= 2) {
        console.warn('[Auth] Circuit breaker active: /auth/me failed', authMeFailureCount, 'times. Initializing unauthenticated.');
        set({ isInitialized: true });
        return;
      }
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
        resetAuthMeFailureCountOnSuccess();
        // Session auth is active. Don't use Bearer token auth.
        try {
          localStorage.removeItem('masterToken');
          localStorage.removeItem('tokenData');
        } catch {}
        const sessionData = await sessionCheckRes.json();
        // CRITICAL: Ensure user object includes email for isPowerUser check in Layout component
        const user = sessionData?.user || sessionData?.data || null;
        set({ 
          user, 
          masterToken: null, 
          sessionToken: null, 
          isAuthenticated: true, 
          isInitialized: true, 
          error: null 
        });
        return;
      }
      // 401 is expected when user is logged out — this is not a failure, just no session
      if (sessionCheckRes.status === 401) {
        resetAuthMeFailureCountOnSuccess();
        // No session, continue to Bearer token check below
      } else {
        incrementAuthMeFailureCount();
      }
    } catch (e) {
      incrementAuthMeFailureCount();
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
    // ONLY bootstrap if we don't have a stored token and haven't already failed too many times
    if (authMeFailureCount < 2) {
      try {
        const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
        if (res.ok) {
          resetAuthMeFailureCountOnSuccess();
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
        incrementAuthMeFailureCount();
      } catch {
        incrementAuthMeFailureCount();
      }
    }

    console.log('[Auth] Initialization complete (unauthenticated, circuit breaker at', authMeFailureCount, ')');
    set({ isInitialized: true });
    } catch (err) {
      if (err?.message?.includes('Corruption')) {
        // Suppress storage/runtime errors - they're handled by global error handler
        console.warn('[Auth] Storage corruption detected but handled - initializing unauthenticated');
        set({ isInitialized: true });
        return;
      }
      console.error('[Auth] Fatal error during initialization:', err);
      set({ isInitialized: true, error: 'Initialization error. Please refresh.' });
    }
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
      localStorage.removeItem('tokenData');
      localStorage.removeItem('profileAvatarUrl');
      sessionStorage.removeItem('sessionToken');
      sessionStorage.removeItem('tokenData');
      // Clear any corruption recovery markers so fresh init works
      sessionStorage.removeItem('__myapi_corruption_recovery_ts__');
      sessionStorage.removeItem('__myapi_corruption_recovery_count__');
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
