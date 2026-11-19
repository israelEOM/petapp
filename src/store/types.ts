export type Species = 'dog' | 'cat' | 'other';
export type Sex = 'male' | 'female';
export type TaskId = 'food' | 'water' | 'walk' | 'play';

export interface Pet {
  name: string;
  species: Species;
  breed: string;
  /** "mm/aaaa", optional */
  birth: string;
  weightKg: string;
  sex: Sex;
}

export interface Routine {
  meals: number;
  walkMinutes: number;
}

export interface DayLog {
  /** meals given today */
  food: number;
  water: boolean;
  walk: boolean;
  play: boolean;
  /** whether the full-day XP bonus was granted */
  bonus: boolean;
}

/** One logged meal, task or health dose. Never edited; undo sets `deletedAt`. */
export interface Activity {
  /** generated on the phone, so retries and merges are idempotent */
  id: string;
  kind: TaskId | 'health';
  /** set only for kind 'health' */
  healthItemId: string | null;
  /** logger's local day "YYYY-MM-DD" */
  day: string;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp of the undo, null while it counts */
  deletedAt: string | null;
  /** who logged it (from the server); null for activities made on this phone before syncing */
  userId: string | null;
}

export interface HealthItem {
  id: string;
  name: string;
  intervalDays: number;
  /** "YYYY-MM-DD" of the last dose, null when unknown */
  lastDate: string | null;
  /**
   * lastDate is a guess from onboarding, not a recorded dose: 'month' when the owner picked the
   * month of the last dose, 'late' when they only said it's overdue. Cleared by "Feito hoje".
   */
  guess?: 'month' | 'late';
}

/** Onboarding answer for one health item. */
export interface HealthAnswer {
  kind: 'ok' | 'late' | 'unknown';
  /** "YYYY-MM" of the last dose when kind is 'ok' */
  month: string;
}

export interface Reminders {
  /** user opted in (permission may still be denied at the OS level) */
  enabled: boolean;
  /** one "HH:MM" per meal, same length as routine.meals */
  mealTimes: string[];
  /** evening nudge when the day isn't complete yet */
  streak: boolean;
  /** heads-up before and on health due dates */
  health: boolean;
}
