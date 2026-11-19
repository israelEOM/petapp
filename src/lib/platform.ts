import * as Haptics from 'expo-haptics';
import { Alert, Platform } from 'react-native';

/** The native driver is unavailable on web; Animated falls back to JS there. */
export const nativeDriver = Platform.OS !== 'web';

function safe(run: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  run().catch(() => {});
}

export const haptic = {
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

/** Destructive confirmation that also works on web, where Alert buttons are not supported. */
export function confirmDestructive(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
