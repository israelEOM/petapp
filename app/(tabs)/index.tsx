import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Mascot } from '@/components/Mascot';
import { PetAvatar } from '@/components/PetAvatar';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { dateKey, formatShort } from '@/lib/dates';
import { XP, completedTasks, countRun, emptyLog, isComplete } from '@/lib/gamification';
import { dueLabel, healthIcon, sortByDue } from '@/lib/health';
import { de, petSubtitle } from '@/lib/pet';
import { haptic, nativeDriver } from '@/lib/platform';
import { useAccess } from '@/lib/useAccess';
import { describe, lastOf, timeOf, todays, whoName } from '@/lib/whoDid';
import { useFamily } from '@/store/useFamily';
import { useSession } from '@/store/useSession';
import type { DayLog, TaskId } from '@/store/types';
import { usePetStore } from '@/store/usePetStore';
import { colors, fonts, radius } from '@/theme';

const TASKS: { id: TaskId; label: string; icon: IconName; tint: string }[] = [
  { id: 'food', label: 'Comida', icon: 'bowl', tint: colors.orangeSoft },
  { id: 'water', label: 'Água', icon: 'drop', tint: colors.blueSoft },
  { id: 'walk', label: 'Passeio', icon: 'paw', tint: colors.greenSoft },
  { id: 'play', label: 'Brincar', icon: 'ball', tint: colors.purpleSoft },
];

const REACTIONS: Record<TaskId, string> = {
  food: 'Nham! Que delícia.',
  water: 'Glub glub, valeu!',
  walk: 'Passeio é vida!',
  play: 'De novo! De novo!',
};

const REACTION_MS = 2600;

function isTaskDone(id: TaskId, log: DayLog, meals: number) {
  return id === 'food' ? log.food >= meals : log[id];
}

