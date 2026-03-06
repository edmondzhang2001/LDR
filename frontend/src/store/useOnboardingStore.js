import { create } from 'zustand';

/**
 * Store for onboarding questionnaire data (multi-select answers) and optional
 * handoff data. Reset after signup or when abandoning onboarding.
 */
export const useOnboardingStore = create((set) => ({
  // Phase 1 multi-select answers (arrays of selected option strings)
  situation: [],
  hardestPart: [],
  bringsYouHere: [],

  setSituation: (situation) => set({ situation: Array.isArray(situation) ? situation : [] }),
  setHardestPart: (hardestPart) => set({ hardestPart: Array.isArray(hardestPart) ? hardestPart : [] }),
  setBringsYouHere: (bringsYouHere) => set({ bringsYouHere: Array.isArray(bringsYouHere) ? bringsYouHere : [] }),

  toggleSituation: (option) =>
    set((state) => ({
      situation: state.situation.includes(option)
        ? state.situation.filter((s) => s !== option)
        : [...state.situation, option],
    })),
  toggleHardestPart: (option) =>
    set((state) => ({
      hardestPart: state.hardestPart.includes(option)
        ? state.hardestPart.filter((h) => h !== option)
        : [...state.hardestPart, option],
    })),
  toggleBringsYouHere: (option) =>
    set((state) => ({
      bringsYouHere: state.bringsYouHere.includes(option)
        ? state.bringsYouHere.filter((b) => b !== option)
        : [...state.bringsYouHere, option],
    })),

  /** Persist questionnaire answers for handoff / analytics. */
  setOnboardingData: (data) =>
    set({
      situation: data.situation ?? [],
      hardestPart: data.hardestPart ?? [],
      bringsYouHere: data.bringsYouHere ?? [],
    }),

  /** Clear all onboarding data. */
  resetOnboarding: () =>
    set({
      situation: [],
      hardestPart: [],
      bringsYouHere: [],
    }),
}));
