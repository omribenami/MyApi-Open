import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useTokenStore } from '../stores/tokenStore';
import EditTokenModal from '../components/EditTokenModal';
import RevokeConfirmationModal from '../components/RevokeConfirmationModal';

const GUEST_SCOPES = [
  { value: 'read', label: 'Basic Read', description: 'Name, role, company' },
  { value: 'professional', label: 'Professional', description: 'Skills, education, experience' },
  { value: 'availability', label: 'Availability', description: 'Calendar, timezone' },
  { value: 'personas', label: 'Personas', description: 'Public persona profiles' },
  { value: 'knowledge', label: 'Knowledge', description: 'Knowledge base access' },
  { value: 'chat', label: 'Chat', description: 'Conversation and messaging' },
];

function AccessTokens() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const {
    tokens,
    isLoading,
    isSaving,
    error,
    success,
    fetchTokens,
    createToken,
    clearError,
    clearSuccess,
    selectToken,
    deselectToken,
    selectedToken,
  } = useTokenStore();

  // Master token reveal
  const [masterRevealed, setMasterRevealed] = useState(false);
  const [masterCopied, setMasterCopied] = useState(false);

  // Guest token modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);

  // Create guest token form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ label: '', scopes: [], expiresInHours: '168' });
  const [newlyCreated, setNewlyCreated] = useState(null);

  // Persona scoping
  const [personas, setPersonas] = useState([]);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [allowedPersonas, setAllowedPersonas] = useState([]); // empty = all
  const [allPersonas, setAllPersonas] = useState(true); // "All Personas" checkbox

  useEffect(() => {
    if (masterToken) fetchTokens(masterToken);
  }, [masterToken, fetchTokens]);

  // Fetch personas when the 'personas' scope is toggled on
  useEffect(() => {
    if (createForm.scopes.includes('personas') && personas.length === 0 && !personasLoading) {
      setPersonasLoading(true);
      fetch('/api/v1/personas', { headers: { Authorization: `Bearer ${masterToken}` } })
        .then((r) => r.json())
        .then((json) => {
          if (json.data) setPersonas(json.data);
        })
        .catch(() => {})
        .finally(() => setPersonasLoading(false));
    }
    // Reset selection when scope removed
    if (!createForm.scopes.includes('personas')) {
      setAllowedPersonas([]);
      setAllPersonas(true);
    }
  }, [createForm.scopes, masterToken]);

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

  const handleCopyMaster = async () => {
    try {
      await navigator.clipboard.writeText(masterToken);
      setMasterCopied(true);
      setTimeout(() => setMasterCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
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

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (createForm.scopes.length === 0) return;

    const payload = {
      label: createForm.label,
      scopes: createForm.scopes,
      expiresInHours: createForm.expiresInHours ? parseInt(createForm.expiresInHours) : null,
    };

    // Only include allowedPersonas when 'personas' scope is selected and specific ones chosen
    if (createForm.scopes.includes('personas') && !allPersonas && allowedPersonas.length > 0) {
      payload.allowedPersonas = allowedPersonas;
    } else {
      payload.allowedPersonas = []; // empty = all
    }

    const created = await createToken(masterToken, payload);

    if (created) {
      setNewlyCreated(created);
      setCreateForm({ label: '', scopes: [], expiresInHours: '168' });
      setAllowedPersonas([]);
      setAllPersonas(true);
      setShowCreateForm(false);
    }
  };

  const handleCopyNew = async (token) => {
    try {
      await navigator.clipboard.writeText(token);
    } catch {
      /* unavailable */
    }
  };

  const handleOpenCreate = () => {
    setShowCreateForm((v) => !v);
    setNewlyCreated(null);
    // Reset persona state when toggling form
    setAllowedPersonas([]);
    setAllPersonas(true);
  };

  // Guest tokens = non-master tokens that are not revoked
  const guestTokens = tokens.filter((t) => !t.isMaster && t.scope !== 'full' && !t.revokedAt);

  // Resolve persona names for display on token cards
  const getPersonaLabel = (token) => {
    if (!token.scopes || !token.scopes.some((s) => s.includes('personas'))) return null;
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
          Manage your master platform token and generate limited guest tokens for external access
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
            <span className="text-amber-400">★</span> Master Token
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
            <div className="flex items-center justify-between gap-3">
              <code className="text-sm text-slate-300 font-mono break-all flex-1">
                {masterRevealed ? masterToken : maskToken(masterToken)}
              </code>
              <div className="flex gap-2 flex-shrink-0">
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
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            This token is set during server setup and cannot be changed here. To rotate it, update your server configuration.
          </p>
        </div>
      </section>

      {/* ── Section 2: Guest Tokens ── */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <span className="text-blue-400">🎟</span> Guest Tokens
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Limited-access tokens you can share with external parties. Assign specific scopes and expiry dates.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
          >
            {showCreateForm ? 'Cancel' : '+ New Token'}
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
                <span>Expires: <span className="text-slate-300">{new Date(newlyCreated.expiresAt).toLocaleDateString()}</span></span>
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
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">New Guest Token</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-5">
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

              {/* Per-persona scoping — shown when 'personas' scope is selected */}
              {createForm.scopes.includes('personas') && (
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
                      {/* All Personas option */}
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
                              {persona.active ? (
                                <span className="text-xs text-green-400 flex-shrink-0">Active</span>
                              ) : null}
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
                  disabled={isSaving || createForm.scopes.length === 0}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Creating...' : 'Create Token'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Guest Tokens List */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : guestTokens.length === 0 ? (
          <div className="rounded-lg bg-slate-800 border-2 border-dashed border-slate-700 p-10 text-center">
            <div className="text-4xl mb-3">🎟️</div>
            <h3 className="text-base font-semibold text-white mb-1">No guest tokens</h3>
            <p className="text-sm text-slate-400">
              Create a token to grant limited, scoped access to external parties
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {guestTokens.map((token) => {
              const personaLabel = getPersonaLabel(token);
              return (
                <div
                  key={token.id}
                  className="bg-slate-800 border border-slate-700 rounded-lg p-5 hover:border-slate-600 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white">{token.label || token.name}</h3>

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

                      {/* Metadata */}
                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-400">
                        {token.createdAt && (
                          <span>Created: {new Date(token.createdAt).toLocaleDateString()}</span>
                        )}
                        {token.expiresAt ? (
                          <span className="text-amber-400">
                            Expires: {new Date(token.expiresAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span>Expires: Never</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => { selectToken(token); setShowEditModal(true); }}
                        className="px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { selectToken(token); setShowRevokeModal(true); }}
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
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

      {/* Modals */}
      <EditTokenModal
        isOpen={showEditModal}
        token={selectedToken}
        onClose={() => { setShowEditModal(false); deselectToken(); }}
        onSuccess={() => { setShowEditModal(false); deselectToken(); fetchTokens(masterToken); }}
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
