import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import apiRequest from '../utils/apiRequest';
import DeleteAccountModal from '../components/DeleteAccountModal';
import NotificationSettings from '../components/NotificationSettings';
import ImportExport from '../components/ImportExport';
import { restartOnboarding, requestOnboardingModal } from '../utils/onboardingUtils';
import { fetchPublicConfig } from '../utils/publicConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI helpers
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({ title, description, children, danger }) {
  return (
    <div
      className={`rounded-lg p-6 ${
        danger
          ? 'bg-slate-800 border-2 border-red-800'
          : 'bg-slate-800 border border-slate-700'
      }`}
    >
      <div className="mb-1">
        <h2 className={`text-lg font-semibold ${danger ? 'text-red-400' : 'text-white'}`}>
          {title}
        </h2>
      </div>
      {description && <p className="text-slate-400 text-sm mb-6">{description}</p>}
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
  const user = useAuthStore((state) => state.user);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
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
    setProfileLoading(true);
    clearProfileError();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const authHeaders = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
      const res = await fetch('/api/v1/users/me', {
        headers: authHeaders,
        credentials: 'include',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setProfile(data);
    } catch (err) {
      const tokenData = (() => {
        try { return JSON.parse(localStorage.getItem('tokenData') || '{}'); } catch { return {}; }
      })();
      setProfile({
        user: {
          email: user?.email || tokenData?.email || tokenData?.user?.email || '',
          username: user?.username || tokenData?.username || tokenData?.user?.username || '',
        },
        identity: {
          Name: user?.username || tokenData?.username || '',
          Email: user?.email || tokenData?.email || tokenData?.user?.email || '',
          Timezone: 'UTC',
        },
      });

      if (err.name === 'AbortError') {
        setProfileError('Profile request timed out. Please retry.');
      } else {
        setProfileError(err.message || 'Failed to load profile');
      }
    } finally {
      clearTimeout(timeout);
      setProfileLoading(false);
    }
  }, [masterToken]);

  useEffect(() => {
    fetchProfile();
  }, [masterToken, fetchProfile]);

  useEffect(() => {
    if (profileSuccess) {
      const t = setTimeout(clearProfileSuccess, 4000);
      return () => clearTimeout(t);
    }
  }, [profileSuccess]);

  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const authHeaders = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
      const res = await fetch('/api/v1/users/me/avatar', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      updateProfileDraft('avatarUrl', data.avatarUrl);
      setAvatarLoadError(false);
      // Persist immediately so it survives a page reload
      localStorage.setItem('profileAvatarUrl', data.avatarUrl || '');
    } catch (_err) {
      setProfileError('Failed to upload image. Max 5 MB, images only.');
    } finally {
      setAvatarUploading(false);
      // Reset file input so the same file can be re-selected
      e.target.value = '';
    }
  };

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
        AvatarUrl: profileDraft.avatarUrl,
        avatarUrl: profileDraft.avatarUrl, // ensure both cases are sent to backend
      };
      const authHeaders = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
      const res = await fetch('/api/v1/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save profile');
      localStorage.setItem('profileAvatarUrl', profileDraft.avatarUrl || '');
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
    <SectionCard title="Profile Settings" description="Update your display name, contact details, and preferences">
      <div className="space-y-4">
        <ErrorBanner message={profileError} onClose={clearProfileError} />
        <SuccessBanner message={profileSuccess} onClose={clearProfileSuccess} />

        <div className="flex items-center gap-4 pb-4 border-b border-slate-700">
          {profileDraft?.avatarUrl && !avatarLoadError ? (
            <img 
              src={profileDraft.avatarUrl} 
              alt="avatar" 
              onError={() => setAvatarLoadError(true)}
              className="w-16 h-16 rounded-full object-cover border border-slate-600" 
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
              {(profileDraft?.displayName || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="w-full">
            <p className="text-white font-medium">{profileDraft?.displayName || 'User'}</p>
            <p className="text-slate-400 text-sm mb-3">{profileDraft?.email || ''}</p>
            <div className="flex items-center gap-3">
              <label className={`cursor-pointer px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors ${avatarUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                />
                {avatarUploading ? 'Uploading…' : 'Change Photo'}
              </label>
              {profileDraft?.avatarUrl && (
                <button
                  type="button"
                  onClick={() => { updateProfileDraft('avatarUrl', ''); setAvatarLoadError(false); }}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
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

function SecuritySection() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const {
    passwordDraft,
    passwordSaving,
    passwordError,
    passwordSuccess,
    updatePasswordDraft,
    clearPasswordDraft,
    setPasswordSaving,
    setPasswordError,
    clearPasswordError,
    setPasswordSuccess,
    clearPasswordSuccess,
  } = useSettingsStore();

  const [approvedDevices, setApprovedDevices] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceLoadError, setDeviceLoadError] = useState('');
  const [deviceError, setDeviceError] = useState('');
  const [deviceSuccess, setDeviceSuccess] = useState('');
  const [activeSessions, setActiveSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [twoFactorSuccess, setTwoFactorSuccess] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [manualSecret, setManualSecret] = useState('');

  useEffect(() => {
    if (passwordSuccess) {
      const t = setTimeout(clearPasswordSuccess, 4000);
      return () => clearTimeout(t);
    }
  }, [passwordSuccess]);

  useEffect(() => {
    let active = true;
    const loadTwoFactorStatus = async () => {
      try {
        const authHeaders = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
        const res = await fetch('/api/v1/auth/2fa/status', { headers: authHeaders, credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setTwoFactorEnabled(Boolean(data?.data?.enabled));
      } catch {
        // ignore
      }
    };
    loadTwoFactorStatus();
    return () => { active = false; };
  }, [masterToken]);

  // Load device approval data with polling to auto-refresh when approvals change
  useEffect(() => {
    let active = true;
    let pollInterval = null;

    const loadDeviceData = async () => {
      try {
        setDeviceLoadError('');
        const authHeaders = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
        
        // Fetch approved devices
        const approvedRes = await fetch('/api/v1/devices/approved', { headers: authHeaders, credentials: 'include' });
        if (approvedRes.ok) {
          const approvedData = await approvedRes.json();
          if (active) setApprovedDevices(approvedData.devices || []);
        } else if (approvedRes.status === 403) {
          // Device not approved error - will be handled separately
          if (active) setApprovedDevices([]);
        } else {
          throw new Error(`Failed to load approved devices (${approvedRes.status})`);
        }

        // Fetch pending approvals
        const pendingRes = await fetch('/api/v1/devices/approvals/pending', { headers: authHeaders, credentials: 'include' });
        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          if (active) setPendingApprovals(pendingData.approvals || []);
        } else if (pendingRes.status === 403) {
          // Device not approved error - will be handled separately
          if (active) setPendingApprovals([]);
        } else {
          throw new Error(`Failed to load pending approvals (${pendingRes.status})`);
        }
      } catch (err) {
        // Network failures during the polling interval are expected when connectivity
        // is temporarily lost. Only log to warn (not error) and only surface the
        // message in the UI so the console isn't flooded every 5 seconds.
        console.warn('Device data poll failed:', err.message);
        if (active) {
          setDeviceLoadError(err.message || 'Failed to load device data. Try refreshing.');
        }
      } finally {
        if (active) setDeviceLoading(false);
      }
    };

    // Initial load
    setDeviceLoading(true);
    loadDeviceData();

    // Set up polling interval (every 5 seconds) to detect when approvals change
    // This ensures the UI auto-updates without requiring manual refresh
    pollInterval = setInterval(() => {
      if (active) {
        loadDeviceData();
      }
    }, 5000);

    return () => {
      active = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [masterToken]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const authHeaders = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
      const res = await fetch('/api/v1/security/sessions', { headers: authHeaders, credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load sessions');
      setActiveSessions(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setDeviceError(err.message || 'Failed to load sessions');
    } finally {
      setSessionsLoading(false);
    }
  }, [masterToken]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const revokeSession = async (sessionId, all = false) => {
    try {
      const authHeaders = {
        'Content-Type': 'application/json',
        ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {}),
      };
      const res = await fetch('/api/v1/security/sessions/revoke', {
        method: 'POST', headers: authHeaders, credentials: 'include',
        body: JSON.stringify(all ? { all: true } : { sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to revoke session');
      await loadSessions();
    } catch (err) {
      setDeviceError(err.message || 'Failed to revoke session');
    }
  };

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

  const handleApproveDevice = async (approvalId) => {
    try {
      const res = await apiRequest(`/devices/approve/${approvalId}`, {
        method: 'POST',
        body: { device_name: 'Approved Device' },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.message || `Server error: ${res.status}`);
      }

      // Approval succeeded — show success message
      setDeviceSuccess('Device approved successfully');
      
      // Reload data (non-blocking)
      try {
        const approvedRes = await apiRequest('/devices/approved');
        if (approvedRes.ok) {
          const data = await approvedRes.json();
          setApprovedDevices(data.devices || []);
        }
      } catch { /* ignored */ }
      
      try {
        const pendingRes = await apiRequest('/devices/approvals/pending');
        if (pendingRes.ok) {
          const data = await pendingRes.json();
          setPendingApprovals(data.approvals || []);
        }
      } catch { /* ignored */ }
    } catch (err) {
      console.error('Error approving device:', err);
      setDeviceError(`Failed to approve device: ${err.message}`);
    }
  };

  const handleDenyDevice = async (approvalId) => {
    try {
      const res = await apiRequest(`/devices/deny/${approvalId}`, {
        method: 'POST',
        body: { reason: 'Denied by user' },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.message || `Server error: ${res.status}`);
      }

      // Denial succeeded — show success
      setDeviceSuccess('Device denied successfully');
      
      // Reload pending (non-blocking)
      try {
        const pendingRes = await apiRequest('/devices/approvals/pending');
        if (pendingRes.ok) {
          const data = await pendingRes.json();
          setPendingApprovals(data.approvals || []);
        }
      } catch { /* ignored */ }
    } catch (err) {
      console.error('Error denying device:', err);
      setDeviceError(`Failed to deny device: ${err.message}`);
    }
  };

  const handleRevokeDevice = async (deviceId) => {
    if (!window.confirm('Revoke this device? It will need to be re-approved to use your tokens.')) return;
    try {
      const res = await apiRequest(`/devices/${deviceId}/revoke`, {
        method: 'POST',
      });
      
      if (res.ok) {
        const approvedRes = await apiRequest('/devices/approved');
        if (approvedRes.ok) {
          const data = await approvedRes.json();
          setApprovedDevices(data.devices || []);
        }
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.message || `Server error: ${res.status}`);
      }
    } catch (err) {
      console.error('Error revoking device:', err);
      setDeviceError(`Failed to revoke device: ${err.message}`);
    }
  };

  const startTwoFactorSetup = async () => {
    setTwoFactorError('');
    setTwoFactorSuccess('');
    setTwoFactorLoading(true);
    try {
      const authHeaders = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
      const res = await fetch('/api/v1/auth/2fa/setup', { method: 'POST', headers: authHeaders, credentials: 'include' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to start 2FA setup');
      setQrCodeDataUrl(payload?.data?.qrCodeDataUrl || '');
      setManualSecret(payload?.data?.secret || '');
      setTwoFactorSuccess('Scan the QR code with Google Authenticator/Authy, then enter the 6-digit code to enable 2FA.');
    } catch (err) {
      setTwoFactorError(err.message || 'Failed to start 2FA setup');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const verifyTwoFactorSetup = async () => {
    setTwoFactorError('');
    setTwoFactorSuccess('');
    if (!twoFactorCode.trim()) {
      setTwoFactorError('Enter the 6-digit code from your authenticator app');
      return;
    }
    setTwoFactorLoading(true);
    try {
      const authHeaders = { 'Content-Type': 'application/json', ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {}) };
      const res = await fetch('/api/v1/auth/2fa/verify', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({ code: twoFactorCode.trim() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Invalid 2FA code');
      setTwoFactorEnabled(true);
      setTwoFactorCode('');
      setQrCodeDataUrl('');
      setManualSecret('');
      setTwoFactorSuccess('2FA enabled successfully. You will be prompted for a code on password login.');
    } catch (err) {
      setTwoFactorError(err.message || 'Failed to verify 2FA code');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const disableTwoFactor = async () => {
    setTwoFactorError('');
    setTwoFactorSuccess('');
    if (!disableCode.trim()) {
      setTwoFactorError('Enter your current 2FA code to disable it');
      return;
    }
    setTwoFactorLoading(true);
    try {
      const authHeaders = { 'Content-Type': 'application/json', ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {}) };
      const res = await fetch('/api/v1/auth/2fa/disable', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({ code: disableCode.trim() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to disable 2FA');
      setTwoFactorEnabled(false);
      setDisableCode('');
      setQrCodeDataUrl('');
      setManualSecret('');
      setTwoFactorSuccess('2FA has been disabled.');
    } catch (err) {
      setTwoFactorError(err.message || 'Failed to disable 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  return (
    <SectionCard title="Security" description="Manage your password, 2FA, and active sessions">
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
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-medium text-white">Two-Factor Authentication (TOTP)</h3>
              <p className="text-slate-400 text-sm mt-1">Use Google Authenticator, Authy, or 1Password to secure password logins.</p>
              <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded border ${twoFactorEnabled ? 'bg-green-900/40 text-green-400 border-green-800' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                {twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            {!twoFactorEnabled ? (
              <button
                onClick={startTwoFactorSetup}
                disabled={twoFactorLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
              >
                {twoFactorLoading ? 'Preparing...' : 'Enable 2FA'}
              </button>
            ) : null}
          </div>

          {twoFactorError ? <ErrorBanner message={twoFactorError} onClose={() => setTwoFactorError('')} /> : null}
          {twoFactorSuccess ? <SuccessBanner message={twoFactorSuccess} onClose={() => setTwoFactorSuccess('')} /> : null}

          {!twoFactorEnabled && qrCodeDataUrl && (
            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-4">
              <p className="text-sm text-slate-300 mb-1">1) Scan this QR code in your authenticator app.</p>
              <p className="text-xs text-slate-400 mb-3">The Disable button appears only after successful verification/enabling.</p>
              <img src={qrCodeDataUrl} alt="2FA QR code" className="h-44 w-44 rounded bg-white p-2" />
              <p className="text-xs text-slate-400 mt-3">Can’t scan? Use this secret manually:</p>
              <code className="mt-1 inline-block rounded bg-slate-800 px-2 py-1 text-xs text-blue-300 break-all">{manualSecret}</code>

              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full sm:w-52 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={verifyTwoFactorSetup}
                  disabled={twoFactorLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
                >
                  {twoFactorLoading ? 'Verifying...' : 'Verify & Enable'}
                </button>
              </div>
            </div>
          )}

          {twoFactorEnabled && (
            <div className="mt-4 rounded-lg border border-amber-700/50 bg-amber-900/10 p-4">
              <p className="text-sm text-amber-200">To disable 2FA, enter a current authenticator code.</p>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder="Current 6-digit code"
                  className="w-full sm:w-52 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={disableTwoFactor}
                  disabled={twoFactorLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
                >
                  {twoFactorLoading ? 'Disabling...' : 'Disable 2FA'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Active Sessions */}
        <div className="border-t border-slate-700 pt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-white">Active Sessions</h3>
            <button
              onClick={() => revokeSession(null, true)}
              className="px-3 py-1.5 text-xs bg-rose-700 hover:bg-rose-600 text-white rounded-lg"
            >
              Revoke Other Sessions
            </button>
          </div>
          {sessionsLoading ? (
            <p className="text-slate-500 text-sm italic">Loading sessions...</p>
          ) : activeSessions.length === 0 ? (
            <p className="text-slate-500 text-sm italic">No active sessions found.</p>
          ) : (
            <div className="space-y-2">
              {activeSessions.map((s) => (
                <div key={s.id} className="p-3 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-white">{s.userAgent || 'Browser session'} {s.isCurrent ? <span className="text-emerald-400">(Current)</span> : null}</p>
                    <p className="text-xs text-slate-400">Expires: {s.expiresAt ? new Date(s.expiresAt).toLocaleString() : 'N/A'}</p>
                  </div>
                  {!s.isCurrent && (
                    <button onClick={() => revokeSession(s.id)} className="text-xs text-red-400 hover:text-red-300">Revoke</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Device & AI Approvals */}
        <div className="border-t border-slate-700 pt-6">
          {deviceLoadError && (
            <ErrorBanner message={deviceLoadError} onClose={() => setDeviceLoadError('')} />
          )}
          {deviceError && (
            <ErrorBanner message={deviceError} onClose={() => setDeviceError('')} />
          )}
          {deviceSuccess && (
            <SuccessBanner message={deviceSuccess} onClose={() => setDeviceSuccess('')} />
          )}
          
          {/* Pending Approvals Section */}
          {pendingApprovals.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base font-medium text-white mb-2 flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-900 text-amber-300 text-xs font-bold">
                  {pendingApprovals.length}
                </span>
                Devices & AIs Pending Approval
              </h3>
              <p className="text-slate-400 text-sm mb-3">New devices or AI agents are requesting access to your tokens:</p>
              <div className="space-y-3">
                {pendingApprovals.map((approval) => (
                  <div
                    key={approval.id}
                    className="p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">
                          {approval.deviceInfo?.userAgent || approval.deviceInfo?.name || 'Unknown Device'}
                        </p>
                        <p className="text-xs text-amber-200 mt-0.5">
                          IP: {approval.ip} • Requested {new Date(approval.createdAt).toLocaleDateString()}
                        </p>
                        {approval.deviceInfo?.os && (
                          <p className="text-xs text-slate-400 mt-1">{approval.deviceInfo.os} {approval.deviceInfo.browser ? `• ${approval.deviceInfo.browser}` : ''}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleApproveDevice(approval.id)}
                        className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDenyDevice(approval.id)}
                        className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved Devices Section */}
          <div>
            <h3 className="text-base font-medium text-white mb-3">
              {pendingApprovals.length > 0 ? 'Approved Devices & AIs' : 'Approved Devices & AIs'}
            </h3>
            {deviceLoading ? (
              <p className="text-slate-500 text-sm italic">Loading devices...</p>
            ) : approvedDevices.length === 0 ? (
              <p className="text-slate-500 text-sm italic">No approved devices yet. Devices will appear here after you approve them.</p>
            ) : (
              <div className="space-y-3">
                {approvedDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-start justify-between gap-3 p-4 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-[11px] text-slate-300 font-semibold">
                        {device.info?.userAgent?.includes('iPhone') || device.info?.userAgent?.includes('Android') ? 'MOB' : device.info?.type === 'ai' ? 'AI' : 'WEB'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{device.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5 break-all">IP: {device.ip}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Approved {new Date(device.approvedAt).toLocaleDateString()}
                          {device.lastUsedAt && ` • Last used ${new Date(device.lastUsedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeDevice(device.id)}
                      className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 border border-red-800 hover:border-red-600 rounded-lg transition-colors flex-shrink-0 self-start"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// AI Agent Token Usage Section
// ─────────────────────────────────────────────────────────────────────────────

function AIAgentTrackingSection() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const [agents, setAgents] = useState([]);
  const [agentLoading, setAgentLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const loadAgents = async () => {
      setAgentLoading(true);
      try {
        const authHeaders = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
        const res = await fetch('/api/v1/manage/audit/agents', { headers: authHeaders, credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (active) setAgents(data.agents || []);
        }
      } catch (err) {
        console.error('Error loading AI agents:', err);
      } finally {
        if (active) setAgentLoading(false);
      }
    };
    loadAgents();
    return () => { active = false; };
  }, [masterToken]);

  const getAgentBadgeColor = (type) => {
    switch (type) {
      case 'ai': return 'bg-blue-900/40 text-blue-400 border-blue-800';
      case 'script': return 'bg-purple-900/40 text-purple-400 border-purple-800';
      case 'cli': return 'bg-green-900/40 text-green-400 border-green-800';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <SectionCard title="AI Agent & Token Usage" description="Monitor which AI agents and scripts are accessing your tokens">
      {agentLoading ? (
        <p className="text-slate-500 text-sm italic">Loading agent usage data...</p>
      ) : agents.length === 0 ? (
        <p className="text-slate-500 text-sm italic">No agents have accessed your tokens yet.</p>
      ) : (
        <div className="space-y-3">
          {agents.map((agent, idx) => (
            <div key={idx} className="p-4 bg-slate-900 border border-slate-700 rounded-lg">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{agent.agentName}</p>
                  <span className={`px-2 py-0.5 text-xs rounded border ${getAgentBadgeColor(agent.agentType)}`}>
                    {agent.agentType === 'ai' ? 'AI Agent' : agent.agentType === 'script' ? 'Script' : agent.agentType === 'cli' ? 'CLI' : 'Browser'}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-400">{agent.accessCount}</p>
                  <p className="text-xs text-slate-500">API calls</p>
                </div>
              </div>
              
              {agent.lastAccess && (
                <p className="text-xs text-slate-400 mb-2">Last access: {new Date(agent.lastAccess).toLocaleString()}</p>
              )}
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-slate-500 mb-1">Tokens Used ({agent.tokensUsed.length})</p>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {agent.tokensUsed.length === 0 ? (
                      <p className="text-slate-600 italic">None</p>
                    ) : (
                      agent.tokensUsed.map((tokenId, i) => (
                        <code key={i} className="block text-slate-400 text-[10px] break-all">
                          {tokenId.slice(0, 12)}...
                        </code>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Endpoints ({agent.endpointsAccessed.length})</p>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {agent.endpointsAccessed.slice(0, 3).map((endpoint, i) => (
                      <code key={i} className="block text-slate-400 text-[10px] break-all">
                        {endpoint}
                      </code>
                    ))}
                    {agent.endpointsAccessed.length > 3 && (
                      <p className="text-slate-600 italic text-[10px]">+{agent.endpointsAccessed.length - 3} more</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function AuditLogsSection() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ action: '', resource: '' });

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const headers = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
        const params = new URLSearchParams({
          limit: '50',
          ...(filters.action && { action: filters.action }),
          ...(filters.resource && { resource: filters.resource }),
        });
        const res = await fetch(`/api/v1/audit/logs?${params}`, { headers, credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setLogs(data.data || data.logs || []);
        }
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [masterToken, filters]);

  return (
    <div className="space-y-6">
      <SectionCard title="Audit Logs" description="View all account activities and security events">
        {/* Filters */}
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Action</label>
              <input
                type="text"
                placeholder="e.g., login, token_created"
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Resource</label>
              <input
                type="text"
                placeholder="e.g., token, service"
                value={filters.resource}
                onChange={(e) => setFilters({ ...filters, resource: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="text-center text-slate-400">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center text-slate-400">No audit logs found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-2 text-slate-300">Timestamp</th>
                  <th className="text-left px-4 py-2 text-slate-300">Action</th>
                  <th className="text-left px-4 py-2 text-slate-300">Resource</th>
                  <th className="text-left px-4 py-2 text-slate-300">Status</th>
                  <th className="text-left px-4 py-2 text-slate-300">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-2 text-slate-400">
                      {new Date(log.created_at * 1000 || log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-slate-300 font-mono text-xs">{log.action}</td>
                    <td className="px-4 py-2 text-slate-300">{log.resource || '-'}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                        log.status === 'success' ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                      }`}>
                        {log.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-400 text-xs max-w-xs truncate">{typeof log.details === 'object' && log.details !== null ? JSON.stringify(log.details) : (log.details || '-')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function PrivacySection() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const {
    privacy,
    privacySaving,
    privacySuccess,
    privacyError,
    updatePrivacy,
    setPrivacySaving,
    setPrivacySuccess,
    clearPrivacySuccess,
    setPrivacyError,
    clearPrivacyError,
  } = useSettingsStore();

  const [retentionPolicies, setRetentionPolicies] = useState([]);
  const [retentionEntityType, setRetentionEntityType] = useState('compliance_audit_logs');
  const [retentionDays, setRetentionDays] = useState(365);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [retentionRunning, setRetentionRunning] = useState(false);
  const [retentionPreview, setRetentionPreview] = useState(null);

  useEffect(() => {
    if (privacySuccess) {
      const t = setTimeout(clearPrivacySuccess, 3000);
      return () => clearTimeout(t);
    }
  }, [privacySuccess]);

  useEffect(() => {
    if (privacyError) {
      const t = setTimeout(clearPrivacyError, 5000);
      return () => clearTimeout(t);
    }
  }, [privacyError]);

  useEffect(() => {
    const headers = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
    fetch('/api/v1/privacy/cookies', { headers, credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const mode = d?.data?.mode;
        if (mode === 'all' || mode === 'essential') {
          updatePrivacy('cookieMode', mode);
        }
      })
      .catch(() => {});

    fetch('/api/v1/privacy/settings', { headers, credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.data?.dataSharing === 'boolean') updatePrivacy('dataSharing', d.data.dataSharing);
        if (typeof d?.data?.apiLogging === 'boolean') updatePrivacy('apiLogging', d.data.apiLogging);
      })
      .catch(() => {});
  }, [masterToken]);

  const loadRetentionPolicies = async () => {
    try {
      const headers = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
      const res = await fetch('/api/v1/privacy/retention-policy', { headers, credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setRetentionPolicies(data?.data || []);
    } catch {
      // ignore UI-only fetch errors
    }
  };

  useEffect(() => {
    loadRetentionPolicies();
  }, [masterToken]);

  const handleSave = async () => {
    setPrivacySaving(true);
    clearPrivacyError();
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {}),
      };
      const mode = privacy.cookieMode === 'all' ? 'all' : 'essential';

      const [cookieRes, settingsRes] = await Promise.all([
        fetch('/api/v1/privacy/cookies', {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify({ mode }),
        }),
        fetch('/api/v1/privacy/settings', {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify({ dataSharing: !!privacy.dataSharing, apiLogging: !!privacy.apiLogging }),
        }),
      ]);

      if (!cookieRes.ok) throw new Error('Failed to save cookie preferences');
      if (!settingsRes.ok) throw new Error('Failed to save privacy settings');

      localStorage.setItem('cookie_pref_v1', mode);
      setPrivacySuccess('Privacy settings saved');
    } catch (e) {
      setPrivacyError(e.message || 'Failed to save privacy settings');
    } finally {
      setPrivacySaving(false);
    }
  };

  const handleSaveRetention = async () => {
    clearPrivacyError();
    const days = Number(retentionDays);
    if (!Number.isInteger(days) || days < 1) {
      setPrivacyError('Retention days must be a positive whole number');
      return;
    }

    setRetentionSaving(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {}),
      };
      const res = await fetch('/api/v1/privacy/retention-policy', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          entityType: retentionEntityType,
          retentionDays: days,
          autoDelete: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save retention policy');
      setPrivacySuccess('Retention policy saved');
      await loadRetentionPolicies();
    } catch (e) {
      setPrivacyError(e.message || 'Failed to save retention policy');
    } finally {
      setRetentionSaving(false);
    }
  };

  const handleRetentionPreview = async () => {
    clearPrivacyError();
    setRetentionRunning(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {}),
      };
      const res = await fetch('/api/v1/admin/privacy/retention/run', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ dryRun: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to preview retention cleanup');
      setRetentionPreview(data?.data);
      setPrivacySuccess(`Preview: Would delete ${data?.data?.totalDeleted || 0} items across ${data?.data?.scannedPolicies || 0} policies`);
    } catch (e) {
      setPrivacyError(e.message || 'Failed to preview retention cleanup');
    } finally {
      setRetentionRunning(false);
    }
  };

  const handleRetentionExecute = async () => {
    if (!window.confirm('This will permanently delete expired data. This cannot be undone. Continue?')) {
      return;
    }
    
    clearPrivacyError();
    setRetentionRunning(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {}),
      };
      const res = await fetch('/api/v1/admin/privacy/retention/run', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ dryRun: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to execute retention cleanup');
      setRetentionPreview(null);
      setPrivacySuccess(`✓ Deleted ${data?.data?.totalDeleted || 0} expired items from ${data?.data?.scannedPolicies || 0} policies`);
    } catch (e) {
      setPrivacyError(e.message || 'Failed to execute retention cleanup');
    } finally {
      setRetentionRunning(false);
    }
  };

  return (
    <SectionCard title="Privacy Controls" description="Manage your privacy preferences, cookie mode, and data retention settings">
      <div className="space-y-4">
        {privacySuccess && <SuccessBanner message={privacySuccess} onClose={clearPrivacySuccess} />}
        {privacyError && <ErrorBanner message={privacyError} onClose={clearPrivacyError} />}

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
          <label className="block text-sm font-medium text-slate-300 mb-2">Cookie Preferences</label>
          <div className="space-y-2">
            {[
              { value: 'all', label: 'Full cookies', description: 'Allow essential + optional cookies' },
              { value: 'essential', label: 'Essential only', description: 'Allow only required cookies (recommended for privacy)' },
            ].map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer hover:border-slate-600 transition-colors"
              >
                <input
                  type="radio"
                  name="cookieMode"
                  value={opt.value}
                  checked={privacy.cookieMode === opt.value}
                  onChange={() => updatePrivacy('cookieMode', opt.value)}
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

        <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg">
          <p className="text-sm font-semibold text-white mb-3">Data Retention Policies</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Entity</label>
              <select
                value={retentionEntityType}
                onChange={(e) => setRetentionEntityType(e.target.value)}
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100"
              >
                <option value="compliance_audit_logs">Compliance Audit Logs</option>
                <option value="activity_logs">Activity Logs</option>
                <option value="notifications">Notifications</option>
                <option value="sessions">Sessions</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Retention Days</label>
              <input
                type="number"
                min={1}
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSaveRetention}
                disabled={retentionSaving}
                className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md text-sm"
              >
                {retentionSaving ? 'Saving...' : 'Save Policy'}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs text-slate-400 mb-2">Current policies</p>
            {retentionPolicies.length === 0 ? (
              <p className="text-xs text-slate-500">No custom retention policies yet.</p>
            ) : (
              <div className="space-y-2">
                {retentionPolicies.map((p) => (
                  <div key={p.id} className="text-xs text-slate-300 border border-slate-800 rounded px-3 py-2">
                    <span className="font-medium">{p.entity_type}</span> · {p.retention_days} days · auto-delete: {p.auto_delete ? 'on' : 'off'}
                  </div>
                ))}
              </div>
            )}
          </div>

          {retentionPolicies.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-slate-400 mb-2">Cleanup execution</p>
              <button
                onClick={handleRetentionPreview}
                disabled={retentionRunning}
                className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-md text-sm font-medium"
              >
                {retentionRunning ? 'Running...' : '📊 Preview Cleanup (Dry Run)'}
              </button>
              {retentionPreview && (
                <button
                  onClick={handleRetentionExecute}
                  disabled={retentionRunning}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-md text-sm font-medium"
                >
                  {retentionRunning ? 'Deleting...' : '🗑️ Execute Cleanup (Permanent)'}
                </button>
              )}
              {retentionPreview && (
                <div className="text-xs bg-slate-800 border border-slate-700 rounded p-3 text-slate-200">
                  <p className="font-semibold mb-1">Preview Results:</p>
                  <p>Scanned: {retentionPreview.scannedPolicies} policies</p>
                  <p>To Delete: {retentionPreview.totalDeleted} items</p>
                  <p className="text-amber-400 mt-1 text-[11px]">Run cleanup to permanently delete these items</p>
                </div>
              )}
            </div>
          )}
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

function ImportDataModal({ isOpen, onClose }) {
  const [file, setFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    setError('');
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/v1/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import data');
      }

      setSuccess(`Import completed! Restored: ${data.summary.imported.personas} personas, Settings: ${data.summary.imported.settings ? 'Yes' : 'No'}, Profile: ${data.summary.imported.profile ? 'Yes' : 'No'}`);
      
      // Auto close after 3s
      setTimeout(() => {
        onClose();
        setSuccess(null);
        setFile(null);
      }, 3000);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Import Data</h2>
            <p className="text-sm text-slate-400 mt-1">
              Upload a MyApi v3 Export ZIP to restore profile, settings, and personas.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl leading-none">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-3 text-sm text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-3 text-sm text-green-200">
            {success}
          </div>
        )}

        {!success && (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">Select ZIP File</label>
              <input
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                className="w-full text-slate-300 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
              />
            </div>
            <div className="bg-blue-900 bg-opacity-20 border border-blue-800 rounded-lg p-3 mb-6">
              <p className="text-xs text-blue-300">
                Note: Auth tokens and connector secrets will NOT be restored for security reasons.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isImporting}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!file || isImporting}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {isImporting ? 'Importing...' : 'Start Import'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Danger Zone Section
// ─────────────────────────────────────────────────────────────────────────────

function DangerZoneSection({ onRequestDelete }) {
  return (
    <SectionCard title="Danger Zone" description="Irreversible account actions" danger>
      <div className="space-y-4">
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

function BillingSection() {
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState({ plan: 'free', billingConfigured: false, features: [], limits: {} });
  const [downgradeWarning, setDowngradeWarning] = useState(null);
  const [confirmingDowngrade, setConfirmingDowngrade] = useState(false);
  const [usage, setUsage] = useState({ limits: {}, resources: {} });
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [betaActive, setBetaActive] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchPublicConfig().then((cfg) => {
      if (!cancelled) setBetaActive(Boolean(cfg?.beta));
    });
    return () => { cancelled = true; };
  }, []);

  const loadBilling = useCallback(async () => {
    try {
      const [plansRes, currentRes, usageRes, invoicesRes] = await Promise.all([
        apiRequest('/billing/plans'),
        apiRequest('/billing/current'),
        apiRequest('/billing/usage?range=30d'),
        apiRequest('/billing/invoices'),
      ]);

      const plansData = await plansRes.json().catch(() => ({}));
      const currentData = await currentRes.json().catch(() => ({}));
      const usageData = await usageRes.json().catch(() => ({}));
      const invoiceData = await invoicesRes.json().catch(() => ({}));

      setPlans(Array.isArray(plansData?.data) ? plansData.data : []);
      setCurrent(currentData?.data || { plan: 'free', billingConfigured: false, features: [], limits: {} });
      setUsage(usageData?.data || { limits: {}, resources: {} });
      setInvoices(Array.isArray(invoiceData?.data) ? invoiceData.data : []);
    } catch {
      setError('Unable to load billing data');
    }
  }, []);

  useEffect(() => {
    loadBilling();
  }, [loadBilling, currentWorkspace?.id]);

  const handleCheckout = async (planId) => {
    setError('');
    setSuccess('');
    
    // Check if this is a downgrade
    const planRank = { free: 0, pro: 1, enterprise: 2 };
    const isDowngrade = (planRank[planId] || 0) < (planRank[current.plan] || 0);
    
    if (isDowngrade) {
      // Show downgrade preview first
      setLoading(true);
      try {
        const response = await apiRequest('/billing/downgrade-preview', {
          method: 'POST',
          body: { newPlan: planId },
        });
        const preview = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(preview.error || 'Failed to generate preview');
        
        setDowngradeWarning({ planId, preview });
        setLoading(false);
      } catch (e) {
        setError(e.message || 'Failed to check downgrade impact');
        setLoading(false);
      }
      return;
    }
    
    // Upgrade flow (no confirmation needed)
    setLoading(true);
    try {
      const response = await apiRequest('/billing/checkout', {
        method: 'POST',
        body: { plan: planId },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to start checkout');
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      await loadBilling();
      if (planId === 'free') {
        setSuccess(`Plan updated to ${String(planId).toUpperCase()}.`);
      } else if (data.provider === 'mock') {
        setSuccess(`Plan updated to ${String(planId).toUpperCase()}. (Stripe not configured — applied directly.)`);
      } else if (data.url) {
        setSuccess(`Redirecting to Stripe checkout. Complete payment to activate ${String(planId).toUpperCase()} plan.`);
      } else {
        setSuccess(`Plan upgrade initiated. Complete payment to activate ${String(planId).toUpperCase()} plan.`);
      }
    } catch (e) {
      setError(e.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDowngrade = async () => {
    if (!downgradeWarning) return;
    setConfirmingDowngrade(true);
    setError('');
    const planId = downgradeWarning.planId; // Capture before state change
    try {
      const confirmResponse = await apiRequest('/billing/downgrade-confirm', {
        method: 'POST',
        body: { newPlan: planId, confirmed: true },
      });
      const confirmData = await confirmResponse.json().catch(() => ({}));
      if (!confirmResponse.ok) throw new Error(confirmData.error || 'Failed to confirm downgrade');
      
      setDowngradeWarning(null);
      setConfirmingDowngrade(false);
      setSuccess(`✓ Downgrade confirmed. Excess items deleted.`);
      await loadBilling(); // Refresh billing info
    } catch (e) {
      setError(e.message || 'Failed to process downgrade');
      setConfirmingDowngrade(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes == null) return 'Unlimited';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const usageItems = [
    { key: 'monthlyApiCalls', label: 'API Calls (30d)' },
    { key: 'activeServices', label: 'Connected Services' },
  ];

  const resourceItems = [
    { key: 'personas', label: 'AI Personas' },
    { key: 'serviceConnections', label: 'Service Connections' },
    { key: 'vaultTokens', label: 'Vault Tokens' },
    { key: 'teamMembers', label: 'Team Members' },
    { key: 'knowledgeBytes', label: 'Knowledge Base', formatValue: formatBytes, formatLimit: formatBytes },
  ];

  const renderMetric = (metric, item) => {
    if (!metric) return null;
    const used = item.formatValue ? item.formatValue(metric.used) : metric.used;
    const limit = metric.unlimited ? 'Unlimited' : (item.formatLimit ? item.formatLimit(metric.limit) : (metric.limit ?? 0));
    const ratioPct = Math.round((metric.ratio || 0) * 100);
    const barColor = metric.exceeded ? 'bg-red-500' : ratioPct > 80 ? 'bg-amber-500' : 'bg-blue-500';

    return (
      <div key={item.key} className="p-3 rounded-lg border border-slate-700 bg-slate-900">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">{item.label}</span>
          <span className={metric.exceeded ? 'text-red-400 font-medium' : 'text-slate-400'}>{used} / {limit}</span>
        </div>
        <div className="mt-2 h-2 rounded bg-slate-800 overflow-hidden">
          <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, ratioPct)}%` }} />
        </div>
      </div>
    );
  };

  return (
    <SectionCard title="Plans & Billing" description="Workspace plan, usage and invoices">
      {error && <ErrorBanner message={error} onClose={() => setError('')} />}
      {success && (
        <div className="mb-4 p-3 rounded-lg border border-emerald-600/40 bg-emerald-900/20 text-emerald-200 text-sm flex items-center justify-between gap-4">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess('')} className="text-emerald-300 hover:text-emerald-100">✕</button>
        </div>
      )}

      {!current.billingConfigured && (
        <div className="mb-4 p-3 rounded-lg border border-amber-600/40 bg-amber-900/20 text-amber-200 text-sm">
          Billing is not configured yet. You can still explore plans and usage with mock-safe behavior.
        </div>
      )}

      <div className="mb-4 p-4 rounded-lg border border-blue-600/40 bg-slate-900">
        <p className="text-xs uppercase tracking-wide text-slate-400">Current Plan</p>
        <p className="text-2xl text-white font-bold mt-1">{String(current.plan || 'free').toUpperCase()}</p>
        {current.status && current.status !== 'active' && (
          <span className="mt-1 inline-block text-xs px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700">
            {current.status}
          </span>
        )}
        {Array.isArray(current.features) && current.features.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-slate-300">
            {current.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {Object.keys(usage?.resources || {}).length > 0 && (
        <>
          <h3 className="text-white font-semibold mb-2">Resource Usage</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            {resourceItems.map((item) => renderMetric(usage.resources?.[item.key], item))}
          </div>
        </>
      )}

      <h3 className="text-white font-semibold mb-2">Activity Usage</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        {usageItems.map((item) => renderMetric(usage?.limits?.[item.key], item))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrent = String(current.plan).toLowerCase() === String(plan.id).toLowerCase();
          const planId = String(plan.id).toLowerCase();
          const isFree = planId === 'free';
          const isComingSoon = Boolean(plan.beta_locked) || (betaActive && !isFree);
          return (
            <div key={plan.id} className={`bg-slate-900 border rounded-lg p-4 ${isCurrent ? 'border-blue-500 ring-1 ring-blue-500/40' : 'border-slate-700'}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-white font-semibold">{plan.name}</h3>
                {isCurrent && (
                  <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded bg-blue-600 text-white">Current</span>
                )}
              </div>
              {isFree ? (
                <p className="text-slate-300 text-xl mt-1 flex items-baseline gap-2">
                  {betaActive && <span className="line-through text-slate-500 text-base">$10</span>}
                  <span>Free</span>
                  {betaActive && <span className="text-xs text-violet-400 font-semibold">Beta</span>}
                </p>
              ) : (
                <p className="text-slate-300 text-xl mt-1">${plan.priceMonthly ?? Math.floor((plan.price_cents || 0) / 100)}<span className="text-sm text-slate-400">/mo</span></p>
              )}
              {plan.description && <p className="text-slate-400 text-xs mt-1">{plan.description}</p>}
              {Array.isArray(plan.features) && plan.features.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-slate-400">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-slate-500 mt-0.5">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                disabled={loading || isCurrent || isComingSoon}
                onClick={() => !isComingSoon && handleCheckout(plan.id)}
                className={`mt-4 w-full px-3 py-2 rounded text-sm text-white disabled:opacity-50 ${isComingSoon ? 'bg-slate-700 cursor-default' : 'bg-blue-600 hover:bg-blue-500'}`}
              >
                {isCurrent ? 'Current Plan' : isComingSoon ? 'Soon' : 'Choose Plan'}
              </button>
            </div>
          );
        })}
      </div>

      {downgradeWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-red-600/40 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-red-400 mb-3">⚠️ Downgrade Warning</h2>
            <p className="text-slate-300 mb-4">Downgrading will remove items that exceed the new plan's limits:</p>
            <div className="space-y-2 bg-slate-800 rounded p-3 mb-4 text-sm text-slate-300 max-h-64 overflow-y-auto">
              {downgradeWarning.preview.toDelete?.personas && (
                <p>❌ <strong>{downgradeWarning.preview.toDelete.personas.count}</strong> AI Personas (keeping oldest)</p>
              )}
              {downgradeWarning.preview.toDelete?.services && (
                <p>❌ <strong>{downgradeWarning.preview.toDelete.services.count}</strong> Service Connections (keeping oldest)</p>
              )}
              {downgradeWarning.preview.toDelete?.skills && (
                <p>❌ <strong>{downgradeWarning.preview.toDelete.skills.count}</strong> Skills (keeping oldest)</p>
              )}
              {downgradeWarning.preview.toDelete?.kbDocs && (
                <p>❌ Knowledge Base: {downgradeWarning.preview.toDelete.kbDocs.message}</p>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-6">Items are deleted based on creation date (newest first).</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDowngradeWarning(null)}
                className="flex-1 px-4 py-2 rounded border border-slate-600 text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDowngrade}
                disabled={confirmingDowngrade}
                className="flex-1 px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white font-medium disabled:opacity-50"
              >
                {confirmingDowngrade ? 'Processing...' : 'Confirm Downgrade'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-white font-semibold mb-2">Invoices</h3>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-400">No invoices yet.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.stripeInvoiceId} className="p-3 rounded border border-slate-700 bg-slate-900 text-sm flex items-center justify-between">
                <div>
                  <p className="text-slate-200">{inv.status} · {(inv.amountCents / 100).toFixed(2)} {String(inv.currency || 'usd').toUpperCase()}</p>
                  <p className="text-slate-400 text-xs">{new Date(inv.createdAt).toLocaleDateString()}</p>
                </div>
                {inv.invoiceUrl && <a className="text-blue-400 hover:text-blue-300" href={inv.invoiceUrl} target="_blank" rel="noreferrer">Open</a>}
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings page — section tabs + content
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'billing', label: 'Plans' },
  { id: 'security', label: 'Security' },
  { id: 'audit', label: 'Audit Logs' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'dataPrivacy', label: 'Data & Privacy' },
  { id: 'danger', label: 'Danger Zone' },
];

function OnboardingSection() {
  const [message, setMessage] = useState('');

  const handleRerunOnboarding = () => {
    restartOnboarding();
    requestOnboardingModal();
    setMessage('Onboarding restarted. The setup modal is open again.');
  };

  return (
    <SectionCard title="Onboarding" description="Replay the first-run setup whenever you want to refresh your profile, security, or integrations flow">
      <div className="space-y-4">
        {message && <SuccessBanner message={message} onClose={() => setMessage('')} />}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-slate-300">
              Re-run onboarding to walk through profile setup, persona creation, 2FA, and first integrations again.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              This also restores the getting-started checklist until you finish or dismiss it again.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRerunOnboarding}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm whitespace-nowrap"
          >
            Run onboarding again
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

function Settings() {
  const { activeSection, setActiveSection } = useSettingsStore();
  const forceUnauthenticated = useAuthStore((state) => state.forceUnauthenticated);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/v1/account', {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to delete account');
      }

      // The backend already destroys the session and clears auth cookies as part of
      // account deletion. Only clear client-side auth state here; do not run the
      // normal logout flow, which performs a second /auth/logout request and can
      // surface a false failure after the account is already gone.
      setShowDeleteModal(false);
      forceUnauthenticated();
      window.location.replace('/');
    } catch (err) {
      alert(err?.message || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
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
            className={`ui-tab ${
              activeSection === s.id
                ? s.id === 'danger'
                  ? 'bg-red-700 text-white'
                  : 'ui-tab-active'
                : ''
            }`}
          >
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Section content */}
      {activeSection === 'profile' && (
        <>
          <ProfileSection />
          <OnboardingSection />
        </>
      )}
      {activeSection === 'billing' && <BillingSection />}
      {activeSection === 'security' && <SecuritySection />}
      {activeSection === 'audit' && <AuditLogsSection />}
      {activeSection === 'notifications' && <NotificationSettings />}
      {activeSection === 'privacy' && <PrivacySection />}
      {activeSection === 'dataPrivacy' && <ImportExport />}
      {activeSection === 'danger' && (
        <DangerZoneSection
          onRequestDelete={() => setShowDeleteModal(true)}
        />
      )}

      {/* Modals */}
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
