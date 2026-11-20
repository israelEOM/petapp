// Called by the activities insert trigger with { id }. Tells the other family members what
// happened ("Ana deu a 1ª refeição do Thor"). Reads everything from the database itself, so the
// request body is only a hint; each (activity, person) pair is sent at most once.
import { admin, article, claim, firstName, json, of, sendPush, tokensFor, type PushMessage } from '../_shared/push.ts';

/** Older activities are history being uploaded (first sign-in), not news. */
const MAX_AGE_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== 'string') return json({ error: 'id required' }, 400);
  const db = admin();

  const { data: act } = await db
    .from('activities')
    .select('id, pet_id, user_id, kind, health_item_id, day, created_at, deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (!act || act.deleted_at) return json({ skipped: 'missing or undone' });
  if (Date.now() - Date.parse(act.created_at) > MAX_AGE_MS) return json({ skipped: 'old' });

  const [{ data: pet }, { data: members }, { data: actor }] = await Promise.all([
    db.from('pets').select('name, sex, meals').eq('id', act.pet_id).single(),
    db.from('pet_members').select('user_id').eq('pet_id', act.pet_id),
    db.from('profiles').select('display_name').eq('id', act.user_id).maybeSingle(),
  ]);
  if (!pet || !members) return json({ skipped: 'no pet' });

  const others = (members as { user_id: string }[]).map((m) => m.user_id).filter((u) => u !== act.user_id);
  if (!others.length) return json({ skipped: 'solo' });

  const { data: prefs } = await db.from('profiles').select('id, notify_family').in('id', others);
  const muted = new Set(((prefs ?? []) as { id: string; notify_family: boolean }[]).filter((p) => !p.notify_family).map((p) => p.id));
  const recipients = others.filter((u) => !muted.has(u));

  const who = firstName(actor?.display_name ?? '');
  let body: string;
  switch (act.kind) {
    case 'food': {
      const { count } = await db
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('pet_id', act.pet_id)
        .eq('kind', 'food')
        .eq('day', act.day)
        .is('deleted_at', null)
        .lte('created_at', act.created_at);
      const n = count ?? 1;
      body = pet.meals > 1 && n <= pet.meals ? `${who} deu a ${n}ª refeição ${of(pet)}.` : `${who} deu comida para ${article(pet)}.`;
      break;
    }
    case 'water':
      body = `${who} trocou a água ${of(pet)}.`;
      break;
    case 'walk':
      body = `${who} levou ${article(pet)} para passear.`;
      break;
    case 'play':
      body = `${who} brincou com ${article(pet)}.`;
      break;
    default: {
      const { data: item } = await db
        .from('health_items')
        .select('name')
        .eq('pet_id', act.pet_id)
        .eq('item_id', act.health_item_id)
        .maybeSingle();
      body = `${who} registrou ${item?.name ?? 'um cuidado de saúde'} ${of(pet)}.`;
    }
  }

  const tokens = await tokensFor(db, recipients);
  const messages: PushMessage[] = [];
  for (const userId of recipients) {
    const list = tokens.get(userId) ?? [];
    if (!list.length) continue;
    if (!(await claim(db, `activity:${act.id}:${userId}`, userId))) continue;
    for (const to of list) messages.push({ to, title: pet.name, body, data: { url: '/' } });
  }

  const result = await sendPush(db, messages);
  return json({ recipients: recipients.length, sent: result.sent, failed: result.failed, removed: result.removed.length });
});
