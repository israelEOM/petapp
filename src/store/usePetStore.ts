import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { activitiesFromLegacy, deriveLogs, deriveXp, mergeActivities, tapChanges } from '@/lib/activities';
import { dateKey } from '@/lib/dates';
import { BADGES, badgeContext } from '@/lib/gamification';
import { legacyUuid, newId } from '@/lib/ids';
import { defaultReminders, fitMealTimes } from '@/lib/reminders';
import type { Activity, DayLog, HealthItem, Pet, Reminders, Routine, TaskId } from './types';

/** What the server sent in one pull (or a Realtime event). */
export interface RemoteData {
  activities?: Activity[];
  health?: HealthItem[];
  badges?: string[];
  /** newest `updated_at` seen, for the next incremental pull */
  cursor?: string | null;
}

/** A pet already in the account, downloaded to replace the local one. */
export interface CloudPet {
  petId: string;
  userId: string;
  pet: Pet;
  routine: Routine;
  health: HealthItem[];
  activities: Activity[];
  badges: string[];
  cursor: string | null;
}

interface PetState {
  onboarded: boolean;
  pet: Pet | null;
  routine: Routine;
  /** source of truth for the routine log, keyed by id */
  activities: Record<string, Activity>;
  /** derived from activities (not persisted) */
  logs: Record<string, DayLog>;
  /** derived from activities (not persisted) */
  xp: number;
  health: HealthItem[];
  badges: string[];
  /** badge id waiting to be celebrated on screen */
  pendingBadge: string | null;
  reminders: Reminders;
  /** id of this pet on the server; set before the first upload so retries reuse it */
  cloudPetId: string | null;
  /** account whose upload of this pet finished; sync runs only for that account */
  linkedUserId: string | null;
  /** activities changed on this phone and not yet on the server: id → local revision */
  outbox: Record<string, number>;
  /** newest server `updated_at` already pulled */
  syncCursor: string | null;

  completeOnboarding: (pet: Pet, routine: Routine, reminders: Reminders, health: HealthItem[]) => void;
  setReminders: (patch: Partial<Reminders>) => void;
  tapTask: (task: TaskId) => void;
  markHealthDone: (id: string) => void;
  dismissBadge: () => void;
  setCloudPetId: (id: string | null) => void;
  setLinked: (userId: string | null) => void;
  /** after a push: drops outbox entries that didn't change while the push was in flight */
  markPushed: (sent: Record<string, number>) => void;
  applyRemote: (data: RemoteData) => void;
  adoptCloudPet: (cloud: CloudPet) => void;
  resetAll: () => void;
}

const initial = {
  onboarded: false,
  pet: null,
  routine: { meals: 2, walkMinutes: 30 },
  activities: {} as Record<string, Activity>,
  logs: {} as Record<string, DayLog>,
  xp: 0,
  health: [] as HealthItem[],
  badges: [] as string[],
  pendingBadge: null as string | null,
  reminders: defaultReminders(2),
  cloudPetId: null as string | null,
  linkedUserId: null as string | null,
  outbox: {} as Record<string, number>,
  syncCursor: null as string | null,
};

function unlockNew(badges: string[], logs: Record<string, DayLog>, health: HealthItem[], meals: number) {
  const ctx = badgeContext(logs, health, meals, dateKey());
  return BADGES.filter((b) => !badges.includes(b.id) && b.check(ctx)).map((b) => b.id);
}

const derive = (activities: Record<string, Activity>, meals: number) => ({
  logs: deriveLogs(activities, meals),
  xp: deriveXp(activities, meals),
});

function queue(outbox: Record<string, number>, ids: string[]) {
  const next = { ...outbox };
  for (const id of ids) next[id] = (next[id] ?? 0) + 1;
  return next;
}

/** Server health items win when their last dose is newer, or equal and no longer a guess. */
function mergeHealth(local: HealthItem[], remote: HealthItem[]): HealthItem[] {
  const byId = new Map(local.map((h) => [h.id, h]));
  for (const r of remote) {
    const cur = byId.get(r.id);
    if (!cur) byId.set(r.id, r);
    else if (r.lastDate && (!cur.lastDate || r.lastDate > cur.lastDate || (r.lastDate === cur.lastDate && !r.guess))) {
      byId.set(r.id, { ...cur, lastDate: r.lastDate, guess: r.guess });
    }
  }
  return [...byId.values()];
}

