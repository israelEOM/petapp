import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { Nunito_400Regular, Nunito_700Bold, Nunito_800ExtraBold, useFonts } from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { startPushSync } from '@/lib/pushSync';
import { ReminderSync } from '@/lib/useReminderSync';
import { startSessionSync } from '@/store/useSession';
import { useHydrated } from '@/store/usePetStore';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
startSessionSync();
startPushSync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_600SemiBold,
    Nunito_400Regular,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const hydrated = useHydrated();
  // A font failure shouldn't brick the app: fall back to system fonts.
  const ready = hydrated && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }}>
        <Stack.Screen name="reminders" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="account/sign-in" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="family/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="family/invite" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="family/join" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="family/schedule" options={{ animation: 'slide_from_right' }} />
      </Stack>
      <ReminderSync />
    </SafeAreaProvider>
  );
}
