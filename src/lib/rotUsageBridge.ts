import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import {
  hasDerotActivitySelection,
  isIosScreenTimeApproved,
  loadIosDeviceActivity,
  readDerotTodayUsageMinutes,
  readIosTrackingFlags,
  syncDerotUsageFromPhone,
} from './derotIosScreenTime';

/**
 * Live "Rot" usage from system screening:
 * - iOS: `UnrotRotUsage` native module, or Device Activity / Screen Time via `react-native-device-activity`
 *   (Family Controls authorized + in-app monitoring — not available in Expo Go).
 * - Android: UsageStatsManager via `UnrotRotUsage` when wired.
 * - Dev mocks in AsyncStorage for QA.
 */
type NativeRotUsage = {
  getCurrentDailyRotUsageMinutes?: () => Promise<number>;
  getWeeklyRotUsageMinutes?: () => Promise<number>;
  isRotUsageReportingActive?: () => Promise<boolean>;
};

const Native: NativeRotUsage =
  (NativeModules as { UnrotRotUsage?: NativeRotUsage }).UnrotRotUsage ?? {};

/** Dev-only: set to integer string to simulate today’s Rot minutes (JS / Expo Go). */
export const DEV_MOCK_DAILY_ROT_MINUTES_KEY = 'unrot_dev_mock_rot_daily_minutes';
/** Dev-only: set to integer string for rolling 7-day total Rot minutes. */
export const DEV_MOCK_WEEKLY_ROT_MINUTES_KEY = 'unrot_dev_mock_rot_weekly_minutes';

export function isNativeRotUsageModulePresent(): boolean {
  return (
    typeof Native.getCurrentDailyRotUsageMinutes === 'function' &&
    typeof Native.getWeeklyRotUsageMinutes === 'function'
  );
}

function clampMin(n: number): number {
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function iosScreenTimeApproved(): boolean {
  return isIosScreenTimeApproved();
}

/** Approved + user started tracking + has a persisted app/category selection. */
function iosScreenTimeTrackingConfigured(): boolean {
  if (!iosScreenTimeApproved()) return false;
  try {
    const flags = readIosTrackingFlags();
    return flags.trackingStarted && hasDerotActivitySelection();
  } catch {
    return false;
  }
}

function iosScreenTimePipelineActive(): boolean {
  if (!iosScreenTimeTrackingConfigured()) return false;
  try {
    syncDerotUsageFromPhone();
    return iosReadTodayUsageMinutes() >= 1;
  } catch {
    return false;
  }
}

/** Read today's minutes from app-group storage (Apple report preferred). */
function iosReadTodayUsageMinutes(): number {
  try {
    return readDerotTodayUsageMinutes();
  } catch {
    return 0;
  }
}

/**
 * True when we should treat screen-reported numbers as real (native authorized, or dev mocks set).
 */
export async function rotUsageReportsAreAuthoritative(): Promise<boolean> {
  if (isNativeRotUsageModulePresent()) {
    try {
      if (typeof Native.isRotUsageReportingActive === 'function') {
        return await Native.isRotUsageReportingActive();
      }
      return true;
    } catch {
      return false;
    }
  }

  if (Platform.OS === 'ios' && iosScreenTimePipelineActive()) {
    return true;
  }

  const [d, w] = await AsyncStorage.multiGet([
    DEV_MOCK_DAILY_ROT_MINUTES_KEY,
    DEV_MOCK_WEEKLY_ROT_MINUTES_KEY,
  ]);
  return d[1] != null || w[1] != null;
}

/** Current calendar day (local), minutes in monitored Rot apps / categories. */
export async function getCurrentDailyRotUsageMinutes(): Promise<number> {
  if (typeof Native.getCurrentDailyRotUsageMinutes === 'function') {
    try {
      return clampMin(await Native.getCurrentDailyRotUsageMinutes());
    } catch {
      return 0;
    }
  }

  if (Platform.OS === 'ios' && iosScreenTimeTrackingConfigured()) {
    syncDerotUsageFromPhone();
    return iosReadTodayUsageMinutes();
  }

  const raw = await AsyncStorage.getItem(DEV_MOCK_DAILY_ROT_MINUTES_KEY);
  if (raw == null) return 0;
  return clampMin(parseInt(raw, 10));
}

/** Sum of Rot usage over the last 7 local days (native); dev mock is a single total. */
export async function getWeeklyRotUsageMinutes(): Promise<number> {
  if (typeof Native.getWeeklyRotUsageMinutes === 'function') {
    try {
      return clampMin(await Native.getWeeklyRotUsageMinutes());
    } catch {
      return 0;
    }
  }

  if (Platform.OS === 'ios' && iosScreenTimePipelineActive()) {
    syncDerotUsageFromPhone();
    const da = loadIosDeviceActivity();
    const v = da?.userDefaultsGet<number>('DEROT_WEEKLY_ROLLING_MINUTES');
    if (typeof v === 'number' && v > 0) return clampMin(v);
    return iosReadTodayUsageMinutes();
  }

  const raw = await AsyncStorage.getItem(DEV_MOCK_WEEKLY_ROT_MINUTES_KEY);
  if (raw == null) return 0;
  return clampMin(parseInt(raw, 10));
}
