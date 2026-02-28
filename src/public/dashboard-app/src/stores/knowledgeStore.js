import { create } from 'zustand';

export const useKnowledgeStore = create((set) => ({
  documents: [],
  isLoading: false,
  error: null,
  success: null,

  // UI state
  viewMode: 'grid',
  searchQuery: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  filterSource: 'all',

  // Modal / overlay states
  showCreateModal: false,
  showEditor: false,
  showDeleteConfirmation: false,

  targetDocumentId: null,
  pendingDocumentData: null,

  // Setters
  setDocuments: (documents) => set({ documents }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSuccess: (success) => set({ success }),
  clearError: () => set({ error: null }),
  clearSuccess: () => set({ success: null }),

  setViewMode: (viewMode) => set({ viewMode }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  setFilterSource: (filterSource) => set({ filterSource }),

  openCreateModal: () => set({ showCreateModal: true, error: null }),
  closeCreateModal: () => set({ showCreateModal: false }),

  openEditor: (data = null) => set({ showEditor: true, pendingDocumentData: data }),
  closeEditor: () => set({ showEditor: false, pendingDocumentData: null }),

  openDeleteConfirmation: (docId) =>
    set({ showDeleteConfirmation: true, targetDocumentId: docId }),
  closeDeleteConfirmation: () =>
    set({ showDeleteConfirmation: false, targetDocumentId: null }),

  addDocument: (doc) =>
    set((state) => ({ documents: [doc, ...state.documents] })),
  removeDocument: (docId) =>
    set((state) => ({ documents: state.documents.filter((d) => d.id !== docId) })),
}));
