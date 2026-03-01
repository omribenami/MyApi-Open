import { create } from 'zustand';

export const useSkillStore = create((set) => ({
  skills: [],
  activeSkillId: null,
  isLoading: false,
  error: null,

  // Modal states
  showCreateModal: false,
  showEditModal: false,
  showDetailModal: false,
  showDeleteConfirmation: false,
  showSetActiveConfirmation: false,

  selectedSkill: null,
  targetSkillId: null,

  setSkills: (skills) => set({ skills }),
  setActiveSkillId: (id) => set({ activeSkillId: id }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  openCreateModal: () => set({ showCreateModal: true, selectedSkill: null, error: null }),
  closeCreateModal: () => set({ showCreateModal: false, selectedSkill: null, error: null }),

  openEditModal: (skill) => set({ showEditModal: true, selectedSkill: skill, error: null }),
  closeEditModal: () => set({ showEditModal: false, selectedSkill: null, error: null }),

  openDetailModal: (skill) => set({ showDetailModal: true, selectedSkill: skill, error: null }),
  closeDetailModal: () => set({ showDetailModal: false, selectedSkill: null, error: null }),

  openDeleteConfirmation: (skillId) => set({ showDeleteConfirmation: true, targetSkillId: skillId, error: null }),
  closeDeleteConfirmation: () => set({ showDeleteConfirmation: false, targetSkillId: null, error: null }),

  openSetActiveConfirmation: (skillId) => set({ showSetActiveConfirmation: true, targetSkillId: skillId, error: null }),
  closeSetActiveConfirmation: () => set({ showSetActiveConfirmation: false, targetSkillId: null, error: null }),

  addSkill: (skill) => set((state) => ({ skills: [...state.skills, skill] })),
  updateSkill: (skillId, updates) => set((state) => ({
    skills: state.skills.map((s) => s.id === skillId ? { ...s, ...updates } : s),
  })),
  removeSkill: (skillId) => set((state) => ({
    skills: state.skills.filter((s) => s.id !== skillId),
  })),
}));