export default function Today() {
  const pet = usePetStore((s) => s.pet);
  const meals = usePetStore((s) => s.routine.meals);
  const walkMinutes = usePetStore((s) => s.routine.walkMinutes);
  const logs = usePetStore((s) => s.logs);
  const health = usePetStore((s) => s.health);
  const tapTask = usePetStore((s) => s.tapTask);
  const remindersOn = usePetStore((s) => s.reminders.enabled);
  const activities = usePetStore((s) => s.activities);
  const members = useFamily((s) => s.members);
  const removed = useFamily((s) => s.removed);
  const myId = useSession((s) => s.session?.user.id ?? null);
  const access = useAccess();

  const [reaction, setReaction] = useState<{ text: string; happy: boolean } | null>(null);
  const [pulse, setPulse] = useState(0);
  const [bursts, setBursts] = useState<Record<TaskId, number>>({ food: 0, water: 0, walk: 0, play: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  if (!pet) return null;

  const today = dateKey();
  const log = { ...emptyLog(), ...logs[today] };
  const count = completedTasks(log, meals);
  const allDone = count === 4;
  const streak = countRun(logs, today, (l) => isComplete(l, meals));
  const next = sortByDue(health, today)[0];
  const todayList = access.shared ? todays(activities, today) : [];
  const readOnly = !access.canLog;
  const sitterEnd = access.me?.role === 'sitter' && access.me.expiresAt ? formatShort(dateKey(new Date(access.me.expiresAt))) : null;

  const defaultBubble =
    count === 0 ? `Oi! Bora cuidar ${de(pet)} ${pet.name} hoje?` : allDone ? 'Dia perfeito! Até amanhã.' : 'Tá ficando bom, continua!';

  const react = (text: string, happy: boolean) => {
    setReaction({ text, happy });
    setPulse((p) => p + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setReaction(null), REACTION_MS);
  };

  const onTap = (id: TaskId) => {
    if (readOnly) {
      haptic.light();
      react(access.me?.role === 'viewer' ? 'Você só acompanha. Quem registra é a família.' : 'Seu período de pet sitter terminou.', false);
      return;
    }
    const before = { ...emptyLog(), ...usePetStore.getState().logs[today] };
    tapTask(id);
    const after = { ...emptyLog(), ...usePetStore.getState().logs[today] };

    const progressed = id === 'food' ? after.food > before.food : after[id] && !before[id];
    if (!progressed) {
      haptic.light();
      react('Ops, desfeito. Sem problema!', false);
      return;
    }

    setBursts((b) => ({ ...b, [id]: b[id] + 1 }));
    if (isComplete(after, meals) && !isComplete(before, meals)) {
      haptic.success();
      react(`Dia perfeito! +${XP.dayBonus} XP`, true);
    } else if (id === 'food' && after.food < meals) {
      haptic.tap();
      react(`Nham! ${after.food} de ${meals} refeições.`, true);
    } else {
      haptic.tap();
      react(REACTIONS[id], true);
    }
  };

  const taskSub = (id: TaskId): string => {
    const last = access.shared ? lastOf(todayList, id) : undefined;
    const by = last ? `${whoName(last, members, myId)} · ${timeOf(last.createdAt)}` : null;
    if (id === 'food') {
      if (by) return log.food >= meals ? `Feito · ${by}` : `${log.food}/${meals} · ${by}`;
      if (log.food >= meals) return meals === 1 ? 'Refeição feita' : 'Todas as refeições';
      return `${log.food}/${meals} ${meals === 1 ? 'refeição' : 'refeições'}`;
    }
    if (log[id]) return by ?? 'Feito hoje';
    if (id === 'water') return 'Toque para registrar';
    if (id === 'walk') return `Meta: ${walkMinutes} min`;
    return 'Mantenha a sequência!';
  };

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.header}>
        <PetAvatar name={pet.name} />
        <View style={{ flex: 1 }}>
          <Text style={styles.petName} accessibilityRole="header">
            {pet.name}
          </Text>
          <Text style={styles.petSub}>{petSubtitle(pet)}</Text>
        </View>
        <View style={styles.streak} accessibilityLabel={`Sequência de ${streak} ${streak === 1 ? 'dia' : 'dias'}`}>
          <Icon name="flame" size={18} color="#C2570C" strokeWidth={2.2} />
          <Text style={styles.streakText}>
            {streak} {streak === 1 ? 'dia' : 'dias'}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/reminders')}
          accessibilityRole="button"
          accessibilityLabel={remindersOn ? 'Lembretes' : 'Lembretes, desativados'}
          hitSlop={4}
          style={({ pressed }) => [styles.bell, pressed && { opacity: 0.6 }]}
        >
          <Icon name="bell" size={20} color={remindersOn ? colors.primary : colors.muted} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.mascotCard}>
        <View style={styles.bubble} accessibilityLiveRegion="polite">
          <Text style={styles.bubbleText}>{reaction?.text ?? defaultBubble}</Text>
        </View>
        <Mascot size={150} mood={allDone || reaction?.happy ? 'happy' : 'neutral'} pulse={pulse} />
        <View style={styles.bond}>
          <View style={styles.bondRow}>
            <Text style={styles.bondLabel}>Vínculo de hoje</Text>
            <Text style={styles.bondLabel}>{count}/4</Text>
          </View>
          <ProgressBar progress={count / 4} accessibilityLabel={`Vínculo de hoje: ${count} de 4`} />
        </View>
      </View>

      {removed ? (
        <Pressable
          onPress={() => router.push('/family')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.notice, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.noticeTitle}>Você não faz mais parte desta família</Text>
          <Text style={styles.noticeText}>Os registros não sincronizam mais. Toque para ver o que fazer.</Text>
        </Pressable>
      ) : readOnly ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>
            {access.me?.role === 'viewer' ? `Você acompanha ${de(pet)} ${pet.name}` : `Seu período de pet sitter terminou${sitterEnd ? ` em ${sitterEnd}` : ''}`}
          </Text>
          <Text style={styles.noticeText}>Você vê tudo o que a família registra, mas não registra. Para mudar, fale com quem convidou você.</Text>
        </View>
      ) : null}

      <View style={styles.grid}>
        {TASKS.map((t) => (
          <TaskCard
            key={t.id}
            label={t.label}
            icon={t.icon}
            tint={t.tint}
            sub={taskSub(t.id)}
            done={isTaskDone(t.id, log, meals)}
            partial={t.id === 'food' && log.food > 0 && log.food < meals}
            burst={bursts[t.id]}
            onPress={() => onTap(t.id)}
          />
        ))}
      </View>

      {access.shared && (
        <View style={styles.dayCard}>
          <Text style={styles.dayTitle}>Hoje na família</Text>
          {todayList.length === 0 ? (
            <Text style={styles.dayEmpty}>Ninguém registrou nada ainda hoje.</Text>
          ) : (
            todayList.slice(0, 8).map((a) => (
              <View key={a.id} style={styles.dayRow}>
                <Text style={styles.dayText} numberOfLines={1}>
                  {describe(a, whoName(a, members, myId), health)}
                </Text>
                <Text style={styles.dayTime}>{timeOf(a.createdAt)}</Text>
              </View>
            ))
          )}
        </View>
      )}

      {next && (
        <Pressable
          onPress={() => router.push('/(tabs)/health')}
          accessibilityRole="button"
          accessibilityHint="Abre a aba Saúde"
          style={({ pressed }) => [styles.nextCard, pressed && { opacity: 0.8 }]}
        >
          <View style={styles.nextIcon}>
            <Icon name={healthIcon(next.item.id)} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nextTitle}>{next.item.name}</Text>
            <Text style={[styles.nextSub, next.status.kind === 'overdue' && styles.nextSubWarn]}>{dueLabel(next.status)}</Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.muted} />
        </Pressable>
      )}
    </Screen>
  );
}

