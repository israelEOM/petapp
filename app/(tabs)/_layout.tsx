import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { View } from 'react-native';

import { AchievementModal } from '@/components/AchievementModal';
import { TabBar } from '@/components/TabBar';
import { usePetStore } from '@/store/usePetStore';
import { colors } from '@/theme';

export default function TabsLayout() {
  const onboarded = usePetStore((s) => s.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      >
        <Tabs.Screen name="index" options={{ title: 'Hoje' }} />
        <Tabs.Screen name="health" options={{ title: 'Saúde' }} />
        <Tabs.Screen name="achievements" options={{ title: 'Conquistas' }} />
      </Tabs>
      {/* Lives here so badges earned on any tab (e.g. a health record) celebrate right away. */}
      <AchievementModal />
    </View>
  );
}
