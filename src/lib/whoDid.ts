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
