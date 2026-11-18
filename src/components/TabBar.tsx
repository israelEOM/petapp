import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { dateKey } from '@/lib/dates';
import { healthStatus } from '@/lib/health';
import { haptic, nativeDriver } from '@/lib/platform';
import { usePetStore } from '@/store/usePetStore';
import { colors, fonts } from '@/theme';

const ICON: Record<string, IconName> = { index: 'home', health: 'heart', achievements: 'trophy' };

const PAD = 6;
const BAR_HEIGHT = 66;

/** True when any health item is overdue or due within a week: drives the dot on Saúde. */
function useHealthAttention() {
  const health = usePetStore((s) => s.health);
  const today = dateKey();
  return health.some((item) => {
    const kind = healthStatus(item, today).kind;
    return kind === 'overdue' || kind === 'soon';
  });
}

export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const attention = useHealthAttention();

  const count = state.routes.length;
  const tabWidth = width > 0 ? (width - PAD * 2) / count : 0;

  useEffect(() => {
    if (!tabWidth) return;
    const to = state.index * tabWidth;
    if (!placed.current) {
      x.setValue(to);
      placed.current = true;
      return;
    }
    Animated.spring(x, { toValue: to, useNativeDriver: nativeDriver, speed: 16, bounciness: 7 }).start();
  }, [state.index, tabWidth, x]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom - 8, 12) }]}>
      <View style={styles.bar} onLayout={onLayout} role="tablist">
        {tabWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.indicator, { width: tabWidth, transform: [{ translateX: x }] }]}
          />
        )}
        {state.routes.map((route, index) => {
          const focused = index === state.index;
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          const dot = route.name === 'health' && attention;

          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptic.light();
              navigateToTab(route.key);
            }
          };

          return (
            <TabItem
              key={route.key}
              label={label}
              icon={ICON[route.name] ?? 'paw'}
              focused={focused}
              dot={dot}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              position={`${index + 1} de ${count}`}
            />
          );
        })}
      </View>
    </View>
  );
}

interface TabItemProps {
  label: string;
  icon: IconName;
  focused: boolean;
  dot: boolean;
  position: string;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({ label, icon, focused, dot, position, onPress, onLongPress }: TabItemProps) {
  const pop = useRef(new Animated.Value(1)).current;
  const press = useRef(new Animated.Value(1)).current;
  const wasFocused = useRef(focused);

  // Hop the icon only when a tab becomes active, not on first render.
  useEffect(() => {
    if (focused && !wasFocused.current) {
      pop.setValue(0.72);
      Animated.spring(pop, { toValue: 1, useNativeDriver: nativeDriver, speed: 14, bounciness: 14 }).start();
    }
    wasFocused.current = focused;
  }, [focused, pop]);

  const pressTo = (toValue: number) =>
    Animated.spring(press, { toValue, useNativeDriver: nativeDriver, speed: 40, bounciness: 0 }).start();

  const tint = focused ? colors.primary : colors.muted;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => pressTo(0.9)}
      onPressOut={() => pressTo(1)}
      role="tab"
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={`${label}${dot ? ', cuidado pendente' : ''}, ${position}`}
      style={styles.item}
    >
      <Animated.View style={[styles.itemInner, { transform: [{ scale: Animated.multiply(pop, press) }] }]}>
        <View>
          <Icon
            name={icon}
            size={24}
            color={tint}
            strokeWidth={focused ? 2.4 : 2}
            fill={focused ? colors.iconFill : 'none'}
          />
          {dot && <View style={styles.dot} />}
        </View>
        <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 8 },
  bar: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    padding: PAD,
    borderRadius: 26,
    backgroundColor: colors.card,
    boxShadow: '0 10px 28px rgba(31, 27, 58, 0.10), 0 2px 6px rgba(31, 27, 58, 0.05)',
  },
  indicator: {
    position: 'absolute',
    top: PAD,
    left: PAD,
    bottom: PAD,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
  },
  item: { flex: 1 },
  itemInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontFamily: fonts.black, fontSize: 12, lineHeight: 16 },
  dot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.alert,
    borderWidth: 2,
    borderColor: colors.card,
  },
});
