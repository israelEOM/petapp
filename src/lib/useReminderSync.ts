import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { usePetStore } from '@/store/usePetStore';
import { applyPlan, configureNotifications, notificationsSupported } from './notifications';
import { planReminders } from './reminders';

let queue: Promise<void> = Promise.resolve();

/** Rebuilds the pending reminders from the current state. Calls run one after another. */
export function syncReminders(): Promise<void> {
  queue = queue
    .then(() => {
      const s = usePetStore.getState();
      const plan =
        s.onboarded && s.pet
          ? planReminders({ pet: s.pet, meals: s.routine.meals, logs: s.logs, health: s.health, reminders: s.reminders })
          : [];
      return applyPlan(plan);
    })
    .catch(() => {});
  return queue;
}

/**
 * Mounted once at the root. Keeps scheduled reminders in step with the store (a meal logged
 * cancels its reminder, a health record moves its due date) and rolls the 7-day window forward
 * whenever the app comes back to the foreground. Tapping a reminder opens the matching tab.
 */
export function useReminderSync() {
  useEffect(() => {
    if (!notificationsSupported) return;
    configureNotifications();
    syncReminders();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubStore = usePetStore.subscribe((s, prev) => {
      if (
        s.logs === prev.logs &&
        s.health === prev.health &&
        s.reminders === prev.reminders &&
        s.routine === prev.routine &&
        s.pet === prev.pet &&
        s.onboarded === prev.onboarded
      )
        return;
      clearTimeout(timer);
      timer = setTimeout(syncReminders, 400);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncReminders();
    });
    return () => {
      clearTimeout(timer);
      unsubStore();
      appState.remove();
    };
  }, []);

  // notificationsSupported never changes at runtime, so the hook order is stable.
  const response = notificationsSupported ? Notifications.useLastNotificationResponse() : null;
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const url = response.notification.request.content.data?.url;
    if (url !== '/health' || !usePetStore.getState().onboarded) return;
    // Let the initial redirect settle before switching tabs on a cold start.
    const t = setTimeout(() => router.navigate('/(tabs)/health'), 0);
    return () => clearTimeout(t);
  }, [response]);
}

/** Renders nothing; mount inside the root navigator once fonts and storage are ready. */
export function ReminderSync() {
  useReminderSync();
  return null;
}
