import { useState, useEffect } from 'react';
import { useTokenStore } from '../stores/tokenStore';
import { useAuthStore } from '../stores/authStore';

function CreateTokenModal({ isOpen, onClose }) {
  const masterToken = useAuthStore((state) => state.masterToken);
  const { createToken, isSaving, scopes, scopeTemplates, fetchScopes } = useTokenStore();

  const [formData, setFormData] = useState({
    label: '',
    description: '',
    selectedScopes: [],
    expiresInHours: 720, // 30 days default
  });

  const [showToken, setShowToken] = useState(false);
  const [createdToken, setCreatedToken] = useState(null);
  const [, setTemplateFilter] = useState('');
  const [searchScopes, setSearchScopes] = useState('');

  // Fetch scopes on mount
  useEffect(() => {
    if (isOpen && masterToken && scopes.length === 0) {
      fetchScopes(masterToken);
    }
  }, [isOpen, masterToken, scopes.length, fetchScopes]);

  const handleScopeToggle = (scope) => {
    setFormData((prev) => ({
      ...prev,
      selectedScopes: prev.selectedScopes.includes(scope)
        ? prev.selectedScopes.filter((s) => s !== scope)
        : [...prev.selectedScopes, scope],
    }));
  };

  const handleTemplateSelect = (templateName) => {
    const templateScopes = scopeTemplates[templateName] || [];
    setFormData((prev) => ({
      ...prev,
      selectedScopes: [...new Set([...prev.selectedScopes, ...templateScopes])],
    }));
    setTemplateFilter('');
  };

  const handleClearScopes = () => {
    setFormData((prev) => ({
      ...prev,
      selectedScopes: [],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.label.trim()) {
      alert('Token name is required');
      return;
    }

    if (formData.selectedScopes.length === 0) {
      alert('Please select at least one scope');
      return;
    }

    const token = await createToken(masterToken, {
      label: formData.label,
      description: formData.description,
      scopes: formData.selectedScopes,
      expiresInHours: formData.expiresInHours === 0 ? null : formData.expiresInHours,
    });

    if (token) {
      setCreatedToken(token);
      setShowToken(true);
    }
  };

  const handleCopyToken = async () => {
    if (createdToken?.token) {
      try {
        await navigator.clipboard.writeText(createdToken.token);
        alert('Token copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy token:', err);
      }
    }
  };

  const handleClose = () => {
    setFormData({
      label: '',
      description: '',
      selectedScopes: [],
      expiresInHours: 720,
    });
    setShowToken(false);
    setCreatedToken(null);
    setTemplateFilter('');
    setSearchScopes('');
    onClose();
  };

  if (!isOpen) return null;

  // Show success screen after token creation
  if (showToken && createdToken) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-md w-full p-6">
          <h2 className="text-2xl font-bold text-white mb-4">✓ Token Created Successfully</h2>

          <div className="space-y-4">
            {/* Warning */}
            <div className="bg-amber-900 bg-opacity-30 border border-amber-700 rounded-lg p-4">
              <p className="text-sm text-amber-200">
                <strong>⚠️ Important:</strong> This is the last time you'll see this token. Copy it now and store it safely!
              </p>
            </div>

            {/* Token Display */}
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide">Token Value</p>
              <div className="flex items-start gap-2">
                <code className="text-xs text-slate-300 font-mono break-all flex-1 bg-slate-800 rounded p-3 select-all">
                  {createdToken.token}
                </code>
                <button
                  onClick={handleCopyToken}
                  className="mt-3 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Token Details */}
            <div className="bg-slate-900 rounded-lg p-4 space-y-2 text-sm">
              <div>
                <span className="text-slate-400">Label:</span>
                <span className="text-white ml-2">{createdToken.label}</span>
              </div>
              {createdToken.scopes && createdToken.scopes.length > 0 && (
                <div>
                  <span className="text-slate-400">Scopes:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {createdToken.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="bg-blue-600 bg-opacity-30 text-blue-200 px-2 py-1 rounded text-xs"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {createdToken.expiresAt && (
                <div>
                  <span className="text-slate-400">Expires:</span>
                  <span className="text-white ml-2">
                    {new Date(createdToken.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show form
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Create New Token</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Token Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Token Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="e.g., API Integration, Mobile App"
              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 outline-none"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What is this token for?"
              rows="3"
              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 outline-none resize-none"
            />
          </div>

          {/* Expiration */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Expiration <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.expiresInHours}
              onChange={(e) => setFormData({ ...formData, expiresInHours: parseInt(e.target.value) })}
              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 outline-none"
            >
              <option value={24}>1 day</option>
              <option value={168}>7 days</option>
              <option value={720}>30 days (default)</option>
              <option value={2160}>90 days</option>
              <option value={8760}>1 year</option>
              <option value={0}>Never expires</option>
            </select>
          </div>

          {/* Scope Templates */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Quick Templates
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(scopeTemplates).map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => handleTemplateSelect(template)}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors capitalize"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>

          {/* Scope Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-slate-300">
                Scopes <span className="text-red-400">*</span>
              </label>
              {formData.selectedScopes.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearScopes}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  Clear all
                </button>
              )}
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
            {formData.selectedScopes.length > 0 && (
              <div className="bg-slate-900 rounded-lg p-3 mb-3 border border-slate-700">
                <div className="flex flex-wrap gap-2">
                  {formData.selectedScopes.map((scope) => (
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
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {scopes.length > 0 ? (
                scopes
                  .filter((scope) => {
                    const name = typeof scope === 'object' ? scope.name : scope;
                    return name.toLowerCase().includes(searchScopes.toLowerCase());
                  })
                  .map((scope) => {
                    const scopeName = typeof scope === 'object' ? scope.name : scope;
                    const scopeDesc = typeof scope === 'object' ? scope.description : null;
                    return (
                      <label
                        key={scopeName}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.selectedScopes.includes(scopeName)}
                          onChange={() => handleScopeToggle(scopeName)}
                          className="w-4 h-4 rounded border border-slate-600 bg-slate-900 text-blue-600 cursor-pointer"
                        />
                        <div>
                          <span className="text-sm text-slate-300">{scopeName}</span>
                          {scopeDesc && <p className="text-xs text-slate-500">{scopeDesc}</p>}
                        </div>
                      </label>
                    );
                  })
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
              disabled={isSaving || !formData.label.trim() || formData.selectedScopes.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Creating...' : 'Create Token'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateTokenModal;
