import type { Activity, DayLog, HealthItem, TaskId } from '@/store/types';
import { activitiesFromLegacy, deriveLogs, deriveXp, legacySeeds, mergeActivities, tapChanges } from '../activities';
import { countRun, isComplete } from '../gamification';

const TODAY = '2026-11-20';
let seq = 0;

/** Applies taps the way the store does and returns the resulting activity map. */
function tap(acts: Record<string, Activity>, task: TaskId, day = TODAY, meals = 2) {
  const now = new Date(Date.UTC(2026, 10, 20, 12, 0, seq)).toISOString();
  const changes = tapChanges(acts, task, day, meals, { id: `a${++seq}`, now });
  const next = { ...acts };
  for (const a of changes) next[a.id] = a;
  return next;
}

const act = (id: string, kind: Activity['kind'], day: string, extra: Partial<Activity> = {}): Activity => ({
  id,
  kind,
  healthItemId: kind === 'health' ? 'v10' : null,
  day,
  createdAt: `${day}T12:00:00.000Z`,
  deletedAt: null,
  userId: null,
  ...extra,
});

describe('tapChanges and deriveLogs', () => {
  it('counts meals up to the goal, then a tap clears the day', () => {
    let a = tap({}, 'food');
    a = tap(a, 'food');
    expect(deriveLogs(a, 2)[TODAY].food).toBe(2);
    a = tap(a, 'food');
    expect(deriveLogs(a, 2)[TODAY]).toBeUndefined();
    // Cleared meals stay as soft-deleted rows so other phones learn about the undo.
    expect(Object.values(a).filter((x) => x.deletedAt).length).toBe(2);
  });

  it('toggles water, walk and play', () => {
    let a = tap({}, 'water');
    expect(deriveLogs(a, 2)[TODAY].water).toBe(true);
    a = tap(a, 'water');
    expect(deriveLogs(a, 2)[TODAY]).toBeUndefined();
    a = tap(a, 'water');
    expect(deriveLogs(a, 2)[TODAY].water).toBe(true);
  });

  it('toggling off removes duplicates logged by two phones', () => {
    const a = { w1: act('w1', 'water', TODAY), w2: act('w2', 'water', TODAY, { userId: 'other' }) };
    const off = tap(a, 'water');
    expect(deriveLogs(off, 2)[TODAY]).toBeUndefined();
  });

  it('marks complete days with the bonus flag', () => {
    let a: Record<string, Activity> = {};
    for (const t of ['food', 'food', 'water', 'walk', 'play'] as TaskId[]) a = tap(a, t);
    expect(deriveLogs(a, 2)[TODAY]).toEqual({ food: 2, water: true, walk: true, play: true, bonus: true });
  });

  it('ignores health doses in day logs', () => {
    expect(deriveLogs({ h: act('h', 'health', TODAY) }, 2)).toEqual({});
  });
});

describe('deriveXp', () => {
  it('gives 10 per task, 40 per complete day and 30 per health dose', () => {
    let a: Record<string, Activity> = {};
    for (const t of ['food', 'food', 'water', 'walk', 'play'] as TaskId[]) a = tap(a, t);
    expect(deriveXp(a, 2)).toBe(5 * 10 + 40);
    a.h = act('h', 'health', TODAY);
    expect(deriveXp(a, 2)).toBe(5 * 10 + 40 + 30);
  });

  it('caps meals at the daily goal when two phones both log', () => {
    const a = {
      f1: act('f1', 'food', TODAY),
      f2: act('f2', 'food', TODAY),
      f3: act('f3', 'food', TODAY, { userId: 'other' }),
    };
    expect(deriveXp(a, 2)).toBe(20);
  });

  it('takes XP back on undo', () => {
    let a = tap({}, 'walk');
    a = tap(a, 'walk');
    expect(deriveXp(a, 2)).toBe(0);
  });
});

describe('streaks from derived logs', () => {
  it('counts consecutive complete days and breaks on an undo', () => {
    let a: Record<string, Activity> = {};
    for (const day of ['2026-11-18', '2026-11-19', TODAY]) {
      for (const t of ['food', 'food', 'water', 'walk', 'play'] as TaskId[]) a = tap(a, t, day);
    }
    const complete = (l: DayLog | undefined) => isComplete(l, 2);
    expect(countRun(deriveLogs(a, 2), TODAY, complete)).toBe(3);
    a = tap(a, 'play', '2026-11-19');
    expect(countRun(deriveLogs(a, 2), TODAY, complete)).toBe(1);
  });
});

describe('mergeActivities', () => {
  it('adds remote rows and keeps pending local versions', () => {
    const local = { a: act('a', 'water', TODAY, { deletedAt: '2026-11-20T13:00:00.000Z' }) };
    const remote = [act('a', 'water', TODAY), act('b', 'walk', TODAY, { userId: 'u2' })];
    const { activities, changed } = mergeActivities(local, remote, { a: 1 });
    expect(changed).toBe(true);
    expect(activities.a.deletedAt).not.toBeNull();
    expect(activities.b.userId).toBe('u2');
  });

  it('never revives an undo from an older remote copy', () => {
    const local = { a: act('a', 'water', TODAY, { deletedAt: '2026-11-20T13:00:00.000Z' }) };
    const { activities } = mergeActivities(local, [act('a', 'water', TODAY)], {});
    expect(activities.a.deletedAt).not.toBeNull();
  });

  it('applies a remote undo', () => {
    const local = { a: act('a', 'water', TODAY) };
    const { activities, changed } = mergeActivities(local, [act('a', 'water', TODAY, { deletedAt: 'x' })], {});
    expect(changed).toBe(true);
    expect(activities.a.deletedAt).toBe('x');
  });

  it('reports no change for identical rows', () => {
    const local = { a: act('a', 'water', TODAY) };
    const { activities, changed } = mergeActivities(local, [act('a', 'water', TODAY)], {});
    expect(changed).toBe(false);
    expect(activities).toBe(local);
  });
});

describe('legacy migration (store v2 → v3)', () => {
  const logs: Record<string, DayLog> = {
    '2026-11-19': { food: 2, water: true, walk: false, play: true, bonus: false },
    [TODAY]: { food: 1, water: false, walk: false, play: false, bonus: false },
  };
  const health: HealthItem[] = [
    { id: 'v10', name: 'V10', intervalDays: 365, lastDate: '2026-06-01' },
    { id: 'flea', name: 'Antipulgas', intervalDays: 30, lastDate: '2026-11-19', guess: 'late' },
  ];

  it('makes one activity per meal, task and recorded dose, with distinct seeds', () => {
    const seeds = legacySeeds(logs, health);
    expect(seeds).toHaveLength(2 + 1 + 1 + 1 + 1); // 3 meals, water, play, v10 (the guess is skipped)
    expect(new Set(seeds.map((s) => s.seed)).size).toBe(seeds.length);
  });

  it('rebuilds the same logs and is deterministic', async () => {
    const uuid = async (seed: string) => `id:${seed}`;
    const a1 = await activitiesFromLegacy(logs, health, uuid);
    const a2 = await activitiesFromLegacy(logs, health, uuid);
    expect(Object.keys(a1)).toEqual(Object.keys(a2));
    const derived = deriveLogs(a1, 2);
    expect(derived['2026-11-19']).toEqual({ food: 2, water: true, walk: false, play: true, bonus: false });
    expect(derived[TODAY].food).toBe(1);
    expect(Object.values(a1).every((a) => a.deletedAt === null)).toBe(true);
  });
});
