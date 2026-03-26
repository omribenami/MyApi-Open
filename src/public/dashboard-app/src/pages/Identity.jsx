import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useIdentityStore } from '../stores/identityStore';

// Fields to display/edit for the user profile
const PROFILE_FIELDS = [
  { key: 'Name', label: 'Full Name', placeholder: 'Your full name', type: 'text' },
  { key: 'Email', label: 'Email', placeholder: 'your@email.com', type: 'email' },
  { key: 'Location', label: 'Location', placeholder: 'City, Country', type: 'text' },
  { key: 'Timezone', label: 'Timezone', placeholder: 'e.g. UTC, America/New_York', type: 'text' },
  { key: 'Occupation', label: 'Occupation', placeholder: 'Your role or title', type: 'text' },
  { key: 'GitHub', label: 'GitHub', placeholder: 'github.com/username', type: 'text' },
  { key: 'Website', label: 'Website', placeholder: 'https://yoursite.com', type: 'text' },
  { key: 'Bio', label: 'Bio', placeholder: 'A short description about yourself', type: 'textarea' },
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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {profileError && (
        <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-red-200 text-sm">{profileError}</p>
            <button
              type="button"
              onClick={fetchProfile}
              className="px-3 py-1.5 rounded border border-red-600 text-red-200 hover:bg-red-800/30 text-xs"
            >
              Retry
            </button>
          </div>
          <button onClick={clearProfileError} className="text-red-400 hover:text-red-300 flex-shrink-0">
            ✕
          </button>
        </div>
      )}
      {profileSuccess && (
        <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4 flex items-start justify-between gap-4">
          <p className="text-green-200 text-sm">{profileSuccess}</p>
          <button onClick={clearProfileSuccess} className="text-green-400 hover:text-green-300 flex-shrink-0">
            ✕
          </button>
        </div>
      )}

      {/* Split view: Form + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Edit Form */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Edit Profile</h2>
          <p className="text-slate-400 text-sm mb-6">
            Updates your USER.md identity file
          </p>

          <form onSubmit={handleSave} className="space-y-4">
            {PROFILE_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {field.label}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={profileDraft?.[field.key] || ''}
                    onChange={(e) => updateProfileDraft(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y text-sm"
                  />
                ) : (
                  <input
                    type={field.type}
                    value={profileDraft?.[field.key] || ''}
                    onChange={(e) => updateProfileDraft(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                )}
              </div>
            ))}

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={profileSaving || !profileDirty}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
              >
                {profileSaving ? 'Saving...' : 'Save Profile'}
              </button>
              <button
                type="button"
                onClick={resetProfileDraft}
                disabled={profileSaving || !profileDirty}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 font-medium rounded-lg transition-colors text-sm"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Right: Preview */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Profile Preview</h2>
          <p className="text-slate-400 text-sm mb-6">How your identity will appear</p>

          <div className="space-y-4">
            {/* Avatar placeholder */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
                {(profileDraft?.Name || profile?.user?.username || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold text-lg">
                  {profileDraft?.Name || profile?.user?.username || 'Unknown'}
                </p>
                {profileDraft?.Occupation && (
                  <p className="text-slate-400 text-sm">{profileDraft.Occupation}</p>
                )}
              </div>
            </div>

            <div className="border-t border-slate-700 pt-4 space-y-3">
              {PROFILE_FIELDS.filter((f) => f.key !== 'Name' && f.key !== 'Occupation').map((field) => {
                const val = profileDraft?.[field.key];
                if (!val) return null;
                return (
                  <div key={field.key} className="flex items-start gap-3">
                    <span className="text-slate-500 text-xs w-20 flex-shrink-0 mt-0.5">{field.label}</span>
                    <span className="text-slate-300 text-sm break-all">{val}</span>
                  </div>
                );
              })}
              {!profileDraft || Object.values(profileDraft).every((v) => !v) ? (
                <p className="text-slate-500 text-sm italic">No profile data yet. Fill in the form to the left.</p>
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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">🤖</p>
        <h2 className="text-xl font-bold text-white mb-2">No Personas Found</h2>
        <p className="text-slate-400 mb-4">
          Create a persona in the Personas tab first, then come back here to edit its SOUL.md content.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {personaError && (
        <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-red-200 text-sm">{personaError}</p>
            <button
              type="button"
              onClick={() => {
                clearPersonaError();
                if (selectedPersonaId) fetchSoulContent(selectedPersonaId);
                else fetchPersonas();
              }}
              className="px-3 py-1.5 rounded border border-red-600 text-red-200 hover:bg-red-800/30 text-xs"
            >
              Retry
            </button>
          </div>
          <button onClick={clearPersonaError} className="text-red-400 hover:text-red-300 flex-shrink-0">
            ✕
          </button>
        </div>
      )}
      {personaSuccess && (
        <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4 flex items-start justify-between gap-4">
          <p className="text-green-200 text-sm">{personaSuccess}</p>
          <button onClick={clearPersonaSuccess} className="text-green-400 hover:text-green-300 flex-shrink-0">
            ✕
          </button>
        </div>
      )}

      {/* Persona selector */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <label className="text-sm font-medium text-slate-300 whitespace-nowrap">
          Editing Persona:
        </label>
        <select
          value={selectedPersonaId || ''}
          onChange={handlePersonaChange}
          className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        >
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.active ? '(Active)' : ''}
            </option>
          ))}
        </select>
        {selectedPersona?.description && (
          <p className="text-slate-400 text-xs sm:max-w-xs">{selectedPersona.description}</p>
        )}
      </div>

      {/* Split view: Editor + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Editor */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">SOUL.md Editor</h2>
              <p className="text-slate-400 text-sm mt-1">
                Define the AI persona's personality, tone, and behavior
              </p>
            </div>
            {personaLoading && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 flex-shrink-0" />
            )}
          </div>

          <form onSubmit={handleSave} className="flex flex-col flex-1 gap-4">
            <textarea
              value={soulDraft}
              onChange={(e) => updateSoulDraft(e.target.value)}
              placeholder={`# ${selectedPersona?.name || 'Persona'} SOUL.md\n\nDescribe the AI persona's personality, communication style, values, and behavior here...\n\n## Personality\n- Trait 1\n- Trait 2\n\n## Communication Style\n...\n\n## Values\n...`}
              rows={20}
              className="flex-1 w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono resize-y leading-relaxed"
            />

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={personaSaving || !soulDirty}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
              >
                {personaSaving ? 'Saving...' : 'Save SOUL.md'}
              </button>
              <button
                type="button"
                onClick={resetSoulDraft}
                disabled={personaSaving || !soulDirty}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 font-medium rounded-lg transition-colors text-sm"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Right: Preview */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Preview</h2>
              <p className="text-slate-400 text-sm mt-1">Rendered SOUL.md content</p>
            </div>
            {soulDirty && (
              <span className="px-2 py-1 bg-amber-600 bg-opacity-30 text-amber-300 text-xs rounded border border-amber-700">
                Unsaved changes
              </span>
            )}
          </div>

          {soulDraft ? (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 overflow-auto max-h-[520px]">
              <pre className="text-slate-300 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                {soulDraft}
              </pre>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm italic">
              No content yet. Start writing in the editor.
            </div>
          )}

          {/* Stats */}
          {soulDraft && (
            <div className="mt-4 flex gap-4 text-xs text-slate-500">
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
      <div>
        <h1 className="text-3xl font-bold text-white">Identity</h1>
        <p className="text-slate-400 mt-1">
          Manage your profile and AI persona configurations
        </p>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex gap-1 bg-slate-800 bg-opacity-50 border border-slate-700 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700 hover:bg-opacity-50'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span
              className={`text-xs hidden sm:inline ${
                activeTab === tab.id ? 'text-blue-200' : 'text-slate-500'
              }`}
            >
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
