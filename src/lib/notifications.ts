import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { PlannedReminder } from './reminders';

/** Local notifications only; web has no scheduling, so every call is a no-op there. */
export const notificationsSupported = Platform.OS !== 'web';

const CHANNEL = 'reminders';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

let configured = false;

/** Show reminders as banners even while the app is open, and create the Android channel. */
export function configureNotifications() {
  if (!notificationsSupported || configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Lembretes',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
}

export async function getPermission(): Promise<PermissionState> {
  if (!notificationsSupported) return 'unsupported';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status as PermissionState;
  } catch {
    return 'unsupported';
  }
}

/** Asks the OS once; afterwards iOS only answers with the stored choice. */
export async function requestPermission(): Promise<PermissionState> {
  if (!notificationsSupported) return 'unsupported';
  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return status as PermissionState;
  } catch {
    return 'unsupported';
  }
}

/** Replaces every pending reminder with the given plan. */
export async function applyPlan(plan: PlannedReminder[]): Promise<void> {
  if (!notificationsSupported) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (plan.length === 0) return;
  if ((await getPermission()) !== 'granted') return;
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, sound: 'default', data: { url: r.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL },
    });
  }
}
