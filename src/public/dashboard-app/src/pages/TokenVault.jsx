import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

function TokenVault() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const [tokens, setTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', service: '', token: '' });
  // revealedTokens maps id -> decrypted token string (or null if not revealed)
  const [revealedTokens, setRevealedTokens] = useState({});
  const [revealingId, setRevealingId] = useState(null);

  const services = [
    { id: 'openai', name: 'OpenAI', icon: '🤖' },
    { id: 'stripe', name: 'Stripe', icon: '💳' },
    { id: 'aws', name: 'AWS', icon: '☁️' },
    { id: 'github', name: 'GitHub', icon: '🐙' },
    { id: 'slack', name: 'Slack', icon: '💬' },
    { id: 'twilio', name: 'Twilio', icon: '📱' },
    { id: 'sendgrid', name: 'SendGrid', icon: '✉️' },
    { id: 'other', name: 'Other', icon: '🔑' },
  ];

  useEffect(() => {
    if (masterToken) {
      fetchTokens();
    }
  }, [masterToken]);

  const fetchTokens = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/vault/tokens', {
        headers: { 'Authorization': `Bearer ${masterToken}` },
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

  const handleAddToken = async () => {
    if (!formData.name || !formData.service || !formData.token) {
      setError('All fields required');
      return;
    }
    setError('');

    try {
      const response = await fetch('/api/v1/vault/tokens', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${masterToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          service: formData.service,
          token: formData.token,
        }),
      });

      if (response.ok) {
        setFormData({ name: '', service: '', token: '' });
        setShowAddModal(false);
        await fetchTokens();
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || 'Failed to add token');
      }
    } catch (err) {
      setError('Error adding token');
    }
  };

  const handleDeleteToken = async (tokenId) => {
    if (!window.confirm('Delete this token?')) return;

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
      await navigator.clipboard.writeText(tokenValue);
      alert('Token copied!');
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
    return service?.icon || '🔑';
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
          <h1 className="text-3xl font-bold text-white">External Token Vault</h1>
          <p className="mt-2 text-slate-400">Securely store API keys and credentials for external services</p>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setError(''); }}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors self-start sm:self-auto"
        >
          + Add Token
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">
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
        <div className="rounded-lg bg-slate-800 border-2 border-dashed border-slate-700 p-12 text-center">
          <div className="text-5xl mb-4">🔐</div>
          <h3 className="text-lg font-semibold text-white mb-2">No external tokens stored yet</h3>
          <p className="text-slate-400 mb-6">Add API keys for OpenAI, AWS, GitHub, Stripe, and more</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
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
                    <span className="text-2xl">{getServiceIcon(token.service)}</span>
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
                              ? '👁 Hide'
                              : '👁 Show'}
                        </button>
                        <button
                          onClick={() => handleCopyToken(token.id)}
                          className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-slate-800"
                        >
                          📋 Copy
                        </button>
                      </div>
                    </div>
                  </div>

                  {token.createdAt && (
                    <p className="mt-2 text-xs text-slate-500">
                      Added {new Date(token.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => handleDeleteToken(token.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded transition-colors flex-shrink-0"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Token Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Add External Token</h2>

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
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Service</label>
                <select
                  value={formData.service}
                  onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select service...</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                  ))}
                </select>
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
                  setFormData({ name: '', service: '', token: '' });
                  setError('');
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToken}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                Add Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TokenVault;
