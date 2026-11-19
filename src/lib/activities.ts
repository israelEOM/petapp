import type { Activity, DayLog, HealthItem, TaskId } from '@/store/types';
import { XP, emptyLog, isComplete } from './gamification';

/**
 * Activities are the source of truth: one row per meal, task or health dose, never edited, only
 * soft-deleted on undo. Day logs and XP are derived from them, so events from several phones merge
 * without conflicts.
 */

export const isLive = (a: Activity) => a.deletedAt === null;

/** Day logs built from the live activities. Only days with at least one live task appear. */
export function deriveLogs(activities: Record<string, Activity>, meals: number): Record<string, DayLog> {
  const logs: Record<string, DayLog> = {};
  for (const a of Object.values(activities)) {
    if (!isLive(a) || a.kind === 'health') continue;
    const log = (logs[a.day] ??= emptyLog());
    if (a.kind === 'food') log.food += 1;
    else log[a.kind] = true;
  }
  for (const log of Object.values(logs)) log.bonus = isComplete(log, meals);
  return logs;
}

/** +10 per task (meals count up to the daily goal), +40 per complete day, +30 per health dose. */
export function deriveXp(activities: Record<string, Activity>, meals: number): number {
  let xp = 0;
  for (const log of Object.values(deriveLogs(activities, meals))) {
    xp += XP.task * (Math.min(log.food, meals) + Number(log.water) + Number(log.walk) + Number(log.play));
    if (log.bonus) xp += XP.dayBonus;
  }
  for (const a of Object.values(activities)) if (isLive(a) && a.kind === 'health') xp += XP.health;
  return xp;
}

export interface NewActivity {
  id: string;
  now: string;
}

/**
 * What one tap on a task card does to today's activities:
 * - food adds a meal until the goal, then a tap clears the day's meals;
 * - water, walk and play toggle (off removes every live one of that kind today, whoever logged it).
 * Returns the activities that were added or soft-deleted.
 */
export function tapChanges(
  activities: Record<string, Activity>,
  task: TaskId,
  today: string,
  meals: number,
  fresh: NewActivity,
): Activity[] {
  const live = Object.values(activities).filter((a) => isLive(a) && a.kind === task && a.day === today);
  const add = (): Activity[] => [
    { id: fresh.id, kind: task, healthItemId: null, day: today, createdAt: fresh.now, deletedAt: null, userId: null },
  ];
  const removeAll = () => live.map((a) => ({ ...a, deletedAt: fresh.now }));

  if (task === 'food') return live.length < meals ? add() : removeAll();
  return live.length === 0 ? add() : removeAll();
}

/** Seeds for stable ids: the same day/kind/index always maps to the same activity id. */
export function legacySeeds(
  logs: Record<string, DayLog>,
  health: HealthItem[],
): { seed: string; kind: Activity['kind']; healthItemId: string | null; day: string }[] {
  const rows: { kind: Activity['kind']; healthItemId: string | null; day: string }[] = [];
  for (const [day, log] of Object.entries(logs)) {
    for (let i = 0; i < log.food; i++) rows.push({ kind: 'food', healthItemId: null, day });
    for (const task of ['water', 'walk', 'play'] as const) if (log[task]) rows.push({ kind: task, healthItemId: null, day });
  }
  for (const h of health) if (h.lastDate && !h.guess) rows.push({ kind: 'health', healthItemId: h.id, day: h.lastDate });

  // Index within (day, kind) keeps the 2nd meal distinct from the 1st.
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const key = `${r.day}|${r.kind}|${r.healthItemId ?? ''}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    return { ...r, seed: `${key}:${n}` };
  });
}

/** Noon of a local day, so the timestamp never slips into the neighbouring day in any timezone. */
export function noonOf(day: string): string {
  return new Date(`${day}T12:00:00`).toISOString();
}

/**
 * Activities for logs saved before the activity model (store v2): one per meal and task per day and
 * one per recorded (not guessed) health dose, at noon of that day. `uuid` turns a seed into an id;
 * it must match what the first upload used so nothing is duplicated on the server.
 */
export async function activitiesFromLegacy(
  logs: Record<string, DayLog>,
  health: HealthItem[],
  uuid: (seed: string) => Promise<string>,
): Promise<Record<string, Activity>> {
  const out: Record<string, Activity> = {};
  for (const r of legacySeeds(logs, health)) {
    const id = await uuid(r.seed);
    out[id] = { id, kind: r.kind, healthItemId: r.healthItemId, day: r.day, createdAt: noonOf(r.day), deletedAt: null, userId: null };
  }
  return out;
}

/** Server row shape (snake_case) for `public.activities`. */
export interface ActivityRow {
  id: string;
  pet_id: string;
  kind: Activity['kind'];
  health_item_id: string | null;
  day: string;
  created_at: string;
  deleted_at: string | null;
  user_id?: string | null;
  updated_at?: string;
}

export const toRow = (petId: string, a: Activity): ActivityRow => ({
  id: a.id,
  pet_id: petId,
  kind: a.kind,
  health_item_id: a.healthItemId,
  day: a.day,
  created_at: a.createdAt,
  deleted_at: a.deletedAt,
});

export const fromRow = (r: ActivityRow): Activity => ({
  id: r.id,
  kind: r.kind,
  healthItemId: r.health_item_id,
  day: r.day,
  createdAt: r.created_at,
  deletedAt: r.deleted_at,
  userId: r.user_id ?? null,
});

/**
 * Merges server rows into local activities. Rows still waiting in the local outbox keep the local
 * version; a soft delete is never undone by an older copy of the row.
 */
export function mergeActivities(
  local: Record<string, Activity>,
  remote: Activity[],
  pending: Record<string, number>,
): { activities: Record<string, Activity>; changed: boolean } {
  let changed = false;
  const next = { ...local };
  for (const r of remote) {
    if (pending[r.id] !== undefined) continue;
    const cur = next[r.id];
    const merged: Activity = cur ? { ...r, deletedAt: cur.deletedAt ?? r.deletedAt } : r;
    if (!cur || cur.deletedAt !== merged.deletedAt || cur.userId !== merged.userId) {
      next[r.id] = merged;
      changed = true;
    }
  }
  return { activities: changed ? next : local, changed };
}
