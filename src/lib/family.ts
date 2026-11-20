import type { Role } from '@/store/useFamily';
import { supabase } from './supabase';

export { codeFromText, inviteLink, isValidCode, normalizeCode } from './inviteCode';

/** Error with a message ready to show (pt-BR). */
export class FamilyError extends Error {}

const OFFLINE = 'Sem conexão agora. Tente de novo em instantes.';

export async function createInvite(petId: string, role: Exclude<Role, 'owner'>, sitterUntil: Date | null): Promise<string> {
  if (!supabase) throw new FamilyError(OFFLINE);
  const { data, error } = await supabase.rpc('create_invite', {
    p_pet: petId,
    p_role: role,
    p_sitter_until: role === 'sitter' && sitterUntil ? sitterUntil.toISOString() : null,
  });
  if (error || typeof data !== 'string') throw new FamilyError('Não deu para criar o convite agora. Tente de novo.');
  return data;
}

/** Joins the pet behind the code; returns its id. */
export async function redeemInvite(code: string): Promise<string> {
  if (!supabase) throw new FamilyError(OFFLINE);
  const { data, error } = await supabase.rpc('redeem_invite', { p_code: code });
  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('invite_invalid')) throw new FamilyError('Esse código não existe. Confira as letras e tente de novo.');
    if (msg.includes('invite_used')) throw new FamilyError('Esse convite já foi usado. Peça um novo código.');
    if (msg.includes('invite_expired')) throw new FamilyError('Esse convite expirou. Peça um novo código.');
    throw new FamilyError(OFFLINE);
  }
  return data as string;
}

export async function setMemberRole(petId: string, userId: string, role: Exclude<Role, 'owner' | 'sitter'>) {
  if (!supabase) throw new FamilyError(OFFLINE);
  const { error } = await supabase
    .from('pet_members')
    .update({ role, expires_at: null })
    .eq('pet_id', petId)
    .eq('user_id', userId);
  if (error) throw new FamilyError('Não deu para mudar agora. Tente de novo.');
}

/** Owner removes someone, or a member leaves (userId = self). */
export async function removeMember(petId: string, userId: string) {
  if (!supabase) throw new FamilyError(OFFLINE);
  const { error } = await supabase.from('pet_members').delete().eq('pet_id', petId).eq('user_id', userId);
  if (error) throw new FamilyError('Não deu para remover agora. Tente de novo.');
}
