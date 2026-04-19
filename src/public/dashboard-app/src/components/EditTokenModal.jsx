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
  { value: 'tickets:read', label: 'Tickets (Read)', description: 'View complaint tickets' },
  { value: 'tickets:write', label: 'Tickets (Write)', description: 'Create, update and delete tickets' },
];

function EditTokenModal({ isOpen, token, onClose, onSuccess }) {
  const masterToken = useAuthStore((state) => state.masterToken);
  const { updateToken, isSaving } = useTokenStore();

  const [selectedScopes, setSelectedScopes] = useState([]);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [initialRequiresApproval, setInitialRequiresApproval] = useState(false);

  // Initialize form state when the token changes
  useEffect(() => {
    if (token) {
      const tokenScopes = Array.isArray(token.scopes) ? token.scopes
        : token.scope ? [token.scope] : [];
      setSelectedScopes(tokenScopes);
      const initApproval = !!(token.requiresApproval ?? token.requires_approval);
      setRequiresApproval(initApproval);
      setInitialRequiresApproval(initApproval);
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

    // Build partial update — only include fields that actually changed
    const originalScopes = Array.isArray(token?.scopes) ? token.scopes
      : token?.scope ? [token.scope] : [];
    const scopesChanged =
      originalScopes.length !== selectedScopes.length ||
      originalScopes.some((s) => !selectedScopes.includes(s)) ||
      selectedScopes.some((s) => !originalScopes.includes(s));
    const approvalChanged = requiresApproval !== initialRequiresApproval;

    if (!scopesChanged && !approvalChanged) {
      handleClose();
      return;
    }

    const updates = {};
    if (scopesChanged) updates.scopes = selectedScopes;
    if (approvalChanged) updates.requiresApproval = requiresApproval;

    const success = await updateToken(masterToken, token.id, updates);

    if (success) {
      onSuccess?.();
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedScopes(token?.scopes || []);
    setRequiresApproval(initialRequiresApproval);
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

          {/* Requires Approval */}
          <div>
            <label
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                requiresApproval
                  ? 'bg-amber-900/20 border-amber-700/50'
                  : 'bg-slate-900 border-slate-700 hover:border-slate-600'
              }`}
            >
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded text-amber-500 bg-slate-700 border-slate-600"
              />
              <div>
                <p className="text-sm font-medium text-white">Requires Device Approval</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Every new device using this token must be approved from the dashboard before it can access the API.
                </p>
                {requiresApproval !== initialRequiresApproval && requiresApproval && (
                  <p className="text-xs text-amber-300 mt-2">
                    Enabling this will revoke all currently approved devices for this token. They will need to be re-approved.
                  </p>
                )}
              </div>
            </label>
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
