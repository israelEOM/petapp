import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { useFamily } from '@/store/useFamily';
import { usePetStore } from '@/store/usePetStore';
import { useSession } from '@/store/useSession';
import { getPermission, notificationsSupported } from './notifications';
import { supabase } from './supabase';

/**
 * Keeps the server ready to notify this person for a shared pet:
 * - registers the phone's Expo push token (only once notification permission is granted; we
 *   never prompt from here);
 * - uploads their reminder settings (meal times, "fechar o dia", time zone) to reminder_prefs,
 *   which the due-reminders function uses once the pet has more than one member.
 * Push delivery to iPhones also needs the Apple Developer push key on EAS; until then the token
 * request fails quietly and nothing else changes.
 */

let lastToken: string | null = null;
let lastPrefs = '';
let started = false;

function linkedPet(): { userId: string; petId: string } | null {
  const userId = useSession.getState().session?.user.id;
  const { cloudPetId, linkedUserId } = usePetStore.getState();
  return userId && cloudPetId && linkedUserId === userId ? { userId, petId: cloudPetId } : null;
}

async function registerToken() {
  if (!supabase || !notificationsSupported || Platform.OS === 'web' || !linkedPet()) return;
  if ((await getPermission()) !== 'granted') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (!token || token === lastToken) return;
    const { error } = await supabase
      .from('push_tokens')
      .upsert({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' }, { onConflict: 'token' });
    if (!error) lastToken = token;
  } catch {
    // No push entitlement yet (no Apple Developer team) or offline: try again next time.
  }
}

async function uploadPrefs() {
  const target = linkedPet();
  if (!supabase || !target) return;
  const { reminders, routine } = usePetStore.getState();
  const row = {
    pet_id: target.petId,
    enabled: reminders.enabled,
    meal_times: reminders.mealTimes.slice(0, routine.meals),
    streak: reminders.streak,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
  };
  const key = JSON.stringify(row);
  if (key === lastPrefs) return;
  const { error } = await supabase.from('reminder_prefs').upsert(row, { onConflict: 'user_id,pet_id' });
  if (!error) lastPrefs = key;
}

export function syncPush() {
  registerToken();
  uploadPrefs();
}

/** Removes this phone's token before signing out, so the next account doesn't get our pushes. */
export async function forgetPushToken() {
  if (!supabase || !lastToken) return;
  await supabase.from('push_tokens').delete().eq('token', lastToken);
  lastToken = null;
  lastPrefs = '';
}

/** Call once at startup (after the session store exists). */
export function startPushSync() {
  if (started || !supabase) return;
  started = true;
  usePetStore.subscribe((s, prev) => {
    if (s.reminders !== prev.reminders || s.routine !== prev.routine || s.linkedUserId !== prev.linkedUserId) syncPush();
  });
  useFamily.subscribe((s, prev) => {
    if (s.members.length !== prev.members.length) syncPush();
  });
  useSession.subscribe((s, prev) => {
    if (s.session?.user.id !== prev.session?.user.id) {
      lastToken = null;
      lastPrefs = '';
    }
    if (s.link.status === 'done' && prev.link.status !== 'done') syncPush();
  });
}
