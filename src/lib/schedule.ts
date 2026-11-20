import type { TaskId } from '@/store/types';

/** One cell of the weekly "quem faz o quê" grid. weekday: 0 = Sunday, like Date.getDay(). */
export interface Assignment {
  weekday: number;
  task: TaskId;
  userId: string;
}

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function assigneeFor(schedule: Assignment[], weekday: number, task: TaskId): string | null {
  return schedule.find((a) => a.weekday === weekday && a.task === task)?.userId ?? null;
}

/** Replaces one cell (userId null clears it). */
export function setCell(schedule: Assignment[], weekday: number, task: TaskId, userId: string | null): Assignment[] {
  const rest = schedule.filter((a) => !(a.weekday === weekday && a.task === task));
  return userId ? [...rest, { weekday, task, userId }] : rest;
}

/** Copies one day's assignments to every day of the week. */
export function copyDayToWeek(schedule: Assignment[], weekday: number): Assignment[] {
  const day = schedule.filter((a) => a.weekday === weekday);
  return [0, 1, 2, 3, 4, 5, 6].flatMap((w) => day.map((a) => ({ ...a, weekday: w })));
}

/** Drops cells assigned to people who are no longer members. */
export const forMembers = (schedule: Assignment[], memberIds: Set<string>) => schedule.filter((a) => memberIds.has(a.userId));
