import type { Session } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';

import { linkLocalPet } from '@/lib/migrateLocal';
import { supabase } from '@/lib/supabase';
import { usePetStore } from './usePetStore';

/** Account features show only when the app was built with Supabase settings. */
export const accountsEnabled = supabase !== null;

export interface Profile {
  id: string;
  displayName: string | null;
}

/** Where moving the local pet into the account stands. 'cloud': the account already had a pet. */
export type LinkState =
  | { status: 'idle' | 'working' | 'done' }
  | { status: 'cloud'; petId: string }
  | { status: 'error'; message: string };

interface SessionState {
  /** true once the stored session (if any) has been read */
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  link: LinkState;
  setSession: (session: Session | null) => void;
  loadProfile: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  linkAccount: () => Promise<void>;
}

/** Name from the provider when the profile row has none (Google sends it; Apple only on first sign-in). */
function metadataName(session: Session | null): string | null {
  const meta = session?.user.user_metadata ?? {};
  const name = meta.full_name ?? meta.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

export const useSession = create<SessionState>()((set, get) => ({
  ready: !accountsEnabled,
  session: null,
  profile: null,
  link: { status: 'idle' },

  setSession: (session) => {
    const changedUser = session?.user.id !== get().session?.user.id;
    set({ session, ready: true, ...(changedUser ? { profile: null, link: { status: 'idle' } } : null) });
    if (session && changedUser) {
      get().loadProfile();
      get().linkAccount();
    }
  },

  loadProfile: async () => {
    const session = get().session;
    if (!supabase || !session) return;
    const { data } = await supabase.from('profiles').select('id, display_name').eq('id', session.user.id).maybeSingle();
    if (get().session?.user.id !== session.user.id) return;
    set({ profile: { id: session.user.id, displayName: data?.display_name ?? metadataName(session) } });
  },

  updateName: async (name) => {
    const session = get().session;
    const displayName = name.trim();
    if (!supabase || !session || !displayName) return;
    set({ profile: { id: session.user.id, displayName } });
    await supabase.from('profiles').update({ display_name: displayName }).eq('id', session.user.id);
  },

  linkAccount: async () => {
    const session = get().session;
    if (!session || get().link.status === 'working') return;
    set({ link: { status: 'working' } });

    const store = usePetStore.getState();
    // Persist the id before uploading so a retry upserts the same rows.
    let petId = store.cloudPetId;
    if (!petId && store.pet) {
      petId = Crypto.randomUUID();
      store.setCloudPetId(petId);
    }
    const snapshot = store.pet
      ? { pet: store.pet, routine: store.routine, logs: store.logs, health: store.health, badges: store.badges }
      : null;

    try {
      const result = await linkLocalPet(session.user.id, petId ?? Crypto.randomUUID(), snapshot);
      if (get().session?.user.id !== session.user.id) return;
      if (result.status === 'cloud') set({ link: { status: 'cloud', petId: result.petId } });
      else set({ link: { status: 'done' } });
    } catch {
      if (get().session?.user.id !== session.user.id) return;
      set({ link: { status: 'error', message: 'Não deu para salvar na nuvem agora. Vamos tentar de novo depois.' } });
    }
  },
}));

let started = false;

/** Reads the stored session and follows sign-in, sign-out and token refresh. Call once at startup. */
export function startSessionSync() {
  if (!supabase || started) return;
  started = true;
  supabase.auth
    .getSession()
    .then(({ data }) => useSession.getState().setSession(data.session))
    .catch(() => useSession.getState().setSession(null));
  supabase.auth.onAuthStateChange((_event, session) => useSession.getState().setSession(session));
}
