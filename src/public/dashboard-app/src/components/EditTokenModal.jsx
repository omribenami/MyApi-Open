import { useState, useEffect } from 'react';
import { useTokenStore } from '../stores/tokenStore';
import { useAuthStore } from '../stores/authStore';

function EditTokenModal({ isOpen, token, onClose, onSuccess }) {
  const masterToken = useAuthStore((state) => state.masterToken);
  const { updateToken, isSaving, scopes, fetchScopes } = useTokenStore();

  const [selectedScopes, setSelectedScopes] = useState([]);
  const [searchScopes, setSearchScopes] = useState('');

  // Initialize selected scopes when token changes
  useEffect(() => {
    if (token && token.scopes) {
      setSelectedScopes(token.scopes);
    }
  }, [token]);

  // Fetch scopes on mount
  useEffect(() => {
    if (isOpen && masterToken && scopes.length === 0) {
      fetchScopes(masterToken);
    }
  }, [isOpen, masterToken, scopes.length, fetchScopes]);

  const handleScopeToggle = (scope) => {
    setSelectedScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    );
  };

  const handleClearScopes = () => {
    setSelectedScopes([]);
  };

  const handleSelectAll = () => {
    setSelectedScopes(scopes);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedScopes.length === 0) {
      alert('Please select at least one scope');
      return;
    }

    const success = await updateToken(masterToken, token.id, {
      scopes: selectedScopes,
    });

    if (success) {
      onSuccess?.();
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedScopes(token?.scopes || []);
    setSearchScopes('');
    onClose();
  };

  if (!isOpen || !token) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Edit Token Scopes</h2>
            <p className="text-sm text-slate-400 mt-1">{token.label || token.name}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Token Info */}
          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-400 mb-1">Created</p>
                <p className="text-white">
                  {token.createdAt
                    ? new Date(token.createdAt).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-slate-400 mb-1">Expires</p>
                <p className="text-white">
                  {token.expiresAt
                    ? new Date(token.expiresAt).toLocaleDateString()
                    : 'Never'}
                </p>
              </div>
            </div>
          </div>

          {/* Scope Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-slate-300">
                Scopes <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  Select all
                </button>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={handleClearScopes}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Scope Search */}
            <input
              type="text"
              value={searchScopes}
              onChange={(e) => setSearchScopes(e.target.value)}
              placeholder="Search scopes..."
              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 outline-none mb-3 text-sm"
            />

            {/* Selected Scopes Display */}
            {selectedScopes.length > 0 && (
              <div className="bg-slate-900 rounded-lg p-3 mb-3 border border-slate-700">
                <div className="flex flex-wrap gap-2">
                  {selectedScopes.map((scope) => (
                    <span
                      key={scope}
                      className="inline-flex items-center gap-2 bg-blue-600 bg-opacity-30 text-blue-200 px-3 py-1 rounded-lg text-sm"
                    >
                      {scope}
                      <button
                        type="button"
                        onClick={() => handleScopeToggle(scope)}
                        className="text-blue-300 hover:text-blue-100 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Available Scopes */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {scopes.length > 0 ? (
                scopes
                  .filter((scope) =>
                    scope.toLowerCase().includes(searchScopes.toLowerCase())
                  )
                  .map((scope) => (
                    <label
                      key={scope}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope)}
                        onChange={() => handleScopeToggle(scope)}
                        className="w-4 h-4 rounded border border-slate-600 bg-slate-900 text-blue-600 cursor-pointer"
                      />
                      <span className="text-sm text-slate-300">{scope}</span>
                    </label>
                  ))
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">No scopes available</p>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || selectedScopes.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditTokenModal;
