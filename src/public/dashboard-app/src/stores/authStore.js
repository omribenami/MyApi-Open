import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: null,
  masterToken: null,
  sessionToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // Initialize auth from localStorage
  initialize: () => {
    const masterToken = localStorage.getItem('masterToken');
    const sessionToken = sessionStorage.getItem('sessionToken');
    
    if (masterToken) {
      set({
        masterToken,
        sessionToken,
        isAuthenticated: true,
      });
    }
  },

  // Set master token (from username/password or OAuth)
  setMasterToken: (token) => {
    localStorage.setItem('masterToken', token);
    set({
      masterToken: token,
      isAuthenticated: true,
      error: null,
    });
  },

  // Set session token (optional, for API calls)
  setSessionToken: (token) => {
    sessionStorage.setItem('sessionToken', token);
    set({ sessionToken: token });
  },

  // Set user info
  setUser: (user) => {
    set({ user });
  },

  // Set loading state
  setLoading: (isLoading) => {
    set({ isLoading });
  },

  // Set error
  setError: (error) => {
    set({ error });
  },

  // Logout
  logout: () => {
    localStorage.removeItem('masterToken');
    sessionStorage.removeItem('sessionToken');
    set({
      user: null,
      masterToken: null,
      sessionToken: null,
      isAuthenticated: false,
      error: null,
    });
  },

  // OAuth flow start
  startOAuthFlow: (service) => {
    set({ isLoading: true });
    // The actual OAuth flow will be handled by the component
  },

  // OAuth flow complete
  completeOAuthFlow: (service, token) => {
    set({ isLoading: false });
    // Token is stored in sessionStorage by the OAuth callback handler
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));
