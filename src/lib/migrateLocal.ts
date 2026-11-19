import type { Activity, HealthItem, Pet, Routine } from '@/store/types';
import { toRow } from './activities';
import { supabase } from './supabase';

export interface LocalSnapshot {
  pet: Pet;
  routine: Routine;
  activities: Record<string, Activity>;
  health: HealthItem[];
  badges: string[];
}

export type LinkResult =
  | { status: 'uploaded'; petId: string }
  | { status: 'cloud'; petId: string; name: string }
  | { status: 'nothing' };

/**
 * First sign-in: if the account has no pet yet, uploads the local one (pet, health items, every
 * activity, badges). If the account already has a different pet (second phone, reinstall), uploads
 * nothing and returns it so the app can offer to use the cloud data instead.
 *
 * `petId` must be generated once and persisted by the caller before calling, so a retry after a
 * crash or a lost connection upserts the same rows.
 */
export async function linkLocalPet(userId: string, petId: string, snapshot: LocalSnapshot | null): Promise<LinkResult> {
  if (!supabase) return { status: 'nothing' };

  const { data: memberships, error: listError } = await supabase
    .from('pet_members')
    .select('pet_id, pets(name)')
    .eq('user_id', userId)
    .order('joined_at')
    .limit(1);
  if (listError) throw listError;

  const row = memberships?.[0] as { pet_id: string; pets: { name: string } | { name: string }[] | null } | undefined;
  const existing = row?.pet_id;
  const pets = row?.pets;
  const existingName = (Array.isArray(pets) ? pets[0]?.name : pets?.name) ?? '';
  // Our own earlier, interrupted upload counts as "no pet yet": finish it.
  if (existing && existing !== petId) return { status: 'cloud', petId: existing, name: existingName };
  if (!snapshot) return existing ? { status: 'cloud', petId: existing, name: existingName } : { status: 'nothing' };

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

  // Undone activities go up too, so another phone never resurrects them.
  const rows = Object.values(snapshot.activities).map((a) => toRow(petId, a));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('activities').upsert(rows.slice(i, i + 500), { onConflict: 'id' });
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
