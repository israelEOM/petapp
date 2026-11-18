import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: colors.primary } }} />
      <Stack.Screen name="done" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}
