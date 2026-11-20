import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { dateKey, formatShort } from '@/lib/dates';
import { FamilyError, removeMember, setMemberRole } from '@/lib/family';
import { de } from '@/lib/pet';
import { haptic } from '@/lib/platform';
import { syncNow } from '@/lib/sync';
import { useAccess } from '@/lib/useAccess';
import { type Member, ROLE_LABEL, sitterExpired, useFamily } from '@/store/useFamily';
import { usePetStore } from '@/store/usePetStore';
import { useSession } from '@/store/useSession';
import { colors, fonts, radius } from '@/theme';

function roleLine(m: Member): string {
  if (m.role !== 'sitter' || !m.expiresAt) return ROLE_LABEL[m.role];
  const end = formatShort(dateKey(new Date(m.expiresAt)));
  return sitterExpired(m) ? `Pet sitter · terminou em ${end}` : `Pet sitter · até ${end}`;
}

export default function FamilyScreen() {
  const pet = usePetStore((s) => s.pet);
  const petId = usePetStore((s) => s.cloudPetId);
  const members = useFamily((s) => s.members);
  const removed = useFamily((s) => s.removed);
  const userId = useSession((s) => s.session?.user.id ?? null);
  const leaveFamily = useSession((s) => s.leaveFamily);
  const access = useAccess();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const linked = !!access.me;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      haptic.success();
      syncNow();
    } catch (e) {
      haptic.error();
      setError(e instanceof FamilyError ? e.message : 'Algo deu errado. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const manage = (m: Member) => {
    if (!access.isOwner || m.userId === userId || !petId) return;
    haptic.light();
    const first = m.name.split(' ')[0];
    Alert.alert(m.name, roleLine(m), [
      ...(m.role !== 'caregiver'
        ? [{ text: 'Tornar cuidador', onPress: () => run(() => setMemberRole(petId, m.userId, 'caregiver')) }]
        : []),
      ...(m.role !== 'viewer'
        ? [{ text: 'Só acompanhar', onPress: () => run(() => setMemberRole(petId, m.userId, 'viewer')) }]
        : []),
      {
        text: `Remover ${first}`,
        style: 'destructive' as const,
        onPress: () =>
          Alert.alert(`Remover ${first}?`, `${first} deixa de ver e registrar os cuidados ${pet ? `${de(pet)} ${pet.name}` : ''}.`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Remover', style: 'destructive', onPress: () => run(() => removeMember(petId, m.userId)) },
          ]),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const leave = () =>
    Alert.alert(
      removed ? 'Apagar do celular?' : 'Sair da família?',
      `Os dados ${pet ? `${de(pet)} ${pet.name}` : 'do pet'} saem deste celular. Para voltar, peça um novo convite.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: removed ? 'Apagar' : 'Sair',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              await leaveFamily();
              router.replace('/');
            }),
        },
      ],
    );

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
          Família
        </Text>
      </View>

      {removed ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Você não faz mais parte desta família</Text>
          <Text style={styles.noticeText}>O tutor removeu seu acesso. Os dados ainda estão neste celular, mas não sincronizam mais.</Text>
          <Button label="Apagar do celular" variant="secondary" onPress={leave} disabled={busy} />
        </View>
      ) : !linked ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Cuide junto com a família</Text>
          <Text style={styles.noticeText}>
            Entre na sua conta para convidar quem também cuida {pet ? `${de(pet)} ${pet.name}` : 'do seu pet'}.
          </Text>
          <Button label="Criar conta ou entrar" onPress={() => router.push('/account/sign-in')} />
        </View>
      ) : (
        <>
          <Text style={styles.lead}>
            Quem cuida {pet ? `${de(pet)} ${pet.name}` : 'do pet'}. Todo mundo vê o que os outros registraram, na hora.
          </Text>

          <View style={styles.card}>
            {members.map((m, i) => {
              const mine = m.userId === userId;
              const tappable = access.isOwner && !mine;
              return (
                <Pressable
                  key={m.userId}
                  onPress={() => manage(m)}
                  disabled={!tappable || busy}
                  accessibilityRole={tappable ? 'button' : undefined}
                  accessibilityLabel={`${m.name}${mine ? ', você' : ''}. ${roleLine(m)}`}
                  accessibilityHint={tappable ? 'Mudar papel ou remover' : undefined}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && { opacity: 0.6 }]}
                >
                  <View style={styles.avatar} aria-hidden>
                    <Text style={styles.avatarText}>{m.name.trim().charAt(0).toUpperCase() || '?'}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {m.name}
                      {mine ? ' (você)' : ''}
                    </Text>
                    <Text style={[styles.role, sitterExpired(m) && styles.roleWarn]}>{roleLine(m)}</Text>
                  </View>
                  {tappable && <Icon name="chevron-right" size={18} color={colors.muted} />}
                </Pressable>
              );
            })}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          {access.isOwner ? (
            <Button label="Convidar alguém" icon="plus" onPress={() => router.push('/family/invite')} disabled={busy} />
          ) : (
            <Button label="Sair da família" variant="secondary" onPress={leave} disabled={busy} />
          )}

          <View style={styles.roles}>
            <Text style={styles.rolesTitle}>Papéis</Text>
            <Text style={styles.rolesText}>
              <Text style={styles.rolesStrong}>Cuidador</Text> registra tudo. <Text style={styles.rolesStrong}>Pet sitter</Text> registra até a data
              combinada. <Text style={styles.rolesStrong}>Só acompanha</Text> vê tudo, mas não registra.
            </Text>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  lead: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: radius.md + 4, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 17, color: colors.primary },
  name: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  role: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  roleWarn: { color: colors.warn, fontFamily: fonts.bold },
  error: { fontFamily: fonts.bold, fontSize: 14, color: colors.warn },
  notice: { backgroundColor: colors.card, borderRadius: radius.md + 4, padding: 16, gap: 10 },
  noticeTitle: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  noticeText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  roles: { gap: 4, paddingHorizontal: 4 },
  rolesTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.subtle },
  rolesText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted },
  rolesStrong: { fontFamily: fonts.bold, color: colors.subtle },
});
