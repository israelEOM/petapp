import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Mascot } from '@/components/Mascot';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { ReminderSettings } from '@/components/ReminderSettings';
import { Screen } from '@/components/Screen';
import { requestPermission } from '@/lib/notifications';
import { applyAnswer } from '@/lib/health';
import { defaultHealth } from '@/lib/pet';
import { haptic } from '@/lib/platform';
import { defaultReminders } from '@/lib/reminders';
import type { Reminders } from '@/store/types';
import { useOnboardingDraft } from '@/store/useOnboardingDraft';
import { usePetStore } from '@/store/usePetStore';
import { colors, fonts } from '@/theme';

export default function RemindersStep() {
  const draft = useOnboardingDraft();
  const completeOnboarding = usePetStore((s) => s.completeOnboarding);
  const [reminders, setReminders] = useState<Reminders>(() => defaultReminders(draft.meals));
  const [busy, setBusy] = useState(false);
  const name = draft.name.trim();

  const finish = (enabled: boolean) => {
    completeOnboarding(
      {
        name,
        species: draft.species,
        breed: draft.breed.trim(),
        birth: draft.birth,
        weightKg: draft.weightKg,
        sex: draft.sex,
      },
      { meals: draft.meals, walkMinutes: draft.walkMinutes },
      { ...reminders, enabled },
      defaultHealth(draft.species).map((item) => applyAnswer(item, draft.health[item.id])),
    );
    haptic.success();
    router.replace('/onboarding/done');
  };

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    await requestPermission();
    setBusy(false);
    // Keep the choice even if the OS said no: the Lembretes screen explains how to allow it later.
    finish(true);
  };

  return (
    <Screen scroll>
      <OnboardingHeader step={5} />

      <View style={styles.heading}>
        <Mascot size={96} mood="happy" />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.title} accessibilityRole="header">
            Quer que eu te lembre?
          </Text>
          <Text style={styles.subtitle}>Eu aviso na hora da comida e antes das vacinas. Dá para mudar depois.</Text>
        </View>
      </View>

      <ReminderSettings value={reminders} meals={draft.meals} onChange={(patch) => setReminders((r) => ({ ...r, ...patch }))} />

      <View style={{ flex: 1 }} />

      <View style={styles.actions}>
        <Button label="Ativar lembretes" onPress={enable} disabled={busy} />
        <Button label="Agora não" variant="ghost" onPress={() => finish(false)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted },
  actions: { gap: 4 },
});
