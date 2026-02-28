import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import DeleteAccountModal from '../components/DeleteAccountModal';
import ExportDataModal from '../components/ExportDataModal';

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI helpers
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({ title, description, icon, children, danger }) {
  return (
    <div
      className={`rounded-lg p-6 ${
        danger
          ? 'bg-slate-800 border-2 border-red-800'
          : 'bg-slate-800 border border-slate-700'
      }`}
    >
      <div className="flex items-center gap-3 mb-1">
        <span className="text-xl">{icon}</span>
        <h2 className={`text-lg font-semibold ${danger ? 'text-red-400' : 'text-white'}`}>
          {title}
        </h2>
      </div>
      {description && <p className="text-slate-400 text-sm mb-6 ml-9">{description}</p>}
      <div className="ml-0">{children}</div>
    </div>
  );
}

function SuccessBanner({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4 flex items-center justify-between gap-4">
      <p className="text-green-200 text-sm">{message}</p>
      <button onClick={onClose} className="text-green-400 hover:text-green-300 flex-shrink-0">
        ✕
      </button>
    </div>
  );
}

function ErrorBanner({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4 flex items-center justify-between gap-4">
      <p className="text-red-200 text-sm">{message}</p>
      <button onClick={onClose} className="text-red-400 hover:text-red-300 flex-shrink-0">
        ✕
      </button>
    </div>
  );
}

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Tokyo',
  'Australia/Sydney', 'Pacific/Auckland',
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Profile Settings Section
// ─────────────────────────────────────────────────────────────────────────────

