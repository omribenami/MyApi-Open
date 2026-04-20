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
  const [copiedId, setCopiedId] = useState(null);

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
      await copyText(tokenValue);
      setCopiedId(tokenId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // silently ignore
    }
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
          <div className="micro mb-2">VAULT · CREDENTIALS</div>
          <h1 className="font-serif text-[20px] sm:text-[28px] font-medium tracking-tight ink">External Token Vault.</h1>
          <p className="mt-2 ink-3 text-sm">Securely store API keys and credentials for external services</p>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setError(''); }}
          className="ui-button self-start sm:self-auto"
        >
          + Add Token
        </button>
      </div>

      {error && (
        <div className="rounded p-3 text-sm" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)' }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 mb-4" style={{ borderColor: 'var(--accent)' }}></div>
            <p className="ink-3">Loading tokens...</p>
          </div>
        </div>
      ) : tokens.length === 0 ? (
        <div className="ui-card border-2 border-dashed p-10 text-center">
          <h3 className="text-lg font-semibold ink mb-2">No external tokens stored yet</h3>
          <p className="ink-3 mb-6">Add API keys for OpenAI, AWS, GitHub, Stripe, and more</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="ui-button px-6"
          >
            Add Your First Token
          </button>
        </div>
      ) : (
        <div className="rounded hairline overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-sunk" style={{ borderBottom: '1px solid var(--line)' }}>
                <th className="px-4 py-2.5 text-left micro whitespace-nowrap">Name</th>
                <th className="px-4 py-2.5 text-left micro whitespace-nowrap hidden sm:table-cell">Service</th>
                <th className="px-4 py-2.5 text-left micro whitespace-nowrap">Secret Key</th>
                <th className="px-4 py-2.5 text-left micro whitespace-nowrap hidden lg:table-cell">API Endpoint</th>
                <th className="px-4 py-2.5 text-left micro whitespace-nowrap hidden md:table-cell">Added</th>
                <th className="px-4 py-2.5 text-right micro whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody style={{ borderTop: 'none' }}>
              {tokens.map((token) => {
                const isRevealed = revealedTokens[token.id] !== undefined;
                const displayValue = isRevealed
                  ? revealedTokens[token.id]
                  : (token.tokenPreview ? `${token.tokenPreview.slice(0, 8)}…` : '••••••••••••');
                return (
                  <tr key={token.id} className="row row-cell group" style={{ borderTop: '1px solid var(--line)' }}>
                    {/* Name */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="font-medium ink text-sm">{token.name || token.label}</span>
                    </td>
                    {/* Service */}
                    <td className="px-4 py-2.5 whitespace-nowrap hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-xs ink-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-raised text-[10px] font-bold ink-2 flex-shrink-0">
                          {getServiceIcon(token.service)}
                        </span>
                        {getServiceName(token.service)}
                      </span>
                    </td>
                    {/* Secret Key */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <code className="mono text-[11px] ink-3 bg-sunk px-2 py-0.5 rounded hairline max-w-[160px] truncate">
                          {displayValue}
                        </code>
                        <button
                          onClick={() => handleReveal(token.id)}
                          disabled={revealingId === token.id}
                          title={isRevealed ? 'Hide' : 'Reveal'}
                          className="ink-4 hover:ink-2 transition-colors disabled:opacity-30"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {isRevealed
                              ? <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></>
                              : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></>
                            }
                          </svg>
                        </button>
                      </div>
                    </td>
                    {/* API Endpoint */}
                    <td className="px-4 py-2.5 whitespace-nowrap hidden lg:table-cell">
                      {token.discoveredApiUrl ? (
                        <span className="text-xs truncate max-w-[200px] block" style={{ color: 'var(--green)' }} title={token.discoveredApiUrl}>
                          {token.discoveredApiUrl.replace(/^https?:\/\//, '')}
                          {token.discoveredAuthScheme && token.discoveredAuthScheme !== 'unknown' && (
                            <span className="ml-1 ink-4">({token.discoveredAuthScheme})</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs ink-4">—</span>
                      )}
                    </td>
                    {/* Added */}
                    <td className="px-4 py-2.5 whitespace-nowrap hidden md:table-cell">
                      <span className="text-xs ink-3">
                        {token.createdAt ? new Date(token.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-2.5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopyToken(token.id)}
                          title={copiedId === token.id ? 'Copied!' : 'Copy key'}
                          className={`p-1.5 rounded transition-colors ${copiedId === token.id ? 'accent' : 'ink-4 hover:ink'}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                        </button>
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
                          title="Edit"
                          className="p-1.5 rounded ink-4 hover:ink transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(token)}
                          title="Delete"
                          className="p-1.5 rounded ink-4 transition-colors hover:text-[color:var(--red)]"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Token Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-raised hairline rounded p-6 max-w-md w-full" style={{ background: 'var(--bg-raised)' }}>
            <h2 className="text-xl font-bold ink mb-4">{editingToken ? 'Edit External Token' : 'Add External Token'}</h2>

            {error && (
              <div className="mb-4 p-3 rounded text-sm" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)' }}>
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm ink-2 mb-2">Token Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., My OpenAI API Key"
                  className="ui-input w-full"
                />
              </div>


              <div>
                <label className="block text-sm ink-2 mb-2">Website URL</label>
                <input
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  placeholder="https://example.com"
                  className="ui-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm ink-2 mb-2">API URL (Optional)</label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <input
                    type="url"
                    value={formData.discoveredApiUrl}
                    onChange={(e) => setFormData({ ...formData, discoveredApiUrl: e.target.value })}
                    placeholder="https://api.example.com"
                    className="ui-input flex-1 w-full"
                  />
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <span className="ink-4 text-xs font-semibold uppercase tracking-wider hidden sm:inline">or</span>
                    <button
                      type="button"
                      onClick={handleDiscoverApi}
                      disabled={discovering || !formData.websiteUrl}
                      className="ui-button w-full sm:w-auto whitespace-nowrap disabled:opacity-60"
                      title="Scan Website URL for API endpoint"
                    >
                      {discovering ? 'Scanning...' : 'Scan Website'}
                    </button>
                  </div>
                </div>
                {formData.discoveredAuthScheme && formData.discoveredAuthScheme !== 'unknown' && (
                  <p className="mt-2 text-xs" style={{ color: 'var(--green)' }}>Detected auth: {formData.discoveredAuthScheme}</p>
                )}
              </div>

              <div>
                <label className="block text-sm ink-2 mb-2">Token / API Key</label>
                <textarea
                  value={formData.token}
                  onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                  placeholder="Paste your API key here"
                  className="ui-input mono w-full"
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
                className="flex-1 ui-button"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveToken}
                className="flex-1 ui-button-primary"
              >
                {editingToken ? 'Save Changes' : 'Add Token'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-raised rounded max-w-md w-full p-6" style={{ background: 'var(--bg-raised)', border: '1px solid var(--red)' }}>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--red)' }}>Delete token?</h3>
            <p className="text-sm ink-2 mb-5">
              Are you sure you want to delete <span className="font-semibold ink">{deleteTarget.name || deleteTarget.label}</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 ui-button"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleDeleteToken(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="flex-1 ui-button-danger"
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
