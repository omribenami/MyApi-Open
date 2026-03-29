import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

export default function TokenVault() {
  const { masterToken } = useAuthStore();
  const [yourTokens, setYourTokens] = useState([]);
  const [guestTokens, setGuestTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareModal, setShareModal] = useState(null);
  const [sharePersonaId, setSharePersonaId] = useState('');
  const [shareDescription, setShareDescription] = useState('');
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    fetchTokens();
  }, [masterToken]);

  const fetchTokens = async () => {
    if (!masterToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/vault/my-tokens', {
        headers: { 'Authorization': `Bearer ${masterToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch tokens');
      const data = await res.json();
      setYourTokens(data.data.yourTokens || []);
      setGuestTokens(data.data.guestTokens || []);
    } catch (err) {
      setError(err.message || 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  };

  const handleMakeShareable = async (tokenId) => {
    if (!shareModal || !masterToken) return;
    setSharing(true);
    try {
      const res = await fetch(`/api/v1/tokens/${tokenId}/make-shareable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${masterToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scopePersonaId: sharePersonaId || null,
          description: shareDescription,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to make token shareable');
      }
      setShareModal(null);
      setSharePersonaId('');
      setShareDescription('');
      fetchTokens();
    } catch (err) {
      setError(err.message);
    } finally {
      setSharing(false);
    }
  };

  const handleUnpublish = async (tokenId) => {
    if (!masterToken || !window.confirm('Remove this token from marketplace?')) return;
    try {
      const res = await fetch(`/api/v1/tokens/${tokenId}/unpublish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${masterToken}` },
      });
      if (!res.ok) throw new Error('Failed to unpublish');
      fetchTokens();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRevoke = async (tokenId) => {
    if (!masterToken || !window.confirm('Revoke this guest token?')) return;
    try {
      const res = await fetch(`/api/v1/vault/${tokenId}/revoke`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${masterToken}` },
      });
      if (!res.ok) throw new Error('Failed to revoke');
      fetchTokens();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="p-8 text-slate-400">Loading tokens...</div>;

  return (
    <div className="space-y-8 p-6">
      {error && (
        <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Your Published Tokens */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Your Published Tokens</h2>
          <p className="text-slate-400">Tokens you've shared with others via marketplace</p>
        </div>

        {yourTokens.length === 0 ? (
          <div className="bg-slate-900 bg-opacity-40 border border-slate-700 rounded-lg p-6 text-center">
            <p className="text-slate-400">No tokens shared yet</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {yourTokens.map((token) => (
              <div
                key={token.id}
                className="bg-slate-900 bg-opacity-50 border border-slate-700 rounded-lg p-4 hover:border-green-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-white">{token.label}</h3>
                      {token.isPublished && (
                        <span className="px-2 py-1 bg-green-900 bg-opacity-60 text-green-300 text-xs rounded border border-green-700">
                          Published
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">Scope: {token.scope}</p>
                  </div>
                  <div className="flex gap-2">
                    {token.isPublished ? (
                      <button
                        onClick={() => handleUnpublish(token.id)}
                        className="px-3 py-1 bg-red-900 bg-opacity-60 text-red-300 hover:bg-opacity-100 rounded text-sm border border-red-700 transition-all"
                      >
                        Unpublish
                      </button>
                    ) : (
                      <button
                        onClick={() => setShareModal(token.id)}
                        className="px-3 py-1 bg-green-900 bg-opacity-60 text-green-300 hover:bg-opacity-100 rounded text-sm border border-green-700 transition-all"
                      >
                        Make Shareable
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500">Created: {new Date(token.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Installed Guest Tokens */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Installed Guest Tokens</h2>
          <p className="text-slate-400">Tokens installed from marketplace with limited access</p>
        </div>

        {guestTokens.length === 0 ? (
          <div className="bg-slate-900 bg-opacity-40 border border-slate-700 rounded-lg p-6 text-center">
            <p className="text-slate-400">No guest tokens installed</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {guestTokens.map((token) => (
              <div
                key={token.id}
                className="bg-slate-900 bg-opacity-50 border border-slate-700 rounded-lg p-4 hover:border-blue-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-white">{token.label}</h3>
                      <span className="px-2 py-1 bg-blue-900 bg-opacity-60 text-blue-300 text-xs rounded border border-blue-700">
                        Guest
                      </span>
                      {token.readOnly && (
                        <span className="px-2 py-1 bg-amber-900 bg-opacity-60 text-amber-300 text-xs rounded border border-amber-700">
                          Read-Only
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">Scope: {token.scope}</p>
                  </div>
                  <button
                    onClick={() => handleRevoke(token.id)}
                    className="px-3 py-1 bg-red-900 bg-opacity-60 text-red-300 hover:bg-opacity-100 rounded text-sm border border-red-700 transition-all"
                  >
                    Revoke
                  </button>
                </div>
                <p className="text-xs text-slate-500">Installed: {new Date(token.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Make Shareable Modal */}
      {shareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-bold text-white">Publish Token to Marketplace</h3>
            <p className="text-slate-400">This will make your token available for others to install (read-only)</p>

            <div>
              <label className="block text-sm text-slate-300 mb-2">Scope to Persona (Optional)</label>
              <input
                type="text"
                value={sharePersonaId}
                onChange={(e) => setSharePersonaId(e.target.value)}
                placeholder="Persona ID or name"
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500"
              />
              <p className="text-xs text-slate-500 mt-1">If set, guests can only use this token with this persona</p>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">Description</label>
              <textarea
                value={shareDescription}
                onChange={(e) => setShareDescription(e.target.value)}
                placeholder="What does this token do? Why share it?"
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500 h-24 resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShareModal(null)}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleMakeShareable(shareModal)}
                disabled={sharing}
                className="px-4 py-2 bg-green-900 text-green-300 rounded hover:bg-green-800 disabled:opacity-50 transition-colors"
              >
                {sharing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
