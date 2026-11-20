// Runs every 15 minutes (pg_cron). For shared pets, sends meal reminders to whoever is on duty
// (the weekly schedule, else every member who wants reminders) and the 20h "fechar o dia" nudge,
// but only when nobody in the family has logged it yet. Solo pets keep their local reminders.
import { admin, canLog, claim, json, of, sendPush, tokensFor, type PushMessage } from '../_shared/push.ts';

const STREAK_TIME = '20:00';
/** A reminder is due when its time passed less than this long ago (cron runs every 15 min). */
const WINDOW_MIN = 20;

interface Pref {
  user_id: string;
  pet_id: string;
  meal_times: string[];
  streak: boolean;
  tz: string;
}

/** Local date, minutes since midnight and weekday (0 = Sunday) in a time zone. */
function localNow(tz: string, now: Date) {
  let parts: Record<string, string>;
  try {
    parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        weekday: 'short',
      })
        .formatToParts(now)
        .map((p) => [p.type, p.value]),
    );
  } catch {
    return localNow('America/Sao_Paulo', now);
  }
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute), weekday };
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
const isDue = (time: string, minutes: number) => {
  const diff = minutes - toMinutes(time);
  return diff >= 0 && diff < WINDOW_MIN;
};

function joinPt(items: string[]) {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

Deno.serve(async (req) => {
  // No inputs: anyone may poke this endpoint, and all it can do is send what is due now (once).
  await req.body?.cancel().catch(() => {});
  const now = new Date();
  const db = admin();

  const { data: prefRows } = await db.from('reminder_prefs').select('user_id, pet_id, meal_times, streak, tz').eq('enabled', true);
  const prefs = (prefRows ?? []) as Pref[];
  if (!prefs.length) return json({ prefs: 0, messages: 0 });

  const petIds = [...new Set(prefs.map((p) => p.pet_id))];
  const [{ data: pets }, { data: members }, { data: schedule }] = await Promise.all([
    db.from('pets').select('id, name, sex, meals').in('id', petIds),
    db.from('pet_members').select('pet_id, user_id, role, expires_at').in('pet_id', petIds),
    db.from('schedule').select('pet_id, weekday, task, user_id').in('pet_id', petIds),
  ]);
  const petById = new Map(((pets ?? []) as { id: string; name: string; sex: string; meals: number }[]).map((p) => [p.id, p]));
  const membersOf = (petId: string) =>
    ((members ?? []) as { pet_id: string; user_id: string; role: string; expires_at: string | null }[]).filter((m) => m.pet_id === petId);
  const onDuty = (petId: string, weekday: number, task: string) =>
    ((schedule ?? []) as { pet_id: string; weekday: number; task: string; user_id: string }[]).find(
      (s) => s.pet_id === petId && s.weekday === weekday && s.task === task,
    )?.user_id ?? null;

  // Today's live activities per pet and local day, fetched once per pair.
  const logCache = new Map<string, { food: number; water: boolean; walk: boolean; play: boolean }>();
  async function logFor(petId: string, day: string) {
    const key = `${petId}:${day}`;
    if (!logCache.has(key)) {
      const { data } = await db.from('activities').select('kind').eq('pet_id', petId).eq('day', day).is('deleted_at', null);
      const kinds = ((data ?? []) as { kind: string }[]).map((r) => r.kind);
      logCache.set(key, {
        food: kinds.filter((k) => k === 'food').length,
        water: kinds.includes('water'),
        walk: kinds.includes('walk'),
        play: kinds.includes('play'),
      });
    }
    return logCache.get(key)!;
  }

  const planned: { key: string; userId: string; title: string; body: string }[] = [];
  for (const p of prefs) {
    const pet = petById.get(p.pet_id);
    const family = membersOf(p.pet_id);
    const me = family.find((m) => m.user_id === p.user_id);
    // Solo pets use the phone's local reminders; viewers and expired sitters get none.
    if (!pet || family.length < 2 || !me || !canLog(me, now.getTime())) continue;

    const local = localNow(p.tz, now);
    const meals = Math.min(pet.meals, p.meal_times.length);

    for (let i = 0; i < meals; i++) {
      if (!isDue(p.meal_times[i], local.minutes)) continue;
      const duty = onDuty(p.pet_id, local.weekday, 'food');
      if (duty && duty !== p.user_id) continue;
      const log = await logFor(p.pet_id, local.day);
      if (log.food > i) continue;
      planned.push({
        key: `meal:${p.pet_id}:${p.user_id}:${local.day}:${i}`,
        userId: p.user_id,
        title: 'Hora da comida!',
        body: pet.meals === 1 ? `A refeição ${of(pet)} é agora. Ninguém registrou ainda.` : `${i + 1}ª refeição ${of(pet)}. Ninguém registrou ainda.`,
      });
    }

    if (p.streak && isDue(STREAK_TIME, local.minutes)) {
      const log = await logFor(p.pet_id, local.day);
      const missing: string[] = [];
      if (log.food < pet.meals) missing.push(pet.meals - log.food > 1 ? `${pet.meals - log.food} refeições` : 'comida');
      if (!log.water) missing.push('água');
      if (!log.walk) missing.push('passeio');
      if (!log.play) missing.push('brincar');
      if (missing.length) {
        planned.push({
          key: `streak:${p.pet_id}:${p.user_id}:${local.day}`,
          userId: p.user_id,
          title: 'Ainda dá tempo de fechar o dia',
          body: `${missing.length > 1 || pet.meals - log.food > 1 ? 'Faltam' : 'Falta'} ${joinPt(missing)} para completar o dia ${of(pet)}.`,
        });
      }
    }
  }

  const tokens = await tokensFor(db, [...new Set(planned.map((x) => x.userId))]);
  const messages: PushMessage[] = [];
  for (const x of planned) {
    const list = tokens.get(x.userId) ?? [];
    if (!list.length || !(await claim(db, x.key, x.userId))) continue;
    for (const to of list) messages.push({ to, title: x.title, body: x.body, data: { url: '/' } });
  }
  const result = await sendPush(db, messages);
  return json({ prefs: prefs.length, planned: planned.length, sent: result.sent, failed: result.failed, removed: result.removed.length });
});
