import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import apiClient from '../utils/apiClient';

function NotificationSettings() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const addToast = useNotificationStore((state) => state.addToast);

  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const notificationTypes = [
    { key: 'device_approval_requested', label: 'Device Approval Requests' },
    { key: 'device_approved', label: 'Device Approved' },
    { key: 'device_revoked', label: 'Device Revoked' },
    { key: 'skill_liked', label: 'Skill Liked' },
    { key: 'skill_used', label: 'Skill Used' },
    { key: 'persona_invoked', label: 'Persona Used' },
    { key: 'guest_token_used', label: 'Guest Token Used' },
    { key: 'token_revoked', label: 'Token Revoked' },
    { key: 'service_connected', label: 'Service Connected' },
  ];

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, [masterToken, currentWorkspace?.id]);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);

    try {
      const headers = masterToken ? { Authorization: `Bearer ${masterToken}` } : undefined;
      const response = await apiClient.get('/notifications/settings', { headers });
      setSettings(response.data?.settings || {});
    } catch (err) {
      console.error('Failed to fetch notification settings:', err);
      setError('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates) => {
    setIsSaving(true);
    setError(null);

    try {
      const headers = masterToken ? { Authorization: `Bearer ${masterToken}` } : undefined;
      const response = await apiClient.put('/notifications/settings', updates, { headers });
      setSettings(response.data.settings || {});
      addToast('Notification settings saved', 'success');
    } catch (err) {
      console.error('Failed to save notification settings:', err);
      setError('Failed to save notification settings');
      addToast('Failed to save notification settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleChannel = (type, channel) => {
    const key = `${type}_${channel}`;
    const newValue = settings[key] ? 0 : 1;
    
    const updates = { [key]: newValue };
    setSettings(prev => ({ ...prev, [key]: newValue }));
    updateSettings(updates);
  };

  const handleEmailDigestChange = (newDigestType) => {
    const updates = { email_digest_type: newDigestType };
    setSettings(prev => ({ ...prev, email_digest_type: newDigestType }));
    updateSettings(updates);
  };

  const handleEnableAll = () => {
    const updates = {};
    notificationTypes.forEach(type => {
      updates[`${type.key}_web`] = 1;
      updates[`${type.key}_email`] = 1;
    });
    setSettings(prev => ({ ...prev, ...updates }));
    updateSettings(updates);
    addToast('All notifications enabled', 'success');
  };

  const handleDisableAll = () => {
    const updates = {};
    notificationTypes.forEach(type => {
      updates[`${type.key}_web`] = 0;
      updates[`${type.key}_email`] = 0;
    });
    setSettings(prev => ({ ...prev, ...updates }));
    updateSettings(updates);
    addToast('All notifications disabled', 'success');
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
        <p className="text-slate-400 mt-4">Loading notification settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Email Digest Settings */}
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Email Digest Settings</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="email_digest"
              value="immediate"
              checked={settings.email_digest_type === 'immediate'}
              onChange={() => handleEmailDigestChange('immediate')}
              disabled={isSaving}
              className="cursor-pointer"
            />
            <div>
              <p className="text-sm font-medium text-slate-100">Send immediately</p>
              <p className="text-xs text-slate-400">Get notified right when something happens</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="email_digest"
              value="daily"
              checked={settings.email_digest_type === 'daily'}
              onChange={() => handleEmailDigestChange('daily')}
              disabled={isSaving}
              className="cursor-pointer"
            />
            <div>
              <p className="text-sm font-medium text-slate-100">Daily digest</p>
              <p className="text-xs text-slate-400">Get one email per day with all events</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="email_digest"
              value="weekly"
              checked={settings.email_digest_type === 'weekly'}
              onChange={() => handleEmailDigestChange('weekly')}
              disabled={isSaving}
              className="cursor-pointer"
            />
            <div>
              <p className="text-sm font-medium text-slate-100">Weekly digest</p>
              <p className="text-xs text-slate-400">Get one email per week with all events</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="email_digest"
              value="disabled"
              checked={settings.email_digest_type === 'disabled'}
              onChange={() => handleEmailDigestChange('disabled')}
              disabled={isSaving}
              className="cursor-pointer"
            />
            <div>
              <p className="text-sm font-medium text-slate-100">Disable all emails</p>
              <p className="text-xs text-slate-400">Only show notifications in-app</p>
            </div>
          </label>
        </div>
      </div>

      {/* Notification Type Settings */}
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-100">Notification Types</h3>
          <div className="flex gap-2">
            <button
              onClick={handleEnableAll}
              disabled={isSaving}
              className="px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded transition-colors"
            >
              Enable All
            </button>
            <button
              onClick={handleDisableAll}
              disabled={isSaving}
              className="px-3 py-1 text-xs font-semibold bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-slate-100 rounded transition-colors"
            >
              Disable All
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {notificationTypes.map(type => (
            <div key={type.key} className="border border-slate-700/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-100">{type.label}</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings[`${type.key}_web`] !== 0}
                      onChange={() => handleToggleChannel(type.key, 'web')}
                      disabled={isSaving}
                      className="cursor-pointer"
                    />
                    <span className="text-sm text-slate-400">In-App</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings[`${type.key}_email`] !== 0}
                      onChange={() => handleToggleChannel(type.key, 'email')}
                      disabled={isSaving}
                      className="cursor-pointer"
                    />
                    <span className="text-sm text-slate-400">Email</span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default NotificationSettings;
