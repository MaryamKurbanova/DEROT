import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getHomeSyncedTodayMinutes, saveHomeSyncedTodayMinutes } from './screenTimeHomeSync';

/** Persisted Family Activity selection used for Screen Time / Device Activity monitoring. */
export const DEROT_SELECTION_ID = 'derot_reclaim_selection';

/** Single Device Activity name — no underscores in the name so event keys parse correctly. */
export const DEROT_ACTIVITY_NAME = 'DerotReclaimUsage';

const STEP_MINUTES = [
  1, 5, 10, 15, 30, 60, 90, 120, 150, 180, 210, 240, 300, 360, 420, 480, 540, 600, 720,
];

const UD = {
  trackingStarted: 'DEROT_USAGE_TRACKING_STARTED',
  sampleReady: 'DEROT_SCREEN_TIME_SAMPLE_READY',
  weeklyRolling: 'DEROT_WEEKLY_ROLLING_MINUTES',
  dailyToday: 'DEROT_DAILY_TODAY_MINUTES',
  /** Written by DerotDeviceActivityReport extension (true daily total from Screen Time). */
  reportToday: 'DEROT_REPORT_TODAY_MINUTES',
  reportUpdatedAt: 'DEROT_REPORT_TODAY_UPDATED_AT',
} as const;

export type IosDeviceActivityApi = typeof import('react-native-device-activity');

function isNativeRuntimeError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /runtime not ready|not ready|RangeError/i.test(msg);
}

const CACHE_DATE_KEY = 'derot_cached_today_screen_date';
const CACHE_MINUTES_KEY = 'derot_cached_today_screen_minutes';

/** Allow reads on first paint; native calls are wrapped in try/catch. */
let screenTimeRuntimeReady = true;

/** Unlock Screen Time bridge access after app boot has settled. */
export function setScreenTimeRuntimeReady(ready: boolean): void {
  screenTimeRuntimeReady = ready || Platform.OS !== 'ios';
}

export function isScreenTimeRuntimeReady(): boolean {
  return screenTimeRuntimeReady || Platform.OS !== 'ios';
}

export function loadIosDeviceActivity(): IosDeviceActivityApi | null {
  if (Platform.OS !== 'ios') return null;
  if (!isScreenTimeRuntimeReady()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-device-activity') as IosDeviceActivityApi;
  } catch (e) {
    if (!isNativeRuntimeError(e)) {
      console.warn('loadIosDeviceActivity', e);
    }
    return null;
  }
}

function withDeviceActivity<T>(fallback: T, fn: (da: IosDeviceActivityApi) => T): T {
  try {
    const da = loadIosDeviceActivity();
    if (!da?.isAvailable()) return fallback;
    return fn(da);
  } catch (e) {
    if (isNativeRuntimeError(e)) return fallback;
    console.warn('withDeviceActivity', e);
    return fallback;
  }
}

export function isIosDeviceActivityAvailable(): boolean {
  return withDeviceActivity(false, () => true);
}

