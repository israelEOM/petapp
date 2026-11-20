import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { addDays, dateKey, formatShort } from '@/lib/dates';
import { FamilyError, createInvite, inviteLink } from '@/lib/family';
import { de } from '@/lib/pet';
import { haptic } from '@/lib/platform';
import type { Role } from '@/store/useFamily';
import { usePetStore } from '@/store/usePetStore';
import { colors, fonts, radius } from '@/theme';

type InviteRole = Exclude<Role, 'owner'>;

const ROLES: { id: InviteRole; title: string; hint: string }[] = [
  { id: 'caregiver', title: 'Cuidador', hint: 'Registra comida, passeios e saúde, e vê tudo' },
  { id: 'sitter', title: 'Pet sitter', hint: 'Registra só até a data que você escolher' },
  { id: 'viewer', title: 'Só acompanhar', hint: 'Vê tudo o que acontece, mas não registra' },
];

const SITTER_DAYS = [3, 7, 14, 30];
const daysLabel = (n: number) => (n === 7 ? '1 semana' : n === 14 ? '2 semanas' : n === 30 ? '1 mês' : `${n} dias`);

/** End of the sitter's last day (local 23:59). */
function sitterEnd(days: number): Date {
  const [y, m, d] = addDays(dateKey(), days).split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 0);
}

export default function InviteScreen() {
  const pet = usePetStore((s) => s.pet);
  const petId = usePetStore((s) => s.cloudPetId);
  const [role, setRole] = useState<InviteRole>('caregiver');
  const [days, setDays] = useState(7);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const petName = pet ? `${de(pet)} ${pet.name}` : 'do meu pet';
  const back = () => (router.canGoBack() ? router.back() : router.replace('/family'));

  const generate = async () => {
    if (!petId) return;
    setBusy(true);
    setError(null);
    try {
      const c = await createInvite(petId, role, role === 'sitter' ? sitterEnd(days) : null);
      haptic.success();
      setCode(c);
    } catch (e) {
      haptic.error();
      setError(e instanceof FamilyError ? e.message : 'Não deu para criar o convite agora. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const share = () => {
    if (!code) return;
    const roleText = role === 'viewer' ? 'acompanhar' : 'cuidar';
    Share.share({
      message:
        `Vem ${roleText} ${petName} comigo no PetApp! ` +
        `Abra o app, toque em "Tenho um convite" e use o código ${code}. ` +
        `Ou toque no link: ${inviteLink(code)} (vale por 48 horas).`,
    }).catch(() => {});
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={4}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        >
          <Icon name="chevron-left" size={22} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Convidar
        </Text>
      </View>

      {!code ? (
        <>
          <Text style={styles.lead}>Como essa pessoa vai cuidar {petName}?</Text>
          <View style={{ gap: 10 }} accessibilityRole="radiogroup">
            {ROLES.map((r) => {
              const on = r.id === role;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    haptic.light();
                    setRole(r.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={[styles.option, on && styles.optionOn]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.optionTitle}>{r.title}</Text>
                    <Text style={styles.optionHint}>{r.hint}</Text>
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                </Pressable>
              );
            })}
          </View>

          {role === 'sitter' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Por quanto tempo?</Text>
              <View style={styles.chips}>
                {SITTER_DAYS.map((n) => {
                  const on = n === days;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => {
                        haptic.light();
                        setDays(n);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{daysLabel(n)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.optionHint}>Pode registrar até {formatShort(addDays(dateKey(), days))} e depois só vê o histórico.</Text>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
          <Button label={busy ? 'Criando…' : 'Criar convite'} onPress={generate} disabled={busy || !petId} />
        </>
      ) : (
        <>
          <View style={styles.codeCard}>
            <Text style={styles.cardTitle}>Código do convite</Text>
            <Text style={styles.code} accessibilityLabel={`Código ${code.split('').join(' ')}`} selectable>
              {code}
            </Text>
            <View style={styles.qr} aria-hidden>
              <QRCode value={inviteLink(code)} size={180} color={colors.ink} backgroundColor="#FFFFFF" />
            </View>
            <Text style={styles.optionHint}>
              Na outra pessoa: “Tenho um convite” no PetApp, depois digite o código ou leia o QR code. Vale por 48 horas e para uma
              pessoa.
            </Text>
          </View>
          <Button label="Enviar pelo WhatsApp" icon="share" onPress={share} />
          <Button label="Pronto" variant="secondary" onPress={back} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  lead: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 23, color: colors.ink },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md + 4,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionTitle: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  optionHint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  card: { backgroundColor: colors.card, borderRadius: radius.md + 4, padding: 16, gap: 12 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.subtle },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  chipTextOn: { color: colors.primary },
  error: { fontFamily: fonts.bold, fontSize: 14, color: colors.warn },
  codeCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 20, gap: 14, alignItems: 'center' },
  code: { fontFamily: fonts.display, fontSize: 40, letterSpacing: 6, color: colors.primary },
  qr: { padding: 12, backgroundColor: '#FFFFFF', borderRadius: radius.md },
});
