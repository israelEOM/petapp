import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { useSession } from '@/store/useSession';
import { forgetPushToken } from './pushSync';
import { supabase } from './supabase';

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/** Native Google sign-in needs the client IDs, and the native module (absent in Expo Go and on web). */
export const googleEnabled = Platform.OS !== 'web' && !!supabase && !!googleWebClientId && (Platform.OS !== 'ios' || !!googleIosClientId);

/** Apple sign-in is built in only when the app was built with the entitlement (paid Apple Developer team). */
export const appleConfigured = Platform.OS === 'ios' && !!supabase && process.env.EXPO_PUBLIC_APPLE_SIGN_IN === '1';

export async function appleAvailable(): Promise<boolean> {
  if (!appleConfigured) return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Thrown with a pt-BR message ready to show; `null` result means the user cancelled. */
export class AuthError extends Error {}

const GENERIC = 'Não deu para entrar agora. Confira a internet e tente de novo.';

let googleConfigured = false;

export async function signInWithGoogle(): Promise<'ok' | 'cancelled'> {
  if (!supabase || !googleEnabled) throw new AuthError('Entrar com Google ainda não está disponível.');
  // Required lazily: the native module is missing in Expo Go, and importing it there throws.
  const { GoogleSignin, isCancelledResponse, isErrorWithCode, statusCodes } =
    require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');

  if (!googleConfigured) {
    GoogleSignin.configure({ webClientId: googleWebClientId, iosClientId: googleIosClientId });
    googleConfigured = true;
  }

  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (isCancelledResponse(res)) return 'cancelled';
    const token = res.data.idToken;
    if (!token) throw new AuthError(GENERIC);
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
    if (error) throw new AuthError(GENERIC);
    return 'ok';
  } catch (e) {
    if (e instanceof AuthError) throw e;
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) return 'cancelled';
      if (e.code === statusCodes.IN_PROGRESS) return 'cancelled';
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new AuthError('Atualize o Google Play Services para entrar com Google.');
      }
    }
    throw new AuthError(GENERIC);
  }
}

export async function signInWithApple(): Promise<'ok' | 'cancelled'> {
  if (!supabase || !appleConfigured) throw new AuthError('Entrar com Apple ainda não está disponível.');
  // Apple gets the hashed nonce; Supabase gets the raw one and checks they match.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new AuthError(GENERIC);
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) throw new AuthError(GENERIC);

    // Apple sends the name only on the very first sign-in, and never inside the token.
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
    if (name) await useSession.getState().updateName(name);
    return 'ok';
  } catch (e) {
    if (e instanceof AuthError) throw e;
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return 'cancelled';
    throw new AuthError(GENERIC);
  }
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  if (googleEnabled) {
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    } catch {
      // not signed in with Google; nothing to clear
    }
  }
  await forgetPushToken().catch(() => {});
  await supabase.auth.signOut();
}
