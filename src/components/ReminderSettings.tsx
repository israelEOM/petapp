import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { canShift, formatTime, shiftTime, STREAK_TIME } from '@/lib/reminders';
import { haptic } from '@/lib/platform';
import type { Reminders } from '@/store/types';
import { colors, fonts, radius } from '@/theme';
import { Icon } from './Icon';

interface ReminderSettingsProps {
  value: Reminders;
  meals: number;
  onChange: (patch: Partial<Reminders>) => void;
  /** dims and locks the controls (master switch off) */
  disabled?: boolean;
}

/** Meal times plus the streak and health switches. Shared by onboarding and the Lembretes screen. */
export function ReminderSettings({ value, meals, onChange, disabled = false }: ReminderSettingsProps) {
  const times = value.mealTimes.slice(0, meals);

  const shift = (i: number, steps: number) => {
    haptic.light();
    onChange({ mealTimes: value.mealTimes.map((t, j) => (j === i ? shiftTime(t, steps) : t)) });
  };

  return (
    <View style={[styles.wrap, disabled && styles.dim]} pointerEvents={disabled ? 'none' : 'auto'}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hora da comida</Text>
        {times.map((t, i) => {
          const label = meals === 1 ? 'Refeição' : `${i + 1}ª refeição`;
          return (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <View style={styles.stepper}>
                <ShiftButton
                  icon="chevron-left"
                  label={`${label} mais cedo`}
                  disabled={disabled || !canShift(t, -1)}
                  onPress={() => shift(i, -1)}
                />
                <Text style={styles.time} accessibilityLabel={`${label} às ${formatTime(t)}`} accessibilityLiveRegion="polite">
                  {formatTime(t)}
                </Text>
                <ShiftButton
                  icon="chevron-right"
                  label={`${label} mais tarde`}
                  disabled={disabled || !canShift(t, 1)}
                  onPress={() => shift(i, 1)}
                />
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <ToggleRow
          title="Fechar o dia"
          hint={`Às ${formatTime(STREAK_TIME)}, se faltar alguma tarefa`}
          value={value.streak}
          disabled={disabled}
          onValueChange={(streak) => onChange({ streak })}
        />
        <View style={styles.divider} />
        <ToggleRow
          title="Vacinas e remédios"
          hint="3 dias antes e no dia de vencer"
          value={value.health}
          disabled={disabled}
          onValueChange={(health) => onChange({ health })}
        />
      </View>
    </View>
  );
}

function ShiftButton({
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
      style={({ pressed }) => [styles.shift, disabled && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <Icon name={icon} size={20} color={colors.primaryDark} strokeWidth={2.6} />
    </Pressable>
  );
}

interface ToggleRowProps {
  title: string;
  hint: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (v: boolean) => void;
}

export function ToggleRow({ title, hint, value, disabled, onValueChange }: ToggleRowProps) {
  // The whole row toggles, not just the small switch.
  return (
    <Pressable
      style={styles.row}
      disabled={disabled}
      accessible={false}
      onPress={() => {
        haptic.light();
        onValueChange(!value);
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          haptic.light();
          onValueChange(v);
        }}
        accessibilityLabel={title}
        trackColor={{ true: colors.primary, false: '#D9D4EC' }}
        ios_backgroundColor="#D9D4EC"
        thumbColor="#FFFFFF"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  dim: { opacity: 0.45 },
  card: { backgroundColor: colors.card, borderRadius: radius.md + 4, padding: 16, gap: 10 },
  cardTitle: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  rowLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shift: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: { fontFamily: fonts.display, fontSize: 20, minWidth: 64, textAlign: 'center', color: colors.ink },
  toggleTitle: { fontFamily: fonts.black, fontSize: 15, color: colors.ink },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  divider: { height: 1, backgroundColor: colors.line },
});
