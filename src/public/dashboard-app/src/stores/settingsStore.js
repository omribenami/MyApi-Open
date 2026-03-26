import { create } from 'zustand';

export const useSettingsStore = create((set) => ({
  // Active section tab
  activeSection: 'profile',

  // Profile state
  profile: null,
  profileDraft: {
    displayName: '',
    email: '',
    timezone: 'UTC',
    language: 'en',
    avatarUrl: '',
  },
  profileLoading: false,
  profileSaving: false,
  profileError: null,
  profileSuccess: null,
  profileDirty: false,

  // Security state
  passwordDraft: { current: '', newPassword: '', confirm: '' },
  passwordSaving: false,
  passwordError: null,
  passwordSuccess: null,
  twoFactorEnabled: false,
  sessions: [],
  sessionsLoading: false,

  // Privacy state
  privacy: {
    dataSharing: false,
    apiLogging: true,
    cookieMode: 'essential',
  },
  privacySaving: false,
  privacySuccess: null,
  privacyError: null,

  // Section navigation
  setActiveSection: (section) => set({ activeSection: section }),

  // Profile actions
  setProfile: (data) =>
    set(() => ({
      profile: data,
      profileDraft: {
        displayName: data.identity?.Name || data.user?.displayName || data.user?.display_name || data.user?.username || '',
        email: data.user?.email || data.identity?.Email || '',
        timezone: data.identity?.Timezone || 'UTC',
        language: 'en',
        avatarUrl: data.identity?.AvatarUrl || data.user?.avatarUrl || data.user?.avatar_url || '',
      },
      profileDirty: false,
    })),

  updateProfileDraft: (key, value) =>
    set((state) => ({
      profileDraft: { ...state.profileDraft, [key]: value },
      profileDirty: true,
    })),

  setProfileLoading: (v) => set({ profileLoading: v }),
  setProfileSaving: (v) => set({ profileSaving: v }),
  setProfileError: (msg) => set({ profileError: msg }),
  clearProfileError: () => set({ profileError: null }),
  setProfileSuccess: (msg) => set({ profileSuccess: msg }),
  clearProfileSuccess: () => set({ profileSuccess: null }),

  resetProfileDraft: () =>
    set((state) => ({
      profileDraft: state.profile
        ? {
            displayName: state.profile.identity?.Name || state.profile.user?.displayName || state.profile.user?.display_name || state.profile.user?.username || '',
            email: state.profile.user?.email || state.profile.identity?.Email || '',
            timezone: state.profile.identity?.Timezone || 'UTC',
            language: 'en',
            avatarUrl: state.profile.identity?.AvatarUrl || state.profile.user?.avatarUrl || state.profile.user?.avatar_url || '',
          }
        : { displayName: '', email: '', timezone: 'UTC', language: 'en', avatarUrl: '' },
      profileDirty: false,
    })),

  // Password actions
  updatePasswordDraft: (key, value) =>
    set((state) => ({
      passwordDraft: { ...state.passwordDraft, [key]: value },
    })),

  clearPasswordDraft: () =>
    set({ passwordDraft: { current: '', newPassword: '', confirm: '' } }),

  setPasswordSaving: (v) => set({ passwordSaving: v }),
  setPasswordError: (msg) => set({ passwordError: msg }),
  clearPasswordError: () => set({ passwordError: null }),
  setPasswordSuccess: (msg) => set({ passwordSuccess: msg }),
  clearPasswordSuccess: () => set({ passwordSuccess: null }),

  // 2FA
  toggleTwoFactor: () => set((state) => ({ twoFactorEnabled: !state.twoFactorEnabled })),

  // Sessions
  setSessions: (sessions) => set({ sessions }),
  setSessionsLoading: (v) => set({ sessionsLoading: v }),

  // Privacy actions
  updatePrivacy: (key, value) =>
    set((state) => ({
      privacy: { ...state.privacy, [key]: value },
    })),

  setPrivacySaving: (v) => set({ privacySaving: v }),
  setPrivacySuccess: (msg) => set({ privacySuccess: msg }),
  clearPrivacySuccess: () => set({ privacySuccess: null }),
  setPrivacyError: (msg) => set({ privacyError: msg }),
  clearPrivacyError: () => set({ privacyError: null }),
}));
