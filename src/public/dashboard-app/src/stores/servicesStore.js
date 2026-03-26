import { create } from 'zustand';

export const useServicesStore = create((set) => ({
  services: [],
  isLoading: false,
  error: null,
  selectedService: null,
  showConnectModal: false,
  showRevokeModal: false,
  revokeServiceId: null,

  // Set services list
  setServices: (services) => {
    set({ services });
  },

  // Set loading state
  setIsLoading: (isLoading) => {
    set({ isLoading });
  },

  // Set error
  setError: (error) => {
    set({ error });
  },

  // Select a service
  selectService: (service) => {
    set({ selectedService: service });
  },

  // Open connect modal
  openConnectModal: (service) => {
    set({ 
      selectedService: service,
      showConnectModal: true,
      error: null,
    });
  },

  // Close connect modal
  closeConnectModal: () => {
    set({ 
      showConnectModal: false,
      selectedService: null,
      error: null,
    });
  },

  // Open revoke modal
  openRevokeModal: (serviceId) => {
    set({ 
      showRevokeModal: true,
      revokeServiceId: serviceId,
      error: null,
    });
  },

  // Close revoke modal
  closeRevokeModal: () => {
    set({ 
      showRevokeModal: false,
      revokeServiceId: null,
      error: null,
    });
  },

  // Update service in list
  updateService: (serviceId, updates) => {
    set((state) => ({
      services: state.services.map((s) =>
        s.id === serviceId ? { ...s, ...updates } : s
      ),
    }));
  },

  // Remove service from list
  removeService: (serviceId) => {
    set((state) => ({
      services: state.services.filter((s) => s.id !== serviceId),
    }));
  },

  // Add service to list
  addService: (service) => {
    set((state) => ({
      services: [...state.services, service],
    }));
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));
