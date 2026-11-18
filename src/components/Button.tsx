import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { nativeDriver } from '@/lib/platform';
import { colors, fonts } from '@/theme';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'yellow' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: '#FFFFFF', border: colors.primary },
  secondary: { bg: colors.card, fg: colors.ink, border: colors.border },
  yellow: { bg: colors.yellow, fg: colors.ink, border: colors.yellow },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
};

export function Button({ label, onPress, variant = 'primary', disabled, icon, style, accessibilityHint }: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const p = palette[variant];

  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, friction: 6, tension: 300, useNativeDriver: nativeDriver }).start();

  return (
    <Animated.View style={[{ alignSelf: 'stretch', transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => springTo(0.97)}
        onPressOut={() => springTo(1)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        accessibilityHint={accessibilityHint}
        style={[
          styles.base,
          variant === 'ghost' && styles.ghost,
          { backgroundColor: p.bg, borderColor: p.border },
          disabled && styles.disabled,
        ]}
      >
        {icon && <Icon name={icon} size={22} color={p.fg} strokeWidth={2.2} />}
        <Text style={[styles.label, variant === 'ghost' && styles.ghostLabel, { color: p.fg }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 2,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ghost: { minHeight: 48 },
  disabled: { opacity: 0.4 },
  label: { fontFamily: fonts.black, fontSize: 17 },
  ghostLabel: { fontFamily: fonts.bold, fontSize: 15 },
});
