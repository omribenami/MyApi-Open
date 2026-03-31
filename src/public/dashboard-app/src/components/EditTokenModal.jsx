import { useState, useEffect } from 'react';
import { useTokenStore } from '../stores/tokenStore';
import { useAuthStore } from '../stores/authStore';

const AVAILABLE_SCOPES = [
  { value: 'basic', label: 'Basic Read', description: 'Name, role, company' },
  { value: 'professional', label: 'Professional', description: 'Skills, education, experience' },
  { value: 'availability', label: 'Availability', description: 'Calendar, timezone' },
  { value: 'personas', label: 'Personas', description: 'Public persona profiles' },
  { value: 'knowledge', label: 'Knowledge', description: 'Knowledge/context read access' },
  { value: 'chat', label: 'Chat', description: 'Conversation and messaging' },
  { value: 'skills:read', label: 'Skills (Read)', description: 'Read skills and metadata' },
  { value: 'skills:write', label: 'Skills (Write)', description: 'Create and manage skills' },
];

function EditTokenModal({ isOpen, token, onClose, onSuccess }) {
  const masterToken = useAuthStore((state) => state.masterToken);
  const { updateToken, isSaving } = useTokenStore();

  const [selectedScopes, setSelectedScopes] = useState([]);

  // Initialize selected scopes when token changes
  useEffect(() => {
    if (token) {
      const tokenScopes = Array.isArray(token.scopes) ? token.scopes
        : token.scope ? [token.scope] : [];
      setSelectedScopes(tokenScopes);
    }
  }, [token]);

  const handleScopeToggle = (scope) => {
    setSelectedScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    );
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
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Scopes <span className="text-red-400">*</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <label
                  key={scope.value}
                  className="flex items-start gap-3 p-3 bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 border border-transparent hover:border-slate-600 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope.value)}
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
