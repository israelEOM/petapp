import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Mascot } from '@/components/Mascot';
import { Screen } from '@/components/Screen';
import { colors, fonts } from '@/theme';

const PERKS = ['Rotina de comida, água e passeio', 'Vacinas e remédios sem esquecer', 'Conquistas e fotos pra compartilhar'];

export default function Welcome() {
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

      <Button label="Começar" variant="yellow" onPress={() => router.push('/onboarding/species')} />
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
});
