import type { RealtimeChannel } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { type Member, type Role, useFamily } from '@/store/useFamily';
import type { CloudPet } from '@/store/usePetStore';
import { usePetStore } from '@/store/usePetStore';
import type { HealthItem, Pet, TaskId } from '@/store/types';
import { type ActivityRow, fromRow, toRow } from './activities';
import type { Assignment } from './schedule';
import { supabase } from './supabase';

/**
 * Keeps the local pet and the server in step while signed in:
 * - push: activities in the outbox (new taps and undos) and badges;
 * - pull: activities changed since the last pull, plus health items and badges;
 * - Realtime: any change by another member schedules a pull.
 * Runs after sign-in, after each local change (debounced), when the app returns to the
 * foreground, and retries with backoff when offline.
 */

const PAGE = 500;
/** Pull a little before the cursor: rows committed late with an earlier timestamp aren't missed. */
const OVERLAP_MS = 10_000;
const MAX_BACKOFF_MS = 60_000;

interface Target {
  userId: string;
  petId: string;
}

let target: Target | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let again = false;
let backoff = 0;
let channel: RealtimeChannel | null = null;
let channelPet: string | null = null;

interface HealthRow {
  item_id: string;
  name: string;
  interval_days: number;
  last_date: string | null;
  guess: 'month' | 'late' | null;
}

const healthFromRow = (r: HealthRow): HealthItem => ({
  id: r.item_id,
  name: r.name,
  intervalDays: r.interval_days,
  lastDate: r.last_date,
  ...(r.guess ? { guess: r.guess } : null),
});

async function push(petId: string) {
  if (!supabase) return;
  const { outbox, activities, badges } = usePetStore.getState();
  const sent = { ...outbox };
  const rows = Object.keys(sent)
    .map((id) => activities[id])
    .filter(Boolean)
    .map((a) => toRow(petId, a));
  for (let i = 0; i < rows.length; i += PAGE) {
    const { error } = await supabase.from('activities').upsert(rows.slice(i, i + PAGE), { onConflict: 'id' });
    // No permission (viewer, sitter whose time ended): retrying would never succeed, so drop them.
    if (error && error.code !== '42501') throw error;
  }
  if (Object.keys(sent).length) usePetStore.getState().markPushed(sent);

  if (badges.length) {
    const { error } = await supabase
      .from('badges')
      .upsert(badges.map((badge_id) => ({ pet_id: petId, badge_id })), { onConflict: 'pet_id,badge_id', ignoreDuplicates: true });
    if (error) throw error;
  }
}

/** Activities changed after `since` (all when null), oldest first, page by page. */
async function fetchActivities(petId: string, since: string | null, onPage: (rows: ActivityRow[]) => void) {
  if (!supabase) return;
  let after = since ? new Date(Date.parse(since) - OVERLAP_MS).toISOString() : null;
  for (;;) {
    let q = supabase.from('activities').select('*').eq('pet_id', petId).order('updated_at').limit(PAGE);
    if (after) q = q.gt('updated_at', after);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as ActivityRow[];
    if (rows.length) onPage(rows);
    if (rows.length < PAGE) return;
    after = rows[rows.length - 1].updated_at ?? after;
  }
}

async function fetchHealthAndBadges(petId: string) {
  if (!supabase) return { health: [] as HealthItem[], badges: [] as string[] };
  const [h, b] = await Promise.all([
    supabase.from('health_items').select('item_id, name, interval_days, last_date, guess').eq('pet_id', petId),
    supabase.from('badges').select('badge_id').eq('pet_id', petId),
  ]);
  if (h.error) throw h.error;
  if (b.error) throw b.error;
  return {
    health: ((h.data ?? []) as HealthRow[]).map(healthFromRow),
    badges: ((b.data ?? []) as { badge_id: string }[]).map((r) => r.badge_id),
  };
}

/** Members with their names. Returns false when this account is no longer one of them. */
async function refreshMembers(petId: string, userId: string): Promise<boolean> {
  if (!supabase) return true;
  const { data, error } = await supabase.from('pet_members').select('user_id, role, expires_at, joined_at').eq('pet_id', petId);
  if (error) throw error;
  const rows = (data ?? []) as { user_id: string; role: Role; expires_at: string | null; joined_at: string }[];
  if (!rows.some((r) => r.user_id === userId)) return false;
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', rows.map((r) => r.user_id));
  if (pErr) throw pErr;
  const names = new Map(((profiles ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]));
  const members: Member[] = rows
    .map((r) => ({
      userId: r.user_id,
      role: r.role,
      expiresAt: r.expires_at,
      joinedAt: r.joined_at,
      name: names.get(r.user_id)?.trim() || 'Alguém da família',
    }))
    .sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.joinedAt.localeCompare(b.joinedAt)));
  const { data: sched, error: sErr } = await supabase.from('schedule').select('weekday, task, user_id').eq('pet_id', petId);
  if (sErr) throw sErr;
  const schedule: Assignment[] = ((sched ?? []) as { weekday: number; task: TaskId; user_id: string }[]).map((r) => ({
    weekday: r.weekday,
    task: r.task,
    userId: r.user_id,
  }));
  useFamily.getState().setMembers(petId, members, schedule);
  return true;
}

