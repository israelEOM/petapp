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

export interface HealthItem {
  id: string;
  name: string;
  intervalDays: number;
  /** "YYYY-MM-DD" of the last dose, null when unknown */
  lastDate: string | null;
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
