import { Platform } from 'react-native';

/** Persisted Family Activity selection used for Screen Time / Device Activity monitoring. */
export const DEROT_SELECTION_ID = 'derot_reclaim_selection';

/** Single Device Activity name — no underscores in the name so event keys parse correctly. */
export const DEROT_ACTIVITY_NAME = 'DerotReclaimUsage';

const STEP_MINUTES = [
  30, 60, 90, 120, 150, 180, 210, 240, 300, 360, 420, 480, 540, 600, 720,
];

const UD = {
  trackingStarted: 'DEROT_USAGE_TRACKING_STARTED',
  sampleReady: 'DEROT_SCREEN_TIME_SAMPLE_READY',
  weeklyRolling: 'DEROT_WEEKLY_ROLLING_MINUTES',
  dailyToday: 'DEROT_DAILY_TODAY_MINUTES',
} as const;

export type IosDeviceActivityApi = typeof import('react-native-device-activity');

export function loadIosDeviceActivity(): IosDeviceActivityApi | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-device-activity') as IosDeviceActivityApi;
  } catch {
    return null;
  }
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Recompute daily maxima from threshold events (m30, m60, …) and rolling 7-day sum.
 * Writes totals to the App Group via react-native-device-activity so rotUsageBridge can read them.
 */
export function recomputeDerotUsageTotals(da: IosDeviceActivityApi | null = loadIosDeviceActivity()): void {
  if (!da || !da.isAvailable()) return;

  const events = da.getEvents(DEROT_ACTIVITY_NAME);
  const byDay = new Map<string, number>();

  for (const e of events) {
    if (e.callbackName !== 'eventDidReachThreshold') continue;
    const name = e.eventName ?? '';
    const m = /^m(\d+)$/.exec(name);
    if (!m) continue;
    const minutes = parseInt(m[1], 10);
    if (!Number.isFinite(minutes)) continue;
    const day = localDateKey(e.lastCalledAt);
    byDay.set(day, Math.max(byDay.get(day) ?? 0, minutes));
  }

  const todayKey = localDateKey(new Date());
  const todayMax = byDay.get(todayKey) ?? 0;

  let weeklySum = 0;
  for (let i = 0; i < 7; i += 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    weeklySum += byDay.get(localDateKey(d)) ?? 0;
  }

  da.userDefaultsSet(UD.dailyToday, todayMax);
  da.userDefaultsSet(UD.weeklyRolling, weeklySum);
}

/** Start daily repeating monitoring with minute thresholds for the persisted app selection. */
export async function startDerotScreenTimeTracking(): Promise<void> {
  const da = loadIosDeviceActivity();
  if (!da?.isAvailable()) {
    throw new Error('Screen Time APIs require a native iOS build (not Expo Go).');
  }

  const { AuthorizationStatus, getAuthorizationStatus } = da;
  if (getAuthorizationStatus() !== AuthorizationStatus.approved) {
    throw new Error('Approve Screen Time access first.');
  }

  const token = da.getFamilyActivitySelectionId(DEROT_SELECTION_ID);
  if (!token) {
    throw new Error('Choose at least one app or category to track.');
  }

  const events = STEP_MINUTES.map((minute) => ({
    eventName: `m${minute}`,
    threshold: { minute },
    familyActivitySelection: token,
  }));

  await da.startMonitoring(
    DEROT_ACTIVITY_NAME,
    {
      intervalStart: { hour: 0, minute: 0, second: 0 },
      intervalEnd: { hour: 23, minute: 59, second: 59 },
      repeats: true,
    },
    events,
  );

  da.userDefaultsSet(UD.trackingStarted, true);
  da.reloadDeviceActivityCenter();
  recomputeDerotUsageTotals(da);
}

export function readIosTrackingFlags(da: IosDeviceActivityApi | null = loadIosDeviceActivity()): {
  trackingStarted: boolean;
  sampleReady: boolean;
} {
  if (!da?.isAvailable()) {
    return { trackingStarted: false, sampleReady: false };
  }
  return {
    trackingStarted: da.userDefaultsGet<boolean>(UD.trackingStarted) === true,
    sampleReady: da.userDefaultsGet<boolean>(UD.sampleReady) === true,
  };
}

/**
 * Subscribe to extension callbacks; recompute when thresholds fire (true Screen Time pipeline).
 * Returns unsubscribe.
 */
export function subscribeDerotUsageRecompute(): { remove: () => void } {
  const da = loadIosDeviceActivity();
  if (!da?.isAvailable()) {
    return { remove: () => {} };
  }

  const sub = da.onDeviceActivityMonitorEvent((payload) => {
    if (payload.callbackName === 'eventDidReachThreshold') {
      da.userDefaultsSet(UD.sampleReady, true);
    }
    if (
      payload.callbackName === 'intervalDidStart' ||
      payload.callbackName === 'intervalDidEnd' ||
      payload.callbackName === 'eventDidReachThreshold'
    ) {
      recomputeDerotUsageTotals(da);
    }
  });

  return sub;
}
