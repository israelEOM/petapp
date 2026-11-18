import { router } from 'expo-router';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { Screen } from '@/components/Screen';
import { addMonths, dateKey, formatMonth, monthOf } from '@/lib/dates';
import { answerMonths, healthIcon, intervalLabel } from '@/lib/health';
import { de, defaultHealth } from '@/lib/pet';
import { haptic } from '@/lib/platform';
import type { HealthAnswer, HealthItem } from '@/store/types';
import { useOnboardingDraft } from '@/store/useOnboardingDraft';
import { colors, fonts, radius } from '@/theme';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

const OPTIONS: { kind: HealthAnswer['kind']; label: string; bg: string; border: string; fg: string }[] = [
  { kind: 'ok', label: 'Em dia', bg: colors.greenSoft, border: colors.green, fg: colors.green },
  { kind: 'late', label: 'Atrasado', bg: '#FFE1D6', border: '#C2410C', fg: '#9A2B12' },
  { kind: 'unknown', label: 'Não sei', bg: colors.primarySoft, border: colors.primary, fg: colors.primaryDark },
];

function monthText(month: string, today: string): string {
  const current = monthOf(today);
  if (month === current) return 'Este mês';
  if (month === addMonths(current, -1)) return 'Mês passado';
  return formatMonth(month);
}

export default function HealthStep() {
  const draft = useOnboardingDraft();
  const today = dateKey();
  const items = defaultHealth(draft.species);
  const name = draft.name.trim();

  const answerFor = (id: string): HealthAnswer => draft.health[id] ?? { kind: 'unknown', month: monthOf(today) };

  const setAnswer = (id: string, patch: Partial<HealthAnswer>) => {
    draft.update({ health: { ...draft.health, [id]: { ...answerFor(id), ...patch } } });
  };

  const pick = (id: string, kind: HealthAnswer['kind']) => {
    if (answerFor(id).kind === kind) return;
    haptic.light();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAnswer(id, { kind });
  };

  return (
    <Screen scroll>
      <OnboardingHeader step={4} />

      <View style={styles.heading}>
        <Text style={styles.title} accessibilityRole="header">
          E a saúde {de({ sex: draft.sex })} {name}?
        </Text>
        <Text style={styles.subtitle}>Marque o que você sabe. O resto dá para registrar depois, na aba Saúde.</Text>
      </View>

      {items.map((item) => (
        <HealthCard
          key={item.id}
          item={item}
          answer={answerFor(item.id)}
          today={today}
          onPick={(kind) => pick(item.id, kind)}
          onMonth={(month) => {
            haptic.light();
            setAnswer(item.id, { month });
          }}
        />
      ))}

      <View style={{ flex: 1 }} />

      <Button label="Continuar" onPress={() => router.push('/onboarding/reminders')} />
    </Screen>
  );
}

interface HealthCardProps {
  item: HealthItem;
  answer: HealthAnswer;
  today: string;
  onPick: (kind: HealthAnswer['kind']) => void;
  onMonth: (month: string) => void;
}

function HealthCard({ item, answer, today, onPick, onMonth }: HealthCardProps) {
  const months = answerMonths(item.intervalDays, today);
  const index = Math.max(0, months.indexOf(answer.month));
  const month = months[index];
  const older = index < months.length - 1;
  const newer = index > 0;

  return (
    <View style={styles.card}>
      <View style={styles.itemRow}>
        <View style={styles.itemIcon}>
          <Icon name={healthIcon(item.id)} size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemHint}>{intervalLabel(item.intervalDays)}</Text>
        </View>
      </View>

      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={item.name}>
        {OPTIONS.map((o) => {
          const on = answer.kind === o.kind;
          return (
            <Pressable
              key={o.kind}
              onPress={() => onPick(o.kind)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${item.name}: ${o.label}`}
              style={({ pressed }) => [
                styles.option,
                on && { backgroundColor: o.bg, borderColor: o.border },
                pressed && { transform: [{ scale: 0.96 }] },
              ]}
            >
              <Text style={[styles.optionText, on && { fontFamily: fonts.black, color: o.fg }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {answer.kind === 'ok' && (
        <View style={styles.monthRow}>
          <Text style={styles.monthLabel}>Última vez</Text>
          <View style={styles.stepper}>
            <MonthButton icon="chevron-left" label="Mês anterior" disabled={!older} onPress={() => onMonth(months[index + 1])} />
            <Text style={styles.month} accessibilityLiveRegion="polite" accessibilityLabel={`Última vez: ${monthText(month, today)}`}>
              {monthText(month, today)}
            </Text>
            <MonthButton icon="chevron-right" label="Mês seguinte" disabled={!newer} onPress={() => onMonth(months[index - 1])} />
          </View>
        </View>
      )}
    </View>
  );
}

function MonthButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'chevron-left' | 'chevron-right';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.monthButton, disabled && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <Icon name={icon} size={18} color={colors.primaryDark} strokeWidth={2.6} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 6 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: radius.md + 4, padding: 16, gap: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  itemHint: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  options: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  optionText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4 },
  monthLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.subtle },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: { fontFamily: fonts.black, fontSize: 14, minWidth: 128, textAlign: 'center', color: colors.ink },
});
