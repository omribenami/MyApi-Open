import { create } from 'zustand';

export const usePersonaStore = create((set) => ({
  personas: [],
  activePersonaId: null,
  isLoading: false,
  error: null,
  
  // Modal states
  showCreateModal: false,
  showEditModal: false,
  showDetailModal: false,
  showDeleteConfirmation: false,
  showSetActiveConfirmation: false,
  
  // Selected persona for editing/viewing
  selectedPersona: null,
  
  // Persona to delete/set active
  targetPersonaId: null,

  // Set personas list
  setPersonas: (personas) => {
    set({ personas });
  },

  // Set active persona
  setActivePersonaId: (id) => {
    set({ activePersonaId: id });
  },

  // Set loading state
  setIsLoading: (isLoading) => {
    set({ isLoading });
  },

  // Set error
  setError: (error) => {
    set({ error });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Open create modal
  openCreateModal: () => {
    set({
      showCreateModal: true,
      selectedPersona: null,
      error: null,
    });
  },

  // Close create modal
  closeCreateModal: () => {
    set({
      showCreateModal: false,
      selectedPersona: null,
      error: null,
    });
  },

  // Open edit modal
  openEditModal: (persona) => {
    set({
      showEditModal: true,
      selectedPersona: persona,
      error: null,
    });
  },

  // Close edit modal
  closeEditModal: () => {
    set({
      showEditModal: false,
      selectedPersona: null,
      error: null,
    });
  },

  // Open detail modal (view persona)
  openDetailModal: (persona) => {
    set({
      showDetailModal: true,
      selectedPersona: persona,
      error: null,
    });
  },

  // Close detail modal
  closeDetailModal: () => {
    set({
      showDetailModal: false,
      selectedPersona: null,
      error: null,
    });
  },

  // Open delete confirmation
  openDeleteConfirmation: (personaId) => {
    set({
      showDeleteConfirmation: true,
      targetPersonaId: personaId,
      error: null,
    });
  },

  // Close delete confirmation
  closeDeleteConfirmation: () => {
    set({
      showDeleteConfirmation: false,
      targetPersonaId: null,
      error: null,
    });
  },

  // Open set active confirmation
  openSetActiveConfirmation: (personaId) => {
    set({
      showSetActiveConfirmation: true,
      targetPersonaId: personaId,
      error: null,
    });
  },

  // Close set active confirmation
  closeSetActiveConfirmation: () => {
    set({
      showSetActiveConfirmation: false,
      targetPersonaId: null,
      error: null,
    });
  },

  // Add persona to list
  addPersona: (persona) => {
    set((state) => ({
      personas: [...state.personas, persona],
    }));
  },

  // Update persona in list
  updatePersona: (personaId, updates) => {
    set((state) => ({
      personas: state.personas.map((p) =>
        p.id === personaId ? { ...p, ...updates } : p
      ),
    }));
  },

  // Remove persona from list
  removePersona: (personaId) => {
    set((state) => ({
      personas: state.personas.filter((p) => p.id !== personaId),
    }));
  },
}));
