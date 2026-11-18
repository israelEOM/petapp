import type { IconName } from '@/components/Icon';
import type { HealthAnswer, HealthItem } from '@/store/types';
import { addDays, addMonths, dateKey, daysBetween, formatMonth, formatShort, monthOf } from './dates';

export type HealthStatusKind = 'unknown' | 'overdue' | 'soon' | 'ok';

export interface HealthStatus {
  kind: HealthStatusKind;
  /** "YYYY-MM-DD" of the next dose, null when the last dose is unknown */
  due: string | null;
  /** days from today until `due` (negative when overdue) */
  days: number | null;
  /** the last dose came from an onboarding guess, so exact day counts would be made up */
  estimated: boolean;
}

export function healthStatus(item: HealthItem, today: string = dateKey()): HealthStatus {
  const estimated = !!item.guess;
  if (!item.lastDate) return { kind: 'unknown', due: null, days: null, estimated };
  const due = addDays(item.lastDate, item.intervalDays);
  const days = daysBetween(today, due);
  return { kind: days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'ok', due, days, estimated };
}

/** Soonest due first; items without a recorded dose go last, in their original order. */
export function sortByDue(items: HealthItem[], today: string = dateKey()) {
  return items
    .map((item) => ({ item, status: healthStatus(item, today) }))
    .sort((a, b) => (a.status.days ?? Infinity) - (b.status.days ?? Infinity));
}

export const statusLabel: Record<HealthStatusKind, string> = {
  unknown: 'Registrar última dose',
  overdue: 'Atrasado',
  soon: 'Em breve',
  ok: 'Em dia',
};

/** "Atrasado há 3 dias", "Vence hoje", "Em 5 dias · 23 de nov." */
export function dueLabel(s: HealthStatus): string {
  if (s.days === null || s.due === null) return statusLabel.unknown;
  if (s.days < 0 && s.estimated) return 'Atrasado';
  if (s.days < 0) return s.days === -1 ? 'Atrasado há 1 dia' : `Atrasado há ${-s.days} dias`;
  if (s.days === 0) return 'Vence hoje';
  if (s.days === 1) return `Amanhã · ${formatDue(s.due)}`;
  if (s.days > 60) return `Em ${Math.round(s.days / 30)} meses · ${formatDue(s.due)}`;
  return `Em ${s.days} dias · ${formatDue(s.due)}`;
}

/** "18 de nov." this year, "18 de nov. de 2027" for other years. */
export function formatDue(key: string, today: string = dateKey()): string {
  return key.slice(0, 4) === today.slice(0, 4) ? formatShort(key) : `${formatShort(key)} de ${key.slice(0, 4)}`;
}

export function intervalLabel(days: number): string {
  if (days === 365) return 'Reforço anual';
  if (days % 30 === 0 && days > 30) return `A cada ${days / 30} meses`;
  return `A cada ${days} dias`;
}

export function healthIcon(id: string): IconName {
  if (id === 'deworm') return 'pill';
  if (id === 'flea') return 'drop';
  if (id === 'vet') return 'calendar';
  return 'syringe';
}

/** "Última dose: 3 de out." / "Última dose em outubro de 2026" / "Última dose: data não informada". */
export function lastDoseLabel(item: HealthItem): string {
  if (!item.lastDate) return 'Sem registro ainda';
  if (!item.guess) return `Última dose: ${formatShort(item.lastDate)}`;
  if (item.guess === 'late') return 'Última dose: data não informada';
  return `Última dose em ${formatMonth(monthOf(item.lastDate))}`;
}

/** Months the owner can pick for an item that is "Em dia": this month back to one interval ago, newest first. */
export function answerMonths(intervalDays: number, today: string = dateKey()): string[] {
  const back = Math.max(1, Math.round(intervalDays / 30));
  return Array.from({ length: back + 1 }, (_, i) => addMonths(monthOf(today), -i));
}

/** Turns an onboarding answer into an item with an estimated last dose. */
export function applyAnswer(item: HealthItem, answer: HealthAnswer | undefined, today: string = dateKey()): HealthItem {
  if (!answer || answer.kind === 'unknown') return { ...item, lastDate: null, guess: undefined };
  if (answer.kind === 'late') {
    // Due yesterday: overdue, with no claim about how late.
    return { ...item, lastDate: addDays(today, -item.intervalDays - 1), guess: 'late' };
  }
  // Mid-month for past months; today for the current one (never in the future).
  const lastDate = answer.month === monthOf(today) ? today : `${answer.month}-15`;
  return { ...item, lastDate, guess: 'month' };
}
