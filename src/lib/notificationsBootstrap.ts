import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

type ExpoNotificationsModule = typeof import('expo-notifications');

let handlerConfigured = false;

export function isExpoNotificationsNativeAvailable(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  try {
    requireNativeModule('ExpoNotifications');
    return true;
  } catch {
    return false;
  }
}

export function loadExpoNotifications(): ExpoNotificationsModule | null {
  if (!isExpoNotificationsNativeAvailable()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as ExpoNotificationsModule;
  } catch {
    return null;
  }
}

export function ensureNotificationsHandlerConfigured(): void {
  if (handlerConfigured) return;
  const Notifications = loadExpoNotifications();
  if (!Notifications) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerConfigured = true;
  } catch {
    /* native module may not be in this dev build yet */
  }
}

export function isNativeNotificationsError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /native module|runtime not ready|cannot find native module|exponotifications|unavailabilityerror/i.test(
    msg,
  );
}
