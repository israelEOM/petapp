import { useMemo } from 'react';

import { accessFor, type Access, useFamily } from '@/store/useFamily';
import { usePetStore } from '@/store/usePetStore';
import { useSession } from '@/store/useSession';

/** Role-based permissions for the signed-in person on the current pet (everything when solo). */
export function useAccess(): Access {
  const userId = useSession((s) => s.session?.user.id ?? null);
  const cloudPetId = usePetStore((s) => s.cloudPetId);
  const linkedUserId = usePetStore((s) => s.linkedUserId);
  const members = useFamily((s) => s.members);
  const familyPet = useFamily((s) => s.petId);
  const matches = !!cloudPetId && familyPet === cloudPetId && linkedUserId === userId;
  return useMemo(() => accessFor(members, userId, matches), [members, userId, matches]);
}
