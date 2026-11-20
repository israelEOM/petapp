import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentType, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Mascot } from '@/components/Mascot';
import { Screen } from '@/components/Screen';
import { FamilyError, codeFromText, isValidCode, normalizeCode } from '@/lib/family';
import { haptic } from '@/lib/platform';
import { usePetStore } from '@/store/usePetStore';
import { accountsEnabled, useSession } from '@/store/useSession';
import { colors, fonts, radius } from '@/theme';

interface ScannerProps {
  onCode: (code: string) => void;
  onClose: () => void;
}

/** The camera module is native: load it only when scanning, so older builds still open this screen. */
function loadScanner(): ComponentType<ScannerProps> | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cam = require('expo-camera') as typeof import('expo-camera');
    return function Scanner({ onCode, onClose }: ScannerProps) {
      const [permission, request] = cam.useCameraPermissions();
      const done = useRef(false);
      useEffect(() => {
        if (permission && !permission.granted && permission.canAskAgain) request();
      }, [permission, request]);

      // Still undecided: the system prompt is up.
      if (!permission || (!permission.granted && permission.canAskAgain)) return null;
      if (!permission.granted) {
        return (
          <View style={styles.card}>
            <Text style={styles.cardText}>Sem acesso à câmera. Você pode digitar o código.</Text>
            <Button label="Digitar código" variant="secondary" onPress={onClose} />
          </View>
        );
      }
      return (
        <View style={styles.scanner}>
          <cam.CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              const code = codeFromText(data);
              if (code && !done.current) {
                done.current = true;
                onCode(code);
              }
            }}
          />
          <View style={styles.scanFrame} pointerEvents="none" />
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar câmera"
            style={({ pressed }) => [styles.scanClose, pressed && { opacity: 0.6 }]}
          >
            <Icon name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      );
    };
  } catch {
    return null;
  }
}

export default function JoinScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const signedIn = useSession((s) => s.session !== null);
  const joinWithCode = useSession((s) => s.joinWithCode);
  const localPet = usePetStore((s) => s.pet);
  const linked = usePetStore((s) => !!s.linkedUserId);
  const [code, setCode] = useState(() => normalizeCode(params.code ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [Scanner, setScanner] = useState<ComponentType<ScannerProps> | null>(null);
  const [scanning, setScanning] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const valid = isValidCode(code);

  const join = async (c: string) => {
    setBusy(true);
    setError(null);
    try {
      await joinWithCode(c);
      haptic.success();
      router.replace('/(tabs)');
    } catch (e) {
      haptic.error();
      setError(e instanceof FamilyError ? e.message : 'Algo deu errado. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const confirmJoin = (c: string) => {
    if (!signedIn) {
      router.push('/account/sign-in');
      return;
    }
    if (!localPet) return join(c);
    Alert.alert(
      'Trocar de pet neste celular?',
      linked
        ? `O ${localPet.name} continua salvo na sua conta, mas este celular passa a mostrar o pet do convite.`
        : `O ${localPet.name} ainda não foi salvo em uma conta e será apagado deste celular.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Entrar na família', onPress: () => join(c) },
      ],
    );
  };

  const openScanner = () => {
    const S = Scanner ?? loadScanner();
    if (!S) {
      setError('A câmera chega na próxima versão do app. Por enquanto, digite o código.');
      return;
    }
    setScanner(() => S);
    setScanning(true);
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
          Tenho um convite
        </Text>
      </View>

      {scanning && Scanner ? (
        <Scanner
          onCode={(c) => {
            haptic.success();
            setScanning(false);
            setCode(c);
            confirmJoin(c);
          }}
          onClose={() => setScanning(false)}
        />
      ) : (
        <>
          <View style={styles.intro}>
            <Mascot size={96} mood="happy" />
            <Text style={styles.lead}>Digite o código de 6 letras que a família te mandou, ou leia o QR code.</Text>
          </View>

          <TextInput
            value={code}
            onChangeText={(t) => {
              setError(null);
              setCode(codeFromText(t) ?? normalizeCode(t));
            }}
            placeholder="ABC123"
            placeholderTextColor="#A9A4C4"
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={40}
            accessibilityLabel="Código do convite"
            style={styles.input}
            onSubmitEditing={() => valid && confirmJoin(code)}
            returnKeyType="go"
          />

          {error && <Text style={styles.error}>{error}</Text>}
          {!accountsEnabled && <Text style={styles.cardText}>Contas ainda não estão disponíveis nesta versão.</Text>}

          <Button
            label={busy ? 'Entrando…' : signedIn ? 'Entrar na família' : 'Entrar na conta para continuar'}
            onPress={() => confirmJoin(code)}
            disabled={busy || !valid || !accountsEnabled}
          />
          <Button label="Ler QR code" icon="qr" variant="secondary" onPress={openScanner} disabled={busy} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  intro: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  lead: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.muted, textAlign: 'center', maxWidth: 320 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 64,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 30,
    letterSpacing: 6,
    color: colors.ink,
  },
  error: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.warn },
  card: { backgroundColor: colors.card, borderRadius: radius.md + 4, padding: 16, gap: 12 },
  cardText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  scanner: { height: 420, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 220, height: 220, borderRadius: 24, borderWidth: 3, borderColor: '#FFFFFF' },
  scanClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
