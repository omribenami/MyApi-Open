import { create } from 'zustand';
import { clearAuthArtifacts, isLogoutInProgress, setLogoutInProgress, redirectToLoginOnce } from '../utils/authRuntime';
import apiClient from '../utils/apiClient';

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
        let _sessionToken = null;
        try {
          masterToken = localStorage.getItem('masterToken');
          _sessionToken = sessionStorage.getItem('sessionToken');
        } catch { /* ignored */ }

        // If a masterToken exists in localStorage but the browser session flag is missing
        // (sessionStorage is cleared on browser close), the user must re-authenticate fully
        // (including 2FA). This prevents the persistent token from bypassing 2FA after
        // the browser is closed and reopened.
        if (masterToken) {
          const sessionVerified = (() => { try { return sessionStorage.getItem('sessionAuthVerified'); } catch { return null; } })();
          if (!sessionVerified) {
            set({ isAuthenticated: false, isInitialized: true });
            return;
          }
        }

        // Single combined probe: send session cookie + Bearer token (if available) together.
        // The server checks session first, then Bearer, so this handles both auth paths in
        // one request — eliminating the session-probe 401 that showed in console for
        // masterToken-only users.
        try {
          const headers = {};
          if (masterToken) headers.Authorization = `Bearer ${masterToken}`;
          const probeRes = await fetch('/api/v1/auth/me', { headers, credentials: 'include' });
          if (probeRes.ok) {
            resetAuthMeFailureCountOnSuccess();
            const payload = await probeRes.json();
            const user = normalizeUserPayload(payload);
            const bootstrapToken = payload?.bootstrap?.masterToken || null;
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
          if (probeRes.status === 401) {
            resetAuthMeFailureCountOnSuccess();
            // Token in localStorage is invalid/expired — clear it before trying cookie fallback.
            if (masterToken) {
              clearAuthArtifacts();
              masterToken = null;
            }
          } else {
            incrementAuthMeFailureCount();
          }
        } catch {
          incrementAuthMeFailureCount();
        }

        // Fallback: try a master token stored in a cookie (set by OAuth login on another device/tab).
        const cookieMasterToken = !wasLoggedOut() ? readCookie('myapi_master_token') : null;
        if (authMeFailureCount < 2 && cookieMasterToken) {
          try {
            try { localStorage.setItem('masterToken', cookieMasterToken); } catch { /* ignored */ }
            const res = await fetch('/api/v1/auth/me', {
              headers: { Authorization: `Bearer ${cookieMasterToken}` },
              credentials: 'include',
            });
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

        // Don't overwrite if another handler (e.g. OAuth confirm) already authenticated the user
        if (!get().isAuthenticated) {
          set({ user: null, masterToken: null, sessionToken: null, isAuthenticated: false, isInitialized: true, error: null });
        } else {
          set({ isInitialized: true });
        }
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
    try { sessionStorage.setItem('sessionAuthVerified', '1'); } catch { /* ignored */ }
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
      const response = await apiClient.get('/workspaces');
      const data = response.data;
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
    } catch (error) {
      set({ workspacesLoading: false });
      return { success: false, error: error.message };
    }
  },

  switchWorkspace: async (workspaceId) => {
    try {
      const response = await apiClient.post(`/workspace-switch/${workspaceId}`);
      const workspace = response.data.workspace;
      try {
        localStorage.setItem('currentWorkspace', workspaceId);
      } catch { /* ignored */ }
      set({ currentWorkspace: workspace });
      return { success: true, workspace };
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
