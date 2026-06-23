import { Linking, Platform } from 'react-native';
import {
  ensureNotificationsHandlerConfigured,
  isNativeNotificationsError,
  loadExpoNotifications,
} from './notificationsBootstrap';
import {
  ensureDerotScreenTimeSelection,
  isIosDeviceActivityAvailable,
  isIosScreenTimeApproved,
  loadIosDeviceActivity,
  setScreenTimeRuntimeReady,
  tryEnsureDerotScreenTimeTracking,
} from './derotIosScreenTime';

type ExpoNotificationsModule = typeof import('expo-notifications');

export type ScreenTimeConnectResult = {
  ok: boolean;
  approved: boolean;
  reason?: 'unavailable' | 'denied' | 'error';
  message?: string;
};

export type NotificationsConnectResult = {
  ok: boolean;
  granted: boolean;
  reason?: 'unavailable' | 'denied' | 'error';
  message?: string;
  openSettings?: boolean;
};

const NOTIFICATION_REQUEST = {
  ios: {
    allowAlert: true,
    allowBadge: true,
    allowSound: true,
  },
} as const;

function isNotificationsGranted(
  Notifications: ExpoNotificationsModule,
  status: import('expo-notifications').NotificationPermissionsStatus,
): boolean {
  return (
    status.granted ||
    status.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function requestOnboardingNotifications(): Promise<NotificationsConnectResult> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { ok: true, granted: false, reason: 'unavailable' };
  }

  const Notifications = loadExpoNotifications();
  if (!Notifications) {
    return { ok: true, granted: false, reason: 'unavailable' };
  }

  ensureNotificationsHandlerConfigured();

  try {
    const existing = await Notifications.getPermissionsAsync();
    if (isNotificationsGranted(Notifications, existing)) {
      return { ok: true, granted: true };
    }

    const blockedOnIos =
      Platform.OS === 'ios' &&
      existing.ios?.status === Notifications.IosAuthorizationStatus.DENIED;

    if (blockedOnIos) {
      return {
        ok: true,
        granted: false,
        reason: 'denied',
        openSettings: true,
      };
    }

    const result = await Notifications.requestPermissionsAsync(NOTIFICATION_REQUEST);
    if (isNotificationsGranted(Notifications, result)) {
      return { ok: true, granted: true };
    }

    const deniedAfterRequest =
      Platform.OS === 'ios' && result.ios?.status === Notifications.IosAuthorizationStatus.DENIED;

    return {
      ok: true,
      granted: false,
      reason: 'denied',
      openSettings: deniedAfterRequest,
    };
  } catch (e) {
    if (isNativeNotificationsError(e)) {
      return { ok: true, granted: false, reason: 'unavailable' };
    }

    return { ok: true, granted: false, reason: 'error' };
  }
}

export async function openOnboardingNotificationSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    /* user can open Settings manually */
  }
}

export async function requestOnboardingScreenTime(): Promise<ScreenTimeConnectResult> {
  if (Platform.OS !== 'ios') {
    return {
      ok: false,
      approved: false,
      reason: 'unavailable',
      message: 'Screen Time is only available on iPhone.',
    };
  }

  setScreenTimeRuntimeReady(true);

  if (!isIosDeviceActivityAvailable()) {
    return {
      ok: false,
      approved: false,
      reason: 'unavailable',
      message: 'Screen Time requires a native iOS build. Open UNROT from your installed dev client.',
    };
  }

  const da = loadIosDeviceActivity();
  if (!da) {
    return {
      ok: false,
      approved: false,
      reason: 'unavailable',
      message: 'Screen Time is not available in this build.',
    };
  }

  try {
    const { AuthorizationStatus, getAuthorizationStatus, requestAuthorization } = da;
    await requestAuthorization('individual');

    const approved = getAuthorizationStatus() === AuthorizationStatus.approved;
    if (!approved) {
      return {
        ok: false,
        approved: false,
        reason: 'denied',
        message: 'Allow Screen Time when iOS asks, then tap connect again.',
      };
    }

    ensureDerotScreenTimeSelection(da);
    await tryEnsureDerotScreenTimeTracking();
    return { ok: true, approved: true };
  } catch (e) {
    return {
      ok: false,
      approved: isIosScreenTimeApproved(),
      reason: 'error',
      message: e instanceof Error ? e.message : 'Could not connect Screen Time.',
    };
  }
}
