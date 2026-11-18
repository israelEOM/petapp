import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Mascot } from '@/components/Mascot';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { Screen } from '@/components/Screen';
import { haptic } from '@/lib/platform';
import type { Species } from '@/store/types';
import { useOnboardingDraft } from '@/store/useOnboardingDraft';
import { colors, fonts, radius } from '@/theme';

const OPTIONS: { id: Species; label: string; hint: string; tint: string }[] = [
  { id: 'dog', label: 'Cachorro', hint: 'Passeios, petiscos e muito carinho', tint: colors.orangeSoft },
  { id: 'cat', label: 'Gato', hint: 'Independente, mas adora um mimo', tint: colors.blueSoft },
  { id: 'other', label: 'Outro', hint: 'Coelho, ave, roedor, réptil...', tint: colors.greenSoft },
];

const COMMENT: Record<Species, string> = {
  dog: 'Um au-migo! A gente vai se dar muito bem.',
  cat: 'Um gato? Prometo não latir muito.',
  other: 'Todo pet merece carinho. Bora lá!',
};

export default function SpeciesStep() {
  const species = useOnboardingDraft((s) => s.species);
  const update = useOnboardingDraft((s) => s.update);

  return (
    <Screen scroll>
      <OnboardingHeader step={1} />

      <View style={styles.heading}>
        <Text style={styles.title} accessibilityRole="header">
          Quem é o seu pet?
        </Text>
        <Text style={styles.subtitle}>Tem mais de um? Você adiciona os outros depois.</Text>
      </View>

      <View style={styles.options} accessibilityRole="radiogroup">
        {OPTIONS.map((o) => {
          const on = o.id === species;
          return (
            <Pressable
              key={o.id}
              onPress={() => {
                haptic.light();
                update({ species: o.id });
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${o.label}. ${o.hint}`}
              style={({ pressed }) => [
                styles.option,
                on && styles.optionOn,
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={[styles.initial, { backgroundColor: o.tint }]}>
                <Text style={styles.initialText}>{o.label.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{o.label}</Text>
                <Text style={styles.optionHint}>{o.hint}</Text>
              </View>
              <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.comment}>
        <Mascot size={44} mood="neutral" shadow={false} pulse={OPTIONS.findIndex((o) => o.id === species)} />
        <Text style={styles.commentText}>{COMMENT[species]}</Text>
      </View>

      <Button label="Continuar" onPress={() => router.push('/onboarding/profile')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 6 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
  subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  options: { gap: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: radius.md + 2,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 14,
    minHeight: 84,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  initial: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  initialText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  optionLabel: { fontFamily: fonts.display, fontSize: 21, color: colors.ink },
  optionHint: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
  comment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  commentText: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
});
