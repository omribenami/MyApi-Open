import { useState, useEffect } from 'react';
import { isLogoutInProgress } from '../utils/authRuntime';
import { useAuthStore } from '../stores/authStore';
import { useTokenStore } from '../stores/tokenStore';
import EditTokenModal from '../components/EditTokenModal';
import ServiceScopeSelector from '../components/ServiceScopeSelector';
import RevokeConfirmationModal from '../components/RevokeConfirmationModal';

const GUEST_SCOPES = [
  { value: 'basic', label: 'Basic Read', description: 'Name, role, company' },
  { value: 'professional', label: 'Professional', description: 'Skills, education, experience' },
  { value: 'availability', label: 'Availability', description: 'Calendar, timezone' },
  { value: 'personas', label: 'Personas', description: 'Public persona profiles' },
  { value: 'knowledge', label: 'Knowledge', description: 'Knowledge/context read access' },
  { value: 'chat', label: 'Chat', description: 'Conversation and messaging' },
  { value: 'skills:read', label: 'Skills (Read)', description: 'Read skills and metadata' },
  { value: 'skills:write', label: 'Skills (Write)', description: 'Create and manage skills' },
  { value: 'services:read', label: 'Services (Read)', description: 'Proxy GET requests to connected OAuth services' },
  { value: 'services:write', label: 'Services (Write)', description: 'Proxy POST/PUT/DELETE requests to connected OAuth services' },
];