async function pull(petId: string) {
  await fetchActivities(petId, usePetStore.getState().syncCursor, (rows) =>
    usePetStore.getState().applyRemote({ activities: rows.map(fromRow), cursor: rows[rows.length - 1].updated_at }),
  );
  usePetStore.getState().applyRemote(await fetchHealthAndBadges(petId));
}

async function run() {
  if (running) {
    again = true;
    return;
  }
  const t = target;
  if (!t) return;
  running = true;
  try {
    if (!(await refreshMembers(t.petId, t.userId))) {
      // Removed from the family: stop; the UI offers to clear the pet from this phone.
      useFamily.getState().setRemoved(true);
      setSyncTarget(null);
      return;
    }
    await push(t.petId);
    await pull(t.petId);
    backoff = 0;
  } catch {
    backoff = Math.min(MAX_BACKOFF_MS, backoff ? backoff * 2 : 2_000);
    schedule(backoff);
  } finally {
    running = false;
    if (again) {
      again = false;
      schedule(0);
    }
  }
}

function schedule(delay: number) {
  if (!target) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    run();
  }, delay);
}

function subscribe(petId: string) {
  if (!supabase || channelPet === petId) return;
  unsubscribe();
  channelPet = petId;
  const filter = `pet_id=eq.${petId}`;
  const onChange = () => schedule(300);
  // Drop channels left over for this pet (hot reload, a quick re-subscribe) before adding a fresh one:
  // a reused channel name rejects new callbacks once subscribed.
  const prefix = `realtime:pet:${petId}`;
  for (const c of supabase.getChannels()) if (c.topic.startsWith(prefix)) supabase.removeChannel(c);
  channel = supabase
    .channel(`pet:${petId}:${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activities', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'health_items', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'badges', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pet_members', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule', filter }, onChange)
    .subscribe();
}

function unsubscribe() {
  if (channel && supabase) supabase.removeChannel(channel);
  channel = null;
  channelPet = null;
}

/**
 * Points sync at a signed-in account and its linked pet, or stops it (null). Called by the session
 * store whenever the session or the link changes.
 */
export function setSyncTarget(next: Target | null) {
  const same = next && target && next.userId === target.userId && next.petId === target.petId;
  if (same) return;
  target = next;
  if (!next) {
    if (timer) clearTimeout(timer);
    timer = null;
    unsubscribe();
    return;
  }
  subscribe(next.petId);
  schedule(0);
}

let started = false;

/** Wires local changes and app foregrounding to the sync loop. Call once at startup. */
export function startSyncTriggers() {
  if (started || !supabase) return;
  started = true;
  usePetStore.subscribe((s, prev) => {
    if (s.outbox !== prev.outbox && Object.keys(s.outbox).length) schedule(500);
  });
  AppState.addEventListener('change', (state) => {
    if (state === 'active') schedule(0);
  });
}

/** Downloads a pet already in the account, to replace the local one ("Usar os dados da nuvem"). */
export async function downloadPet(userId: string, petId: string): Promise<CloudPet> {
  if (!supabase) throw new Error('accounts disabled');
  const { data, error } = await supabase
    .from('pets')
    .select('name, species, breed, birth, weight_kg, sex, meals, walk_minutes')
    .eq('id', petId)
    .single();
  if (error) throw error;
  const pet: Pet = {
    name: data.name,
    species: data.species,
    breed: data.breed,
    birth: data.birth,
    weightKg: data.weight_kg,
    sex: data.sex,
  };
  const all: ActivityRow[] = [];
  await fetchActivities(petId, null, (rows) => all.push(...rows));
  const { health, badges } = await fetchHealthAndBadges(petId);
  return {
    petId,
    userId,
    pet,
    routine: { meals: data.meals, walkMinutes: data.walk_minutes },
    health,
    activities: all.map(fromRow),
    badges,
    cursor: all.length ? (all[all.length - 1].updated_at ?? null) : null,
  };
}

/** Runs a sync soon (e.g. after changing members), if one is active. */
export function syncNow() {
  schedule(0);
}
