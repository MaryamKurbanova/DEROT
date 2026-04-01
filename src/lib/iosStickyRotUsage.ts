import { Platform } from 'react-native';
import { rotUsageReportsAreAuthoritative } from './rotUsageBridge';

/**
 * iOS-only: true when Rot usage numbers should drive “sticky” refresh logic.
 * Reuses the same native / dev-mock gate as `rotUsageReportsAreAuthoritative`.
 */
export async function iosStickyReportsAreAuthoritative(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return rotUsageReportsAreAuthoritative();
}

/**
 * Hook for native code to (re)register DeviceActivity monitoring. Safe no-op in JS-only builds.
 */
export async function iosEnsureStickyMonitoring(): Promise<void> {
  if (Platform.OS !== 'ios') return;
}
