import type { IconName } from '@/components/Icon';
import type { HealthItem } from '@/store/types';
import { addDays, dateKey, daysBetween, formatShort } from './dates';

export type HealthStatusKind = 'unknown' | 'overdue' | 'soon' | 'ok';

export interface HealthStatus {
  kind: HealthStatusKind;
  /** "YYYY-MM-DD" of the next dose, null when the last dose is unknown */
  due: string | null;
  /** days from today until `due` (negative when overdue) */
  days: number | null;
}

export function healthStatus(item: HealthItem, today: string = dateKey()): HealthStatus {
  if (!item.lastDate) return { kind: 'unknown', due: null, days: null };
  const due = addDays(item.lastDate, item.intervalDays);
  const days = daysBetween(today, due);
  return { kind: days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'ok', due, days };
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
