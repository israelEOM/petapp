import type { DayLog, HealthItem, Pet, Reminders } from '@/store/types';
import { addDays, dateKey } from './dates';
import { emptyLog, isComplete } from './gamification';
import { formatDue, healthStatus } from './health';
import { de } from './pet';

/** Pure planning for local reminders: what to fire and when. Scheduling lives in notifications.ts. */

export const STREAK_TIME = '20:00';
export const HEALTH_TIME = '09:00';
/** How many days of meal and streak reminders to keep queued; refreshed every time the app opens. */
const WINDOW_DAYS = 7;
/** iOS keeps at most 64 pending local notifications per app. */
const MAX_PENDING = 60;
const HEALTH_HEADS_UP_DAYS = 3;

const EARLIEST = 5 * 60;
const LATEST = 23 * 60;
const STEP = 30;

const DEFAULT_MEAL_TIMES: Record<number, string[]> = {
  1: ['08:00'],
  2: ['08:00', '18:00'],
  3: ['07:30', '12:30', '18:30'],
  4: ['07:00', '11:00', '15:00', '19:00'],
};

export const defaultReminders = (meals: number): Reminders => ({
  enabled: false,
  mealTimes: defaultMealTimes(meals),
  streak: true,
  health: true,
});

export function defaultMealTimes(meals: number): string[] {
  return DEFAULT_MEAL_TIMES[meals] ?? DEFAULT_MEAL_TIMES[2];
}

/** Keeps existing times when the meal count changes, filling new slots with defaults. */
export function fitMealTimes(times: string[], meals: number): string[] {
  if (times.length === meals) return times;
  const defaults = defaultMealTimes(meals);
  return defaults.map((d, i) => times[i] ?? d);
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const fromMinutes = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

/** Moves a "HH:MM" time by ±30 min steps, kept between 05:00 and 23:00. */
export function shiftTime(t: string, steps: number): string {
  const n = Math.min(LATEST, Math.max(EARLIEST, toMinutes(t) + steps * STEP));
  return fromMinutes(n);
}

export const canShift = (t: string, steps: number) => shiftTime(t, steps) !== t;

/** "08:00" → "8h", "18:30" → "18h30" (how times are usually written in Brazil). */
export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

function at(key: string, time: string): Date {
  const [y, mo, d] = key.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

export interface PlannedReminder {
  id: string;
  date: Date;
  title: string;
  body: string;
  /** route to open when tapped */
  url: '/' | '/health';
}

export interface PlanInput {
  pet: Pet;
  meals: number;
  logs: Record<string, DayLog>;
  health: HealthItem[];
  reminders: Reminders;
}

const TASK_NAMES = { water: 'água', walk: 'passeio', play: 'brincar' } as const;

function missingTasks(log: DayLog, meals: number): string[] {
  const missing: string[] = [];
  if (log.food < meals) missing.push(meals - log.food === 1 ? '1 refeição' : `${meals - log.food} refeições`);
  for (const k of ['water', 'walk', 'play'] as const) if (!log[k]) missing.push(TASK_NAMES[k]);
  return missing;
}

function joinPt(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

export function planReminders({ pet, meals, logs, health, reminders }: PlanInput, now: Date = new Date()): PlannedReminder[] {
  if (!reminders.enabled) return [];
  const today = dateKey(now);
  const name = pet.name;
  const of = `${de(pet)} ${name}`;
  const out: PlannedReminder[] = [];

  for (let d = 0; d < WINDOW_DAYS; d++) {
    const day = addDays(today, d);
    const log = { ...emptyLog(), ...logs[day] };

    reminders.mealTimes.slice(0, meals).forEach((time, i) => {
      // Already served today: no nagging.
      if (log.food > i) return;
      out.push({
        id: `meal-${day}-${i}`,
        date: at(day, time),
        title: 'Hora da comida!',
        body:
          meals === 1
            ? `A refeição ${of} é agora. Marque no app quando servir.`
            : `${i + 1}ª refeição ${of}. Marque no app quando servir.`,
        url: '/',
      });
    });

    if (reminders.streak && !isComplete(log, meals)) {
      const missing = d === 0 ? missingTasks(log, meals) : [];
      out.push({
        id: `streak-${day}`,
        date: at(day, STREAK_TIME),
        title: 'Ainda dá tempo de fechar o dia',
        body: missing.length
          ? `${missing.length > 1 || meals - log.food > 1 ? 'Faltam' : 'Falta'} ${joinPt(missing)} para completar o dia ${of}.`
          : `Já registrou o dia ${of}? Complete as 4 tarefas para manter a sequência.`,
        url: '/',
      });
    }
  }

  if (reminders.health) {
    for (const item of health) {
      const s = healthStatus(item, today);
      if (!s.due || s.days === null) continue;
      if (s.days < 0) {
        // Overdue: nudge tomorrow morning and again a few days later.
        for (const offset of [1, 4]) {
          out.push({
            id: `health-${item.id}-late-${offset}`,
            date: at(addDays(today, offset), HEALTH_TIME),
            title: `Atrasado: ${item.name}`,
            body: `Venceu em ${formatDue(s.due, today)}. Quando cuidar disso, marque na aba Saúde.`,
            url: '/health',
          });
        }
        continue;
      }
      const headsUp = addDays(s.due, -HEALTH_HEADS_UP_DAYS);
      out.push({
        id: `health-${item.id}-soon`,
        date: at(headsUp, HEALTH_TIME),
        title: `${item.name} em ${HEALTH_HEADS_UP_DAYS} dias`,
        body: `Vence em ${formatDue(s.due, today)}. Bom momento para marcar com o veterinário.`,
        url: '/health',
      });
      out.push({
        id: `health-${item.id}-due`,
        date: at(s.due, HEALTH_TIME),
        title: `${item.name}: vence hoje`,
        body: `Depois de cuidar ${of}, toque em "Feito hoje" na aba Saúde.`,
        url: '/health',
      });
    }
  }

  return out
    .filter((r) => r.date.getTime() > now.getTime() + 30_000)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MAX_PENDING);
}
