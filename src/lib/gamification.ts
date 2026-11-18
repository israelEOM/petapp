import type { IconName } from '@/components/Icon';
import type { DayLog, HealthItem } from '@/store/types';
import { addDays } from './dates';

export const XP = { task: 10, dayBonus: 40, health: 30 };
export const XP_PER_LEVEL = 250;

const LEVEL_NAMES = [
  'Recém-chegados',
  'Conhecidos',
  'Parceiros',
  'Amigos',
  'Bons amigos',
  'Grandes amigos',
  'Melhores amigos',
  'Inseparáveis',
  'Almas gêmeas',
];

export function levelInfo(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  return {
    level,
    name: LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)],
    into: xp % XP_PER_LEVEL,
    needed: XP_PER_LEVEL,
  };
}

export const emptyLog = (): DayLog => ({ food: 0, water: false, walk: false, play: false, bonus: false });

export function completedTasks(log: DayLog | undefined, meals: number): number {
  if (!log) return 0;
  return (log.food >= meals ? 1 : 0) + (log.water ? 1 : 0) + (log.walk ? 1 : 0) + (log.play ? 1 : 0);
}

export function isComplete(log: DayLog | undefined, meals: number): boolean {
  return completedTasks(log, meals) === 4;
}

/** Consecutive days passing `test`, counting today if it passes, otherwise ending yesterday. */
export function countRun(
  logs: Record<string, DayLog>,
  today: string,
  test: (log: DayLog | undefined) => boolean,
): number {
  let key = test(logs[today]) ? today : addDays(today, -1);
  let n = 0;
  while (test(logs[key])) {
    n += 1;
    key = addDays(key, -1);
  }
  return n;
}

export interface BadgeContext {
  streak: number;
  playStreak: number;
  totalWalks: number;
  completeDays: number;
  healthCount: number;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  check: (c: BadgeContext) => boolean;
}

export const BADGES: Badge[] = [
  { id: 'first_day', title: 'Primeiro dia perfeito', description: 'Completou as 4 tarefas num dia', icon: 'star', check: (c) => c.completeDays >= 1 },
  { id: 'streak_3', title: '3 dias seguidos', description: 'Três dias perfeitos em sequência', icon: 'flame', check: (c) => c.streak >= 3 },
  { id: 'play_7', title: '7 dias brincando', description: 'Brincou 7 dias seguidos', icon: 'ball', check: (c) => c.playStreak >= 7 },
  { id: 'streak_7', title: '7 dias seguidos', description: 'Uma semana inteira perfeita', icon: 'flame', check: (c) => c.streak >= 7 },
  { id: 'walks_10', title: '10 passeios', description: 'Registrou 10 passeios', icon: 'paw', check: (c) => c.totalWalks >= 10 },
  { id: 'health_first', title: 'Saúde em dia', description: 'Registrou o primeiro cuidado de saúde', icon: 'shield', check: (c) => c.healthCount >= 1 },
  { id: 'walks_50', title: '50 passeios', description: 'Registrou 50 passeios', icon: 'paw', check: (c) => c.totalWalks >= 50 },
  { id: 'streak_30', title: '30 dias seguidos', description: 'Um mês inteiro perfeito', icon: 'trophy', check: (c) => c.streak >= 30 },
];

export function badgeContext(
  logs: Record<string, DayLog>,
  health: HealthItem[],
  meals: number,
  today: string,
): BadgeContext {
  const all = Object.values(logs);
  return {
    streak: countRun(logs, today, (l) => isComplete(l, meals)),
    playStreak: countRun(logs, today, (l) => !!l?.play),
    totalWalks: all.filter((l) => l.walk).length,
    completeDays: all.filter((l) => isComplete(l, meals)).length,
    healthCount: health.filter((h) => h.lastDate && !h.guess).length,
  };
}

/** Longest run of consecutive complete days ever logged. */
export function bestStreak(logs: Record<string, DayLog>, meals: number): number {
  const days = Object.keys(logs)
    .filter((k) => isComplete(logs[k], meals))
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of days) {
    run = prev !== null && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}
