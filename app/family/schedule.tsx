import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { FamilyError, saveSchedule } from '@/lib/family';
import { de } from '@/lib/pet';
import { confirmAction, haptic } from '@/lib/platform';
import { type Assignment, WEEKDAYS, WEEKDAY_SHORT, assigneeFor, copyDayToWeek, forMembers, setCell } from '@/lib/schedule';
import { useAccess } from '@/lib/useAccess';
import { firstName, sitterExpired, useFamily } from '@/store/useFamily';
import type { TaskId } from '@/store/types';
import { usePetStore } from '@/store/usePetStore';
import { useSession } from '@/store/useSession';
import { colors, fonts, radius } from '@/theme';

const TASKS: { id: TaskId; label: string; icon: IconName; tint: string }[] = [
  { id: 'food', label: 'Comida', icon: 'bowl', tint: colors.orangeSoft },
  { id: 'water', label: 'Água', icon: 'drop', tint: colors.blueSoft },
  { id: 'walk', label: 'Passeio', icon: 'paw', tint: colors.greenSoft },
  { id: 'play', label: 'Brincar', icon: 'ball', tint: colors.purpleSoft },
];

export default function ScheduleScreen() {
  const pet = usePetStore((s) => s.pet);
  const petId = usePetStore((s) => s.cloudPetId);
  const members = useFamily((s) => s.members);
  const stored = useFamily((s) => s.schedule);
  const setSchedule = useFamily((s) => s.setSchedule);
  const myId = useSession((s) => s.session?.user.id ?? null);
  const access = useAccess();
  const [day, setDay] = useState(() => new Date().getDay());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schedule = forMembers(stored, new Set(members.map((m) => m.userId)));
  // Only people who can log can be on duty.
  const candidates = members.filter((m) => m.role === 'owner' || m.role === 'caregiver' || (m.role === 'sitter' && !sitterExpired(m)));
  const nameOf = (userId: string | null) => {
    if (!userId) return null;
    if (userId === myId) return 'Você';
    const m = members.find((x) => x.userId === userId);
    return m ? firstName(m.name) : null;
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace('/family'));

  const save = async (next: Assignment[]) => {
    if (!petId) return;
    const prev = stored;
    setSchedule(next);
    setBusy(true);
    setError(null);
    try {
      await saveSchedule(petId, next, prev);
      haptic.success();
    } catch (e) {
      setSchedule(prev);
      haptic.error();
      setError(e instanceof FamilyError ? e.message : 'Não deu para salvar agora. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const pick = (task: TaskId, label: string) => {
    if (!access.isOwner || busy) return;
    haptic.light();
    const current = assigneeFor(schedule, day, task);
    Alert.alert(`${label} · ${WEEKDAYS[day].toLowerCase()}`, 'Quem fica com essa tarefa?', [
      ...candidates
        .filter((m) => m.userId !== current)
        .map((m) => ({ text: m.userId === myId ? 'Eu' : m.name, onPress: () => save(setCell(schedule, day, task, m.userId)) })),
      ...(current ? [{ text: 'Ninguém', onPress: () => save(setCell(schedule, day, task, null)) }] : []),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };

  const copyToWeek = () =>
    confirmAction(
      `Repetir ${WEEKDAYS[day].toLowerCase()} na semana toda?`,
      'As tarefas dos outros dias passam a ser iguais a este.',
      'Repetir',
      () => save(copyDayToWeek(schedule, day)),
    );

  const dayHasAny = TASKS.some((t) => assigneeFor(schedule, day, t.id));

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={4}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        >
          <Icon name="chevron-left" size={22} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Quem faz o quê
        </Text>
      </View>

      <Text style={styles.lead}>
        {access.isOwner
          ? `Divida os cuidados ${pet ? `${de(pet)} ${pet.name}` : ''} na semana. Quem está de vez vê isso no Hoje.`
          : 'A escala da semana. Só o tutor muda quem faz cada tarefa.'}
      </Text>

      <View style={styles.days} accessibilityRole="tablist">
        {WEEKDAY_SHORT.map((label, i) => {
          const on = i === day;
          return (
            <Pressable
              key={label}
              onPress={() => {
                haptic.light();
                setDay(i);
              }}
              accessibilityRole="tab"
              accessibilityLabel={WEEKDAYS[i]}
              accessibilityState={{ selected: on }}
              style={[styles.day, on && styles.dayOn]}
            >
              <Text style={[styles.dayText, on && styles.dayTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        {TASKS.map((t, i) => {
          const who = nameOf(assigneeFor(schedule, day, t.id));
          return (
            <Pressable
              key={t.id}
              onPress={() => pick(t.id, t.label)}
              disabled={!access.isOwner || busy}
              accessibilityRole={access.isOwner ? 'button' : undefined}
              accessibilityLabel={`${t.label}: ${who ?? 'ninguém'}`}
              accessibilityHint={access.isOwner ? 'Escolher quem faz' : undefined}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && { opacity: 0.6 }]}
            >
              <View style={[styles.taskIcon, { backgroundColor: t.tint }]} aria-hidden>
                <Icon name={t.icon} size={20} />
              </View>
              <Text style={styles.taskLabel}>{t.label}</Text>
              <View style={[styles.chip, who ? styles.chipOn : null]}>
                <Text style={[styles.chipText, who ? styles.chipTextOn : null]} numberOfLines={1}>
                  {who ?? 'Ninguém'}
                </Text>
              </View>
              {access.isOwner && <Icon name="chevron-right" size={18} color={colors.muted} />}
            </Pressable>
          );
        })}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {access.isOwner && dayHasAny && (
        <Button label={`Repetir ${WEEKDAYS[day].toLowerCase()} na semana`} variant="secondary" onPress={copyToWeek} disabled={busy} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  lead: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted },
  days: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  dayText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  dayTextOn: { color: colors.primary },
  card: { backgroundColor: colors.card, borderRadius: radius.md + 4, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  taskIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  taskLabel: { flex: 1, fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  chip: { maxWidth: 140, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.locked },
  chipOn: { backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fonts.bold, fontSize: 14, color: colors.muted },
  chipTextOn: { color: colors.primary },
  error: { fontFamily: fonts.bold, fontSize: 14, color: colors.warn },
});
