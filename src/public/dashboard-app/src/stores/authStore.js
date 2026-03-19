import { create } from 'zustand';
import { clearAuthArtifacts, isLogoutInProgress, setLogoutInProgress } from '../utils/authRuntime';

const readCookie = (name) => {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
};

let authMeFailureCount = 0;
let initializePromise = null;
const resetAuthMeFailureCountOnSuccess = () => { authMeFailureCount = 0; };
const incrementAuthMeFailureCount = () => { authMeFailureCount++; };

const normalizeUserPayload = (payload) => {
  const raw = payload?.user || payload?.data || payload || null;
  if (!raw || typeof raw !== 'object') return null;

  return {
    ...raw,
    displayName: raw.displayName || raw.display_name || raw.name || raw.username || '',
    avatarUrl: raw.avatarUrl || raw.avatar_url || '',
    email: raw.email || '',
  };
};

export const useAuthStore = create((set, get) => ({
  user: null,
  masterToken: null,
  sessionToken: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    if (initializePromise) return initializePromise;

    initializePromise = (async () => {
      try {
        if (isLogoutInProgress()) {
          set({ user: null, masterToken: null, sessionToken: null, isAuthenticated: false, isInitialized: true, error: null });
          return;
        }

        if (authMeFailureCount >= 2) {
          set({ isInitialized: true });
          return;
        }

        let masterToken = null;
        let sessionToken = null;
        try {
          masterToken = localStorage.getItem('masterToken');
          sessionToken = sessionStorage.getItem('sessionToken');
        } catch {}

        try {
          const sessionCheckRes = await fetch('/api/v1/auth/me', { credentials: 'include' });
          if (sessionCheckRes.ok) {
            resetAuthMeFailureCountOnSuccess();
            const sessionData = await sessionCheckRes.json();
            const user = normalizeUserPayload(sessionData);
            const bootstrapToken = sessionData?.bootstrap?.masterToken || null;

            if (bootstrapToken) {
              try { localStorage.setItem('masterToken', bootstrapToken); } catch {}
            }

            set({
              user,
              masterToken: bootstrapToken || masterToken || null,
              sessionToken: null,
              isAuthenticated: true,
              isInitialized: true,
              error: null,
            });
            return;
          }
          if (sessionCheckRes.status === 401) {
            resetAuthMeFailureCountOnSuccess();
          } else {
            incrementAuthMeFailureCount();
          }
        } catch {
          incrementAuthMeFailureCount();
        }

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
          } catch {}

          clearAuthArtifacts();
          masterToken = null;
          sessionToken = null;
        }

        const cookieMasterToken = readCookie('myapi_master_token');
        if (cookieMasterToken) {
          try { localStorage.setItem('masterToken', cookieMasterToken); } catch {}
          set({ masterToken: cookieMasterToken, isAuthenticated: true, isInitialized: true, error: null });
          return;
        }

        const cookieUser = readCookie('myapi_user');
        if (cookieUser) {
          try {
            const user = normalizeUserPayload(JSON.parse(decodeURIComponent(cookieUser)));
            set({ user, isAuthenticated: true, isInitialized: true, error: null });
            return;
          } catch {}
        }

        if (authMeFailureCount < 2) {
          try {
            const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
            if (res.ok) {
              resetAuthMeFailureCountOnSuccess();
              const payload = await res.json();
              const user = normalizeUserPayload(payload);
              let bootstrapToken = payload?.bootstrap?.masterToken;

              if (!bootstrapToken) {
                try {
                  const bootRes = await fetch('/api/v1/tokens/master/bootstrap', { method: 'POST', credentials: 'include' });
                  if (bootRes.ok) {
                    const bootData = await bootRes.json();
                    bootstrapToken = bootData?.data?.token || null;
                  }
                } catch {}
              }

              if (bootstrapToken) {
                try { localStorage.setItem('masterToken', bootstrapToken); } catch {}
              }
              set({ user, masterToken: bootstrapToken || null, isAuthenticated: true, error: null, isInitialized: true });
              return;
            }
            incrementAuthMeFailureCount();
          } catch {
            incrementAuthMeFailureCount();
          }
        }

        set({ user: null, masterToken: null, sessionToken: null, isAuthenticated: false, isInitialized: true, error: null });
      } catch (err) {
        if (err?.message?.includes('Corruption')) {
          set({ isInitialized: true, isAuthenticated: false });
          return;
        }
        set({ isInitialized: true, error: 'Initialization error. Please refresh.' });
      } finally {
        initializePromise = null;
      }
    })();

    return initializePromise;
  },

  setMasterToken: (token) => {
    setLogoutInProgress(false);
    try { localStorage.setItem('masterToken', token); } catch {}
    set({ masterToken: token, isAuthenticated: true, error: null });
  },

  setSessionToken: (token) => {
    setLogoutInProgress(false);
    try { sessionStorage.setItem('sessionToken', token); } catch {}
    set({ sessionToken: token });
  },

  setUser: (user) => {
    setLogoutInProgress(false);
    const normalized = normalizeUserPayload(user);
    set({ user: normalized, isAuthenticated: !!normalized });
  },

  forceUnauthenticated: () => {
    setLogoutInProgress(false);
    clearAuthArtifacts();
    set({ user: null, masterToken: null, sessionToken: null, isAuthenticated: false, isInitialized: true, error: null });
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  logout: () => {
    if (isLogoutInProgress()) {
      get().forceUnauthenticated();
      return;
    }
    setLogoutInProgress(true);
    clearAuthArtifacts();
    try {
      sessionStorage.removeItem('__myapi_corruption_recovery_ts__');
      sessionStorage.removeItem('__myapi_corruption_recovery_count__');
    } catch {}

    set({ user: null, masterToken: null, sessionToken: null, isAuthenticated: false, isInitialized: true, error: null });

    fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' })
      .catch(() => {})
      .finally(() => setLogoutInProgress(false));
  },

  startOAuthFlow: () => set({ isLoading: true }),
  completeOAuthFlow: () => set({ isLoading: false }),
  clearError: () => set({ error: null }),
}));
