import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

function TokenVault() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const [tokens, setTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', token: '', websiteUrl: '', discoveredApiUrl: '', discoveredAuthScheme: '' });
  const [discovering, setDiscovering] = useState(false);
  // revealedTokens maps id -> decrypted token string (or null if not revealed)
  const [revealedTokens, setRevealedTokens] = useState({});
  const [revealingId, setRevealingId] = useState(null);
  const [editingToken, setEditingToken] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const services = [
    { id: 'openai', name: 'OpenAI' },
    { id: 'stripe', name: 'Stripe' },
    { id: 'aws', name: 'AWS' },
    { id: 'github', name: 'GitHub' },
    { id: 'slack', name: 'Slack' },
    { id: 'twilio', name: 'Twilio' },
    { id: 'sendgrid', name: 'SendGrid' },
    { id: 'other', name: 'Other' },
  ];

  useEffect(() => {
    if (isAuthenticated) {
      fetchTokens();
    }
  }, [isAuthenticated, masterToken, currentWorkspace?.id]);

  const fetchTokens = async () => {
    setIsLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (masterToken) headers['Authorization'] = `Bearer ${masterToken}`;
      const response = await fetch('/api/v1/vault/tokens', {
        headers,
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setTokens(data.tokens || data.data || []);
      } else {
        console.error('Failed to fetch vault tokens:', response.status);
      }
    } catch (err) {
      console.error('Error fetching vault tokens:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscoverApi = async () => {
    if (!formData.websiteUrl) {
      setError('Website URL is required before discovery');
      return;
    }

    setDiscovering(true);
    setError('');
    try {
      const response = await fetch('/api/v1/vault/discover-api', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${masterToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ websiteUrl: formData.websiteUrl }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || 'Failed to discover API URL');
        return;
      }
      setFormData((prev) => ({
        ...prev,
        discoveredApiUrl: payload?.data?.apiBaseUrl || '',
        discoveredAuthScheme: payload?.data?.authScheme || 'unknown',
      }));
    } catch {
      setError('Failed to discover API URL');
    } finally {
      setDiscovering(false);
    }
  };

  const handleSaveToken = async () => {
    if (!formData.name || !formData.token || !formData.websiteUrl) {
      setError('Name, URL, and token are required');
      return;
    }
    setError('');

    try {
      const response = await fetch(editingToken ? `/api/v1/vault/tokens/${editingToken.id}` : '/api/v1/vault/tokens', {
        method: editingToken ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${masterToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          token: formData.token,
          websiteUrl: formData.websiteUrl,
          discoveredApiUrl: formData.discoveredApiUrl,
          discoveredAuthScheme: formData.discoveredAuthScheme,
          discoverApi: !formData.discoveredApiUrl, // only discover if not provided
        }),
      });

      if (response.ok) {
        setFormData({ name: '', token: '', websiteUrl: '', discoveredApiUrl: '', discoveredAuthScheme: '' });
        setShowAddModal(false);
        setEditingToken(null);
        await fetchTokens();
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || `Failed to ${editingToken ? 'update' : 'add'} token`);
      }
    } catch {
      setError(`Error ${editingToken ? 'updating' : 'adding'} token`);
    }
  };

  const handleDeleteToken = async (tokenId) => {

    try {
      const response = await fetch(`/api/v1/vault/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${masterToken}` },
      });

      if (response.ok) {
        setRevealedTokens((prev) => {
          const next = { ...prev };
          delete next[tokenId];
          return next;
        });
        await fetchTokens();
      }
    } catch (err) {
      console.error('Error deleting vault token:', err);
    }
  };

  const handleReveal = async (tokenId) => {
    // Toggle off if already revealed
    if (revealedTokens[tokenId] !== undefined) {
      setRevealedTokens((prev) => {
        const next = { ...prev };
        delete next[tokenId];
        return next;
      });
      return;
    }

    setRevealingId(tokenId);
    try {
      const response = await fetch(`/api/v1/vault/tokens/${tokenId}/reveal`, {
        headers: { 'Authorization': `Bearer ${masterToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRevealedTokens((prev) => ({ ...prev, [tokenId]: data.data.token }));
      }
    } catch (err) {
      console.error('Error revealing vault token:', err);
    } finally {
      setRevealingId(null);
    }
  };

  const copyText = async (text) => {
    if (!text) return false;
    try {
      if (navigator?.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* ignored */ }

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

  const handleCopyToken = async (tokenId) => {
    try {
      let tokenValue = revealedTokens[tokenId];
      if (!tokenValue) {
        const response = await fetch(`/api/v1/vault/tokens/${tokenId}/reveal`, {
          headers: { 'Authorization': `Bearer ${masterToken}` },
        });
        if (!response.ok) {
          alert('Failed to retrieve token');
          return;
        }
        const data = await response.json();
        tokenValue = data.data.token;
        setRevealedTokens((prev) => ({ ...prev, [tokenId]: tokenValue }));
      }
      const ok = await copyText(tokenValue);
      if (ok) {
        alert('Token copied!');
      } else {
        alert('Failed to copy');
      }
    } catch {
      alert('Failed to copy');
    }
  };

  const maskToken = (preview) => {
    if (!preview) return '••••••••';
    return preview;
  };

  const getServiceIcon = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return service?.name?.charAt(0)?.toUpperCase() || 'K';
  };

  const getServiceName = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return service?.name || serviceId || 'Unknown';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">External Token Vault</h1>
          <p className="mt-2 text-slate-400">Securely store API keys and credentials for external services</p>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setError(''); }}
          className="ui-button self-start sm:self-auto"
        >
          + Add Token
        </button>
      </div>

      {error && (
        <div className="ui-toast border-red-500/30 bg-red-500/10 text-red-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-slate-400">Loading tokens...</p>
          </div>
        </div>
      ) : tokens.length === 0 ? (
        <div className="ui-card border-2 border-dashed p-10 text-center">
                    <h3 className="text-lg font-semibold text-white mb-2">No external tokens stored yet</h3>
          <p className="text-slate-400 mb-6">Add API keys for OpenAI, AWS, GitHub, Stripe, and more</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="ui-button px-6"
          >
            Add Your First Token
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tokens.map((token) => (
            <div key={token.id} className="bg-slate-800 border border-slate-700 rounded-lg p-5 hover:border-slate-600 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-sm font-semibold text-slate-200">{getServiceIcon(token.service)}</span>
                    <div>
                      <h3 className="font-medium text-white">{token.name || token.label}</h3>
                      <p className="text-sm text-slate-400">{getServiceName(token.service)}</p>
                    </div>
                  </div>

                  {/* Token Value */}
                  <div className="mt-4 p-3 bg-slate-900 rounded border border-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs text-slate-300 font-mono break-all">
                        {revealedTokens[token.id] !== undefined
                          ? revealedTokens[token.id]
                          : maskToken(token.tokenPreview)}
                      </code>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleReveal(token.id)}
                          disabled={revealingId === token.id}
                          className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1 rounded hover:bg-slate-800 disabled:opacity-50"
                        >
                          {revealingId === token.id
                            ? '...'
                            : revealedTokens[token.id] !== undefined
                              ? 'Hide'
                              : 'Show'}
                        </button>
                        <button
                          onClick={() => handleCopyToken(token.id)}
                          className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-slate-800"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>

                  {token.websiteUrl && (
                    <p className="mt-2 text-xs text-slate-400 break-all">Website: {token.websiteUrl}</p>
                  )}
                  {token.discoveredApiUrl && (
                    <p className="mt-1 text-xs text-emerald-400 break-all">
                      API: {token.discoveredApiUrl}{token.discoveredAuthScheme && token.discoveredAuthScheme !== 'unknown' ? ` (${token.discoveredAuthScheme})` : ''}
                    </p>
                  )}
                  {token.createdAt && (
                    <p className="mt-2 text-xs text-slate-500">
                      Added {new Date(token.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setEditingToken(token);
                      setFormData({
                        name: token.name || token.label || '',
                        token: '',
                        websiteUrl: token.websiteUrl || '',
                        discoveredApiUrl: token.discoveredApiUrl || '',
                        discoveredAuthScheme: token.discoveredAuthScheme || '',
                      });
                      setShowAddModal(true);
                    }}
                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-3 py-2 rounded transition-colors flex-shrink-0"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(token)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded transition-colors flex-shrink-0"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Token Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">{editingToken ? 'Edit External Token' : 'Add External Token'}</h2>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Token Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., My OpenAI API Key"
                  className="w-full px-3 py-2 ui-input focus:border-slate-500 focus:outline-none"
                />
              </div>


              <div>
                <label className="block text-sm text-slate-300 mb-2">Website URL</label>
                <input
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 ui-input focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">API URL (Optional)</label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <input
                    type="url"
                    value={formData.discoveredApiUrl}
                    onChange={(e) => setFormData({ ...formData, discoveredApiUrl: e.target.value })}
                    placeholder="https://api.example.com"
                    className="flex-1 w-full px-3 py-2 ui-input focus:border-slate-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider hidden sm:inline">or</span>
                    <button
                      type="button"
                      onClick={handleDiscoverApi}
                      disabled={discovering || !formData.websiteUrl}
                      className="w-full sm:w-auto px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-slate-100 text-sm border border-slate-600 whitespace-nowrap transition-colors"
                      title="Scan Website URL for API endpoint"
                    >
                      {discovering ? 'Scanning...' : 'Scan Website'}
                    </button>
                  </div>
                </div>
                {formData.discoveredAuthScheme && formData.discoveredAuthScheme !== 'unknown' && (
                  <p className="mt-2 text-xs text-emerald-400">Detected auth: {formData.discoveredAuthScheme}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Token / API Key</label>
                <textarea
                  value={formData.token}
                  onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                  placeholder="Paste your API key here"
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
                  rows={4}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingToken(null);
                  setFormData({ name: '', token: '', websiteUrl: '', discoveredApiUrl: '', discoveredAuthScheme: '' });
                  setError('');
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveToken}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                {editingToken ? 'Save Changes' : 'Add Token'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-red-300 mb-2">Delete token?</h3>
            <p className="text-sm text-slate-300 mb-5">
              Are you sure you want to delete <span className="font-semibold text-white">{deleteTarget.name || deleteTarget.label}</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleDeleteToken(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TokenVault;
