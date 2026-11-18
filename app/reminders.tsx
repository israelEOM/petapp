import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ReminderSettings, ToggleRow } from '@/components/ReminderSettings';
import { Screen } from '@/components/Screen';
import { getPermission, requestPermission, type PermissionState } from '@/lib/notifications';
import { usePetStore } from '@/store/usePetStore';
import { colors, fonts, radius } from '@/theme';

export default function RemindersScreen() {
  const reminders = usePetStore((s) => s.reminders);
  const meals = usePetStore((s) => s.routine.meals);
  const setReminders = usePetStore((s) => s.setReminders);
  const [permission, setPermission] = useState<PermissionState | null>(null);

  const refresh = useCallback(() => {
    getPermission().then(setPermission);
  }, []);

  // Re-check when coming back from the system Settings app.
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const toggle = async (on: boolean) => {
    if (!on) return setReminders({ enabled: false });
    const status = permission === 'granted' ? permission : await requestPermission();
    setPermission(status);
    setReminders({ enabled: true });
  };

  const blocked = reminders.enabled && permission === 'denied';
  const unsupported = permission === 'unsupported';

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={4}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        >
          <Icon name="chevron-left" size={22} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Lembretes
        </Text>
      </View>

      <View style={styles.card}>
        <ToggleRow
          title="Lembretes ativados"
          hint="Avisos no celular, mesmo com o app fechado"
          value={reminders.enabled}
          disabled={unsupported}
          onValueChange={toggle}
        />
      </View>

      {unsupported && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Lembretes funcionam no app do celular. Abra o PetApp no iPhone ou Android para ativar.</Text>
        </View>
      )}

      {blocked && (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Text style={styles.noticeTitle}>As notificações estão bloqueadas</Text>
          <Text style={styles.noticeText}>Libere nos Ajustes do celular para os lembretes chegarem.</Text>
          <Button label="Abrir Ajustes" variant="secondary" onPress={() => Linking.openSettings()} />
        </View>
      )}

      <ReminderSettings
        value={reminders}
        meals={meals}
        onChange={setReminders}
        disabled={!reminders.enabled || unsupported}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  card: { backgroundColor: colors.card, borderRadius: radius.md + 4, paddingHorizontal: 16, paddingVertical: 6 },
  notice: { backgroundColor: colors.orangeSoft, borderRadius: radius.md, padding: 16, gap: 8 },
  noticeTitle: { fontFamily: fonts.black, fontSize: 15, color: colors.ink },
  noticeText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
});
