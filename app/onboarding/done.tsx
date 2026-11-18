import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Mascot } from '@/components/Mascot';
import { PetAvatar } from '@/components/PetAvatar';
import { Screen } from '@/components/Screen';
import { petSubtitle } from '@/lib/pet';
import { nativeDriver } from '@/lib/platform';
import { useOnboardingDraft } from '@/store/useOnboardingDraft';
import { usePetStore } from '@/store/usePetStore';
import { colors, fonts, radius } from '@/theme';

export default function Done() {
  const pet = usePetStore((s) => s.pet);
  const resetDraft = useOnboardingDraft((s) => s.reset);
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, delay: 250, friction: 6, tension: 90, useNativeDriver: nativeDriver }).start();
  }, [pop]);

  if (!pet) return null;

  const details = [petSubtitle(pet), pet.weightKg && `${pet.weightKg} kg`].filter(Boolean).join(' · ');

  return (
    <Screen scroll contentStyle={styles.content}>
      <Mascot size={150} mood="happy" />

      <View style={styles.copy}>
        <Text style={styles.title} accessibilityRole="header">
          Tudo pronto!
        </Text>
        <Text style={styles.body}>
          {pet.sex === 'female' ? 'A' : 'O'} {pet.name} já tem perfil, rotina e carteirinha. Agora é cuidar e subir de nível
          juntos.
        </Text>
      </View>

      <Animated.View
        style={[
          styles.card,
          { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] },
        ]}
      >
        <PetAvatar name={pet.name} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.petName}>{pet.name}</Text>
          <Text style={styles.petDetails}>{details}</Text>
        </View>
      </Animated.View>

      <View style={{ flex: 1 }} />

      <Button
        label={`Começar o dia com ${pet.sex === 'female' ? 'a' : 'o'} ${pet.name}`}
        onPress={() => {
          resetDraft();
          router.replace('/(tabs)');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingTop: 48, gap: 20 },
  copy: { alignItems: 'center', gap: 6 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.muted, textAlign: 'center', maxWidth: 300 },
  card: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: radius.lg - 4,
    padding: 16,
  },
  petName: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  petDetails: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
});
