import { create } from 'zustand';

/** Build auth headers, always including the active workspace so the backend
 *  can scope token queries correctly for both session and Bearer-token auth. */
function getAuthHeaders(masterToken, extra = {}) {
  const headers = { ...extra };
  if (masterToken) {
    headers['Authorization'] = `Bearer ${masterToken}`;
  }
  try {
    const workspaceId = localStorage.getItem('currentWorkspace');
    if (workspaceId) {
      headers['X-Workspace-ID'] = workspaceId;
    }
  } catch {
    // localStorage may be unavailable (e.g. private browsing with strict settings)
  }
  return headers;
}

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
        headers: getAuthHeaders(masterToken),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tokens');
      }

      const data = await response.json();
      // Normalize tokenId → id for consistent field access across modals
      const normalized = (data.data || []).map(t => ({
        ...t,
        id: t.id || t.tokenId,
        name: t.label || t.name,
      }));
      set({
        tokens: normalized,
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
        headers: getAuthHeaders(masterToken),
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
  createToken: async (masterToken, { label, description, scopes, expiresInHours, requiresApproval, scopeBundle, allowedPersonas, allowedResources }) => {
    if (!masterToken) {
      set({ error: 'No master token available' });
      return null;
    }

    set({ isSaving: true, error: null });

    try {
      const response = await fetch('/api/v1/tokens', {
        method: 'POST',
        headers: getAuthHeaders(masterToken, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          label,
          description,
          scopes,
          expiresInHours,
          requiresApproval,
          scopeBundle,
          allowedPersonas: allowedPersonas && allowedPersonas.length > 0 ? allowedPersonas : undefined,
          allowedResources: allowedResources && Object.keys(allowedResources).length > 0 ? allowedResources : undefined,
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

  // Update token: partial update — only include fields that should change.
  // Supported fields: scopes, requiresApproval, scopeBundle, allowedResources, allowedPersonas, label.
  updateToken: async (masterToken, tokenId, updates = {}) => {
    if (!masterToken) {
      set({ error: 'No master token available' });
      return null;
    }

    // Build body with only keys explicitly provided in updates
    const body = {};
    if ('scopes' in updates) body.scopes = updates.scopes;
    if ('requiresApproval' in updates) body.requiresApproval = !!updates.requiresApproval;
    if ('scopeBundle' in updates) body.scopeBundle = updates.scopeBundle;
    if ('allowedResources' in updates) body.allowedResources = updates.allowedResources;
    if ('allowedPersonas' in updates) body.allowedPersonas = updates.allowedPersonas;
    if ('label' in updates) body.label = updates.label;

    if (Object.keys(body).length === 0) {
      set({ error: 'No fields provided to update' });
      return null;
    }

    set({ isSaving: true, error: null });

    try {
      const response = await fetch(`/api/v1/tokens/${tokenId}`, {
        method: 'PUT',
        headers: getAuthHeaders(masterToken, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update token');
      }

      const data = await response.json();
      const updated = data.data || {};

      // Update token in list, merging only the fields the server echoed back
      const tokens = get().tokens.map(t =>
        t.id === tokenId ? { ...t, ...updated, id: tokenId } : t
      );

      set({
        tokens,
        isSaving: false,
        error: null,
        success: 'Token updated successfully',
      });

      return updated;
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
        headers: getAuthHeaders(masterToken),
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

  setError: (error) => {
    set({ error });
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
