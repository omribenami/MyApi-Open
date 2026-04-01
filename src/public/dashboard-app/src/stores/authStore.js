import { create } from 'zustand';
import { clearAuthArtifacts, isLogoutInProgress, setLogoutInProgress, redirectToLoginOnce } from '../utils/authRuntime';

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

const LOGGED_OUT_FLAG = '__myapi_logged_out__';
const markLoggedOut = () => { try { localStorage.setItem(LOGGED_OUT_FLAG, '1'); } catch { /* ignored */ } };
const clearLoggedOut = () => { try { localStorage.removeItem(LOGGED_OUT_FLAG); } catch { /* ignored */ } };
const wasLoggedOut = () => { try { return localStorage.getItem(LOGGED_OUT_FLAG) === '1'; } catch { return false; } };
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
  // Phase 1: Workspaces & Multi-Tenancy
  workspaces: [],
  currentWorkspace: null,
  workspacesLoading: false,

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
        } catch { /* ignored */ }

        // Track whether the first session check definitively returned 401 (no active session).
        // This prevents a redundant second session-only call that would also return 401.
        let sessionReturned401 = false;

        try {
          const sessionCheckRes = await fetch('/api/v1/auth/me', { credentials: 'include' });
          if (sessionCheckRes.ok) {
            resetAuthMeFailureCountOnSuccess();
            const sessionData = await sessionCheckRes.json();
            const user = normalizeUserPayload(sessionData);
            const bootstrapToken = sessionData?.bootstrap?.masterToken || null;

            if (bootstrapToken) {
              try { localStorage.setItem('masterToken', bootstrapToken); } catch { /* ignored */ }
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
            sessionReturned401 = true;
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
              const validatePayload = await validateRes.json().catch(() => ({}));
              const user = normalizeUserPayload(validatePayload);
              set({ user, masterToken, sessionToken, isAuthenticated: true, isInitialized: true, error: null });
              return;
            }
          } catch { /* ignored */ }

          clearAuthArtifacts();
          masterToken = null;
          sessionToken = null;
        }

        const cookieMasterToken = readCookie('myapi_master_token');
        // Never restore from cookie if the user explicitly logged out on this device
        if (cookieMasterToken && !sessionReturned401 && !wasLoggedOut()) {
          try { localStorage.setItem('masterToken', cookieMasterToken); } catch { /* ignored */ }
        }

        const cookieUser = readCookie('myapi_user');
        if (cookieUser) {
          // Advisory only; authentication must still be confirmed via /auth/me.
          try { JSON.parse(decodeURIComponent(cookieUser)); } catch { /* ignored */ }
        }

        // If the first session check already returned 401 and we have a cookie master token,
        // validate it via Bearer auth. If there is no token at all, skip the redundant
        // session-only check (it would also return 401, causing a second console error).
        if (authMeFailureCount < 2 && (!sessionReturned401 || cookieMasterToken) && !wasLoggedOut()) {
          try {
            let fetchOptions;
            if (sessionReturned401 && cookieMasterToken) {
              // Session is confirmed gone; validate the cookie token via Bearer auth instead.
              fetchOptions = { headers: { Authorization: `Bearer ${cookieMasterToken}` }, credentials: 'include' };
            } else {
              fetchOptions = { credentials: 'include' };
            }

            const res = await fetch('/api/v1/auth/me', fetchOptions);
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
                } catch { /* ignored */ }
              }

              if (bootstrapToken) {
                try { localStorage.setItem('masterToken', bootstrapToken); } catch { /* ignored */ }
              }
              set({ user, masterToken: bootstrapToken || cookieMasterToken || null, isAuthenticated: true, error: null, isInitialized: true });
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
    clearLoggedOut();
    try { localStorage.setItem('masterToken', token); } catch { /* ignored */ }
    set({ masterToken: token, isAuthenticated: true, error: null });
  },

  setSessionToken: (token) => {
    setLogoutInProgress(false);
    try { sessionStorage.setItem('sessionToken', token); } catch { /* ignored */ }
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

    // Mark logged-out in localStorage so initialize() won't restore from cookies on next page load
    markLoggedOut();

    // Clear all client-side auth artifacts FIRST
    clearAuthArtifacts();
    
    // Clear workspace data
    try {
      localStorage.removeItem('currentWorkspace');
      localStorage.removeItem('workspaces');
      sessionStorage.clear();
    } catch { /* ignored */ }
    
    // Clear recovery flags
    try {
      sessionStorage.removeItem('__myapi_corruption_recovery_ts__');
      sessionStorage.removeItem('__myapi_corruption_recovery_count__');
    } catch { /* ignored */ }

    // Update store immediately (so UI reflects logout)
    set({ 
      user: null, 
      masterToken: null, 
      sessionToken: null, 
      isAuthenticated: false, 
      isInitialized: true, 
      error: null,
      workspaces: [],
      currentWorkspace: null
    });

    // Notify backend to destroy session
    fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' })
      .then(res => res.json())
      .catch(() => {})
      .finally(() => {
        setLogoutInProgress(false);
        // Redirect to login (but don't auto-trigger another auth attempt)
        redirectToLoginOnce();
      });
  },

  startOAuthFlow: () => set({ isLoading: true }),
  completeOAuthFlow: () => set({ isLoading: false }),
  clearError: () => set({ error: null }),

  // Phase 1: Workspaces & Multi-Tenancy
  fetchWorkspaces: async () => {
    set({ workspacesLoading: true });
    try {
      const response = await fetch('/api/v1/workspaces', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        const workspaces = data.workspaces || [];
        let currentWorkspace = null;

        try {
          const stored = localStorage.getItem('currentWorkspace');
          if (stored) {
            currentWorkspace = workspaces.find(w => w.id === stored);
          }
        } catch { /* ignored */ }

        if (!currentWorkspace && workspaces.length > 0) {
          currentWorkspace = workspaces[0];
        }

        set({ workspaces, currentWorkspace, workspacesLoading: false });
        return { success: true, workspaces };
      }
      set({ workspacesLoading: false });
      return { success: false, error: 'Failed to fetch workspaces' };
    } catch (error) {
      set({ workspacesLoading: false });
      return { success: false, error: error.message };
    }
  },

  switchWorkspace: async (workspaceId) => {
    try {
      const response = await fetch(`/api/v1/workspace-switch/${workspaceId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        const workspace = data.workspace;
        try {
          localStorage.setItem('currentWorkspace', workspaceId);
        } catch { /* ignored */ }
        set({ currentWorkspace: workspace });
        return { success: true, workspace };
      }
      return { success: false, error: 'Failed to switch workspace' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  setCurrentWorkspace: (workspace) => {
    try {
      if (workspace) {
        localStorage.setItem('currentWorkspace', workspace.id);
      } else {
        localStorage.removeItem('currentWorkspace');
      }
    } catch { /* ignored */ }
    set({ currentWorkspace: workspace });
  },
}));
