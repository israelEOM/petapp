import type { Session } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';

import { linkLocalPet } from '@/lib/migrateLocal';
import { supabase } from '@/lib/supabase';
import { FamilyError, redeemInvite, removeMember } from '@/lib/family';
import { downloadPet, setSyncTarget, startSyncTriggers } from '@/lib/sync';
import { useFamily } from './useFamily';
import { usePetStore } from './usePetStore';

/** Account features show only when the app was built with Supabase settings. */
export const accountsEnabled = supabase !== null;

export interface Profile {
  id: string;
  displayName: string | null;
  /** push when someone else in the family logs something */
  notifyFamily: boolean;
}

/** Where moving the local pet into the account stands. 'cloud': the account already had a pet. */
export type LinkState =
  | { status: 'idle' | 'working' | 'done' }
  | { status: 'cloud'; petId: string; name: string }
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
  setNotifyFamily: (on: boolean) => Promise<void>;
  linkAccount: () => Promise<void>;
  /** Replaces the local pet with the one already in the account (link status 'cloud'). */
  switchToCloudPet: () => Promise<boolean>;
  /** Joins a pet with an invite code and makes it this phone's pet. Throws FamilyError. */
  joinWithCode: (code: string) => Promise<void>;
  /** Leaves the shared pet (non-owners) and clears it from this phone. Throws FamilyError. */
  leaveFamily: () => Promise<void>;
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
    if (!session || changedUser) {
      setSyncTarget(null);
      useFamily.getState().clear();
    }
    if (session && changedUser) {
      get().loadProfile();
      get().linkAccount();
    }
  },

  loadProfile: async () => {
    const session = get().session;
    if (!supabase || !session) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, notify_family')
      .eq('id', session.user.id)
      .maybeSingle();
    if (get().session?.user.id !== session.user.id) return;
    set({
      profile: {
        id: session.user.id,
        displayName: data?.display_name || metadataName(session),
        notifyFamily: data?.notify_family ?? true,
      },
    });
  },

  updateName: async (name) => {
    const session = get().session;
    const displayName = name.trim();
    if (!supabase || !session || !displayName) return;
    set({ profile: { id: session.user.id, displayName, notifyFamily: get().profile?.notifyFamily ?? true } });
    await supabase.from('profiles').update({ display_name: displayName }).eq('id', session.user.id);
  },

  setNotifyFamily: async (on) => {
    const session = get().session;
    const profile = get().profile;
    if (!supabase || !session || !profile) return;
    set({ profile: { ...profile, notifyFamily: on } });
    const { error } = await supabase.from('profiles').update({ notify_family: on }).eq('id', session.user.id);
    if (error && get().profile) set({ profile: { ...get().profile!, notifyFamily: !on } });
  },

  linkAccount: async () => {
    const session = get().session;
    if (!session || get().link.status === 'working') return;
    const userId = session.user.id;
    const store = usePetStore.getState();

    // Already uploaded for this account: just sync.
    if (store.linkedUserId === userId && store.cloudPetId) {
      set({ link: { status: 'done' } });
      setSyncTarget({ userId, petId: store.cloudPetId });
      return;
    }

    set({ link: { status: 'working' } });
    // Persist the id before uploading so a retry upserts the same rows.
    let petId = store.cloudPetId;
    if (!petId && store.pet) {
      petId = Crypto.randomUUID();
      store.setCloudPetId(petId);
    }
    const snapshot = store.pet
      ? { pet: store.pet, routine: store.routine, activities: store.activities, health: store.health, badges: store.badges }
      : null;

    try {
      const result = await linkLocalPet(userId, petId ?? Crypto.randomUUID(), snapshot);
      if (get().session?.user.id !== userId) return;
      if (result.status === 'cloud') {
        set({ link: { status: 'cloud', petId: result.petId, name: result.name } });
        // Nothing local to lose (new phone, signed in before onboarding): take the account's pet.
        if (!usePetStore.getState().pet) await get().switchToCloudPet();
      } else if (result.status === 'uploaded') {
        usePetStore.getState().setLinked(userId);
        set({ link: { status: 'done' } });
        setSyncTarget({ userId, petId: result.petId });
      } else {
        set({ link: { status: 'idle' } });
      }
    } catch {
      if (get().session?.user.id !== userId) return;
      set({ link: { status: 'error', message: 'Não deu para salvar na nuvem agora. Vamos tentar de novo depois.' } });
    }
  },

  switchToCloudPet: async () => {
    const session = get().session;
    const link = get().link;
    if (!session || link.status !== 'cloud') return false;
    try {
      const cloud = await downloadPet(session.user.id, link.petId);
      if (get().session?.user.id !== session.user.id) return false;
      usePetStore.getState().adoptCloudPet(cloud);
      set({ link: { status: 'done' } });
      setSyncTarget({ userId: session.user.id, petId: link.petId });
      return true;
    } catch {
      return false;
    }
  },

  joinWithCode: async (code) => {
    const session = get().session;
    if (!session) throw new FamilyError('Entre na sua conta para usar o convite.');
    const userId = session.user.id;
    const petId = await redeemInvite(code);
    let cloud;
    try {
      cloud = await downloadPet(userId, petId);
    } catch {
      throw new FamilyError('Você entrou na família, mas não deu para baixar os dados agora. Abra o app de novo em instantes.');
    }
    if (get().session?.user.id !== userId) return;
    setSyncTarget(null);
    useFamily.getState().clear();
    usePetStore.getState().adoptCloudPet(cloud);
    set({ link: { status: 'done' } });
    setSyncTarget({ userId, petId });
  },

  leaveFamily: async () => {
    const session = get().session;
    const petId = usePetStore.getState().cloudPetId;
    if (!session || !petId) return;
    // Already removed by the owner: nothing to delete on the server.
    if (!useFamily.getState().removed) await removeMember(petId, session.user.id);
    setSyncTarget(null);
    useFamily.getState().clear();
    usePetStore.getState().resetAll();
  },
}));

let started = false;

/** Reads the stored session and follows sign-in, sign-out and token refresh. Call once at startup. */
export function startSessionSync() {
  if (!supabase || started) return;
  started = true;
  startSyncTriggers();
  supabase.auth
    .getSession()
    .then(({ data }) => useSession.getState().setSession(data.session))
    .catch(() => useSession.getState().setSession(null));
  supabase.auth.onAuthStateChange((_event, session) => useSession.getState().setSession(session));

  // Signed in before there was a pet (e.g. on a fresh install): upload it as soon as onboarding creates it.
  usePetStore.subscribe((state, prev) => {
    if (state.pet && !prev.pet && useSession.getState().session) useSession.getState().linkAccount();
    // Local data erased: stop syncing the old pet.
    if (prev.cloudPetId && !state.cloudPetId) {
      setSyncTarget(null);
      useFamily.getState().clear();
      useSession.setState({ link: { status: 'idle' } });
    }
  });
}