interface TaskCardProps {
  label: string;
  icon: IconName;
  tint: string;
  sub: string;
  done: boolean;
  partial: boolean;
  /** increments on each positive tap to fire the "+XP" float */
  burst: number;
  onPress: () => void;
}

function TaskCard({ label, icon, tint, sub, done, partial, burst, onPress }: TaskCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(1)).current;
  const check = useRef(new Animated.Value(done ? 1 : 0)).current;

  useEffect(() => {
    if (burst === 0) return;
    float.setValue(0);
    Animated.timing(float, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
  }, [burst, float]);

  useEffect(() => {
    Animated.spring(check, { toValue: done ? 1 : 0, friction: 5, tension: 200, useNativeDriver: nativeDriver }).start();
  }, [done, check]);

  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, friction: 5, tension: 300, useNativeDriver: nativeDriver }).start();

  return (
    <Animated.View style={[styles.taskWrap, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => springTo(0.95)}
        onPressOut={() => springTo(1)}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${sub}`}
        accessibilityState={{ checked: done }}
        style={[
          styles.task,
          { backgroundColor: done ? colors.primarySoft : tint, borderColor: done ? colors.primary : partial ? '#C9BEF5' : 'transparent' },
        ]}
      >
        <View style={styles.taskTop}>
          <Icon name={icon} size={28} />
          <Animated.View style={{ opacity: check, transform: [{ scale: check }] }}>
            <Icon name="check" size={22} color={colors.primary} strokeWidth={3} />
          </Animated.View>
        </View>
        <Text style={styles.taskLabel}>{label}</Text>
        <Text style={styles.taskSub}>{sub}</Text>
      </Pressable>

      <Animated.Text
        pointerEvents="none"
        aria-hidden
        style={[
          styles.xp,
          {
            opacity: float.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -36] }) }],
          },
        ]}
      >
        +{XP.task} XP
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  petName: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  petSub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.yellowSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: 36,
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakText: { fontFamily: fonts.black, fontSize: 14, color: colors.ink },
  mascotCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  bubble: {
    alignSelf: 'flex-start',
    marginLeft: 24,
    maxWidth: '85%',
    backgroundColor: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' },
  bond: { alignSelf: 'stretch', gap: 6 },
  bondRow: { flexDirection: 'row', justifyContent: 'space-between' },
  bondLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  notice: { backgroundColor: colors.yellowSoft, borderRadius: radius.md, padding: 14, gap: 4 },
  noticeTitle: { fontFamily: fonts.black, fontSize: 15, color: colors.ink },
  noticeText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink },
  dayCard: { backgroundColor: colors.card, borderRadius: radius.md + 4, padding: 16, gap: 10 },
  dayTitle: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  dayEmpty: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dayText: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  dayTime: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  taskWrap: { width: '47%', flexGrow: 1 },
  task: { borderRadius: 22, borderWidth: 2, padding: 14, gap: 8, minHeight: 112 },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskLabel: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  taskSub: { fontFamily: fonts.body, fontSize: 12, color: colors.subtle },
  xp: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    fontFamily: fonts.black,
    fontSize: 15,
    color: colors.primaryDark,
  },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
  },
  nextIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextTitle: { fontFamily: fonts.black, fontSize: 14, color: colors.ink },
  nextSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  nextSubWarn: { fontFamily: fonts.bold, color: '#A33A12' },
});
