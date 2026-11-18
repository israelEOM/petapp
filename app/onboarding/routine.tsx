import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { Screen } from '@/components/Screen';
import { haptic } from '@/lib/platform';
import { de } from '@/lib/pet';
import { useOnboardingDraft } from '@/store/useOnboardingDraft';
import { colors, fonts, radius } from '@/theme';

const WALKS = [15, 30, 60];
const MIN_MEALS = 1;
const MAX_MEALS = 4;

export default function RoutineStep() {
  const draft = useOnboardingDraft();
  const name = draft.name.trim();

  const setMeals = (meals: number) => {
    if (meals < MIN_MEALS || meals > MAX_MEALS) return;
    haptic.light();
    draft.update({ meals });
  };

  const next = () => router.push('/onboarding/health');

  return (
    <Screen scroll>
      <OnboardingHeader step={3} />

      <View style={styles.heading}>
        <Text style={styles.title} accessibilityRole="header">
          Como é a rotina {de({ sex: draft.sex })} {name}?
        </Text>
        <Text style={styles.subtitle}>Isso vira as metas diárias e os pontos.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Refeições por dia</Text>
            <Text style={styles.cardHint}>Cada refeição conta no dia</Text>
          </View>
          <View style={styles.stepper}>
            <StepButton icon="minus" label="Menos uma refeição" disabled={draft.meals <= MIN_MEALS} onPress={() => setMeals(draft.meals - 1)} />
            <Text style={styles.count} accessibilityLiveRegion="polite" accessibilityLabel={`${draft.meals} refeições`}>
              {draft.meals}
            </Text>
            <StepButton icon="plus" label="Mais uma refeição" disabled={draft.meals >= MAX_MEALS} onPress={() => setMeals(draft.meals + 1)} />
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View>
          <Text style={styles.cardTitle}>Meta de passeio</Text>
          <Text style={styles.cardHint}>Por dia</Text>
        </View>
        <View style={styles.walks} accessibilityRole="radiogroup">
          {WALKS.map((min) => {
            const on = draft.walkMinutes === min;
            return (
              <Pressable
                key={min}
                onPress={() => {
                  haptic.light();
                  draft.update({ walkMinutes: min });
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.walk, on && styles.walkOn]}
              >
                <Text style={[styles.walkText, on && styles.walkTextOn]}>{min} min</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <Button label="Continuar" onPress={next} />
    </Screen>
  );
}

function StepButton({ icon, label, disabled, onPress }: { icon: 'plus' | 'minus'; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.stepButton, disabled && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <Icon name={icon} size={20} color={colors.primaryDark} strokeWidth={2.6} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 6 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: radius.md + 4, padding: 16, gap: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  cardHint: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { fontFamily: fonts.display, fontSize: 24, minWidth: 18, textAlign: 'center', color: colors.ink },
  walks: { flexDirection: 'row', gap: 8 },
  walk: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  walkText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  walkTextOn: { fontFamily: fonts.black, color: colors.primaryDark },
});
