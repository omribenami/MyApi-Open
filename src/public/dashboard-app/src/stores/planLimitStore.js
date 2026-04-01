import { create } from 'zustand';

export const usePlanLimitStore = create((set) => ({
  visible: false,
  plan: null,
  limit: null,
  errorMessage: '',

  show: ({ plan, limit, errorMessage }) =>
    set({ visible: true, plan, limit, errorMessage }),

  hide: () =>
    set({ visible: false, plan: null, limit: null, errorMessage: '' }),
}));
