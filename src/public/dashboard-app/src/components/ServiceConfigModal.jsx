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
    if (isOpen && service) fetchPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, service]);

  const fetchPreferences = async () => {
    if (getConfigFields().length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/services/preferences/${service.name}`, {
        credentials: 'include',
        headers: masterToken ? { Authorization: `Bearer ${masterToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setPreferences(data.data?.preferences || {});
      } else if (res.status === 404) {
        setPreferences(getDefaultPreferences(service.name));
      } else {
        setError('Failed to load preferences');
      }
    } catch {
      setError('Error loading preferences');
      setPreferences(getDefaultPreferences(service.name));
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultPreferences = (name) => ({
    slack:     { default_channel: '' },
    facebook:  { default_page_id: '' },
    instagram: { default_account_id: '' },
    twitter:   { default_account: '' },
    tiktok:    { default_account: '' },
    discord:   { bot_token: '', default_server_id: '', default_channel_id: '' },
    linkedin:  { default_profile_id: '' },
    linkedin_pages: { default_organization_id: '' },
    reddit:    { default_subreddit: '' },
    fal:       { fal_api_key: '', default_image_model: 'fal-ai/fast-sdxl' },
  }[name] || {});

  const getConfigFields = () => ({
    slack:     [{ key: 'default_channel',    label: 'Default Channel',        placeholder: '#general',           help: 'Channel ID or name (e.g. #general or C1234567)' }],
    facebook:  [{ key: 'default_page_id',    label: 'Default Page ID',        placeholder: '1234567890',         help: 'Facebook page ID used by default for posts' }],
    instagram: [{ key: 'default_account_id', label: 'Default Account ID',     placeholder: '1234567890',         help: 'Your Instagram account ID' }],
    twitter:   [{ key: 'default_account',    label: 'Default Account Handle', placeholder: '@yourhandle',        help: 'Your Twitter handle (with or without @)' }],
    tiktok:    [{ key: 'default_account',    label: 'Default Account',        placeholder: 'yourusername',       help: 'Your TikTok username' }],
    linkedin:  [{ key: 'default_profile_id', label: 'Default Profile ID',     placeholder: 'urn:li:person:…',   help: 'Your LinkedIn profile URN' }],
    linkedin_pages: [{ key: 'default_organization_id', label: 'Default Organization URN', placeholder: 'urn:li:organization:…', help: 'Default LinkedIn Page/organization URN used as author for posts' }],
    reddit:    [{ key: 'default_subreddit',  label: 'Default Subreddit',      placeholder: 'r/MySubreddit',      help: 'Subreddit name (with or without r/)' }],
    discord: [
      { key: 'bot_token',          label: 'Bot Token',          type: 'password', placeholder: 'MTxxx…', help: 'Discord Developer Portal → your app → Bot → Reset Token. Bot must be in the target server.' },
      { key: 'default_server_id',  label: 'Default Server ID',               placeholder: '1234567890', help: 'Server ID (right-click server → Copy ID)' },
      { key: 'default_channel_id', label: 'Default Channel ID',              placeholder: '0987654321', help: 'Channel ID (right-click channel → Copy ID)' },
    ],
    fal: [
      { key: 'fal_api_key',          label: 'fal API Key',          type: 'password', placeholder: 'key_************************', help: 'Stored encrypted. Server-wide FAL_API_KEY also works as fallback.' },
      { key: 'default_image_model',  label: 'Default Image Model',            placeholder: 'fal-ai/fast-sdxl',  help: 'Optional default model for image generation.' },
    ],
  }[service?.name] || []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/v1/services/preferences/${service.name}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {}),
        },
        body: JSON.stringify({ preferences }),
      });
      if (res.ok || res.status === 201) {
        setSuccessMessage('Preferences saved.');
        onSave?.(preferences);
        setTimeout(onClose, 1500);
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to save preferences');
      }
    } catch {
      setError('Error saving preferences');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !service) return null;

  const configFields = getConfigFields();
  const hasAnyValue = Object.values(preferences).some(Boolean);

  const labelStyle = {
    display: 'block',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10.5,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--ink-3)',
    marginBottom: 6,
  };

  const inputStyle = {
    width: '100%',
    fontSize: 13,
    padding: '8px 10px',
    background: 'var(--bg-sunk)',
    border: '1px solid var(--line)',
    borderRadius: 5,
    color: 'var(--ink)',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50, padding: 16,
    }}>
      <div style={{
        background: 'var(--bg-raised)',
        border: '1px solid var(--line)',
        borderRadius: 8,
        maxWidth: 420, width: '100%',
        padding: 24,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div className="micro" style={{ marginBottom: 6 }}>SERVICES · {service.label.toUpperCase()}</div>
          <h2 className="font-serif ink" style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.01em', margin: '0 0 4px' }}>
            Configure {service.label}
          </h2>
          <p className="ink-3" style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            Set default preferences for this service connection.
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              border: '2px solid var(--line-2)', borderTopColor: 'var(--accent)',
              animation: 'spin 0.7s linear infinite',
            }} />
          </div>
        )}

        {!isLoading && (
          <>
            {/* Error */}
            {error && (
              <div style={{
                background: 'var(--red-bg)',
                border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
                borderLeft: '3px solid var(--red)',
                borderRadius: 5, padding: '10px 12px', marginBottom: 16,
              }}>
                <p style={{ fontSize: 12.5, color: 'var(--red)', margin: 0 }}>{error}</p>
              </div>
            )}

            {/* Success */}
            {successMessage && (
              <div style={{
                background: 'var(--green-bg)',
                border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)',
                borderLeft: '3px solid var(--green)',
                borderRadius: 5, padding: '10px 12px', marginBottom: 16,
              }}>
                <p style={{ fontSize: 12.5, color: 'var(--green)', margin: 0 }}>{successMessage}</p>
              </div>
            )}

            {/* Fields */}
            {configFields.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                {configFields.map((field) => (
                  <div key={field.key}>
                    <label htmlFor={field.key} style={labelStyle}>{field.label}</label>
                    <input
                      id={field.key}
                      type={field.type || 'text'}
                      value={preferences[field.key] || ''}
                      onChange={(e) => setPreferences(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      disabled={isSaving}
                      style={{ ...inputStyle, opacity: isSaving ? 0.5 : 1 }}
                      onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-bg)'; }}
                      onBlur={e => { e.target.style.borderColor = 'var(--line)'; e.target.style.boxShadow = 'none'; }}
                    />
                    {field.help && (
                      <p style={{ fontSize: 11.5, color: 'var(--ink-4)', margin: '5px 0 0', lineHeight: 1.5 }}>{field.help}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                background: 'var(--bg-sunk)', border: '1px solid var(--line)',
                borderRadius: 6, padding: '12px 14px', marginBottom: 20,
              }}>
                <p className="ink-3" style={{ fontSize: 13, margin: 0 }}>
                  No configurable preferences for {service.label} yet.
                </p>
              </div>
            )}

            {/* Info */}
            <div style={{
              background: 'var(--accent-bg)',
              border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
              borderRadius: 5, padding: '9px 12px', marginBottom: 20,
            }}>
              <p style={{ fontSize: 11.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.5 }}>
                These defaults are used automatically when agents call {service.label} without explicit values.
              </p>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} disabled={isSaving} className="ui-button"
                style={{ flex: 1, justifyContent: 'center', opacity: isSaving ? 0.5 : 1 }}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || (configFields.length > 0 && !hasAnyValue)}
                className="btn btn-accent"
                style={{ flex: 1, justifyContent: 'center', opacity: (isSaving || (configFields.length > 0 && !hasAnyValue)) ? 0.5 : 1 }}>
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ServiceConfigModal;
