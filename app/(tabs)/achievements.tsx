import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { addDays, dateKey } from '@/lib/dates';
import { BADGES, bestStreak, countRun, isComplete, levelInfo } from '@/lib/gamification';
import { confirmDestructive } from '@/lib/platform';
import { useOnboardingDraft } from '@/store/useOnboardingDraft';
import { usePetStore } from '@/store/usePetStore';
import { colors, fonts, radius } from '@/theme';

const WEEKDAY = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const BADGE_TINTS = [colors.purpleSoft, colors.greenSoft, colors.blueSoft, colors.orangeSoft, colors.yellowSoft];

const fmt = (n: number) => n.toLocaleString('pt-BR');

export default function Achievements() {
  const xp = usePetStore((s) => s.xp);
  const logs = usePetStore((s) => s.logs);
  const meals = usePetStore((s) => s.routine.meals);
  const unlocked = usePetStore((s) => s.badges);
  const resetAll = usePetStore((s) => s.resetAll);
  const resetDraft = useOnboardingDraft((s) => s.reset);

  const today = dateKey();
  const level = levelInfo(xp);
  const streak = countRun(logs, today, (l) => isComplete(l, meals));
  const record = Math.max(streak, bestStreak(logs, meals));
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  const wipe = () =>
    confirmDestructive('Apagar dados?', 'Isso apaga o pet, a rotina e todo o progresso deste aparelho.', 'Apagar', () => {
      resetAll();
      resetDraft();
      router.replace('/onboarding');
    });

  return (
    <Screen scroll edges={['top']}>
      <Text style={styles.title} accessibilityRole="header">
        Conquistas
      </Text>

      <View style={styles.levelCard}>
        <View style={styles.levelRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.levelKicker}>Nível {level.level}</Text>
            <Text style={styles.levelName}>{level.name}</Text>
          </View>
          <Text style={styles.levelXp}>
            {fmt(level.into)} / {fmt(level.needed)} XP
          </Text>
        </View>
        <ProgressBar
          progress={level.into / level.needed}
          trackColor="#4330A8"
          fillColor={colors.yellow}
          accessibilityLabel={`${level.into} de ${level.needed} XP para o próximo nível`}
        />
        <Text style={styles.levelTotal}>{fmt(xp)} XP no total</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.streakHead}>
          <Text style={styles.cardTitle}>
            Sequência: {streak} {streak === 1 ? 'dia' : 'dias'}
          </Text>
          <Text style={styles.record}>Recorde: {record}</Text>
        </View>
        <View style={styles.week}>
          {week.map((day) => {
            const complete = isComplete(logs[day], meals);
            const isToday = day === today;
            const weekday = WEEKDAY[new Date(`${day}T12:00:00`).getDay()];
            return (
              <View
                key={day}
                style={styles.day}
                accessible
                accessibilityLabel={`${isToday ? 'Hoje' : day}: ${complete ? 'dia completo' : 'incompleto'}`}
              >
                <View style={[styles.dot, complete && styles.dotOn, isToday && styles.dotToday]}>
                  {complete && <Icon name="check" size={16} color={colors.ink} strokeWidth={3} />}
                </View>
                <Text style={[styles.dayLabel, isToday && { color: colors.ink }]}>{weekday}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <Text style={styles.section} accessibilityRole="header">
        Medalhas
      </Text>
      <View style={styles.badges}>
        {BADGES.map((b, i) => {
          const on = unlocked.includes(b.id);
          return (
            <View
              key={b.id}
              style={[styles.badge, !on && styles.badgeLocked]}
              accessible
              accessibilityLabel={`${b.title}. ${on ? b.description : 'Bloqueada'}`}
            >
              <View style={[styles.badgeIcon, { backgroundColor: on ? BADGE_TINTS[i % BADGE_TINTS.length] : '#E0DDEA' }]}>
                <Icon name={on ? b.icon : 'lock'} size={on ? 30 : 26} color={on ? colors.primary : colors.muted} />
              </View>
              <Text style={[styles.badgeTitle, !on && { color: colors.muted }]}>{b.title}</Text>
            </View>
          );
        })}
      </View>

      {__DEV__ && (
        <View style={styles.dev}>
          <Text style={styles.devLabel}>Desenvolvimento</Text>
          <Button label="Apagar dados" variant="secondary" onPress={wipe} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  levelCard: { backgroundColor: colors.primary, borderRadius: radius.lg - 2, paddingVertical: 18, paddingHorizontal: 20, gap: 12 },
  levelRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  levelKicker: { fontFamily: fonts.bold, fontSize: 13, color: '#E4DEFF' },
  levelName: { fontFamily: fonts.display, fontSize: 24, color: '#FFFFFF' },
  levelXp: { fontFamily: fonts.black, fontSize: 14, color: '#FFFFFF' },
  levelTotal: { fontFamily: fonts.bold, fontSize: 12, color: '#E4DEFF' },
  card: { backgroundColor: colors.card, borderRadius: radius.md + 4, padding: 16, gap: 12 },
  streakHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  record: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 6 },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.locked,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOn: { backgroundColor: colors.yellow },
  dotToday: { borderWidth: 2, borderColor: colors.ink },
  dayLabel: { fontFamily: fonts.black, fontSize: 12, color: colors.muted },
  section: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badge: {
    width: '30.5%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 8,
  },
  badgeLocked: { backgroundColor: colors.locked },
  badgeIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  badgeTitle: { fontFamily: fonts.black, fontSize: 12, lineHeight: 15, textAlign: 'center', color: colors.ink },
  dev: { marginTop: 16, gap: 8 },
  devLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted, textAlign: 'center' },
});
