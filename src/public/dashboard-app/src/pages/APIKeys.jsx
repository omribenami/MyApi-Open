import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useTokenStore } from '../stores/tokenStore';
import CreateTokenModal from '../components/CreateTokenModal';
import EditTokenModal from '../components/EditTokenModal';
import RevokeConfirmationModal from '../components/RevokeConfirmationModal';

function APIKeys() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const {
    tokens,
    isLoading,
    error,
    success,
    fetchTokens,
    clearError,
    clearSuccess,
    selectToken,
    deselectToken,
    selectedToken,
  } = useTokenStore();

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revealedTokens, setRevealedTokens] = useState({});
  const [searchFilter, setSearchFilter] = useState('');

  // Fetch tokens on mount
  useEffect(() => {
    if (masterToken) {
      fetchTokens(masterToken);
    }
  }, [masterToken, fetchTokens, currentWorkspace?.id]);

  // Auto-clear messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => clearSuccess(), 4000);
      return () => clearTimeout(timer);
    }
  }, [success, clearSuccess]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => clearError(), 4000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handleEditToken = (token) => {
    selectToken(token);
    setShowEditModal(true);
  };

  const handleRevokeToken = (token) => {
    selectToken(token);
    setShowRevokeModal(true);
  };

  const handleCopyToken = async (token) => {
    try {
      await navigator.clipboard.writeText(token.token);
      alert('Token copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy token:', err);
    }
  };

  const toggleRevealToken = (tokenId) => {
    setRevealedTokens((prev) => ({
      ...prev,
      [tokenId]: !prev[tokenId],
    }));
  };

  const maskToken = (token) => {
    if (!token || token.length <= 3) return token;
    return `${'*'.repeat(Math.max(0, token.length - 3))}${token.substring(token.length - 3)}`;
  };

  const getTokensToDisplay = () => {
    if (!searchFilter.trim()) return tokens;
    const filter = searchFilter.toLowerCase();
    return tokens.filter((token) =>
      (token.label || token.name || '').toLowerCase().includes(filter)
    );
  };

  const displayTokens = getTokensToDisplay();
  const isMasterToken = (token) => token.isMaster || token.scope === 'full';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">API Keys</h1>
          <p className="mt-2 text-slate-400">Manage your MyApi platform credentials and authentication tokens</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors self-start sm:self-auto"
        >
          + Create Token
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-lg bg-red-900 bg-opacity-30 border border-red-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-xl">✕</span>
            <p className="text-sm text-red-200">{error}</p>
          </div>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-900 bg-opacity-30 border border-green-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-xl">✓</span>
            <p className="text-sm text-green-200">{success}</p>
          </div>
          <button
            onClick={clearSuccess}
            className="text-green-400 hover:text-green-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-slate-400">Loading tokens...</p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {!isLoading && displayTokens.length > 0 && (
        <div className="flex gap-4">
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search tokens..."
            className="flex-1 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 outline-none"
          />
        </div>
      )}

      {/* Tokens List */}
      {!isLoading && displayTokens.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            Your Tokens ({displayTokens.length})
          </h2>

          <div className="space-y-3">
            {displayTokens.map((token) => (
              <div
                key={token.id || token.tokenId}
                className="bg-slate-800 border border-slate-700 rounded-lg p-5 hover:border-slate-600 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  {/* Token Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      <div>
                        <h3 className="font-semibold text-white text-lg">
                          {token.label || token.name}
                        </h3>
                        {isMasterToken(token) && (
                          <span className="inline-block mt-1 px-2 py-1 bg-amber-600 bg-opacity-30 text-amber-200 text-xs rounded border border-amber-700">
                            Master Token
                          </span>
                        )}
                      </div>
                    </div>

                    {token.description && (
                      <p className="text-sm text-slate-400 mt-2">{token.description}</p>
                    )}

                    {/* Token Value Display */}
                    {token.token && (
                      <div className="mt-4 p-3 bg-slate-900 rounded border border-slate-700">
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs text-slate-300 font-mono break-all">
                            {revealedTokens[token.id] ? token.token : maskToken(token.token)}
                          </code>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => toggleRevealToken(token.id)}
                              className="text-xs text-slate-400 hover:text-slate-300 whitespace-nowrap px-2 py-1 rounded hover:bg-slate-800"
                            >
                              {revealedTokens[token.id] ? '👁 Hide' : '👁 Show'}
                            </button>
                            <button
                              onClick={() => handleCopyToken(token)}
                              className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap px-2 py-1 rounded hover:bg-slate-800"
                            >
                              📋 Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scopes */}
                    {token.scopes && token.scopes.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">
                          Scopes
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {token.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="inline-block bg-blue-600 bg-opacity-20 text-blue-300 px-2 py-1 rounded text-xs border border-blue-700 border-opacity-50"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-700 text-xs text-slate-400">
                      {token.createdAt && (
                        <div>
                          <span className="font-medium">Created:</span>{' '}
                          {new Date(token.createdAt).toLocaleDateString()}
                        </div>
                      )}
                      {token.expiresAt ? (
                        <div>
                          <span className="font-medium">Expires:</span>{' '}
                          {new Date(token.expiresAt).toLocaleDateString()}
                        </div>
                      ) : (
                        <div>
                          <span className="font-medium">Expires:</span> Never
                        </div>
                      )}
                      {token.lastUsed && (
                        <div>
                          <span className="font-medium">Last used:</span>{' '}
                          {new Date(token.lastUsed).toLocaleDateString()}
                        </div>
                      )}
                      {token.requestCount && (
                        <div>
                          <span className="font-medium">Requests:</span>{' '}
                          {token.requestCount}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
                    {!isMasterToken(token) && (
                      <>
                        <button
                          onClick={() => handleEditToken(token)}
                          className="px-3 py-1 text-sm text-blue-400 hover:text-blue-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRevokeToken(token)}
                          className="px-3 py-1 text-sm text-red-400 hover:text-red-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                        >
                          Revoke
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && tokens.length === 0 && (
        <div className="rounded-lg bg-slate-800 border-2 border-dashed border-slate-700 p-12 text-center">
          <div className="text-5xl mb-4">🔑</div>
          <h3 className="text-lg font-semibold text-white mb-2">No tokens created</h3>
          <p className="text-slate-400 mb-6">
            Create your first API token to start integrating with external services
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Create Your First Token
          </button>
        </div>
      )}

      {/* No search results */}
      {!isLoading && tokens.length > 0 && displayTokens.length === 0 && (
        <div className="rounded-lg bg-slate-800 border border-slate-700 p-8 text-center">
          <p className="text-slate-400">No tokens match your search</p>
        </div>
      )}

      {/* Modals */}
      <CreateTokenModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      <EditTokenModal
        isOpen={showEditModal}
        token={selectedToken}
        onClose={() => {
          setShowEditModal(false);
          deselectToken();
        }}
        onSuccess={() => {
          setShowEditModal(false);
          deselectToken();
          fetchTokens(masterToken);
        }}
      />

      <RevokeConfirmationModal
        isOpen={showRevokeModal}
        token={selectedToken}
        onClose={() => {
          setShowRevokeModal(false);
          deselectToken();
        }}
        onConfirm={() => {
          setShowRevokeModal(false);
          deselectToken();
          fetchTokens(masterToken);
        }}
      />
    </div>
  );
}

export default APIKeys;