export const usePetStore = create<PetState>()(
  persist(
    (set) => ({
      ...initial,

      completeOnboarding: (pet, routine, reminders, health) =>
        set((s) => ({
          onboarded: true,
          pet,
          routine,
          health,
          reminders: { ...reminders, mealTimes: fitMealTimes(reminders.mealTimes, routine.meals) },
          ...derive(s.activities, routine.meals),
        })),

      setReminders: (patch) => set((s) => ({ reminders: { ...s.reminders, ...patch } })),

      tapTask: (task) =>
        set((s) => {
          const changes = tapChanges(s.activities, task, dateKey(), s.routine.meals, { id: newId(), now: new Date().toISOString() });
          const activities = { ...s.activities };
          for (const a of changes) activities[a.id] = a;
          const { logs, xp } = derive(activities, s.routine.meals);
          const fresh = unlockNew(s.badges, logs, s.health, s.routine.meals);
          return {
            activities,
            logs,
            xp,
            outbox: queue(s.outbox, changes.map((a) => a.id)),
            badges: [...s.badges, ...fresh],
            pendingBadge: fresh[0] ?? s.pendingBadge,
          };
        }),

      markHealthDone: (id) =>
        set((s) => {
          const today = dateKey();
          const dose: Activity = {
            id: newId(),
            kind: 'health',
            healthItemId: id,
            day: today,
            createdAt: new Date().toISOString(),
            deletedAt: null,
            userId: null,
          };
          const activities = { ...s.activities, [dose.id]: dose };
          const health = s.health.map((h) => (h.id === id ? { ...h, lastDate: today, guess: undefined } : h));
          const { logs, xp } = derive(activities, s.routine.meals);
          const fresh = unlockNew(s.badges, logs, health, s.routine.meals);
          return {
            activities,
            logs,
            xp,
            health,
            outbox: queue(s.outbox, [dose.id]),
            badges: [...s.badges, ...fresh],
            pendingBadge: fresh[0] ?? s.pendingBadge,
          };
        }),

      dismissBadge: () => set({ pendingBadge: null }),

      setCloudPetId: (cloudPetId) => set({ cloudPetId }),

      setLinked: (linkedUserId) => set({ linkedUserId }),

      markPushed: (sent) =>
        set((s) => {
          const outbox = { ...s.outbox };
          for (const [id, rev] of Object.entries(sent)) if (outbox[id] === rev) delete outbox[id];
          return { outbox };
        }),

      applyRemote: (data) =>
        set((s) => {
          const patch: Partial<PetState> = {};
          if (data.activities?.length) {
            const { activities, changed } = mergeActivities(s.activities, data.activities, s.outbox);
            if (changed) Object.assign(patch, { activities }, derive(activities, s.routine.meals));
          }
          if (data.health?.length) patch.health = mergeHealth(s.health, data.health);
          if (data.badges?.length) {
            const extra = data.badges.filter((b) => !s.badges.includes(b));
            if (extra.length) patch.badges = [...s.badges, ...extra];
          }
          if (data.cursor && (!s.syncCursor || data.cursor > s.syncCursor)) patch.syncCursor = data.cursor;
          return patch;
        }),

      adoptCloudPet: (c) =>
        set((s) => {
          const activities = Object.fromEntries(c.activities.map((a) => [a.id, a]));
          return {
            onboarded: true,
            pet: c.pet,
            routine: c.routine,
            health: c.health,
            activities,
            ...derive(activities, c.routine.meals),
            badges: c.badges,
            pendingBadge: null,
            reminders: { ...s.reminders, mealTimes: fitMealTimes(s.reminders.mealTimes, c.routine.meals) },
            cloudPetId: c.petId,
            linkedUserId: c.userId,
            outbox: {},
            syncCursor: c.cursor,
          };
        }),

      resetAll: () => set({ ...initial }),
    }),
    {
      name: 'petapp-store',
      version: 3,
      migrate: async (persisted, version) => {
        const state = persisted as Partial<PetState> & { logs?: Record<string, DayLog>; xp?: number };
        // v1 had no reminders: start them off, matching the saved meal count.
        if (version < 2) state.reminders = defaultReminders(state.routine?.meals ?? 2);
        // v2 stored day logs and a running XP total; v3 stores activities and derives both.
        if (version < 3) {
          state.activities = await activitiesFromLegacy(
            state.logs ?? {},
            state.health ?? [],
            legacyUuid(state.cloudPetId ?? 'local'),
          );
          state.outbox = {};
          state.syncCursor = null;
          state.linkedUserId = null;
          delete state.logs;
          delete state.xp;
        }
        return state as PetState;
      },
      // Logs and XP aren't stored; rebuild them from the activities on load.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PetState>;
        const activities = p.activities ?? current.activities;
        const meals = p.routine?.meals ?? current.routine.meals;
        return { ...current, ...p, activities, ...derive(activities, meals) };
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        onboarded: s.onboarded,
        pet: s.pet,
        routine: s.routine,
        activities: s.activities,
        health: s.health,
        badges: s.badges,
        pendingBadge: s.pendingBadge,
        reminders: s.reminders,
        cloudPetId: s.cloudPetId,
        linkedUserId: s.linkedUserId,
        outbox: s.outbox,
        syncCursor: s.syncCursor,
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