function AccessTokens() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setMasterToken = useAuthStore((state) => state.setMasterToken);
  const {
    tokens,
    isLoading,
    isSaving,
    error,
    success,
    fetchTokens,
    createToken,
    setError,
    clearError,
    clearSuccess,
    selectToken,
    deselectToken,
    selectedToken,
  } = useTokenStore();

  // Master token reveal
  const [masterRevealed, setMasterRevealed] = useState(false);
  const [masterCopied, setMasterCopied] = useState(false);
  const [masterRegenerating, setMasterRegenerating] = useState(false);

  // Guest token modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showServiceScopeModal, setShowServiceScopeModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);

  // Marketplace-installed guest tokens
  const [myPublishedTokens, setMyPublishedTokens] = useState([]);
  const [installedTokens, setInstalledTokens] = useState([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultDeleteTarget, setVaultDeleteTarget] = useState(null);

  // Create guest token form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ label: '', description: '', scopes: [], expiresInHours: '168', requiresApproval: false });
  const [bundleMode, setBundleMode] = useState('custom'); // 'custom' | 'persona_bundle'
  const [bundlePersonaId, setBundlePersonaId] = useState(null);
  const [newlyCreated, setNewlyCreated] = useState(null);
  const [revealedTokens, setRevealedTokens] = useState({});
  const [visibleTokenIds, setVisibleTokenIds] = useState({});
  const [copiedTokenId, setCopiedTokenId] = useState(null);
  const [regeneratingTokenId, setRegeneratingTokenId] = useState(null);

  // Persona scoping
  const [personas, setPersonas] = useState([]);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [allowedPersonas, setAllowedPersonas] = useState([]); // empty = all
  const [allPersonas, setAllPersonas] = useState(true); // "All Personas" checkbox

  // Publish/unpublish state
  const [publishingTokenId, setPublishingTokenId] = useState(null);

  // Re-fetch tokens when switching workspaces or when master token changes
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  useEffect(() => {
    if (masterToken) {
      fetchTokens(masterToken);
      fetchVaultTokens(masterToken);
    }
  }, [masterToken, fetchTokens, currentWorkspace?.id]);

  // OAuth session fallback: lazily bootstrap master token if missing.
  // ONLY bootstrap if masterToken doesn't already exist in localStorage
  useEffect(() => {
    if (!isAuthenticated || isLogoutInProgress() || masterToken) return;

    const stored = localStorage.getItem('masterToken');
    if (stored) {
      setMasterToken(stored);
      return;
    }
    
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (payload) => {
        let t = payload?.bootstrap?.masterToken;
        if (!t) {
          const boot = await fetch('/api/v1/tokens/master/bootstrap', { method: 'POST', credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
          t = boot?.data?.token;
        }
        if (t) setMasterToken(t);
      })
      .catch(() => {});
  }, [masterToken, setMasterToken, isAuthenticated]);

  // Fetch personas when 'personas' scope is toggled on or bundle mode is selected
  useEffect(() => {
    const needsPersonas = createForm.scopes.includes('personas:read') || bundleMode === 'persona_bundle';
    if (needsPersonas && personas.length === 0 && !personasLoading) {
      setPersonasLoading(true);
      fetch('/api/v1/personas', { headers: { Authorization: `Bearer ${masterToken}` } })
        .then((r) => r.json())
        .then((json) => {
          if (json.data) setPersonas(json.data);
        })
        .catch(() => {})
        .finally(() => setPersonasLoading(false));
    }
    // Reset persona selection when personas scope removed (custom mode only)
    if (bundleMode === 'custom' && !createForm.scopes.includes('personas:read')) {
      setAllowedPersonas([]);
      setAllPersonas(true);
    }
  }, [createForm.scopes, bundleMode, masterToken]);

  // Auto-clear messages
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => clearSuccess(), 4000);
      return () => clearTimeout(t);
    }
  }, [success, clearSuccess]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => clearError(), 6000);
      return () => clearTimeout(t);
    }
  }, [error, clearError]);

  const maskToken = (token) => {
    if (!token || token.length <= 8) return '••••••••';
    return `${'•'.repeat(token.length - 8)}${token.slice(-8)}`;
  };


  const getExpiryContext = (expiresAt) => {
    if (!expiresAt) return { label: 'Never', tooltip: 'This token does not expire automatically.' };
    const expiryDate = new Date(expiresAt);
    const diffMs = expiryDate.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const label = expiryDate.toLocaleDateString();
    if (diffDays < 0) return { label, tooltip: `Expired ${Math.abs(diffDays)} day(s) ago` };
    if (diffDays === 0) return { label, tooltip: 'Expires today' };
    return { label, tooltip: `Expires in ${diffDays} day(s)` };
  };
  const copyText = async (text) => {
    if (!text) return false;

    try {
      if (navigator?.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to legacy copy
    }

    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  const handleCopyMaster = async () => {
    const ok = await copyText(masterToken);
    if (ok) {
      setMasterCopied(true);
      setTimeout(() => setMasterCopied(false), 2000);
    }
  };

  const handleRegenerateMaster = async () => {
    setMasterRegenerating(true);
    clearError();
    try {
      const res = await fetch('/api/v1/tokens/master/regenerate', {
        method: 'POST',
        credentials: 'include',  // send session cookie so this works even if bearer token is stale
        headers: { Authorization: `Bearer ${masterToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate master token');

      const newToken = data?.data?.token;
      if (!newToken) throw new Error('No token returned from server');

      setMasterToken(newToken);
      setMasterRevealed(true);
      const ok = await copyText(newToken);
      if (ok) {
        setMasterCopied(true);
        setTimeout(() => setMasterCopied(false), 2000);
      }
      await fetchTokens(newToken);
    } catch (err) {
      setError(err.message || 'Failed to regenerate master token');
    } finally {
      setMasterRegenerating(false);
    }
  };

  const fetchVaultTokens = async (token) => {
    if (!token) return;
    setVaultLoading(true);
    try {
      const res = await fetch('/api/v1/vault/my-tokens', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyPublishedTokens(data.data?.yourTokens || []);
        setInstalledTokens(data.data?.guestTokens || []);
      }
    } catch {
      // ignore
    } finally {
      setVaultLoading(false);
    }
  };

  const handleRevokeInstalledToken = async (tokenId) => {
    try {
      const res = await fetch(`/api/v1/vault/${tokenId}/revoke`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${masterToken}` },
      });
      if (!res.ok) throw new Error('Failed to revoke token');
      await fetchVaultTokens(masterToken);
    } catch (err) {
      setError(err.message || 'Failed to revoke token');
    }
  };

  const handleDeletePublishedToken = async (tokenId) => {
    try {
      const res = await fetch(`/api/v1/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${masterToken}` },
      });
      if (!res.ok) throw new Error('Failed to remove token');
      await fetchTokens(masterToken);
      await fetchVaultTokens(masterToken);
    } catch (err) {
      setError(err.message || 'Failed to remove token');
    }
  };

  const handleScopeToggle = (scope) => {
    setCreateForm((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const handlePersonaToggle = (id) => {
    setAllPersonas(false);
    setAllowedPersonas((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleAllPersonasToggle = () => {
    setAllPersonas(true);
    setAllowedPersonas([]);
  };

  const BUNDLE_SCOPES = ['personas', 'knowledge', 'skills:read', 'chat'];

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    const isBundle = bundleMode === 'persona_bundle';
    const effectiveScopes = isBundle ? BUNDLE_SCOPES : createForm.scopes;
    if (effectiveScopes.length === 0) return;
    if (isBundle && !bundlePersonaId) return;

    const payload = {
      label: createForm.label,
      description: createForm.description || undefined,
      scopes: effectiveScopes,
      expiresInHours: createForm.expiresInHours ? parseInt(createForm.expiresInHours) : null,
      requiresApproval: createForm.requiresApproval,
    };

    if (isBundle) {
      payload.scopeBundle = { persona_id: bundlePersonaId };
      payload.allowedPersonas = [bundlePersonaId];
    } else if (createForm.scopes.includes('personas:read') && !allPersonas && allowedPersonas.length > 0) {
      payload.allowedPersonas = allowedPersonas;
    } else {
      payload.allowedPersonas = [];
    }

    const created = await createToken(masterToken, payload);

    if (created) {
      setNewlyCreated(created);
      if (created.id && created.token) {
        setRevealedTokens((prev) => ({ ...prev, [created.id]: created.token }));
        setVisibleTokenIds((prev) => ({ ...prev, [created.id]: true }));
      }
      setCreateForm({ label: '', description: '', scopes: [], expiresInHours: '168', requiresApproval: false });
      setAllowedPersonas([]);
      setAllPersonas(true);
      setBundleMode('custom');
      setBundlePersonaId(null);
      setShowCreateForm(false);
    }
  };

  const handleCopyNew = async (token) => {
    await copyText(token);
  };

  const getTokenKey = (token) => token?.id || token?.tokenId;

  const regenerateAndStoreToken = async (token) => {
    const tokenKey = getTokenKey(token);
    if (!tokenKey) throw new Error('Invalid token id');

    const res = await fetch(`/api/v1/tokens/${tokenKey}/regenerate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${masterToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to regenerate token');

    const raw = data?.data?.token || null;
    if (raw) {
      setRevealedTokens((prev) => ({ ...prev, [tokenKey]: raw }));
      setVisibleTokenIds((prev) => ({ ...prev, [tokenKey]: true }));
    }
    return raw;
  };

  const handleCopyGuestToken = async (token) => {
    const tokenKey = getTokenKey(token);
    if (!tokenKey) return;

    clearError();
    let rawToken = revealedTokens[tokenKey];

    if (!rawToken) {
      try {
        rawToken = await regenerateAndStoreToken(token);
      } catch (err) {
        setError(err.message || 'Failed to retrieve token');
        return;
      }
    }

    const ok = await copyText(rawToken);
    if (ok) {
      setCopiedTokenId(tokenKey);
      setTimeout(() => setCopiedTokenId(null), 1800);
    }
  };

  const handleRegenerateToken = async (token) => {
    const tokenKey = getTokenKey(token);
    if (!tokenKey) return;

    setRegeneratingTokenId(tokenKey);
    clearError();
    try {
      await regenerateAndStoreToken(token);
      await fetchTokens(masterToken);
    } catch (err) {
      setError(err.message || 'Failed to regenerate token');
    } finally {
      setRegeneratingTokenId(null);
    }
  };

  const handleOpenCreate = () => {
    setShowCreateForm(true);
    setNewlyCreated(null);
    setAllowedPersonas([]);
    setAllPersonas(true);
    setBundleMode('custom');
    setBundlePersonaId(null);
  };

  const handlePublishToken = async (token) => {
    const tokenKey = getTokenKey(token);
    if (!tokenKey) return;
    setPublishingTokenId(tokenKey);
    clearError();
    try {
      const res = await fetch(`/api/v1/tokens/${tokenKey}/make-shareable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: token.description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to publish token');
      await fetchTokens(masterToken);
      await fetchVaultTokens(masterToken);
    } catch (err) {
      setError(err.message || 'Failed to publish token');
    } finally {
      setPublishingTokenId(null);
    }
  };

  const handleUnpublishToken = async (token) => {
    const tokenKey = getTokenKey(token);
    if (!tokenKey) return;
    setPublishingTokenId(tokenKey);
    clearError();
    try {
      const res = await fetch(`/api/v1/tokens/${tokenKey}/unpublish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to unpublish token');
      await fetchTokens(masterToken);
      await fetchVaultTokens(masterToken);
    } catch (err) {
      setError(err.message || 'Failed to unpublish token');
    } finally {
      setPublishingTokenId(null);
    }
  };

  // Guest tokens = non-master tokens that are not revoked
  const guestTokens = tokens.filter((t) => !t.isMaster && t.scope !== 'full' && !t.revokedAt);

  // Resolve persona names for display on token cards
  const getPersonaLabel = (token) => {
    if (!token.scopes || !token.scopes.some((s) => s.includes('personas:read'))) return null;
    if (!token.allowedPersonas || token.allowedPersonas.length === 0) return 'All';
    if (personas.length > 0) {
      const names = token.allowedPersonas
        .map((id) => personas.find((p) => p.id === id)?.name)
        .filter(Boolean);
      if (names.length > 0) return names.join(', ');
    }
    return `${token.allowedPersonas.length} persona(s)`;
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Access Tokens</h1>
        <p className="mt-2 text-slate-400">
          Manage your master token, guest tokens, and marketplace-installed tokens
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-lg bg-red-900 bg-opacity-30 border border-red-700 p-4 flex items-center justify-between">
          <p className="text-sm text-red-200">{error}</p>
          <button onClick={clearError} className="text-red-400 hover:text-red-300 ml-4">×</button>
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-900 bg-opacity-30 border border-green-700 p-4 flex items-center justify-between">
          <p className="text-sm text-green-200">{success}</p>
          <button onClick={clearSuccess} className="text-green-400 hover:text-green-300 ml-4">×</button>
        </div>
      )}

      {/* ── Section 1: Master Token ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            Master Token
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Your primary platform token. Used for AI and API access. Keep it secure — do not share it.
          </p>
        </div>

        <div className="bg-slate-800 border border-amber-700 border-opacity-40 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-600 bg-opacity-30 text-amber-200 text-xs rounded border border-amber-700">
                Master Token
              </span>
              <span className="text-xs text-slate-400">Full access · Never expires</span>
            </div>
          </div>

          <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
            <div className="flex flex-col gap-4">
              <code className="text-sm text-slate-300 font-mono break-all">
                {masterRevealed ? masterToken : maskToken(masterToken)}
              </code>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setMasterRevealed((v) => !v)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  {masterRevealed ? 'Hide' : 'Reveal'}
                </button>
                <button
                  onClick={handleCopyMaster}
                  className="px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  {masterCopied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={handleRegenerateMaster}
                  disabled={masterRegenerating}
                  className="px-3 py-1.5 text-xs text-amber-300 hover:text-amber-200 bg-slate-700 hover:bg-slate-600 rounded transition-colors disabled:opacity-50"
                >
                  {masterRegenerating ? 'Regenerating…' : 'Regenerate'}
                </button>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Regenerating rotates your master token immediately. Your current session keeps working, but any old copied master token stops working.
          </p>
        </div>
      </section>

      {/* ── Section 2: Guest Tokens ── */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              Guest Tokens
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Limited-access tokens you can share with external parties. Assign specific scopes and expiry dates.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
          >
New Token
          </button>
        </div>

        {/* Newly created token banner */}
        {newlyCreated && (
          <div className="bg-green-900 bg-opacity-20 border border-green-700 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-semibold text-green-200">Token Created — Copy it now, it won't be shown again</h3>
            </div>
            <div className="bg-slate-900 rounded p-3 flex items-center gap-3">
              <code className="flex-1 text-sm text-green-300 font-mono break-all">
                {newlyCreated.token}
              </code>
              <button
                onClick={() => handleCopyNew(newlyCreated.token)}
                className="px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 bg-slate-700 rounded transition-colors flex-shrink-0"
              >
                Copy
              </button>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-slate-400">
              <span>Label: <span className="text-slate-300">{newlyCreated.label || newlyCreated.name}</span></span>
              {newlyCreated.expiresAt && (
                <span title={getExpiryContext(newlyCreated.expiresAt).tooltip}>Expires: <span className="text-slate-300">{getExpiryContext(newlyCreated.expiresAt).label}</span></span>
              )}
            </div>
            <button
              onClick={() => setNewlyCreated(null)}
              className="mt-3 text-xs text-green-400 hover:text-green-300 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-white">New Guest Token</h3>
                <button onClick={() => setShowCreateForm(false)} className="text-slate-400 hover:text-slate-200 text-xl">✕</button>
              </div>

            <form onSubmit={handleCreateSubmit} className="space-y-5">
              {/* Mode selector */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Token Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${bundleMode === 'custom' ? 'bg-blue-600/10 border-blue-600' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                    <input type="radio" name="bundleMode" value="custom" checked={bundleMode === 'custom'} onChange={() => setBundleMode('custom')} className="mt-0.5 h-4 w-4 text-blue-600 bg-slate-800 border-slate-600" />
                    <div>
                      <p className="text-sm font-medium text-white">Custom Scopes</p>
                      <p className="text-xs text-slate-400">Pick individual access permissions</p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${bundleMode === 'persona_bundle' ? 'bg-purple-600/10 border-purple-600' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                    <input type="radio" name="bundleMode" value="persona_bundle" checked={bundleMode === 'persona_bundle'} onChange={() => setBundleMode('persona_bundle')} className="mt-0.5 h-4 w-4 text-purple-500 bg-slate-800 border-slate-600" />
                    <div>
                      <p className="text-sm font-medium text-white">Persona Bundle</p>
                      <p className="text-xs text-slate-400">Expose a full persona (skills + knowledge + chat)</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Token Label *</label>
                <input
                  type="text"
                  required
                  value={createForm.label}
                  onChange={(e) => setCreateForm((p) => ({ ...p, label: e.target.value }))}
                  placeholder="e.g., Client XYZ — Interview Access"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description <span className="text-slate-500 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={createForm.description}
                  onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="What is this token used for?"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Scope selection — custom mode */}
              {bundleMode === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Access Scopes *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {GUEST_SCOPES.map((scope) => (
                      <label
                        key={scope.value}
                        className="flex items-start gap-3 p-3 bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 border border-transparent hover:border-slate-600 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={createForm.scopes.includes(scope.value)}
                          onChange={() => handleScopeToggle(scope.value)}
                          className="mt-0.5 h-4 w-4 text-blue-600 bg-slate-800 border-slate-600 rounded"
                        />
                        <div>
                          <p className="text-sm font-medium text-white">{scope.label}</p>
                          <p className="text-xs text-slate-400">{scope.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {createForm.scopes.length === 0 && (
                    <p className="mt-1 text-xs text-red-400">Select at least one scope</p>
                  )}
                </div>
              )}

              {/* Persona bundle mode — scope summary + persona picker */}
              {bundleMode === 'persona_bundle' && (
                <div className="space-y-4">
                  <div className="bg-purple-900/20 border border-purple-700/40 rounded-lg p-3">
                    <p className="text-xs font-medium text-purple-300 mb-1">Included scopes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['personas', 'knowledge', 'skills:read', 'chat'].map(s => (
                        <span key={s} className="px-2 py-0.5 bg-purple-700/30 text-purple-200 text-xs rounded border border-purple-700/50">{s}</span>
                      ))}
                    </div>
                  </div>

                  <div className="border border-slate-600 rounded-lg p-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-slate-200">Select Persona *</p>
                      <p className="text-xs text-slate-400 mt-0.5">This token will be scoped to one persona and its skills and knowledge.</p>
                    </div>
                    {personasLoading ? (
                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                        Loading personas…
                      </div>
                    ) : personas.length === 0 ? (
                      <p className="text-xs text-slate-500">No personas found. Create a persona first.</p>
                    ) : (
                      <div className="space-y-2">
                        {personas.map((persona) => (
                          <label
                            key={persona.id}
                            className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border transition-colors ${bundlePersonaId === persona.id ? 'bg-purple-600/10 border-purple-600' : 'bg-slate-900 border-transparent hover:border-slate-600'}`}
                          >
                            <input
                              type="radio"
                              name="bundlePersona"
                              checked={bundlePersonaId === persona.id}
                              onChange={() => setBundlePersonaId(persona.id)}
                              className="h-4 w-4 text-purple-500 bg-slate-800 border-slate-600"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white">{persona.name}</p>
                              {persona.description && (
                                <p className="text-xs text-slate-400 truncate">{persona.description}</p>
                              )}
                            </div>
                            {persona.active ? <span className="text-xs text-green-400 flex-shrink-0">Active</span> : null}
                          </label>
                        ))}
                      </div>
                    )}
                    {bundleMode === 'persona_bundle' && !bundlePersonaId && (
                      <p className="text-xs text-red-400">Select a persona</p>
                    )}
                  </div>
                </div>
              )}

              {/* Per-persona scoping in custom mode — shown when 'personas' scope is selected */}
              {bundleMode === 'custom' && createForm.scopes.includes('personas') && (
                <div className="border border-slate-600 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">Persona Access</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Choose which personas this token can access. Leave as "All" to allow any persona.
                    </p>
                  </div>

                  {personasLoading ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      Loading personas…
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-2.5 bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 border border-transparent hover:border-slate-600 transition-colors">
                        <input
                          type="checkbox"
                          checked={allPersonas}
                          onChange={handleAllPersonasToggle}
                          className="h-4 w-4 text-blue-600 bg-slate-800 border-slate-600 rounded"
                        />
                        <span className="text-sm font-medium text-white">All Personas</span>
                        <span className="text-xs text-slate-400 ml-auto">Default</span>
                      </label>

                      {personas.length > 0 && (
                        <>
                          <div className="border-t border-slate-700 my-1" />
                          {personas.map((persona) => (
                            <label
                              key={persona.id}
                              className="flex items-center gap-3 p-2.5 bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 border border-transparent hover:border-slate-600 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={allowedPersonas.includes(persona.id)}
                                onChange={() => handlePersonaToggle(persona.id)}
                                className="h-4 w-4 text-blue-600 bg-slate-800 border-slate-600 rounded"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white">{persona.name}</p>
                                {persona.description && (
                                  <p className="text-xs text-slate-400 truncate">{persona.description}</p>
                                )}
                              </div>
                              {persona.active ? <span className="text-xs text-green-400 flex-shrink-0">Active</span> : null}
                            </label>
                          ))}
                        </>
                      )}

                      {personas.length === 0 && (
                        <p className="text-xs text-slate-500 px-1">No personas found — token will have access to all personas.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Expires In</label>
                <select
                  value={createForm.expiresInHours}
                  onChange={(e) => setCreateForm((p) => ({ ...p, expiresInHours: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-900 text-white focus:border-blue-500 focus:outline-none text-sm"
                >
                  <option value="1">1 hour</option>
                  <option value="24">24 hours</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                  <option value="">Never</option>
                </select>
              </div>

              {/* Requires Approval */}
              <label className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 border border-transparent hover:border-slate-600 transition-colors">
                <input
                  type="checkbox"
                  checked={createForm.requiresApproval}
                  onChange={(e) => setCreateForm((p) => ({ ...p, requiresApproval: e.target.checked }))}
                  className="h-4 w-4 text-amber-500 bg-slate-800 border-slate-600 rounded"
                />
                <div>
                  <p className="text-sm font-medium text-white">Requires Approval</p>
                  <p className="text-xs text-slate-400">Anyone using this token must be approved before access is granted</p>
                </div>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || (bundleMode === 'custom' && createForm.scopes.length === 0) || (bundleMode === 'persona_bundle' && !bundlePersonaId)}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Creating...' : 'Create Token'}
                </button>
              </div>
            </form>
          
            </div>
          </div>
        )}


        {/* Guest Tokens List */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : guestTokens.length === 0 ? (
          <div className="rounded-lg bg-slate-800 border-2 border-dashed border-slate-700 p-10 text-center">
                        <h3 className="text-base font-semibold text-white mb-1">No guest tokens</h3>
            <p className="text-sm text-slate-400">
              Create a token to grant limited, scoped access to external parties
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {guestTokens.map((token) => {
              const personaLabel = getPersonaLabel(token);
              const tokenKey = token.id || token.tokenId;
              return (
                <div
                  key={tokenKey}
                  className="bg-slate-800 border border-slate-700 rounded-lg p-5 hover:border-slate-600 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white">{token.label || token.name}</h3>
                      {token.description && (
                        <p className="text-sm text-slate-400 mt-1">{token.description}</p>
                      )}

                      {/* Scopes */}
                      {token.scopes && token.scopes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {token.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="px-2 py-0.5 bg-blue-600 bg-opacity-20 text-blue-300 text-xs rounded border border-blue-700 border-opacity-50"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Persona restriction badge */}
                      {personaLabel && (
                        <div className="mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-600 bg-opacity-20 text-purple-300 text-xs rounded border border-purple-700 border-opacity-50">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Personas: {personaLabel}
                          </span>
                        </div>
                      )}

                      {/* Approval / shareable badges */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(token.requiresApproval || token.requires_approval) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-600/20 text-amber-300 text-xs rounded border border-amber-700/50">
                            Requires Approval
                          </span>
                        ) : null}
                        {(token.isShareable || token.is_shareable) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600/20 text-emerald-300 text-xs rounded border border-emerald-700/50">
                            Published
                          </span>
                        ) : null}
                      </div>

                      {/* Metadata */}
                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-400">
                        {token.createdAt && (
                          <span>Created: {new Date(token.createdAt).toLocaleDateString()}</span>
                        )}
                        {(() => { const exp = getExpiryContext(token.expiresAt); return (
                          <span className={token.expiresAt ? 'text-amber-400' : ''} title={exp.tooltip}>
                            Expires: {exp.label}
                          </span>
                        ); })()}
                      </div>

                      <div className="mt-3 p-3 bg-slate-900 rounded-lg border border-slate-700">
                        <code className="text-xs text-slate-300 font-mono break-all">
                          {revealedTokens[tokenKey] && visibleTokenIds[tokenKey]
                            ? revealedTokens[tokenKey]
                            : maskToken(revealedTokens[tokenKey] || tokenKey || '')}
                        </code>
                        {!revealedTokens[tokenKey] && (
                          <p className="mt-2 text-[11px] text-slate-500">Token secret is hidden until creation/regeneration.</p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 flex-shrink-0 min-w-[150px]">
                      <button
                        onClick={() => { selectToken(token); setShowEditModal(true); }}
                        className="px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { selectToken(token); setShowServiceScopeModal(true); }}
                        className="px-3 py-1.5 text-sm text-purple-400 hover:text-purple-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                        title="Configure per-service access levels"
                      >
                        Services
                      </button>
                      <button
                        onClick={async () => {
                          if (!revealedTokens[tokenKey]) {
                            await handleRegenerateToken(token);
                            return;
                          }
                          setVisibleTokenIds((prev) => ({ ...prev, [tokenKey]: !prev[tokenKey] }));
                        }}
                        className="px-3 py-1.5 text-sm text-slate-200 hover:text-white bg-slate-700 hover:bg-slate-600 rounded transition-colors disabled:opacity-50"
                        disabled={regeneratingTokenId === tokenKey}
                        title={revealedTokens[tokenKey] ? 'Toggle hide/reveal' : 'Regenerate and reveal token'}
                      >
                        {visibleTokenIds[tokenKey] ? 'Hide' : 'Reveal'}
                      </button>
                      <button
                        onClick={() => handleCopyGuestToken(token)}
                        className="px-3 py-1.5 text-sm text-cyan-300 hover:text-cyan-200 bg-slate-700 hover:bg-slate-600 rounded transition-colors disabled:opacity-50"
                        disabled={regeneratingTokenId === tokenKey}
                        title={revealedTokens[tokenKey] ? 'Copy token' : 'Regenerate and copy token'}
                      >
                        {copiedTokenId === tokenKey ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={() => handleRegenerateToken(token)}
                        className="px-3 py-1.5 text-sm text-amber-300 hover:text-amber-200 bg-slate-700 hover:bg-slate-600 rounded transition-colors disabled:opacity-50"
                        disabled={regeneratingTokenId === tokenKey}
                      >
                        {regeneratingTokenId === tokenKey ? 'Regenerating…' : 'Regenerate'}
                      </button>
                      {/* Publish / Unpublish */}
                      {(() => {
                        const hasServiceScope = (token.scopes || []).some(s => s === 'services:read' || s === 'services:write' || s.startsWith('services:'));
                        const isPublished = token.isShareable || token.is_shareable;
                        if (isPublished) {
                          return (
                            <button
                              onClick={() => handleUnpublishToken(token)}
                              disabled={publishingTokenId === tokenKey}
                              className="px-3 py-1.5 text-sm text-emerald-300 hover:text-emerald-200 bg-slate-700 hover:bg-slate-600 rounded transition-colors disabled:opacity-50 col-span-2 sm:col-span-1"
                            >
                              {publishingTokenId === tokenKey ? 'Updating…' : 'Unpublish'}
                            </button>
                          );
                        }
                        return (
                          <button
                            onClick={() => !hasServiceScope && handlePublishToken(token)}
                            disabled={publishingTokenId === tokenKey || hasServiceScope}
                            title={hasServiceScope ? 'Tokens with service scopes cannot be published' : 'Publish to marketplace'}
                            className={`px-3 py-1.5 text-sm rounded transition-colors col-span-2 sm:col-span-1 ${hasServiceScope ? 'text-slate-500 bg-slate-700 cursor-not-allowed opacity-50' : 'text-emerald-400 hover:text-emerald-300 bg-slate-700 hover:bg-slate-600 disabled:opacity-50'}`}
                          >
                            {publishingTokenId === tokenKey ? 'Publishing…' : 'Publish'}
                          </button>
                        );
                      })()}
                      <button
                        onClick={() => { selectToken(token); setShowRevokeModal(true); }}
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors col-span-2 sm:col-span-1"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 3: My Shareable Tokens (publishable, user-created via vault) ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">My Shareable Tokens</h2>
          <p className="mt-1 text-sm text-slate-400">
            Tokens you created that can be published to the marketplace for others to use.
          </p>
        </div>

        {vaultLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-500"></div>
          </div>
        ) : myPublishedTokens.length === 0 ? (
          <div className="rounded-lg bg-slate-800 border-2 border-dashed border-slate-700 p-8 text-center">
            <p className="text-sm text-slate-400">No shareable tokens yet. Create a guest token and publish it to the marketplace.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myPublishedTokens.map((token) => (
              <div key={token.id} className="bg-slate-800 border border-emerald-700/40 rounded-lg p-5 hover:border-emerald-700/60 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{token.label || token.name || 'Untitled'}</h3>
                      {token.isPublished && (
                        <span className="px-2 py-0.5 bg-emerald-900/60 text-emerald-300 text-xs rounded border border-emerald-700">Published</span>
                      )}
                    </div>
                    {token.description && (
                      <p className="text-sm text-slate-400 mt-1">{token.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500">
                      <span>Scope: {token.scope || 'default'}</span>
                      {(token.created_at || token.createdAt) && (
                        <span>Created: {new Date(token.created_at || token.createdAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setVaultDeleteTarget({ ...token, type: 'shareable' })}
                    className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors flex-shrink-0"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 4: Installed from Marketplace ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Installed from Marketplace</h2>
          <p className="mt-1 text-sm text-slate-400">
            Tokens added from the marketplace. Created by other users — used to access their data with their permission.
          </p>
        </div>

        {vaultLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-500"></div>
          </div>
        ) : installedTokens.length === 0 ? (
          <div className="rounded-lg bg-slate-800 border-2 border-dashed border-slate-700 p-8 text-center">
            <p className="text-sm text-slate-400">No installed tokens. Browse the marketplace to find and add tokens from other users.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {installedTokens.map((token) => (
              <div key={token.id} className="bg-slate-800 border border-cyan-700/40 rounded-lg p-5 hover:border-cyan-700/60 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{token.label || token.name || 'Untitled'}</h3>
                      <span className="px-2 py-0.5 bg-cyan-900/60 text-cyan-300 text-xs rounded border border-cyan-700">Installed</span>
                    </div>
                    {token.description && (
                      <p className="text-sm text-slate-400 mt-1">{token.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500">
                      <span>Scope: {token.scope || 'default'}</span>
                      {(token.created_at || token.createdAt) && (
                        <span>Installed: {new Date(token.created_at || token.createdAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setVaultDeleteTarget({ ...token, type: 'installed' })}
                    className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors flex-shrink-0"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Vault token delete/revoke confirmation */}
      {vaultDeleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-red-300 mb-2">
              {vaultDeleteTarget.type === 'installed' ? 'Revoke installed token?' : 'Remove shareable token?'}
            </h3>
            <p className="text-sm text-slate-300 mb-5">
              Are you sure you want to {vaultDeleteTarget.type === 'installed' ? 'revoke' : 'remove'}{' '}
              <span className="font-semibold text-white">{vaultDeleteTarget.label || vaultDeleteTarget.name}</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setVaultDeleteTarget(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (vaultDeleteTarget.type === 'installed') {
                    await handleRevokeInstalledToken(vaultDeleteTarget.id);
                  } else {
                    await handleDeletePublishedToken(vaultDeleteTarget.id);
                  }
                  setVaultDeleteTarget(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm"
              >
                {vaultDeleteTarget.type === 'installed' ? 'Revoke' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <EditTokenModal
        isOpen={showEditModal}
        token={selectedToken}
        onClose={() => { setShowEditModal(false); deselectToken(); }}
        onSuccess={() => { setShowEditModal(false); deselectToken(); fetchTokens(masterToken); }}
      />

      <ServiceScopeSelector
        isOpen={showServiceScopeModal}
        currentToken={selectedToken}
        masterToken={masterToken}
        onClose={() => { setShowServiceScopeModal(false); deselectToken(); }}
        onSuccess={() => { setShowServiceScopeModal(false); deselectToken(); fetchTokens(masterToken); }}
      />

      <RevokeConfirmationModal
        isOpen={showRevokeModal}
        token={selectedToken}
        onClose={() => { setShowRevokeModal(false); deselectToken(); }}
        onConfirm={() => { setShowRevokeModal(false); deselectToken(); fetchTokens(masterToken); }}
      />
    </div>
  );
}

export default AccessTokens;