function ProfileSection() {
  const masterToken = useAuthStore((state) => state.masterToken);
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
  } = useSettingsStore();

  const fetchProfile = useCallback(async () => {
    if (!masterToken) return;
    setProfileLoading(true);
    clearProfileError();
    try {
      const res = await fetch('/api/v1/users/me', {
        headers: { Authorization: `Bearer ${masterToken}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setProfile(data);
    } catch (err) {
      setProfileError(err.message || 'Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  }, [masterToken]);

  useEffect(() => {
    if (masterToken) fetchProfile();
  }, [masterToken]);

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
      const body = {
        Name: profileDraft.displayName,
        Email: profileDraft.email,
        Timezone: profileDraft.timezone,
      };
      const res = await fetch('/api/v1/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${masterToken}`,
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save profile');
      setProfileSuccess('Profile updated successfully');
      await fetchProfile();
    } catch (err) {
      setProfileError(err.message || 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  if (profileLoading && !profile) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <SectionCard title="Profile Settings" description="Update your display name, contact details, and preferences" icon="👤">
      <div className="space-y-4">
        <ErrorBanner message={profileError} onClose={clearProfileError} />
        <SuccessBanner message={profileSuccess} onClose={clearProfileSuccess} />

        {/* Avatar placeholder */}
        <div className="flex items-center gap-4 pb-4 border-b border-slate-700">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
            {(profileDraft?.displayName || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-white font-medium">{profileDraft?.displayName || 'User'}</p>
            <p className="text-slate-400 text-sm">{profileDraft?.email || ''}</p>
            <button className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Change avatar (coming soon)
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Display Name</label>
              <input
                type="text"
                value={profileDraft?.displayName || ''}
                onChange={(e) => updateProfileDraft('displayName', e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={profileDraft?.email || ''}
                onChange={(e) => updateProfileDraft('email', e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Timezone</label>
              <select
                value={profileDraft?.timezone || 'UTC'}
                onChange={(e) => updateProfileDraft('timezone', e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Language</label>
              <select
                value={profileDraft?.language || 'en'}
                onChange={(e) => updateProfileDraft('language', e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={profileSaving || !profileDirty}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
            >
              {profileSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={resetProfileDraft}
              disabled={profileSaving || !profileDirty}
              className="px-5 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 font-medium rounded-lg transition-colors text-sm"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Security Section
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_SESSIONS = [
  { id: 1, device: 'Chrome on macOS', location: 'San Francisco, US', lastActive: '2 minutes ago', current: true },
  { id: 2, device: 'Safari on iPhone', location: 'San Francisco, US', lastActive: '1 hour ago', current: false },
  { id: 3, device: 'Firefox on Linux', location: 'New York, US', lastActive: '3 days ago', current: false },
];

function SecuritySection() {
  const {
    passwordDraft,
    passwordSaving,
    passwordError,
    passwordSuccess,
    twoFactorEnabled,
    updatePasswordDraft,
    clearPasswordDraft,
    setPasswordSaving,
    setPasswordError,
    clearPasswordError,
    setPasswordSuccess,
    clearPasswordSuccess,
    toggleTwoFactor,
  } = useSettingsStore();

  const [sessions, setSessions] = useState(MOCK_SESSIONS);

  useEffect(() => {
    if (passwordSuccess) {
      const t = setTimeout(clearPasswordSuccess, 4000);
      return () => clearTimeout(t);
    }
  }, [passwordSuccess]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    clearPasswordError();

    if (!passwordDraft.current) {
      setPasswordError('Current password is required');
      return;
    }
    if (passwordDraft.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (passwordDraft.newPassword !== passwordDraft.confirm) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordSaving(true);
    // Simulate API call — hook up to real endpoint when available
    await new Promise((r) => setTimeout(r, 800));
    setPasswordSaving(false);
    clearPasswordDraft();
    setPasswordSuccess('Password changed successfully');
  };

  const handleRevokeSession = (id) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <SectionCard title="Security" description="Manage your password, 2FA, and active sessions" icon="🔒">
      <div className="space-y-8">

        {/* Change Password */}
        <div>
          <h3 className="text-base font-medium text-white mb-4">Change Password</h3>
          <ErrorBanner message={passwordError} onClose={clearPasswordError} />
          {passwordSuccess && (
            <SuccessBanner message={passwordSuccess} onClose={clearPasswordSuccess} />
          )}
          <form onSubmit={handleChangePassword} className="space-y-3 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Current Password</label>
              <input
                type="password"
                value={passwordDraft.current}
                onChange={(e) => updatePasswordDraft('current', e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={passwordDraft.newPassword}
                  onChange={(e) => updatePasswordDraft('newPassword', e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={passwordDraft.confirm}
                  onChange={(e) => updatePasswordDraft('confirm', e.target.value)}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={passwordSaving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm"
            >
              {passwordSaving ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* 2FA */}
        <div className="border-t border-slate-700 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium text-white">Two-Factor Authentication</h3>
              <p className="text-slate-400 text-sm mt-1">
                Add an extra layer of security to your account
              </p>
              {twoFactorEnabled && (
                <span className="inline-block mt-2 px-2 py-0.5 bg-green-900 bg-opacity-40 text-green-400 text-xs rounded border border-green-800">
                  Enabled
                </span>
              )}
            </div>
            <button
              onClick={toggleTwoFactor}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${
                twoFactorEnabled ? 'bg-blue-600' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {twoFactorEnabled && (
            <div className="mt-4 p-4 bg-blue-900 bg-opacity-20 border border-blue-800 rounded-lg">
              <p className="text-sm text-blue-300">
                2FA setup via authenticator app coming soon. This toggle is a UI placeholder for the MVP.
              </p>
            </div>
          )}
        </div>

        {/* Active Sessions */}
        <div className="border-t border-slate-700 pt-6">
          <h3 className="text-base font-medium text-white mb-4">Active Sessions</h3>
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 bg-slate-900 border border-slate-700 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">
                    {session.device.includes('iPhone') || session.device.includes('Android') ? '📱' : '💻'}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{session.device}</p>
                      {session.current && (
                        <span className="px-1.5 py-0.5 bg-green-900 bg-opacity-40 text-green-400 text-xs rounded border border-green-800">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{session.location}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Last active: {session.lastActive}</p>
                  </div>
                </div>
                {!session.current && (
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 border border-red-800 hover:border-red-600 rounded-lg transition-colors flex-shrink-0"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="text-slate-500 text-sm italic">No other active sessions.</p>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Privacy Section
// ─────────────────────────────────────────────────────────────────────────────

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-700 last:border-b-0">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${
          checked ? 'bg-blue-600' : 'bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function PrivacySection() {
  const {
    privacy,
    privacySaving,
    privacySuccess,
    updatePrivacy,
    setPrivacySaving,
    setPrivacySuccess,
    clearPrivacySuccess,
  } = useSettingsStore();

  useEffect(() => {
    if (privacySuccess) {
      const t = setTimeout(clearPrivacySuccess, 3000);
      return () => clearTimeout(t);
    }
  }, [privacySuccess]);

  const handleSave = async () => {
    setPrivacySaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setPrivacySaving(false);
    setPrivacySuccess('Privacy settings saved');
  };

  return (
    <SectionCard title="Privacy Controls" description="Control how your data is used and who can see your profile" icon="🔏">
      <div className="space-y-4">
        {privacySuccess && <SuccessBanner message={privacySuccess} onClose={clearPrivacySuccess} />}

        <div>
          <ToggleRow
            label="Data Sharing"
            description="Allow anonymized usage data to improve the service"
            checked={privacy.dataSharing}
            onChange={() => updatePrivacy('dataSharing', !privacy.dataSharing)}
          />
          <ToggleRow
            label="API Access Logging"
            description="Log all API requests made with your tokens for auditing"
            checked={privacy.apiLogging}
            onChange={() => updatePrivacy('apiLogging', !privacy.apiLogging)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Profile Visibility</label>
          <div className="space-y-2">
            {[
              { value: 'private', label: 'Private', description: 'Only you can see your profile' },
              { value: 'team', label: 'Team', description: 'Visible to members of your organization' },
              { value: 'public', label: 'Public', description: 'Anyone with the link can view' },
            ].map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer hover:border-slate-600 transition-colors"
              >
                <input
                  type="radio"
                  name="profileVisibility"
                  value={opt.value}
                  checked={privacy.profileVisibility === opt.value}
                  onChange={() => updatePrivacy('profileVisibility', opt.value)}
                  className="accent-blue-500"
                />
                <div>
                  <p className="text-sm font-medium text-white">{opt.label}</p>
                  <p className="text-xs text-slate-400">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={privacySaving}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm"
        >
          {privacySaving ? 'Saving...' : 'Save Privacy Settings'}
        </button>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Danger Zone Section
// ─────────────────────────────────────────────────────────────────────────────

function DangerZoneSection({ onRequestExport, onRequestDelete }) {
  return (
    <SectionCard title="Danger Zone" description="Irreversible account actions" icon="⚠️" danger>
      <div className="space-y-4">
        {/* Export */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-900 border border-slate-700 rounded-lg">
          <div>
            <p className="text-sm font-semibold text-white">Export All Data</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Download a complete copy of your account data in JSON format
            </p>
          </div>
          <button
            onClick={onRequestExport}
            className="flex-shrink-0 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg transition-colors text-sm border border-slate-600"
          >
            Export Data
          </button>
        </div>

        {/* Delete Account */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-red-950 bg-opacity-40 border border-red-900 rounded-lg">
          <div>
            <p className="text-sm font-semibold text-red-300">Delete Account</p>
            <p className="text-xs text-red-400 mt-0.5">
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
          </div>
          <button
            onClick={onRequestDelete}
            className="flex-shrink-0 px-4 py-2 bg-red-700 hover:bg-red-600 text-white font-medium rounded-lg transition-colors text-sm"
          >
            Delete Account
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings page — section tabs + content
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'security', label: 'Security', icon: '🔒' },
  { id: 'privacy', label: 'Privacy', icon: '🔏' },
  { id: 'danger', label: 'Danger Zone', icon: '⚠️' },
];

function Settings() {
  const { activeSection, setActiveSection } = useSettingsStore();
  const { logout } = useAuthStore();
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    // Simulate deletion — hook up to real endpoint
    await new Promise((r) => setTimeout(r, 1200));
    setIsDeleting(false);
    setShowDeleteModal(false);
    logout();
    window.location.href = '/';
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your account, security, and privacy preferences</p>
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-800 bg-opacity-50 border border-slate-700 rounded-lg p-1 w-fit">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeSection === s.id
                ? s.id === 'danger'
                  ? 'bg-red-700 text-white shadow-sm'
                  : 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700 hover:bg-opacity-50'
            }`}
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Section content */}
      {activeSection === 'profile' && <ProfileSection />}
      {activeSection === 'security' && <SecuritySection />}
      {activeSection === 'privacy' && <PrivacySection />}
      {activeSection === 'danger' && (
        <DangerZoneSection
          onRequestExport={() => setShowExportModal(true)}
          onRequestDelete={() => setShowDeleteModal(true)}
        />
      )}

      {/* Modals */}
      <ExportDataModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        isDeleting={isDeleting}
      />
    </div>
  );
}

export default Settings;
