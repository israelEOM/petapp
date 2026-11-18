import { create } from 'zustand';

import type { Sex, Species } from './types';

interface Draft {
  species: Species;
  name: string;
  breed: string;
  birth: string;
  weightKg: string;
  sex: Sex;
  meals: number;
  walkMinutes: number;
  update: (patch: Partial<Omit<Draft, 'update' | 'reset'>>) => void;
  reset: () => void;
}

const empty = {
  species: 'dog' as Species,
  name: '',
  breed: '',
  birth: '',
  weightKg: '',
  sex: 'male' as Sex,
  meals: 2,
  walkMinutes: 30,
};

/** In-memory answers while the user walks through onboarding. */
export const useOnboardingDraft = create<Draft>()((set) => ({
  ...empty,
  update: (patch) => set(patch),
  reset: () => set(empty),
}));
