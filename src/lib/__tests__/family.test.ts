import { type Member, accessFor, sitterExpired } from '@/store/useFamily';
import type { Activity } from '@/store/types';
import { codeFromText, isValidCode, normalizeCode } from '../inviteCode';
import { describe as describeActivity, lastOf, todays, whoName } from '../whoDid';

const member = (userId: string, role: Member['role'], extra: Partial<Member> = {}): Member => ({
  userId,
  role,
  expiresAt: null,
  joinedAt: '2026-11-01T00:00:00Z',
  name: `Pessoa ${userId}`,
  ...extra,
});

describe('invite codes', () => {
  it('normalizes typed codes', () => {
    expect(normalizeCode(' ab-c23 4x ')).toBe('ABC234');
    expect(isValidCode('ABC234')).toBe(true);
    expect(isValidCode('ABC10O')).toBe(false); // look-alikes are never generated
  });

  it('reads codes from links and shared messages', () => {
    expect(codeFromText('petapp://convite/HJK234')).toBe('HJK234');
    expect(codeFromText('Use o código HJK234. Ou toque no link: petapp://convite/HJK234')).toBe('HJK234');
    expect(codeFromText('hjk234')).toBe('HJK234');
    expect(codeFromText('nada aqui')).toBeNull();
  });
});

describe('accessFor', () => {
  const members = [member('a', 'owner'), member('b', 'caregiver'), member('c', 'viewer')];

  it('allows everything when solo or not linked', () => {
    expect(accessFor([], null, false)).toMatchObject({ canLog: true, isOwner: true, shared: false });
    expect(accessFor(members, 'a', false).me).toBeNull();
  });

  it('applies roles', () => {
    expect(accessFor(members, 'a', true)).toMatchObject({ canLog: true, isOwner: true, shared: true });
    expect(accessFor(members, 'b', true)).toMatchObject({ canLog: true, isOwner: false });
    expect(accessFor(members, 'c', true)).toMatchObject({ canLog: false, isOwner: false });
  });

  it('ends a sitter at their date', () => {
    const now = Date.parse('2026-11-20T12:00:00Z');
    const active = member('s', 'sitter', { expiresAt: '2026-11-21T00:00:00Z' });
    const ended = member('s', 'sitter', { expiresAt: '2026-11-19T00:00:00Z' });
    expect(sitterExpired(active, now)).toBe(false);
    expect(sitterExpired(ended, now)).toBe(true);
    expect(accessFor([member('a', 'owner'), ended], 's', true).canLog).toBe(false);
  });
});

describe('who did it', () => {
  const a = (id: string, kind: Activity['kind'], userId: string | null, createdAt: string, deletedAt: string | null = null): Activity => ({
    id,
    kind,
    healthItemId: kind === 'health' ? 'v10' : null,
    day: '2026-11-20',
    createdAt,
    deletedAt,
    userId,
  });
  const acts = {
    x: a('x', 'food', 'b', '2026-11-20T11:10:00Z'),
    y: a('y', 'food', null, '2026-11-20T12:00:00Z'),
    z: a('z', 'walk', 'b', '2026-11-20T13:00:00Z', '2026-11-20T13:05:00Z'),
  };
  const members = [member('a', 'owner'), member('b', 'caregiver', { name: 'Ana Souza' })];

  it('lists today newest first, without undone ones', () => {
    expect(todays(acts, '2026-11-20').map((x) => x.id)).toEqual(['y', 'x']);
    expect(lastOf(todays(acts, '2026-11-20'), 'walk')).toBeUndefined();
  });

  it('names people', () => {
    expect(whoName(acts.x, members, 'a')).toBe('Ana');
    expect(whoName(acts.y, members, 'a')).toBe('Você');
    expect(describeActivity(acts.x, 'Ana', [])).toBe('Ana deu comida');
    expect(describeActivity(a('h', 'health', 'a', 'x'), 'Você', [{ id: 'v10', name: 'V10', intervalDays: 365, lastDate: null }])).toBe(
      'Você registrou V10',
    );
  });
});
