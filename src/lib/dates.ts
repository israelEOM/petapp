const pad = (n: number) => String(n).padStart(2, '0');

/** Local date as "YYYY-MM-DD". */
export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parse(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const dt = parse(key);
  dt.setDate(dt.getDate() + n);
  return dateKey(dt);
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function formatShort(key: string): string {
  return parse(key).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

export function formatWeekday(key: string): string {
  return parse(key).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "YYYY-MM" of a "YYYY-MM-DD" key. */
export const monthOf = (key: string) => key.slice(0, 7);

/** Moves a "YYYY-MM" month by n months. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** "novembro de 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
