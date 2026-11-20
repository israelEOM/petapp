import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { dateKey } from '@/lib/dates';
import { XP } from '@/lib/gamification';
import { dueLabel, formatDue, healthIcon, intervalLabel, lastDoseLabel, sortByDue, statusLabel, type HealthStatus, type HealthStatusKind } from '@/lib/health';
import { de } from '@/lib/pet';
import { haptic } from '@/lib/platform';
import { useAccess } from '@/lib/useAccess';
import { usePetStore } from '@/store/usePetStore';
import { colors, fonts, radius } from '@/theme';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

const CHIP: Record<Exclude<HealthStatusKind, 'unknown'>, { fg: string; bg: string }> = {
  overdue: { fg: '#9A2B12', bg: '#FFE1D6' },
  soon: { fg: colors.warn, bg: colors.yellowSoft },
  ok: { fg: colors.green, bg: colors.greenSoft },
};

const ICON_TINT: Record<HealthStatusKind, string> = {
  overdue: colors.orangeSoft,
  soon: colors.yellowSoft,
  ok: colors.greenSoft,
  unknown: colors.primarySoft,
};

function rowDetail(intervalDays: number, s: HealthStatus): string {
  const interval = intervalLabel(intervalDays);
  if (s.kind === 'unknown' || !s.due) return interval;
  if (s.kind === 'overdue') return `${interval} · ${dueLabel(s).toLowerCase()}`;
  return `${interval} · próx. ${formatDue(s.due)}`;
}

export default function Health() {
  const pet = usePetStore((s) => s.pet);
  const health = usePetStore((s) => s.health);
  const markHealthDone = usePetStore((s) => s.markHealthDone);
  const { canLog } = useAccess();
  const [open, setOpen] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);

  if (!pet) return null;

  const today = dateKey();
  const sorted = sortByDue(health, today);
  const top = sorted[0];

  const done = (id: string) => {
    haptic.success();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    markHealthDone(id);
    setJustDone(id);
    setOpen(null);
  };

  const toggle = (id: string) => {
    haptic.light();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((cur) => (cur === id ? null : id));
  };

  return (
    <Screen scroll edges={['top']}>
      <View style={{ gap: 2 }}>
        <Text style={styles.title} accessibilityRole="header">
          Saúde {de(pet)} {pet.name}
        </Text>
        <Text style={styles.subtitle}>Carteirinha digital</Text>
      </View>

      {top && (
        <View style={styles.hero}>
          <Text style={styles.kicker}>PRÓXIMO CUIDADO</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Icon name={healthIcon(top.item.id)} size={28} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{top.item.name}</Text>
              <Text style={styles.heroDue}>{dueLabel(top.status)}</Text>
            </View>
          </View>
          {top.item.lastDate === today ? (
            <View style={styles.heroDone} accessibilityLiveRegion="polite">
              <Icon name="check" size={20} color={colors.yellow} strokeWidth={3} />
              <Text style={styles.heroDoneText}>Registrado hoje · +{XP.health} XP</Text>
            </View>
          ) : !canLog ? null : (
            <Pressable
              onPress={() => done(top.item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${top.item.name}: feito hoje`}
              style={({ pressed }) => [styles.heroButton, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.heroButtonText}>Feito hoje</Text>
            </Pressable>
          )}
        </View>
      )}

      <Text style={styles.section} accessibilityRole="header">
        Calendário de saúde
      </Text>
      <View style={styles.list}>
        {sorted.map(({ item, status }, i) => {
          const expanded = open === item.id;
          return (
            <View key={item.id} style={[styles.rowWrap, i < sorted.length - 1 && styles.rowBorder]}>
              <Pressable
                onPress={() => toggle(item.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${item.name}. ${statusLabel[status.kind]}`}
                style={styles.row}
              >
                <View style={[styles.rowIcon, { backgroundColor: ICON_TINT[status.kind] }]}>
                  <Icon name={healthIcon(item.id)} size={22} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  {status.kind === 'unknown' ? (
                    <Text style={styles.rowRegister}>{statusLabel.unknown}</Text>
                  ) : (
                    <Text style={styles.rowDetail}>{rowDetail(item.intervalDays, status)}</Text>
                  )}
                </View>
                {status.kind !== 'unknown' && (
                  <View style={[styles.chip, { backgroundColor: CHIP[status.kind].bg }]}>
                    <Text style={[styles.chipText, { color: CHIP[status.kind].fg }]}>{statusLabel[status.kind]}</Text>
                  </View>
                )}
              </Pressable>

              {expanded && (
                <View style={styles.expand}>
                  <Text style={styles.expandText}>
                    {lastDoseLabel(item)}
                  </Text>
                  {canLog && (
                    <Pressable
                      onPress={() => done(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.name}: feito hoje`}
                      style={({ pressed }) => [styles.doneButton, pressed && { opacity: 0.85 }]}
                    >
                      <Icon name="check" size={18} color="#FFFFFF" strokeWidth={2.6} />
                      <Text style={styles.doneButtonText}>Feito hoje</Text>
                    </Pressable>
                  )}
                </View>
              )}
              {justDone === item.id && item.lastDate === today && !expanded && (
                <Text style={styles.toast} accessibilityLiveRegion="polite">
                  Registrado! +{XP.health} XP
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  hero: { backgroundColor: colors.ink, borderRadius: radius.lg - 2, padding: 20, gap: 14 },
  kicker: { fontFamily: fonts.black, fontSize: 12, letterSpacing: 1, color: colors.yellow },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { fontFamily: fonts.display, fontSize: 22, color: '#FFFFFF' },
  heroDue: { fontFamily: fonts.body, fontSize: 14, color: '#D6D2EE' },
  heroButton: {
    minHeight: 48,
    borderRadius: radius.sm,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroButtonText: { fontFamily: fonts.black, fontSize: 15, color: colors.ink },
  heroDone: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroDoneText: { fontFamily: fonts.black, fontSize: 15, color: colors.yellow },
  section: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, marginTop: 4 },
  list: { backgroundColor: colors.card, borderRadius: radius.md + 4, paddingHorizontal: 16, paddingVertical: 4 },
  rowWrap: { paddingVertical: 4 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 56 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontFamily: fonts.black, fontSize: 15, color: colors.ink },
  rowDetail: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  rowRegister: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontFamily: fonts.black, fontSize: 12 },
  expand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 10, paddingLeft: 52 },
  expandText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  doneButtonText: { fontFamily: fonts.black, fontSize: 14, color: '#FFFFFF' },
  toast: { fontFamily: fonts.black, fontSize: 13, color: colors.green, paddingLeft: 52, paddingBottom: 8 },
});
