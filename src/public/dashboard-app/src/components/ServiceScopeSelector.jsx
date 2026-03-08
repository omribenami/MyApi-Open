import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

// Available services from DB seed
const AVAILABLE_SERVICES = [
  'google',
  'github',
  'slack',
  'discord',
  'tiktok',
  'facebook',
  'instagram',
  'linkedin',
  'twitter',
  'reddit',
  'whatsapp',
  'stripe',
  'paypal',
  'notion',
  'airtable',
  'asana',
  'trello',
];

// Scope level options for each service
const SCOPE_LEVELS = [
  { value: 'read', label: 'Read Only', description: 'GET requests only' },
  { value: 'write', label: 'Write', description: 'GET, POST, PUT, PATCH requests' },
  { value: '*', label: 'All', description: 'All scopes for this service' },
];

function ServiceScopeSelector({ isOpen, currentToken, onClose, onSuccess, masterToken }) {
  const authMasterToken = useAuthStore((state) => state.masterToken);
  const token = masterToken || authMasterToken;

  // Service toggles: { [serviceName]: { enabled: bool, level: 'read'|'write'|'*' } }
  const [services, setServices] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Initialize services from currentToken's scopes on mount
  useEffect(() => {
    if (currentToken && isOpen) {
      const initialized = {};

      // Initialize all services as disabled
      AVAILABLE_SERVICES.forEach((service) => {
        initialized[service] = { enabled: false, level: 'read' };
      });

      // Parse existing scopes and populate
      if (currentToken.scopes && Array.isArray(currentToken.scopes)) {
        currentToken.scopes.forEach((scope) => {
          // Match patterns like: services:github:read, services:google:write, services:slack:*
          const match = scope.match(/^services:([^:]+):(.+)$/);
          if (match) {
            const [, serviceName, level] = match;
            if (initialized[serviceName]) {
              initialized[serviceName] = { enabled: true, level };
            }
          }
        });
      }

      setServices(initialized);
      setError(null);
    }
  }, [currentToken, isOpen]);

  // Build the final scope string from current service selections
  const buildScopeString = () => {
    const serviceScopes = [];

    Object.entries(services).forEach(([serviceName, config]) => {
      if (config.enabled) {
        serviceScopes.push(`services:${serviceName}:${config.level}`);
      }
    });

    return serviceScopes.join(', ');
  };

  const handleServiceToggle = (serviceName) => {
    setServices((prev) => ({
      ...prev,
      [serviceName]: {
        ...prev[serviceName],
        enabled: !prev[serviceName].enabled,
      },
    }));
  };

  const handleLevelChange = (serviceName, newLevel) => {
    setServices((prev) => ({
      ...prev,
      [serviceName]: {
        ...prev[serviceName],
        level: newLevel,
      },
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentToken || !token) {
      setError('Missing token information');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Build scope array from service selections
      const newScopes = [];

      // Preserve non-service scopes (e.g., 'read', 'professional', 'personas:read', etc.)
      if (currentToken.scopes && Array.isArray(currentToken.scopes)) {
        currentToken.scopes.forEach((scope) => {
          // Only keep non-service scopes
          if (!scope.startsWith('services:')) {
            newScopes.push(scope);
          }
        });
      }

      // Add new service scopes
      Object.entries(services).forEach(([serviceName, config]) => {
        if (config.enabled) {
          newScopes.push(`services:${serviceName}:${config.level}`);
        }
      });

      // PATCH the token with updated scopes
      const response = await fetch(`/api/v1/tokens/${currentToken.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scopes: newScopes }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update token scopes');
      }

      const data = await response.json();
      onSuccess?.(data.data);
      handleClose();
    } catch (err) {
      setError(err.message || 'Failed to save service scopes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setServices({});
    setError(null);
    onClose();
  };

  const currentScopeString = buildScopeString();
  const enabledServiceCount = Object.values(services).filter((s) => s.enabled).length;

  if (!isOpen || !currentToken) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Service Scopes</h2>
            <p className="text-sm text-slate-400 mt-1">
              Configure per-service access for: <span className="font-medium">{currentToken.label || currentToken.name}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-900 bg-opacity-30 border border-red-700 p-4">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <p className="text-sm text-slate-300">
              Select which services this token can access, and the scope level for each service:
            </p>
            <ul className="text-xs text-slate-400 mt-2 space-y-1 ml-4">
              <li>
                <strong>Read:</strong> GET requests only (read data)
              </li>
              <li>
                <strong>Write:</strong> GET, POST, PUT, PATCH requests (read & modify)
              </li>
              <li>
                <strong>All:</strong> All operations for the service
              </li>
            </ul>
          </div>

          {/* Services Grid */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Services ({enabledServiceCount} selected)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {AVAILABLE_SERVICES.map((serviceName) => {
                const config = services[serviceName];
                if (!config) return null;

                return (
                  <div
                    key={serviceName}
                    className={`rounded-lg border transition-colors p-4 ${
                      config.enabled
                        ? 'bg-slate-900 border-blue-600 border-opacity-50'
                        : 'bg-slate-900 border-slate-700'
                    }`}
                  >
                    {/* Service toggle */}
                    <label className="flex items-center gap-3 mb-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={() => handleServiceToggle(serviceName)}
                        className="h-4 w-4 text-blue-600 bg-slate-800 border-slate-600 rounded"
                      />
                      <span className="font-medium text-white capitalize">{serviceName}</span>
                    </label>

                    {/* Scope level selector (shown when enabled) */}
                    {config.enabled && (
                      <div className="space-y-2">
                        {SCOPE_LEVELS.map((level) => (
                          <label
                            key={level.value}
                            className="flex items-start gap-2 text-xs cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={`${serviceName}-level`}
                              value={level.value}
                              checked={config.level === level.value}
                              onChange={() => handleLevelChange(serviceName, level.value)}
                              className="mt-1 h-3 w-3 text-blue-600 bg-slate-800 border-slate-600"
                            />
                            <div>
                              <p className="text-slate-200 font-medium">{level.label}</p>
                              <p className="text-slate-500">{level.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scope Preview */}
          <div className="border-t border-slate-700 pt-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Final Scope String
            </label>
            <div className="bg-slate-900 rounded-lg border border-slate-700 p-4">
              {currentScopeString ? (
                <code className="text-sm text-slate-200 font-mono block break-all">
                  {currentScopeString}
                </code>
              ) : (
                <p className="text-sm text-slate-500 italic">No services selected</p>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Only service scopes are shown here. Existing non-service scopes will be preserved.
            </p>
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
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Scopes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ServiceScopeSelector;
