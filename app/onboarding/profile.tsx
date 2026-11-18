import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Button } from '@/components/Button';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { Screen } from '@/components/Screen';
import { haptic } from '@/lib/platform';
import type { Sex } from '@/store/types';
import { useOnboardingDraft } from '@/store/useOnboardingDraft';
import { colors, fonts, radius } from '@/theme';

const SEXES: { id: Sex; label: string }[] = [
  { id: 'male', label: 'Macho' },
  { id: 'female', label: 'Fêmea' },
];

/** Keeps digits only and inserts the slash: "032023" → "03/2023". */
function maskBirth(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 6);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

function birthError(birth: string): string | null {
  if (!birth) return null;
  const match = birth.match(/^(\d{2})\/(\d{4})$/);
  if (!match) return 'Use o formato mm/aaaa';
  const month = Number(match[1]);
  const year = Number(match[2]);
  const now = new Date();
  if (month < 1 || month > 12) return 'Mês inválido';
  if (year < now.getFullYear() - 40 || year * 12 + month > now.getFullYear() * 12 + now.getMonth() + 1) {
    return 'Data inválida';
  }
  return null;
}

/** Digits with at most one decimal separator, shown with a comma. */
function maskWeight(text: string): string {
  const cleaned = text.replace('.', ',').replace(/[^\d,]/g, '');
  const [int, ...rest] = cleaned.split(',');
  return rest.length ? `${int.slice(0, 3)},${rest.join('').slice(0, 1)}` : int.slice(0, 3);
}

export default function ProfileStep() {
  const draft = useOnboardingDraft();
  const [touched, setTouched] = useState(false);

  const nameMissing = !draft.name.trim();
  const birthMsg = birthError(draft.birth);
  const canContinue = !nameMissing && !birthMsg;
  const pronoun = draft.sex === 'female' ? 'ela' : 'ele';

  return (
    <Screen scroll>
      <OnboardingHeader step={2} />

      <Text style={styles.title} accessibilityRole="header">
        Conta mais sobre {pronoun}
      </Text>

      <Field
        label="Nome"
        value={draft.name}
        onChangeText={(name) => draft.update({ name })}
        placeholder="Ex.: Thor"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={24}
        returnKeyType="next"
        error={touched && nameMissing ? `Como ${pronoun} se chama?` : null}
      />
      <Field
        label="Raça"
        value={draft.breed}
        onChangeText={(breed) => draft.update({ breed })}
        placeholder="Ex.: SRD, Golden Retriever"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={32}
      />
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field
            label="Nascimento"
            value={draft.birth}
            onChangeText={(t) => draft.update({ birth: maskBirth(t) })}
            placeholder="mm/aaaa"
            keyboardType="number-pad"
            error={draft.birth.length === 7 || touched ? birthMsg : null}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Peso (kg)"
            value={draft.weightKg}
            onChangeText={(t) => draft.update({ weightKg: maskWeight(t) })}
            placeholder="Opcional"
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Sexo</Text>
        <View style={styles.pair} accessibilityRole="radiogroup">
          {SEXES.map((s) => {
            const on = draft.sex === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  haptic.light();
                  draft.update({ sex: s.id });
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <Button
        label="Continuar"
        disabled={touched && !canContinue}
        onPress={() => {
          setTouched(true);
          if (canContinue) router.push('/onboarding/routine');
        }}
      />
    </Screen>
  );
}

function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string | null }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor="#8E8AA8"
        style={[styles.input, focused && styles.inputFocused, !!error && styles.inputError]}
      />
      {!!error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  pair: { flexDirection: 'row', gap: 12 },
  field: { gap: 6 },
  label: { fontFamily: fonts.black, fontSize: 13, color: colors.ink },
  input: {
    minHeight: 52,
    backgroundColor: colors.card,
    borderRadius: radius.sm + 2,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.ink,
  },
  inputFocused: { borderColor: colors.primary },
  inputError: { borderColor: '#C0392B' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#A52A1F' },
  chip: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.sm + 2,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  chipTextOn: { fontFamily: fonts.black, color: colors.primaryDark },
});
