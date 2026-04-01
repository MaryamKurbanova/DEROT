import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';

/**
 * Live "Rot" usage from system screening:
 * - iOS: DeviceActivityCenter / Screen Time aggregates for selected apps & categories.
 * - Android: UsageStatsManager for distraction packages.
 *
 * Wire native module `UnrotRotUsage` with the methods below. Until then, optional dev mocks
 * in AsyncStorage allow QA without a native build.
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
  const raw = await AsyncStorage.getItem(DEV_MOCK_WEEKLY_ROT_MINUTES_KEY);
  if (raw == null) return 0;
  return clampMin(parseInt(raw, 10));
}
