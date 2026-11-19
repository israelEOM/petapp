import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { Mascot } from '@/components/Mascot';
import { Screen } from '@/components/Screen';
import { appleAvailable, AuthError, googleEnabled, signInWithApple, signInWithGoogle } from '@/lib/auth';
import { de } from '@/lib/pet';
import { haptic } from '@/lib/platform';
import { usePetStore } from '@/store/usePetStore';
import { colors, fonts, radius } from '@/theme';

const PERKS: { icon: IconName; text: string }[] = [
  { icon: 'shield', text: 'Progresso salvo, mesmo se trocar de celular' },
  { icon: 'heart', text: 'Família e pet sitter cuidando junto' },
  { icon: 'check', text: 'Todo mundo vê quem já deu comida' },
];

export default function SignIn() {
  const pet = usePetStore((s) => s.pet);
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    appleAvailable().then(setApple);
  }, []);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const run = async (provider: 'apple' | 'google') => {
    if (busy) return;
    setBusy(provider);
    setError(null);
    try {
      const result = provider === 'apple' ? await signInWithApple() : await signInWithGoogle();
      if (result === 'ok') {
        haptic.success();
        close();
      }
    } catch (e) {
      haptic.error();
      setError(e instanceof AuthError ? e.message : 'Não deu para entrar agora. Tente de novo.');
    } finally {
      setBusy(null);
    }
  };

  const title = pet ? `Guarde a história ${de(pet)} ${pet.name}` : 'Guarde a história do seu pet';
  const none = !apple && !googleEnabled;

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          hitSlop={8}
          style={({ pressed }) => [styles.close, pressed && { transform: [{ scale: 0.92 }] }]}
        >
          <Icon name="close" size={20} color={colors.ink} strokeWidth={2.6} />
        </Pressable>
      </View>

      <Mascot size={128} mood="happy" />

      <View style={styles.copy}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.body}>Crie sua conta em um toque. Sem senha para lembrar.</Text>
      </View>

      <View style={styles.perks}>
        {PERKS.map((p) => (
          <View key={p.text} style={styles.perk}>
            <View style={styles.perkIcon}>
              <Icon name={p.icon} size={18} color={colors.primary} strokeWidth={2.4} />
            </View>
            <Text style={styles.perkText}>{p.text}</Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.actions}>
        {error && (
          <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            {error}
          </Text>
        )}

        {apple && (
          <View pointerEvents={busy ? 'none' : 'auto'} style={busy && busy !== 'apple' ? styles.dim : null}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.md}
              style={styles.providerButton}
              onPress={() => run('apple')}
            />
          </View>
        )}

        {googleEnabled && (
          <Pressable
            onPress={() => run('google')}
            disabled={!!busy}
            accessibilityRole="button"
            accessibilityLabel="Continuar com Google"
            accessibilityState={{ busy: busy === 'google', disabled: !!busy }}
            style={({ pressed }) => [
              styles.providerButton,
              styles.google,
              busy && busy !== 'google' && styles.dim,
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
          >
            {busy === 'google' ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <>
                <GoogleMark />
                <Text style={styles.googleText}>Continuar com Google</Text>
              </>
            )}
          </Pressable>
        )}

        {none && (
          <Text style={styles.note}>
            Entrar com Apple ou Google chega na próxima versão do app. Seu progresso continua salvo neste celular.
          </Text>
        )}

        <Button label="Agora não" variant="ghost" onPress={close} />
      </View>
    </Screen>
  );
}

/** Google's "G" in its four brand colors (required on Google sign-in buttons). */
function GoogleMark() {
  return (
    <View aria-hidden>
      <Svg width={20} height={20} viewBox="0 0 48 48">
        <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 20, paddingBottom: 12 },
  topBar: { alignSelf: 'stretch', alignItems: 'flex-end' },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { alignItems: 'center', gap: 6 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: colors.ink, textAlign: 'center', maxWidth: 320 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.muted, textAlign: 'center' },
  perks: { alignSelf: 'stretch', backgroundColor: colors.card, borderRadius: radius.md + 4, padding: 16, gap: 14 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perkIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: { flex: 1, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink },
  actions: { alignSelf: 'stretch', gap: 10 },
  providerButton: { alignSelf: 'stretch', height: 52 },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  googleText: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  dim: { opacity: 0.4 },
  error: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: '#9A2B12', textAlign: 'center' },
  note: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center' },
});
