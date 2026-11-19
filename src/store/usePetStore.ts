import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { dateKey } from '@/lib/dates';
import { BADGES, XP, badgeContext, emptyLog, isComplete } from '@/lib/gamification';
import { defaultReminders, fitMealTimes } from '@/lib/reminders';
import type { DayLog, HealthItem, Pet, Reminders, Routine, TaskId } from './types';

interface PetState {
  onboarded: boolean;
  pet: Pet | null;
  routine: Routine;
  logs: Record<string, DayLog>;
  health: HealthItem[];
  xp: number;
  badges: string[];
  /** badge id waiting to be celebrated on screen */
  pendingBadge: string | null;
  reminders: Reminders;
  /** id of this pet on the server; set before the first upload so retries reuse it */
  cloudPetId: string | null;

  completeOnboarding: (pet: Pet, routine: Routine, reminders: Reminders, health: HealthItem[]) => void;
  setReminders: (patch: Partial<Reminders>) => void;
  tapTask: (task: TaskId) => void;
  markHealthDone: (id: string) => void;
  dismissBadge: () => void;
  setCloudPetId: (id: string | null) => void;
  resetAll: () => void;
}

const initial = {
  onboarded: false,
  pet: null,
  routine: { meals: 2, walkMinutes: 30 },
  logs: {},
  health: [],
  xp: 0,
  badges: [],
  pendingBadge: null,
  reminders: defaultReminders(2),
  cloudPetId: null as string | null,
};

function unlockNew(badges: string[], logs: Record<string, DayLog>, health: HealthItem[], meals: number) {
  const ctx = badgeContext(logs, health, meals, dateKey());
  return BADGES.filter((b) => !badges.includes(b.id) && b.check(ctx)).map((b) => b.id);
}

export const usePetStore = create<PetState>()(
  persist(
    (set) => ({
      ...initial,

      completeOnboarding: (pet, routine, reminders, health) =>
        set({
          onboarded: true,
          pet,
          routine,
          health,
          reminders: { ...reminders, mealTimes: fitMealTimes(reminders.mealTimes, routine.meals) },
        }),

      setReminders: (patch) => set((s) => ({ reminders: { ...s.reminders, ...patch } })),

      tapTask: (task) =>
        set((s) => {
          const today = dateKey();
          const meals = s.routine.meals;
          const log: DayLog = { ...emptyLog(), ...s.logs[today] };
          let xp = s.xp;

          if (task === 'food') {
            // Each tap gives one meal; tapping when full clears the day's meals.
            if (log.food < meals) {
              log.food += 1;
              xp += XP.task;
            } else {
              xp -= XP.task * log.food;
              log.food = 0;
            }
          } else {
            log[task] = !log[task];
            xp += log[task] ? XP.task : -XP.task;
          }

          const complete = isComplete(log, meals);
          if (complete && !log.bonus) {
            log.bonus = true;
            xp += XP.dayBonus;
          } else if (!complete && log.bonus) {
            log.bonus = false;
            xp -= XP.dayBonus;
          }

          const logs = { ...s.logs, [today]: log };
          const fresh = unlockNew(s.badges, logs, s.health, meals);
          return {
            logs,
            xp: Math.max(0, xp),
            badges: [...s.badges, ...fresh],
            pendingBadge: fresh[0] ?? s.pendingBadge,
          };
        }),

      markHealthDone: (id) =>
        set((s) => {
          const health = s.health.map((h) => (h.id === id ? { ...h, lastDate: dateKey(), guess: undefined } : h));
          const fresh = unlockNew(s.badges, s.logs, health, s.routine.meals);
          return {
            health,
            xp: s.xp + XP.health,
            badges: [...s.badges, ...fresh],
            pendingBadge: fresh[0] ?? s.pendingBadge,
          };
        }),

      dismissBadge: () => set({ pendingBadge: null }),

      setCloudPetId: (cloudPetId) => set({ cloudPetId }),

      resetAll: () => set({ ...initial }),
    }),
    {
      name: 'petapp-store',
      version: 2,
      // v1 had no reminders: start them off, matching the saved meal count.
      migrate: (persisted, version) => {
        const state = persisted as Partial<PetState>;
        if (version < 2) state.reminders = defaultReminders(state.routine?.meals ?? 2);
        return state as PetState;
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        onboarded: s.onboarded,
        pet: s.pet,
        routine: s.routine,
        logs: s.logs,
        health: s.health,
        xp: s.xp,
        badges: s.badges,
        pendingBadge: s.pendingBadge,
        reminders: s.reminders,
        cloudPetId: s.cloudPetId,
      }),
    },
  ),
);

/** True once the saved state has been loaded from storage. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(usePetStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = usePetStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(usePetStore.persist.hasHydrated());
    return unsub;
  }, []);
  return hydrated;
}
