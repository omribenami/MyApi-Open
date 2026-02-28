import { create } from 'zustand';

export const useIdentityStore = create((set) => ({
  // Sub-tab state
  activeTab: 'profile',

  // Profile state
  profile: null,       // { user, identity }
  profileDraft: null,  // editable copy
  profileLoading: false,
  profileSaving: false,
  profileError: null,
  profileSuccess: null,
  profileDirty: false,

  // AI Persona state
  personas: [],
  selectedPersonaId: null,
  soulContent: '',
  soulDraft: '',
  personaLoading: false,
  personaSaving: false,
  personaError: null,
  personaSuccess: null,
  soulDirty: false,

  // Tab switching
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Profile actions
  setProfile: (data) =>
    set({
      profile: data,
      profileDraft: { ...data.identity },
      profileDirty: false,
    }),

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
      profileDraft: state.profile ? { ...state.profile.identity } : {},
      profileDirty: false,
      profileError: null,
    })),

  // Persona / SOUL.md actions
  setPersonas: (personas) => set({ personas }),

  setSelectedPersonaId: (id) => set({ selectedPersonaId: id }),

  setSoulContent: (content) =>
    set({ soulContent: content, soulDraft: content, soulDirty: false }),

  updateSoulDraft: (content) =>
    set((state) => ({
      soulDraft: content,
      soulDirty: content !== state.soulContent,
    })),

  setPersonaLoading: (v) => set({ personaLoading: v }),
  setPersonaSaving: (v) => set({ personaSaving: v }),
  setPersonaError: (msg) => set({ personaError: msg }),
  clearPersonaError: () => set({ personaError: null }),
  setPersonaSuccess: (msg) => set({ personaSuccess: msg }),
  clearPersonaSuccess: () => set({ personaSuccess: null }),

  resetSoulDraft: () =>
    set((state) => ({
      soulDraft: state.soulContent,
      soulDirty: false,
      personaError: null,
    })),
}));
