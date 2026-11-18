import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { colors } from '@/theme';

interface ProgressBarProps {
  /** 0–1 */
  progress: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  accessibilityLabel?: string;
}

export function ProgressBar({
  progress,
  height = 12,
  trackColor = colors.primarySoft,
  fillColor = colors.primary,
  accessibilityLabel,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const value = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    // Width can't use the native driver.
    Animated.timing(value, {
      toValue: clamped,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clamped, value]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ height, borderRadius: height, backgroundColor: trackColor, overflow: 'hidden' }}
    >
      <Animated.View
        style={{
          height,
          borderRadius: height,
          backgroundColor: fillColor,
          width: value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}
