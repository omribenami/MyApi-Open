import { create } from 'zustand';

export const useTokenStore = create((set, get) => ({
  // State
  tokens: [],
  scopes: [],
  scopeTemplates: {},
  isLoading: false,
  isSaving: false,
  error: null,
  success: null,
  selectedToken: null,

  // Fetch all tokens
  fetchTokens: async (masterToken) => {
    if (!masterToken) return;
    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/v1/tokens', {
        headers: { 'Authorization': `Bearer ${masterToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tokens');
      }

      const data = await response.json();
      set({
        tokens: data.data || [],
        isLoading: false,
        error: null,
      });
    } catch (err) {
      set({
        error: err.message || 'Failed to fetch tokens',
        isLoading: false,
      });
    }
  },

  // Fetch available scopes
  fetchScopes: async (masterToken) => {
    if (!masterToken) return;

    try {
      const response = await fetch('/api/v1/scopes', {
        headers: { 'Authorization': `Bearer ${masterToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch scopes');
      }

      const data = await response.json();
      set({
        scopes: data.data?.scopes || [],
        scopeTemplates: data.data?.templates || {},
        error: null,
      });
    } catch (err) {
      set({
        error: err.message || 'Failed to fetch scopes',
      });
    }
  },

  // Create a new token
  createToken: async (masterToken, { label, description, scopes, expiresInHours }) => {
    if (!masterToken) {
      set({ error: 'No master token available' });
      return null;
    }

    set({ isSaving: true, error: null });

    try {
      const response = await fetch('/api/v1/tokens', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${masterToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          label,
          description,
          scopes,
          expiresInHours,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create token');
      }

      const data = await response.json();
      const newToken = data.data;

      // Refresh tokens list
      const tokens = get().tokens;
      set({
        tokens: [newToken, ...tokens.filter(t => !t.isMaster)],
        isSaving: false,
        error: null,
        success: 'Token created successfully',
      });

      return newToken;
    } catch (err) {
      set({
        error: err.message || 'Failed to create token',
        isSaving: false,
      });
      return null;
    }
  },

  // Update token scopes
  updateToken: async (masterToken, tokenId, { scopes }) => {
    if (!masterToken) {
      set({ error: 'No master token available' });
      return null;
    }

    set({ isSaving: true, error: null });

    try {
      const response = await fetch(`/api/v1/tokens/${tokenId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${masterToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scopes }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update token');
      }

      const data = await response.json();

      // Update token in list
      const tokens = get().tokens.map(t =>
        t.id === tokenId ? { ...t, scopes: data.data.scopes } : t
      );

      set({
        tokens,
        isSaving: false,
        error: null,
        success: 'Token updated successfully',
      });

      return data.data;
    } catch (err) {
      set({
        error: err.message || 'Failed to update token',
        isSaving: false,
      });
      return null;
    }
  },

  // Revoke (delete) a token
  revokeToken: async (masterToken, tokenId) => {
    if (!masterToken) {
      set({ error: 'No master token available' });
      return false;
    }

    set({ isSaving: true, error: null });

    try {
      const response = await fetch(`/api/v1/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${masterToken}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revoke token');
      }

      // Remove token from list
      const tokens = get().tokens.filter(t => t.id !== tokenId);

      set({
        tokens,
        isSaving: false,
        error: null,
        success: 'Token revoked successfully',
      });

      return true;
    } catch (err) {
      set({
        error: err.message || 'Failed to revoke token',
        isSaving: false,
      });
      return false;
    }
  },

  // Clear messages
  clearSuccess: () => {
    set({ success: null });
  },

  clearError: () => {
    set({ error: null });
  },

  // Set selected token (for modals)
  selectToken: (token) => {
    set({ selectedToken: token });
  },

  deselectToken: () => {
    set({ selectedToken: null });
  },
}));
