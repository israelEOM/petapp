import { type Member, firstName } from '@/store/useFamily';
import type { Activity, HealthItem, TaskId } from '@/store/types';
import { isLive } from './activities';
import { formatTime } from './reminders';

const pad = (n: number) => String(n).padStart(2, '0');

/** "8h10" in local time. */
export function timeOf(iso: string): string {
  const d = new Date(iso);
  return formatTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
}

/** "Você" for this phone's or this account's activities, else the member's first name. */
export function whoName(a: Activity, members: Member[], myId: string | null): string {
  if (!a.userId || a.userId === myId) return 'Você';
  const m = members.find((x) => x.userId === a.userId);
  return m ? firstName(m.name) : 'Alguém';
}

/** Today's live activities, newest first. */
export function todays(activities: Record<string, Activity>, today: string): Activity[] {
  return Object.values(activities)
    .filter((a) => isLive(a) && a.day === today)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Latest live activity of a task today, for "Ana · 8h10" on the card. */
export function lastOf(list: Activity[], task: TaskId): Activity | undefined {
  return list.find((a) => a.kind === task);
}

const VERB: Record<TaskId, string> = {
  food: 'deu comida',
  water: 'trocou a água',
  walk: 'levou para passear',
  play: 'brincou',
};

/** "Ana deu comida" / "Você registrou Vermífugo". */
export function describe(a: Activity, who: string, health: HealthItem[]): string {
  if (a.kind === 'health') {
    const item = health.find((h) => h.id === a.healthItemId);
    return `${who} registrou ${item?.name ?? 'um cuidado de saúde'}`;
  }
  return `${who} ${VERB[a.kind]}`;
}

/** How far back a meal by someone else triggers the "já deram comida" warning. */
export const DOUBLE_FEED_MS = 3 * 60 * 60 * 1000;

/**
 * The newest live meal logged by another family member in the last 3 hours, if any. Only
 * activities already synced to this phone count (offline, the warning can miss a meal).
 */
export function recentMealByOther(
  activities: Record<string, Activity>,
  myId: string | null,
  now: number = Date.now(),
): Activity | undefined {
  let best: Activity | undefined;
  for (const a of Object.values(activities)) {
    if (a.kind !== 'food' || !isLive(a) || !a.userId || a.userId === myId) continue;
    const t = Date.parse(a.createdAt);
    if (now - t > DOUBLE_FEED_MS || t > now + 60_000) continue;
    if (!best || a.createdAt > best.createdAt) best = a;
  }
  return best;
}
