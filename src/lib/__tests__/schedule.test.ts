import type { Activity } from '@/store/types';
import { assigneeFor, copyDayToWeek, forMembers, setCell } from '../schedule';
import { recentMealByOther } from '../whoDid';

const NOW = Date.parse('2026-11-20T15:00:00Z');
const meal = (id: string, userId: string | null, createdAt: string, deletedAt: string | null = null): Activity => ({
  id,
  kind: 'food',
  healthItemId: null,
  day: '2026-11-20',
  createdAt,
  deletedAt,
  userId,
});

describe('recentMealByOther', () => {
  it('finds the newest meal by someone else in the last 3 hours', () => {
    const acts = {
      a: meal('a', 'ana', '2026-11-20T12:30:00Z'),
      b: meal('b', 'ana', '2026-11-20T13:10:00Z'),
      c: meal('c', 'me', '2026-11-20T14:50:00Z'),
    };
    expect(recentMealByOther(acts, 'me', NOW)?.id).toBe('b');
  });

  it('ignores my meals, undone meals, old meals and other tasks', () => {
    const acts = {
      mine: meal('mine', 'me', '2026-11-20T14:00:00Z'),
      local: meal('local', null, '2026-11-20T14:00:00Z'),
      undone: meal('undone', 'ana', '2026-11-20T14:00:00Z', '2026-11-20T14:01:00Z'),
      old: meal('old', 'ana', '2026-11-20T11:59:00Z'),
      walk: { ...meal('walk', 'ana', '2026-11-20T14:00:00Z'), kind: 'walk' as const },
    };
    expect(recentMealByOther(acts, 'me', NOW)).toBeUndefined();
  });
});

describe('schedule', () => {
  it('sets, clears and reads cells', () => {
    let s = setCell([], 1, 'walk', 'pedro');
    s = setCell(s, 1, 'walk', 'ana');
    expect(s).toHaveLength(1);
    expect(assigneeFor(s, 1, 'walk')).toBe('ana');
    s = setCell(s, 1, 'walk', null);
    expect(assigneeFor(s, 1, 'walk')).toBeNull();
  });

  it('copies a day to the whole week and drops ex-members', () => {
    const s = copyDayToWeek([{ weekday: 2, task: 'food', userId: 'ana' }, { weekday: 2, task: 'play', userId: 'bia' }], 2);
    expect(s).toHaveLength(14);
    expect(assigneeFor(s, 0, 'food')).toBe('ana');
    expect(forMembers(s, new Set(['ana']))).toHaveLength(7);
  });
});
