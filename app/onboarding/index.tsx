import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Mascot } from '@/components/Mascot';
import { Screen } from '@/components/Screen';
import { usePetStore } from '@/store/usePetStore';
import { accountsEnabled, useSession } from '@/store/useSession';
import { colors, fonts } from '@/theme';

const PERKS = ['Rotina de comida, água e passeio', 'Vacinas e remédios sem esquecer', 'Conquistas e fotos pra compartilhar'];

export default function Welcome() {
  const onboarded = usePetStore((s) => s.onboarded);
  const signedIn = useSession((s) => s.session !== null);
  const link = useSession((s) => s.link);
  const switchToCloudPet = useSession((s) => s.switchToCloudPet);

  // Signing in on a new phone brings the account's pet down; then there's nothing to set up.
  useEffect(() => {
    if (onboarded) router.replace('/(tabs)');
  }, [onboarded]);

  const accountNote =
    link.status === 'working'
      ? 'Buscando seus dados…'
      : link.status === 'cloud'
        ? 'Não deu para baixar seus dados agora.'
        : link.status === 'error'
          ? link.message
          : null;

  return (
    <Screen background={colors.primary} statusBar="light" scroll contentStyle={styles.content}>
      <View style={styles.halo}>
        <Mascot size={200} wave shadow={false} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title} accessibilityRole="header">
          Oi! Eu sou o Pipoca
        </Text>
        <Text style={styles.body}>Vou te ajudar a cuidar do seu melhor amigo, e você ainda ganha prêmios com isso.</Text>
      </View>

      <View style={styles.perks}>
        {PERKS.map((perk) => (
          <View key={perk} style={styles.perk}>
            <View style={styles.dot} />
            <Text style={styles.perkText}>{perk}</Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      {signedIn && accountNote && <Text style={styles.note}>{accountNote}</Text>}
      <Button label="Começar" variant="yellow" onPress={() => router.push('/onboarding/species')} />
      {accountsEnabled && !signedIn && (
        <Pressable
          onPress={() => router.push('/account/sign-in')}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.linkText}>Já tenho conta</Text>
        </Pressable>
      )}
      {signedIn && link.status === 'cloud' && (
        <Pressable
          onPress={() => switchToCloudPet()}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.linkText}>Tentar de novo</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingTop: 40, gap: 24 },
  halo: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#6F55E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { alignItems: 'center', gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: '#FFFFFF', textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: '#ECE8FF', textAlign: 'center', maxWidth: 310 },
  perks: { alignSelf: 'stretch', gap: 10 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.yellow },
  perkText: { fontFamily: fonts.bold, fontSize: 15, color: '#ECE8FF' },
  note: { fontFamily: fonts.bold, fontSize: 14, color: '#ECE8FF', textAlign: 'center' },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, marginTop: -8 },
  linkText: { fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF', textDecorationLine: 'underline' },
});
