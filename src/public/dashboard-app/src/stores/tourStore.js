import { create } from 'zustand';

// Generic guided-tour controller. Plays any "deck" of steps — the cross-page
// essentials tour, or a short per-page manual triggered by the "?" button.
// Steps live in stores/tourSteps.js; this just drives active/index/steps.
const SEEN_KEY = 'myapi_tour_done';

export const tourSeen = () => { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };
export const markTourSeen = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ } };

export const useTourStore = create((set) => ({
  active: false,
  index: 0,
  steps: [],
  start: (steps) => { if (!steps || !steps.length) return; set({ active: true, index: 0, steps }); },
  setIndex: (i) => set({ index: Math.max(0, i) }),
  finish: () => set({ active: false, index: 0, steps: [] }),
}));
