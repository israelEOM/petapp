import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';
import { Icon } from './Icon';
import { ProgressBar } from './ProgressBar';

interface OnboardingHeaderProps {
  step: number;
  total?: number;
}

export function OnboardingHeader({ step, total = 5 }: OnboardingHeaderProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/onboarding'))}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={4}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
      >
        <Icon name="chevron-left" size={22} />
      </Pressable>
      <View style={styles.bar}>
        <ProgressBar progress={step / total} height={10} trackColor="#E4DFF7" />
      </View>
      <Text style={styles.label} accessibilityLabel={`Passo ${step} de ${total}`}>
        {step} de {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: { flex: 1 },
  label: { fontFamily: fonts.black, fontSize: 13, color: colors.subtle },
});
