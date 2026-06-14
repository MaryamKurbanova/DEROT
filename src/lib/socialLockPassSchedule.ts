import { Platform } from 'react-native';
import { getMonitoredPassUntil, getPassDurationMs } from './accessPass';
import { loadIosDeviceActivity } from './derotIosScreenTime';

/** No underscores — event keys parse correctly in react-native-device-activity. */
export const SOCIAL_PASS_ACTIVITY_NAME = 'DerotSocialPass';

const SOCIAL_LOCK_SELECTION_ID = 'derot_social_entertainment_lock';

/** Apple rejects DeviceActivity schedules shorter than 15 minutes. */
const MIN_MONITOR_WINDOW_MS = 15 * 60 * 1000;

export const UD = {
  socialLockEnabled: 'derot_social_lock_enabled',
  passUntilMs: 'derot_social_pass_until_ms',
} as const;

type ClockParts = {
  hour: number;
  minute: number;
  second: number;
};

let armedUntilMs: number | null = null;

function toClockParts(d: Date): ClockParts {
  return {
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
  };
}

/**
 * iOS requires a >= 15 min monitoring window. For shorter passes, start the window
 * in the past so intervalDidEnd still fires exactly at `untilMs`.
 */
export function buildPassMonitorWindow(untilMs: number, nowMs: number = Date.now()): {
  start: Date;
  end: Date;
} {
  const end = new Date(untilMs);
  const remainingMs = Math.max(untilMs - nowMs, 1_000);

  if (remainingMs >= MIN_MONITOR_WINDOW_MS) {
    return { start: new Date(nowMs), end };
  }

  return {
    start: new Date(untilMs - MIN_MONITOR_WINDOW_MS),
    end,
  };
}

/** Mirror toggle state into the App Group so extensions can read it. */
export function syncSocialLockFlagToNative(enabled: boolean): void {
  if (Platform.OS !== 'ios') return;
  const da = loadIosDeviceActivity();
  da?.userDefaultsSet(UD.socialLockEnabled, enabled ? 1 : 0);
}

const PASS_RELOCK_ACTIONS = [
  {
    type: 'removeSelectionFromWhitelist' as const,
    familyActivitySelection: { activitySelectionId: SOCIAL_LOCK_SELECTION_ID },
  },
  {
    type: 'blockSelection' as const,
    familyActivitySelectionId: SOCIAL_LOCK_SELECTION_ID,
  },
];

/**
 * Ask iOS Device Activity to re-lock when the post-log window ends — works even when UNROT
 * is backgrounded or closed (same mechanism as night quiet hours).
 */
export async function scheduleSocialLockPassRelock(fromMs: number, untilMs: number): Promise<void> {
  if (Platform.OS !== 'ios') return;
  if (armedUntilMs === untilMs) return;

  const da = loadIosDeviceActivity();
  if (!da?.isAvailable()) return;

  const { start, end } = buildPassMonitorWindow(untilMs, fromMs);

  // Write deadline before stopMonitoring — stop can fire intervalDidEnd early.
  da.userDefaultsSet(UD.passUntilMs, untilMs);
  armedUntilMs = untilMs;

  da.stopMonitoring([SOCIAL_PASS_ACTIVITY_NAME]);
  da.cleanUpAfterActivity(SOCIAL_PASS_ACTIVITY_NAME);

  const relockActions = PASS_RELOCK_ACTIONS.map((action) => ({
    ...action,
    neverTriggerBefore: new Date(untilMs),
  }));

  da.configureActions({
    activityName: SOCIAL_PASS_ACTIVITY_NAME,
    callbackName: 'intervalDidEnd',
    actions: relockActions,
  });

  try {
    await da.startMonitoring(
      SOCIAL_PASS_ACTIVITY_NAME,
      {
        intervalStart: toClockParts(start),
        intervalEnd: toClockParts(end),
        repeats: false,
      },
      [],
    );
    da.reloadDeviceActivityCenter();
  } catch (e) {
    armedUntilMs = null;
    if (__DEV__) {
      console.warn('scheduleSocialLockPassRelock', e);
    }
  }
}

export function cancelSocialLockPassRelockSchedule(): void {
  armedUntilMs = null;
  if (Platform.OS !== 'ios') return;
  const da = loadIosDeviceActivity();
  if (!da?.isAvailable()) return;

  da.stopMonitoring([SOCIAL_PASS_ACTIVITY_NAME]);
  da.cleanUpAfterActivity(SOCIAL_PASS_ACTIVITY_NAME);
  da.userDefaultsRemove(UD.passUntilMs);
  try {
    da.reloadDeviceActivityCenter();
  } catch {
    /* ignore */
  }
}

/** Re-arm native re-lock after relaunch if a pass is still active. */
export async function rescheduleSocialLockPassRelockIfActive(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const until = await getMonitoredPassUntil();
  if (until == null || until <= Date.now()) {
    cancelSocialLockPassRelockSchedule();
    return;
  }

  const duration = await getPassDurationMs();
  await scheduleSocialLockPassRelock(until - duration, until);
}