export function isIosScreenTimeApproved(): boolean {
  return withDeviceActivity(false, (da) => {
    const { AuthorizationStatus, getAuthorizationStatus } = da;
    return getAuthorizationStatus() === AuthorizationStatus.approved;
  });
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function readReportTodayMinutes(da: IosDeviceActivityApi): number {
  const report = da.userDefaultsGet<number>(UD.reportToday);
  return typeof report === 'number' && Number.isFinite(report) ? Math.max(0, Math.round(report)) : 0;
}

function readThresholdTodayMinutes(da: IosDeviceActivityApi): number {
  const events = da.getEvents(DEROT_ACTIVITY_NAME);
  const todayKey = localDateKey(new Date());
  let thresholdToday = 0;
  for (const e of events) {
    if (e.callbackName !== 'eventDidReachThreshold') continue;
    const name = e.eventName ?? '';
    const m = /^m(\d+)$/.exec(name);
    if (!m) continue;
    const minutes = parseInt(m[1], 10);
    if (!Number.isFinite(minutes)) continue;
    if (localDateKey(e.lastCalledAt) === todayKey) {
      thresholdToday = Math.max(thresholdToday, minutes);
    }
  }
  return thresholdToday;
}

/**
 * Apple's daily total when available; otherwise highest threshold step recorded today.
 * Works with react-native-device-activity alone — no custom report module required.
 */
function readStoredDailyMinutes(da: IosDeviceActivityApi): number {
  const dailyRaw = da.userDefaultsGet<number>(UD.dailyToday);
  return typeof dailyRaw === 'number' && Number.isFinite(dailyRaw) ? Math.max(0, Math.round(dailyRaw)) : 0;
}

function readBestTodayMinutes(da: IosDeviceActivityApi): number {
  const report = readReportTodayMinutes(da);
  if (report > 0) return report;
  return Math.max(readThresholdTodayMinutes(da), readStoredDailyMinutes(da));
}

/** Base64 JSON `{}` — decodes to an empty FamilyActivitySelection (all-device monitoring). */
const EMPTY_DEVICE_ACTIVITY_SELECTION = 'e30=';

/** Store a full-device selection token so monitoring works without an app picker. */
export function ensureDerotScreenTimeSelection(da: IosDeviceActivityApi): string | undefined {
  const existing = da.getFamilyActivitySelectionId(DEROT_SELECTION_ID);
  if (existing) return existing;

  try {
    da.setFamilyActivitySelectionId({
      id: DEROT_SELECTION_ID,
      familyActivitySelection: EMPTY_DEVICE_ACTIVITY_SELECTION,
    });
    return da.getFamilyActivitySelectionId(DEROT_SELECTION_ID) ?? EMPTY_DEVICE_ACTIVITY_SELECTION;
  } catch {
    return undefined;
  }
}

function authoritativeTodayMinutes(da: IosDeviceActivityApi): number {
  return readBestTodayMinutes(da);
}

/**
 * Recompute daily maxima from threshold events (m30, m60, …) and rolling 7-day sum.
 * Writes totals to the App Group via react-native-device-activity so rotUsageBridge can read them.
 */
export function recomputeDerotUsageTotals(da: IosDeviceActivityApi | null = loadIosDeviceActivity()): void {
  try {
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
    const thresholdToday = byDay.get(todayKey) ?? 0;
    const reportMinutes = readReportTodayMinutes(da);
    const todayMax = reportMinutes > 0 ? reportMinutes : thresholdToday;

    let weeklySum = 0;
    for (let i = 0; i < 7; i += 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = localDateKey(d);
      const dayMinutes = key === todayKey ? todayMax : (byDay.get(key) ?? 0);
      weeklySum += dayMinutes;
    }

    da.userDefaultsSet(UD.dailyToday, todayMax);
    da.userDefaultsSet(UD.weeklyRolling, weeklySum);
    if (todayMax > 0) {
      da.userDefaultsSet(UD.sampleReady, true);
    }
  } catch (e) {
    if (!isNativeRuntimeError(e)) console.warn('recomputeDerotUsageTotals', e);
  }
}

/** Call before reading home-screen stats so report + threshold totals are merged. */
export function syncDerotUsageFromPhone(): void {
  setScreenTimeRuntimeReady(true);
  withDeviceActivity(undefined, (da) => {
    da.reloadDeviceActivityCenter?.();
    recomputeDerotUsageTotals(da);
    return undefined;
  });
}

function persistTodayScreenCache(minutes: number): void {
  if (minutes < 1) return;
  const today = localDateKey(new Date());
  void AsyncStorage.multiSet([
    [CACHE_DATE_KEY, today],
    [CACHE_MINUTES_KEY, String(minutes)],
  ]).catch(() => undefined);
}

/** Last persisted today total — instant fallback while Apple's report refreshes. */
export async function readCachedTodayScreenMinutes(): Promise<number> {
  try {
    const today = localDateKey(new Date());
    const rows = await AsyncStorage.multiGet([CACHE_DATE_KEY, CACHE_MINUTES_KEY]);
    const dateRaw = rows[0]?.[1];
    const minRaw = rows[1]?.[1];
    if (dateRaw === today && minRaw != null) {
      const m = parseInt(minRaw, 10);
      if (Number.isFinite(m) && m > 0) return m;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

/** Synchronous read from app-group storage (Apple Screen Time pipeline). */
export function readInstantTodayScreenMinutes(): number {
  if (Platform.OS !== 'ios') return 0;
  setScreenTimeRuntimeReady(true);
  try {
    return readDerotTodayUsageMinutes();
  } catch {
    return 0;
  }
}

export function readIosScreenTimeUiSnapshot(): {
  trackingStarted: boolean;
  hasSelection: boolean;
} {
  if (Platform.OS !== 'ios') return { trackingStarted: false, hasSelection: false };
  try {
    const flags = readIosTrackingFlags();
    return {
      trackingStarted: flags.trackingStarted,
      hasSelection: hasDerotActivitySelection(),
    };
  } catch {
    return { trackingStarted: false, hasSelection: false };
  }
}

/** Where today's home number comes from — useful when UI shows 0m. */
export function readDerotScreenTimeBreakdown(): {
  approved: boolean;
  trackingStarted: boolean;
  hasSelection: boolean;
  sampleReady: boolean;
  reportMinutes: number;
  thresholdMinutes: number;
  storedDaily: number;
} {
  const empty = {
    approved: false,
    trackingStarted: false,
    hasSelection: false,
    sampleReady: false,
    reportMinutes: 0,
    thresholdMinutes: 0,
    storedDaily: 0,
  };
  if (Platform.OS !== 'ios') return empty;

  setScreenTimeRuntimeReady(true);
  const da = loadIosDeviceActivity();
  if (!da?.isAvailable()) return empty;

  try {
    const flags = readIosTrackingFlags(da);
    const reportMinutes = readReportTodayMinutes(da);
    const thresholdMinutes = readThresholdTodayMinutes(da);

    const dailyRaw = da.userDefaultsGet<number>(UD.dailyToday);
    const storedDaily =
      typeof dailyRaw === 'number' && Number.isFinite(dailyRaw) ? Math.max(0, dailyRaw) : 0;

    return {
      approved: isIosScreenTimeApproved(),
      trackingStarted: flags.trackingStarted,
      hasSelection: hasDerotActivitySelection(),
      sampleReady: flags.sampleReady,
      reportMinutes,
      thresholdMinutes,
      storedDaily,
    };
  } catch {
    return empty;
  }
}

/** Enable bridge + merge report/threshold totals; returns today's minutes. */
export function pullTodayScreenTimeMinutes(): number {
  syncDerotUsageFromPhone();
  const da = loadIosDeviceActivity();
  if (!da?.isAvailable()) return 0;
  const minutes = authoritativeTodayMinutes(da);
  if (minutes > 0) {
    persistTodayScreenCache(minutes);
  }
  return minutes;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type ScreenTimeFetchMode = 'fast' | 'standard' | 'deep' | 'sync';

const FETCH_WAITS: Record<ScreenTimeFetchMode, number[]> = {
  /** Settings tap — return cached report instantly, short poll if needed. */
  fast: [0, 200, 450, 900],
  /** Home deep refresh — balanced wait. */
  standard: [0, 300, 700, 1500, 2500],
  /** Pull-to-refresh — allow report to settle. */
  deep: [0, 400, 900, 1800, 3000, 5000],
  /** Settings manual sync — poll Device Activity while today's total loads. */
  sync: [0, 200, 500, 1000, 2000, 3500],
};

/** Poll app-group storage while DeviceActivityReport loads (today's total from Apple). */
export async function fetchTodayScreenTimeWithRetry(
  mode: ScreenTimeFetchMode = 'standard',
  options?: { onPoll?: () => void },
): Promise<number> {
  setScreenTimeRuntimeReady(true);
  const da = loadIosDeviceActivity();
  if (!da?.isAvailable()) return 0;

  const readMinutes = (api: IosDeviceActivityApi) => readBestTodayMinutes(api);

  da.reloadDeviceActivityCenter?.();
  recomputeDerotUsageTotals(da);
  options?.onPoll?.();
  const initial = readMinutes(da);
  if (mode === 'fast' && initial > 0) {
    persistTodayScreenCache(initial);
    return initial;
  }

  const waits = FETCH_WAITS[mode];
  const stableRequired = mode === 'deep' ? 2 : 1;
  let best = initial;
  let stableReads = best > 0 ? 1 : 0;

  for (const ms of waits) {
    if (ms > 0) await sleep(ms);
    options?.onPoll?.();
    da.reloadDeviceActivityCenter?.();
    recomputeDerotUsageTotals(da);
    const next = readMinutes(da);
    if (next > best) {
      best = next;
      stableReads = 1;
    } else if (next > 0 && next === best) {
      stableReads += 1;
    }
    if (best > 0 && stableReads >= stableRequired) break;
  }

  const finalMinutes = readMinutes(da);
  if (finalMinutes > 0) {
    da.userDefaultsSet(UD.sampleReady, true);
    persistTodayScreenCache(finalMinutes);
    if (mode === 'sync') {
      da.userDefaultsSet(UD.dailyToday, finalMinutes);
    }
  }
  return finalMinutes;
}

/**
 * Settings → Sync Screen Time: read today's total via react-native-device-activity, save to home.
 * Works with npm run ios:dev — no custom native rebuild required.
 */
export async function syncScreenTimeToHome(options?: { onPoll?: () => void }): Promise<number> {
  if (!isIosScreenTimeApproved()) {
    throw new Error('Approve Screen Time access first.');
  }

  const da = loadIosDeviceActivity();
  if (!da?.isAvailable()) {
    throw new Error('Screen Time is not available in this build.');
  }

  ensureDerotScreenTimeSelection(da);

  try {
    await refreshDerotScreenTimeMonitoring();
  } catch {
    try {
      await tryEnsureDerotScreenTimeTracking();
    } catch {
      /* monitoring may still populate on next poll */
    }
  }

  const tick = () => {
    options?.onPoll?.();
    da.reloadDeviceActivityCenter?.();
    recomputeDerotUsageTotals(da);
  };

  tick();
  let minutes = readBestTodayMinutes(da);
  if (minutes < 1) {
    minutes = await fetchTodayScreenTimeWithRetry('sync', { onPoll: tick });
  }

  if (minutes < 1) {
    const cached = await readCachedTodayScreenMinutes();
    if (cached > 0) minutes = cached;
  }

  if (minutes < 1) {
    throw new Error(
      'Could not read today\u2019s Screen Time yet. Wait a moment and tap sync again.',
    );
  }

  await saveHomeSyncedTodayMinutes(minutes);
  persistTodayScreenCache(minutes);
  da.userDefaultsSet(UD.sampleReady, true);
  da.userDefaultsSet(UD.dailyToday, minutes);
  return minutes;
}

/** @deprecated Use syncScreenTimeToHome */
export async function syncScreenTimeToHomeFast(options?: { onPoll?: () => void }): Promise<number> {
  return syncScreenTimeToHome(options);
}

export function hasDerotActivitySelection(): boolean {
  return withDeviceActivity(false, (da) => Boolean(da.getFamilyActivitySelectionId(DEROT_SELECTION_ID)));
}

/** Home tile: only the value saved by Settings → Sync Screen Time today. */
export function readHomeTodayScreenMinutes(): number {
  return getHomeSyncedTodayMinutes();
}

/** Today's minutes from Apple report in app-group storage. */
export function readDerotTodayUsageMinutes(): number {
  const da = loadIosDeviceActivity();
  if (!da?.isAvailable()) return 0;
  recomputeDerotUsageTotals(da);
  return authoritativeTodayMinutes(da);
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

  const token =
    ensureDerotScreenTimeSelection(da) ?? da.getFamilyActivitySelectionId(DEROT_SELECTION_ID);
  if (!token) {
    da.userDefaultsSet(UD.trackingStarted, true);
    da.reloadDeviceActivityCenter();
    recomputeDerotUsageTotals(da);
    return;
  }

  const thresholdEvents = STEP_MINUTES.map((minute) => ({
    eventName: `m${minute}`,
    threshold: { minute },
    familyActivitySelection: token,
    includesPastActivity: true,
  }));

  await da.startMonitoring(
    DEROT_ACTIVITY_NAME,
    {
      intervalStart: { hour: 0, minute: 0, second: 0 },
      intervalEnd: { hour: 23, minute: 59, second: 59 },
      repeats: true,
    },
    thresholdEvents,
  );

  da.userDefaultsSet(UD.trackingStarted, true);
  da.reloadDeviceActivityCenter();
  recomputeDerotUsageTotals(da);
  const loggedEvents = da.getEvents(DEROT_ACTIVITY_NAME);
  const todayKey = localDateKey(new Date());
  for (const e of loggedEvents) {
    if (e.callbackName !== 'eventDidReachThreshold') continue;
    if (localDateKey(e.lastCalledAt) === todayKey) {
      recomputeDerotUsageTotals(da);
      break;
    }
  }
}

/** Idempotent: start monitoring when authorized and the user has picked apps. */
export async function tryEnsureDerotScreenTimeTracking(): Promise<boolean> {
  const da = loadIosDeviceActivity();
  if (!da?.isAvailable()) return false;

  const { AuthorizationStatus, getAuthorizationStatus } = da;
  if (getAuthorizationStatus() !== AuthorizationStatus.approved) return false;

  const flags = readIosTrackingFlags(da);
  if (flags.trackingStarted) {
    recomputeDerotUsageTotals(da);
    return true;
  }

  try {
    await startDerotScreenTimeTracking();
    return true;
  } catch {
    return false;
  }
}

/** Restart daily monitoring so includesPastActivity and fresh thresholds apply. */
export async function refreshDerotScreenTimeMonitoring(): Promise<void> {
  const da = loadIosDeviceActivity();
  if (!da?.isAvailable()) {
    throw new Error('Screen Time is not available in this build.');
  }
  da.stopMonitoring([DEROT_ACTIVITY_NAME]);
  await startDerotScreenTimeTracking();
}

export function readIosTrackingFlags(da: IosDeviceActivityApi | null = loadIosDeviceActivity()): {
  trackingStarted: boolean;
  sampleReady: boolean;
} {
  const empty = { trackingStarted: false, sampleReady: false };
  if (!da?.isAvailable()) return empty;
  try {
    return {
      trackingStarted: da.userDefaultsGet<boolean>(UD.trackingStarted) === true,
      sampleReady: da.userDefaultsGet<boolean>(UD.sampleReady) === true,
    };
  } catch (e) {
    if (isNativeRuntimeError(e)) return empty;
    throw e;
  }
}

/**
 * Subscribe to extension callbacks; recompute when thresholds fire (true Screen Time pipeline).
 * Returns unsubscribe.
 */
export function subscribeDerotUsageRecompute(): { remove: () => void } {
  try {
    const da = loadIosDeviceActivity();
    if (!da?.isAvailable()) {
      return { remove: () => {} };
    }

    const sub = da.onDeviceActivityMonitorEvent((payload) => {
      if (
        payload.callbackName === 'intervalDidStart' ||
        payload.callbackName === 'intervalDidEnd' ||
        payload.callbackName === 'eventDidReachThreshold'
      ) {
        recomputeDerotUsageTotals(da);
      }
    });

    return sub;
  } catch (e) {
    if (!isNativeRuntimeError(e)) console.warn('subscribeDerotUsageRecompute', e);
    return { remove: () => {} };
  }
}
