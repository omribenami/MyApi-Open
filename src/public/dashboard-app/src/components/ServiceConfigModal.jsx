import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

function ServiceConfigModal({ isOpen, service, onClose, onSave }) {
  const masterToken = useAuthStore((state) => state.masterToken);
  const [preferences, setPreferences] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (isOpen && service) {
      fetchPreferences();
    }
  }, [isOpen, service]);

  const fetchPreferences = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/services/preferences/${service.name}`,
        {
          credentials: 'include',
          headers: masterToken ? { Authorization: `Bearer ${masterToken}` } : {},
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.data?.preferences || {});
      } else if (response.status === 404) {
        // No preferences set yet, start with empty
        setPreferences(getDefaultPreferences(service.name));
      } else {
        setError('Failed to load preferences');
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);
      setError('Error loading preferences');
      setPreferences(getDefaultPreferences(service.name));
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultPreferences = (serviceName) => {
    const defaults = {
      slack: { default_channel: '' },
      facebook: { default_page_id: '' },
      instagram: { default_account_id: '' },
      twitter: { default_account: '' },
      tiktok: { default_account: '' },
      discord: { default_server_id: '', default_channel_id: '' },
      linkedin: { default_profile_id: '' },
      reddit: { default_subreddit: '' },
      fal: { fal_api_key: '', default_image_model: 'fal-ai/fast-sdxl' },
    };
    return defaults[serviceName] || {};
  };

  const getConfigFields = () => {
    const fields = {
      slack: [
        {
          key: 'default_channel',
          label: 'Default Channel',
          placeholder: '#general',
          help: 'Channel ID or name (e.g., #general or C1234567)',
        },
      ],
      facebook: [
        {
          key: 'default_page_id',
          label: 'Default Page ID',
          placeholder: '1234567890',
          help: 'The Facebook page ID to use by default for posts',
        },
      ],
      instagram: [
        {
          key: 'default_account_id',
          label: 'Default Account ID',
          placeholder: '1234567890',
          help: 'Your Instagram account ID',
        },
      ],
      twitter: [
        {
          key: 'default_account',
          label: 'Default Account Handle',
          placeholder: '@yourhandle',
          help: 'Your Twitter handle (with or without @)',
        },
      ],
      tiktok: [
        {
          key: 'default_account',
          label: 'Default Account Username',
          placeholder: 'yourusername',
          help: 'Your TikTok username',
        },
      ],
      discord: [
        {
          key: 'default_server_id',
          label: 'Default Server ID',
          placeholder: '1234567890',
          help: 'Server ID (right-click server → Copy ID)',
        },
        {
          key: 'default_channel_id',
          label: 'Default Channel ID',
          placeholder: '0987654321',
          help: 'Channel ID (right-click channel → Copy ID)',
        },
      ],
      linkedin: [
        {
          key: 'default_profile_id',
          label: 'Default Profile ID',
          placeholder: 'urn:li:person:1234567890',
          help: 'Your LinkedIn profile URN',
        },
      ],
      reddit: [
        {
          key: 'default_subreddit',
          label: 'Default Subreddit',
          placeholder: 'r/MySubreddit',
          help: 'Subreddit name (with or without r/)',
        },
      ],
      fal: [
        {
          key: 'fal_api_key',
          label: 'fal API Key',
          type: 'password',
          placeholder: 'key_************************',
          help: 'Stored in your encrypted service preferences. Server can also use global FAL_API_KEY.',
        },
        {
          key: 'default_image_model',
          label: 'Default Image Model',
          placeholder: 'fal-ai/fast-sdxl',
          help: 'Optional default model for image generation flows.',
        },
      ],
    };

    return fields[service?.name] || [];
  };

  const handleInputChange = (key, value) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/v1/services/preferences/${service.name}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {}),
          },
          body: JSON.stringify({ preferences }),
        }
      );

      if (response.ok || response.status === 201) {
        setSuccessMessage('Preferences saved successfully!');
        onSave?.(preferences);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save preferences');
      }
    } catch (err) {
      console.error('Error saving preferences:', err);
      setError('Error saving preferences');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !service) return null;

  const configFields = getConfigFields();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Configure {service.label}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Set default preferences for this service
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-700 border-t-blue-500" />
          </div>
        )}

        {/* Content */}
        {!isLoading && (
          <>
            {/* Error Message */}
            {error && (
              <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-3 mb-4">
                <p className="text-sm text-green-200">✓ {successMessage}</p>
              </div>
            )}

            {/* Config Fields */}
            {configFields.length > 0 ? (
              <div className="space-y-4 mb-6">
                {configFields.map((field) => (
                  <div key={field.key}>
                    <label htmlFor={field.key} className="block text-sm font-medium text-slate-300 mb-2">
                      {field.label}
                    </label>
                    <input
                      id={field.key}
                      type={field.type || 'text'}
                      value={preferences[field.key] || ''}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      disabled={isSaving}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors disabled:opacity-50"
                    />
                    {field.help && (
                      <p className="text-xs text-slate-500 mt-1">{field.help}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-900 rounded-lg p-4 mb-6 border border-slate-700">
                <p className="text-sm text-slate-400">
                  No specific preferences available for {service.label} yet.
                </p>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-900 bg-opacity-20 border border-blue-700/50 rounded-lg p-3 mb-6">
              <p className="text-xs text-blue-200">
                ℹ️ These defaults will be automatically used when making requests to {service.label} if specific values aren't provided.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || (configFields.length > 0 && !Object.values(preferences).some(Boolean))}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ServiceConfigModal;
