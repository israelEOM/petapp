import * as Crypto from 'expo-crypto';

import type { DayLog, HealthItem, Pet, Routine, TaskId } from '@/store/types';
import { supabase } from './supabase';

export interface LocalSnapshot {
  pet: Pet;
  routine: Routine;
  logs: Record<string, DayLog>;
  health: HealthItem[];
  badges: string[];
}

export interface ActivityRow {
  id: string;
  pet_id: string;
  kind: TaskId | 'health';
  health_item_id: string | null;
  day: string;
  created_at: string;
}

/**
 * Stable UUID from a string (sha256, shaped as a v5-style UUID). Re-running the upload produces the
 * same ids, so rows that already reached the server are skipped instead of duplicated.
 */
export async function stableUuid(seed: string): Promise<string> {
  const h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, seed);
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Noon of a local day, so the timestamp never slips into the neighbouring day in any timezone offset. */
function noonOf(day: string): string {
  return new Date(`${day}T12:00:00`).toISOString();
}

/** One activity per meal and per task done on each day, plus one per recorded (not guessed) health dose. */
export async function activitiesFromLogs(petId: string, snapshot: LocalSnapshot): Promise<ActivityRow[]> {
  const rows: Omit<ActivityRow, 'id'>[] = [];
  for (const [day, log] of Object.entries(snapshot.logs)) {
    for (let i = 0; i < log.food; i++) rows.push({ pet_id: petId, kind: 'food', health_item_id: null, day, created_at: noonOf(day) });
    for (const task of ['water', 'walk', 'play'] as const) {
      if (log[task]) rows.push({ pet_id: petId, kind: task, health_item_id: null, day, created_at: noonOf(day) });
    }
  }
  for (const h of snapshot.health) {
    if (h.lastDate && !h.guess) {
      rows.push({ pet_id: petId, kind: 'health', health_item_id: h.id, day: h.lastDate, created_at: noonOf(h.lastDate) });
    }
  }
  // Index within (day, kind) keeps the 2nd meal distinct from the 1st.
  const seen = new Map<string, number>();
  return Promise.all(
    rows.map(async (r) => {
      const key = `${r.day}|${r.kind}|${r.health_item_id ?? ''}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      return { ...r, id: await stableUuid(`petapp:${petId}:${key}:${n}`) };
    }),
  );
}

export type LinkResult =
  | { status: 'uploaded'; petId: string }
  | { status: 'cloud'; petId: string }
  | { status: 'nothing' };

/**
 * First sign-in: if the account has no pet yet, uploads the local one (pet, health items, history as
 * activities, badges). If the account already has a pet (second phone, reinstall), uploads nothing
 * and returns it so the app can offer to use the cloud data instead.
 *
 * `petId` must be generated once and persisted by the caller before calling, so a retry after a
 * crash or a lost connection upserts the same rows.
 */
export async function linkLocalPet(userId: string, petId: string, snapshot: LocalSnapshot | null): Promise<LinkResult> {
  if (!supabase) return { status: 'nothing' };

  const { data: memberships, error: listError } = await supabase
    .from('pet_members')
    .select('pet_id')
    .eq('user_id', userId)
    .limit(1);
  if (listError) throw listError;

  const existing = memberships?.[0]?.pet_id as string | undefined;
  // Our own earlier, interrupted upload counts as "no pet yet": finish it.
  if (existing && existing !== petId) return { status: 'cloud', petId: existing };
  if (!snapshot) return existing ? { status: 'cloud', petId: existing } : { status: 'nothing' };

  const { pet, routine } = snapshot;
  const { error: petError } = await supabase.from('pets').upsert(
    {
      id: petId,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      birth: pet.birth,
      weight_kg: pet.weightKg,
      sex: pet.sex,
      meals: routine.meals,
      walk_minutes: routine.walkMinutes,
      created_by: userId,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (petError) throw petError;

  if (snapshot.health.length) {
    const { error } = await supabase.from('health_items').upsert(
      snapshot.health.map((h) => ({
        pet_id: petId,
        item_id: h.id,
        name: h.name,
        interval_days: h.intervalDays,
        last_date: h.lastDate,
        guess: h.guess ?? null,
      })),
      { onConflict: 'pet_id,item_id', ignoreDuplicates: true },
    );
    if (error) throw error;
  }

  const activities = await activitiesFromLogs(petId, snapshot);
  for (let i = 0; i < activities.length; i += 500) {
    const { error } = await supabase
      .from('activities')
      .upsert(activities.slice(i, i + 500), { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
  }

  if (snapshot.badges.length) {
    const { error } = await supabase
      .from('badges')
      .upsert(snapshot.badges.map((badge_id) => ({ pet_id: petId, badge_id })), {
        onConflict: 'pet_id,badge_id',
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }

  return { status: 'uploaded', petId };
}
