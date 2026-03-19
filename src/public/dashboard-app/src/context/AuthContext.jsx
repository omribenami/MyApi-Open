/**
 * AuthContext Hook
 * Provides easy access to auth and workspace state
 */

import { useAuthStore } from '../stores/authStore';

export const useAuth = () => {
  const authState = useAuthStore((state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isInitialized: state.isInitialized,
    isLoading: state.isLoading,
    error: state.error,
    masterToken: state.masterToken,
    sessionToken: state.sessionToken,
    workspaces: state.workspaces,
    currentWorkspace: state.currentWorkspace,
    workspacesLoading: state.workspacesLoading,
  }));

  const authActions = useAuthStore((state) => ({
    setUser: state.setUser,
    setMasterToken: state.setMasterToken,
    setSessionToken: state.setSessionToken,
    setLoading: state.setLoading,
    setError: state.setError,
    clearError: state.clearError,
    initialize: state.initialize,
    logout: state.logout,
    forceUnauthenticated: state.forceUnauthenticated,
    fetchWorkspaces: state.fetchWorkspaces,
    switchWorkspace: state.switchWorkspace,
    setCurrentWorkspace: state.setCurrentWorkspace,
  }));

  return {
    ...authState,
    ...authActions,
  };
};
