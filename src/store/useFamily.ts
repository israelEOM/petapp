import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Role = 'owner' | 'caregiver' | 'sitter' | 'viewer';

export interface Member {
  userId: string;
  role: Role;
  /** sitters only: ISO end of access */
  expiresAt: string | null;
  joinedAt: string;
  name: string;
}

interface FamilyState {
  /** pet the members belong to; a list for another pet is ignored */
  petId: string | null;
  members: Member[];
  /** true when the last sync found this account is no longer a member */
  removed: boolean;
  setMembers: (petId: string, members: Member[]) => void;
  setRemoved: (removed: boolean) => void;
  clear: () => void;
}

/** Members of the shared pet (with names), refreshed on every sync. Kept on disk for offline use. */
export const useFamily = create<FamilyState>()(
  persist(
    (set) => ({
      petId: null,
      members: [],
      removed: false,
      setMembers: (petId, members) => set({ petId, members, removed: false }),
      setRemoved: (removed) => set({ removed }),
      clear: () => set({ petId: null, members: [], removed: false }),
    }),
    { name: 'petapp-family', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Tutor',
  caregiver: 'Cuidador',
  sitter: 'Pet sitter',
  viewer: 'Só acompanha',
};

export const sitterExpired = (m: Pick<Member, 'role' | 'expiresAt'>, now = Date.now()) =>
  m.role === 'sitter' && !!m.expiresAt && Date.parse(m.expiresAt) <= now;

/** What the signed-in person may do with the pet. Solo or signed out: everything. */
export interface Access {
  me: Member | null;
  canLog: boolean;
  isOwner: boolean;
  /** more than one person cares for the pet */
  shared: boolean;
}

export function accessFor(members: Member[], userId: string | null, petMatches: boolean): Access {
  const me = petMatches && userId ? (members.find((m) => m.userId === userId) ?? null) : null;
  if (!me) return { me: null, canLog: true, isOwner: true, shared: false };
  const canLog = me.role === 'owner' || me.role === 'caregiver' || (me.role === 'sitter' && !sitterExpired(me));
  return { me, canLog, isOwner: me.role === 'owner', shared: members.length > 1 };
}

/** First name for compact labels ("Ana · 8h10"). */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
