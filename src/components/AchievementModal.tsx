import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BADGES, type Badge } from '@/lib/gamification';
import { haptic, nativeDriver } from '@/lib/platform';
import { usePetStore } from '@/store/usePetStore';
import { colors, fonts } from '@/theme';
import { Button } from './Button';
import { Icon } from './Icon';
import { Mascot } from './Mascot';

const CONFETTI = [
  { left: 0.08, color: '#FFD25A', delay: 0 },
  { left: 0.23, color: '#FF8A4C', delay: 1200 },
  { left: 0.38, color: '#8FE3B5', delay: 600 },
  { left: 0.56, color: '#B9A8FF', delay: 2000 },
  { left: 0.74, color: '#FFD25A', delay: 300 },
  { left: 0.88, color: '#FF8A4C', delay: 1700 },
];

/** Full-screen celebration for the store's `pendingBadge`. */
export function AchievementModal() {
  const pendingBadge = usePetStore((s) => s.pendingBadge);
  const dismissBadge = usePetStore((s) => s.dismissBadge);
  const insets = useSafeAreaInsets();

  // Keep the last badge while the modal fades out.
  const [badge, setBadge] = useState<Badge | null>(null);
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const next = BADGES.find((b) => b.id === pendingBadge);
    if (!next) return;
    setBadge(next);
    haptic.success();
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: nativeDriver }).start();
  }, [pendingBadge, pop]);

  return (
    <Modal visible={!!pendingBadge} animationType="fade" transparent statusBarTranslucent onRequestClose={dismissBadge}>
      <View style={[styles.root, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
        {pendingBadge && <StatusBar style="light" />}
        {pendingBadge && CONFETTI.map((c, i) => <ConfettiPiece key={i} {...c} />)}

        <Text style={styles.kicker}>CONQUISTA DESBLOQUEADA</Text>

        <Animated.View style={[styles.medal, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
          <Mascot size={160} mood="happy" shadow={false} />
          {badge && (
            <View style={styles.pill}>
              <Icon name={badge.icon} size={18} color={colors.ink} strokeWidth={2.4} />
              <Text style={styles.pillText}>Nova medalha</Text>
            </View>
          )}
        </Animated.View>

        <View style={styles.copy}>
          <Text style={styles.title} accessibilityRole="header">
            {badge?.title}
          </Text>
          <Text style={styles.body}>{badge?.description}</Text>
        </View>

        <View style={{ flex: 1 }} />

        <Button label="Continuar" variant="yellow" onPress={dismissBadge} style={styles.button} />
      </View>
    </Modal>
  );
}

function ConfettiPiece({ left, color, delay }: { left: number; color: string; delay: number }) {
  const { width, height } = useWindowDimensions();
  const fall = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(fall, { toValue: 1, duration: 3600, easing: Easing.linear, useNativeDriver: nativeDriver }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [delay, fall]);

  return (
    <Animated.View
      aria-hidden
      style={[
        styles.confetti,
        {
          left: left * width,
          backgroundColor: color,
          transform: [
            { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [-40, height + 40] }) },
            { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] }) },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2A2152', alignItems: 'center', paddingHorizontal: 24, gap: 20, overflow: 'hidden' },
  kicker: { fontFamily: fonts.black, fontSize: 13, letterSpacing: 1.3, color: colors.yellow },
  medal: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#3B2F70',
    borderWidth: 6,
    borderColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    bottom: -18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.yellow,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: { fontFamily: fonts.black, fontSize: 15, color: colors.ink },
  copy: { alignItems: 'center', gap: 8, marginTop: 16, maxWidth: 320 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 35, color: '#FFFFFF', textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: '#D6D2EE', textAlign: 'center' },
  button: { alignSelf: 'stretch' },
  confetti: { position: 'absolute', top: 0, width: 10, height: 16, borderRadius: 3 },
});
