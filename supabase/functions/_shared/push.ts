// Shared helpers for PetApp edge functions (Deno).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushResult {
  sent: number;
  failed: number;
  /** tokens Expo says no longer exist; removed from push_tokens */
  removed: string[];
}

/**
 * Sends through the Expo push service (100 per request) and deletes tokens that are gone.
 * Delivery to iPhones also needs an APNs key uploaded to EAS for the app.
 */
export async function sendPush(db: SupabaseClient, messages: PushMessage[]): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, removed: [] };
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100).map((m) => ({ ...m, sound: 'default' }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch),
    });
    const json = await res.json().catch(() => ({}));
    const tickets: { status: string; details?: { error?: string } }[] = json.data ?? [];
    tickets.forEach((t, j) => {
      if (t.status === 'ok') result.sent += 1;
      else {
        result.failed += 1;
        if (t.details?.error === 'DeviceNotRegistered') result.removed.push(batch[j].to);
      }
    });
    if (!res.ok && !tickets.length) result.failed += batch.length;
  }
  if (result.removed.length) await db.from('push_tokens').delete().in('token', result.removed);
  return result;
}

/** Claims a send key; false when it was already sent (overlapping runs, retries). */
export async function claim(db: SupabaseClient, key: string, userId: string): Promise<boolean> {
  const { error } = await db.from('notification_log').insert({ key, user_id: userId });
  return !error;
}

export async function tokensFor(db: SupabaseClient, userIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!userIds.length) return map;
  const { data } = await db.from('push_tokens').select('token, user_id').in('user_id', userIds);
  for (const r of (data ?? []) as { token: string; user_id: string }[]) {
    map.set(r.user_id, [...(map.get(r.user_id) ?? []), r.token]);
  }
  return map;
}

/** "do Thor" / "da Luna". */
export const of = (pet: { name: string; sex: string }) => `${pet.sex === 'female' ? 'da' : 'do'} ${pet.name}`;
/** "o Thor" / "a Luna". */
export const article = (pet: { name: string; sex: string }) => `${pet.sex === 'female' ? 'a' : 'o'} ${pet.name}`;

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'Alguém';

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Members who may log (owner, caregiver, sitter within their dates). */
export function canLog(m: { role: string; expires_at: string | null }, now = Date.now()) {
  if (m.role === 'owner' || m.role === 'caregiver') return true;
  return m.role === 'sitter' && (!m.expires_at || Date.parse(m.expires_at) > now);
}
