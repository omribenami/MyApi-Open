import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useIdentityStore } from '../stores/identityStore';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Europe/Moscow', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Shanghai',
  'Asia/Hong_Kong', 'Asia/Tokyo', 'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
];

// Fields to display/edit for the user profile
const PROFILE_FIELDS = [
  { key: 'Name', label: 'Full Name', placeholder: 'Your full name', type: 'text' },
  { key: 'Email', label: 'Email', placeholder: 'your@email.com', type: 'email' },
  { key: 'Location', label: 'Location', placeholder: 'City, Country', type: 'text' },
  { key: 'Timezone', label: 'Timezone', type: 'select', options: TIMEZONES },
  { key: 'Role', label: 'Role', placeholder: 'Your role or title', type: 'text' },
  { key: 'GitHub', label: 'GitHub', placeholder: 'github.com/username', type: 'text' },
  { key: 'Website', label: 'Website', placeholder: 'https://yoursite.com', type: 'text' },
  { key: 'Bio', label: 'Bio', placeholder: 'Tell us about yourself (unlimited length)', type: 'textarea' },
];

async function apiRequest(url, options = {}) {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : await res.text().catch(() => '');

  if (!res.ok) {
    const baseMessage = typeof payload === 'object' ? payload?.error : payload;
    const err = new Error(baseMessage || `Request failed (${res.status})`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

function getReadableError(err, fallback) {
  if (err?.status === 429) {
    const retryAfterSeconds = err?.payload?.retryAfterSeconds;
    return retryAfterSeconds
      ? `Too many requests. Please wait ${retryAfterSeconds}s and try again.`
      : 'Too many requests right now. Please wait a moment and retry.';
  }
  if (err?.status >= 500) {
    return 'Server error. Please try again.';
  }
  return err?.message || fallback;
}

function ProfileTab() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const {
    profile,
    profileDraft,
    profileLoading,
    profileSaving,
    profileError,
    profileSuccess,
    profileDirty,
    setProfile,
    updateProfileDraft,
    setProfileLoading,
    setProfileSaving,
    setProfileError,
    clearProfileError,
    setProfileSuccess,
    clearProfileSuccess,
    resetProfileDraft,
  } = useIdentityStore();

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    clearProfileError();
    try {
      const data = await apiRequest('/api/v1/users/me', {
        headers: { Authorization: `Bearer ${masterToken}` },
        credentials: 'include',
      });
      setProfile(data);
    } catch (err) {
      setProfileError(getReadableError(err, 'Failed to load profile'));
    } finally {
      setProfileLoading(false);
    }
  }, [masterToken]);

  useEffect(() => {
    if (masterToken) fetchProfile();
  }, [masterToken, currentWorkspace?.id]);

  // Auto-clear success
  useEffect(() => {
    if (profileSuccess) {
      const t = setTimeout(clearProfileSuccess, 4000);
      return () => clearTimeout(t);
    }
  }, [profileSuccess]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!profileDraft) return;
    setProfileSaving(true);
    clearProfileError();
    try {
      await apiRequest('/api/v1/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${masterToken}`,
        },
        credentials: 'include',
        body: JSON.stringify(profileDraft),
      });
      // Reflect immediately, then re-fetch authoritative state
      setProfile({
        ...(profile || {}),
        identity: { ...(profile?.identity || {}), ...(profileDraft || {}) },
      });
      setProfileSuccess('Profile saved successfully');
      await fetchProfile();
    } catch (err) {
      setProfileError(getReadableError(err, 'Failed to save profile'));
    } finally {
      setProfileSaving(false);
    }
  };

  if (profileLoading && !profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {profileError && (
        <div style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: '6px', padding: '12px 16px', fontSize: '13px' }} className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p>{profileError}</p>
            <button
              type="button"
              onClick={fetchProfile}
              className="px-3 py-1.5 rounded text-[12px]"
              style={{ border: '1px solid var(--red)', color: 'var(--red)', background: 'transparent' }}
            >
              Retry
            </button>
          </div>
          <button onClick={clearProfileError} style={{ color: 'var(--red)', opacity: 0.7 }} className="flex-shrink-0">
            ✕
          </button>
        </div>
      )}
      {profileSuccess && (
        <div style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(63,185,80,0.4)', borderRadius: '6px', padding: '12px 16px', fontSize: '13px' }} className="flex items-start justify-between gap-4">
          <p>{profileSuccess}</p>
          <button onClick={clearProfileSuccess} style={{ color: 'var(--green)', opacity: 0.7 }} className="flex-shrink-0">
            ✕
          </button>
        </div>
      )}

      {/* Split view: Form + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Edit Form */}
        <div className="card p-6">
          <h2 className="text-[15px] font-semibold ink mb-1">Edit Profile</h2>
          <p className="ink-3 text-[13px] mb-6">
            Updates your USER.md identity file
          </p>

          <form onSubmit={handleSave} className="space-y-4">
            {PROFILE_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="text-[13px] ink-2 font-medium mb-1 block">
                  {field.label}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={profileDraft?.[field.key] || ''}
                    onChange={(e) => updateProfileDraft(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={4}
                    className="ui-input w-full resize-y text-[13px]"
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={profileDraft?.[field.key] || ''}
                    onChange={(e) => updateProfileDraft(field.key, e.target.value)}
                    className="ui-input w-full text-[13px]"
                  >
                    <option value="">Select timezone...</option>
                    {field.options?.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    value={profileDraft?.[field.key] || ''}
                    onChange={(e) => updateProfileDraft(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="ui-input w-full text-[13px]"
                  />
                )}
              </div>
            ))}

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={profileSaving || !profileDirty}
                className="btn btn-primary flex-1 text-[13px]"
              >
                {profileSaving ? 'Saving...' : 'Save Profile'}
              </button>
              <button
                type="button"
                onClick={resetProfileDraft}
                disabled={profileSaving || !profileDirty}
                className="btn text-[13px]"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Right: Preview */}
        <div className="card p-6">
          <h2 className="text-[15px] font-semibold ink mb-1">Profile Preview</h2>
          <p className="ink-3 text-[13px] mb-6">How your identity will appear</p>

          <div className="space-y-4">
            {/* Avatar placeholder */}
            <div className="flex items-center gap-4">
              <div
                style={{ width: 64, height: 64, borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--bg-sunk)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <span className="text-2xl font-bold ink" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {(profileDraft?.Name || profile?.user?.username || '?').charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="ink font-semibold text-[15px]">
                  {profileDraft?.Name || profile?.user?.username || 'Unknown'}
                </p>
                {profileDraft?.Role && (
                  <p className="ink-3 text-[13px]">{profileDraft.Role}</p>
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: '20px' }} className="space-y-3">
              {PROFILE_FIELDS.filter((f) => f.key !== 'Name' && f.key !== 'Role').map((field) => {
                const val = profileDraft?.[field.key];
                if (!val) return null;
                return (
                  <div key={field.key} className="flex items-start gap-3">
                    <span className="ink-4 text-[11px] w-20 flex-shrink-0 mt-0.5">{field.label}</span>
                    <span className="ink-2 text-[13px] break-all">{val}</span>
                  </div>
                );
              })}
              {!profileDraft || Object.values(profileDraft).every((v) => !v) ? (
                <p className="ink-4 text-[13px] italic">No profile data yet. Fill in the form to the left.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonaTab() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const {
    personas,
    selectedPersonaId,
    soulDraft,
    personaLoading,
    personaSaving,
    personaError,
    personaSuccess,
    soulDirty,
    setPersonas,
    setSelectedPersonaId,
    setSoulContent,
    updateSoulDraft,
    setPersonaLoading,
    setPersonaSaving,
    setPersonaError,
    clearPersonaError,
    setPersonaSuccess,
    clearPersonaSuccess,
    resetSoulDraft,
  } = useIdentityStore();

  const headers = { Authorization: `Bearer ${masterToken}` };

  const fetchPersonas = useCallback(async () => {
    if (!masterToken) return;
    setPersonaLoading(true);
    clearPersonaError();
    try {
      const data = await apiRequest('/api/v1/personas', { headers });
      const list = data.data || [];
      setPersonas(list);
      // Auto-select active persona
      const active = list.find((p) => p.active) || list[0];
      if (active && !selectedPersonaId) {
        setSelectedPersonaId(active.id);
      }
    } catch (err) {
      setPersonaError(getReadableError(err, 'Failed to load personas'));
    } finally {
      setPersonaLoading(false);
    }
  }, [masterToken]);

  const fetchSoulContent = useCallback(async (personaId) => {
    if (!personaId || !masterToken) return;
    setPersonaLoading(true);
    clearPersonaError();
    try {
      const data = await apiRequest(`/api/v1/personas/${personaId}`, { headers });
      setSoulContent(data.data?.soul_content || '');
    } catch (err) {
      setPersonaError(getReadableError(err, 'Failed to load persona content'));
    } finally {
      setPersonaLoading(false);
    }
  }, [masterToken]);

  useEffect(() => {
    fetchPersonas();
  }, [masterToken, currentWorkspace?.id]);

  useEffect(() => {
    if (selectedPersonaId) {
      fetchSoulContent(selectedPersonaId);
    }
  }, [selectedPersonaId]);

  // Auto-clear success
  useEffect(() => {
    if (personaSuccess) {
      const t = setTimeout(clearPersonaSuccess, 4000);
      return () => clearTimeout(t);
    }
  }, [personaSuccess]);

  const handlePersonaChange = (e) => {
    const id = parseInt(e.target.value);
    if (soulDirty && !window.confirm('You have unsaved SOUL.md changes. Discard and switch persona?')) {
      return;
    }
    setSelectedPersonaId(id);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedPersonaId) return;
    setPersonaSaving(true);
    clearPersonaError();
    try {
      await apiRequest(`/api/v1/personas/${selectedPersonaId}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ soul_content: soulDraft }),
      });
      setSoulContent(soulDraft);
      setPersonaSuccess('AI persona saved successfully');
    } catch (err) {
      setPersonaError(getReadableError(err, 'Failed to save persona'));
    } finally {
      setPersonaSaving(false);
    }
  };

  const selectedPersona = personas.find((p) => p.id === selectedPersonaId);

  if (personaLoading && personas.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--accent)' }} />
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">🤖</p>
        <h2 className="text-[18px] font-bold ink mb-2">No Personas Found</h2>
        <p className="ink-3 text-[14px] mb-4">
          Create a persona in the Personas tab first, then come back here to edit its SOUL.md content.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {personaError && (
        <div style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: '6px', padding: '12px 16px', fontSize: '13px' }} className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p>{personaError}</p>
            <button
              type="button"
              onClick={() => {
                clearPersonaError();
                if (selectedPersonaId) fetchSoulContent(selectedPersonaId);
                else fetchPersonas();
              }}
              className="px-3 py-1.5 rounded text-[12px]"
              style={{ border: '1px solid var(--red)', color: 'var(--red)', background: 'transparent' }}
            >
              Retry
            </button>
          </div>
          <button onClick={clearPersonaError} style={{ color: 'var(--red)', opacity: 0.7 }} className="flex-shrink-0">
            ✕
          </button>
        </div>
      )}
      {personaSuccess && (
        <div style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(63,185,80,0.4)', borderRadius: '6px', padding: '12px 16px', fontSize: '13px' }} className="flex items-start justify-between gap-4">
          <p>{personaSuccess}</p>
          <button onClick={clearPersonaSuccess} style={{ color: 'var(--green)', opacity: 0.7 }} className="flex-shrink-0">
            ✕
          </button>
        </div>
      )}

      {/* Persona selector */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <label className="text-[13px] font-medium ink-2 whitespace-nowrap">
          Editing Persona:
        </label>
        <select
          value={selectedPersonaId || ''}
          onChange={handlePersonaChange}
          className="ui-input flex-1 text-[13px]"
        >
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.active ? '(Active)' : ''}
            </option>
          ))}
        </select>
        {selectedPersona?.description && (
          <p className="ink-3 text-[12px] sm:max-w-xs">{selectedPersona.description}</p>
        )}
      </div>

      {/* Split view: Editor + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Editor */}
        <div className="card p-6 flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-semibold ink">SOUL.md Editor</h2>
              <p className="ink-3 text-[13px] mt-1">
                Define the AI persona's personality, tone, and behavior
              </p>
            </div>
            {personaLoading && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 flex-shrink-0" style={{ borderColor: 'var(--accent)' }} />
            )}
          </div>

          <form onSubmit={handleSave} className="flex flex-col flex-1 gap-4">
            <textarea
              value={soulDraft}
              onChange={(e) => updateSoulDraft(e.target.value)}
              placeholder={`# ${selectedPersona?.name || 'Persona'} SOUL.md\n\nDescribe the AI persona's personality, communication style, values, and behavior here...\n\n## Personality\n- Trait 1\n- Trait 2\n\n## Communication Style\n...\n\n## Values\n...`}
              rows={20}
              className="ui-input flex-1 w-full text-[13px] font-mono resize-y leading-relaxed"
            />

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={personaSaving || !soulDirty}
                className="btn btn-primary flex-1 text-[13px]"
              >
                {personaSaving ? 'Saving...' : 'Save SOUL.md'}
              </button>
              <button
                type="button"
                onClick={resetSoulDraft}
                disabled={personaSaving || !soulDirty}
                className="btn text-[13px]"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Right: Preview */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-semibold ink">Preview</h2>
              <p className="ink-3 text-[13px] mt-1">Rendered SOUL.md content</p>
            </div>
            {soulDirty && (
              <span
                className="text-[11px] rounded px-2 py-1"
                style={{ background: 'color-mix(in srgb, var(--amber) 15%, transparent)', color: 'var(--amber)', border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)' }}
              >
                Unsaved changes
              </span>
            )}
          </div>

          {soulDraft ? (
            <div className="bg-sunk rounded overflow-auto max-h-[520px]" style={{ border: '1px solid var(--line)', borderRadius: '4px', padding: '16px' }}>
              <pre className="ink-2 text-[12px] font-mono whitespace-pre-wrap leading-relaxed">
                {soulDraft}
              </pre>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 ink-4 text-[13px] italic">
              No content yet. Start writing in the editor.
            </div>
          )}

          {/* Stats */}
          {soulDraft && (
            <div className="mt-4 flex gap-4 text-[12px] ink-4">
              <span>{soulDraft.split('\n').length} lines</span>
              <span>{soulDraft.length} characters</span>
              <span>{soulDraft.split(/\s+/).filter(Boolean).length} words</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Identity() {
  const { activeTab, setActiveTab } = useIdentityStore();

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤', description: 'Edit USER.md' },
    { id: 'persona', label: 'AI Persona', icon: '🤖', description: 'Edit SOUL.md' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-4 mb-8">
        <div className="flex-1 min-w-0">
          <div className="micro mb-2">AI BRAIN · IDENTITY</div>
          <h1 className="font-serif text-[22px] sm:text-[34px] leading-[1.05] tracking-tight ink font-medium">Who you are, precisely.</h1>
          <p className="mt-2 text-[15px] ink-2 max-w-[60ch]">Your identity anchors every persona and scopes what agents can reveal about you.</p>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 border-b hairline mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-[13px] border-b-2 -mb-px capitalize flex items-center gap-2 ${
              activeTab === tab.id
                ? 'ink font-medium border-[color:var(--ink)]'
                : 'ink-3 border-transparent hover:ink-2'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span className={`text-[11px] hidden sm:inline ${activeTab === tab.id ? 'ink-3' : 'ink-4'}`}>
              {tab.description}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'profile' ? <ProfileTab /> : <PersonaTab />}
    </div>
  );
}

export default Identity;
