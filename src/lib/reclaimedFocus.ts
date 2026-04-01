import { getDailyBaselineMinutes } from './onboardingStorage';
import {
  getCurrentDailyRotUsageMinutes,
  getWeeklyRotUsageMinutes,
  rotUsageReportsAreAuthoritative,
} from './rotUsageBridge';

export type ReclaimedFocusSnapshot = {
  /** Onboarding: pre-app daily average for social & entertainment (minutes). */
  baselineDailyMinutes: number;
  baselineWeeklyMinutes: number;
  /** From DeviceActivity / UsageStats when wired. */
  currentDailyUsageMinutes: number;
  weeklyRotUsageMinutes: number;
  /**
   * max(0, baselineWeekly − weeklyRotUsage). Meaningful only when screenDataAuthoritative.
   */
  weeklyReclaimedMinutes: number | null;
  /** Signed: baselineWeekly − weeklyRotUsage (positive = under baseline). */
  weeklyDeltaRawMinutes: number;
  /** CurrentDailyUsage > DailyBaselineMinutes (only when screen data is authoritative). */
  isSystemOverload: boolean;
  screenDataAuthoritative: boolean;
};

/**
 * ReclaimedFocus (weekly) = weekly hours from onboarding baseline − weekly Rot usage from screening data.
 * System overload (daily): current Rot usage today > daily baseline.
 */
export async function getReclaimedFocusSnapshot(): Promise<ReclaimedFocusSnapshot> {
  const baselineDaily = await getDailyBaselineMinutes();
  const baselineWeekly = baselineDaily * 7;
  const authoritative = await rotUsageReportsAreAuthoritative();
  const currentDaily = await getCurrentDailyRotUsageMinutes();
  const weeklyRot = await getWeeklyRotUsageMinutes();

  const weeklyDeltaRawMinutes = baselineWeekly - weeklyRot;
  const weeklyReclaimedMinutes = authoritative ? Math.max(0, weeklyDeltaRawMinutes) : null;
  const isSystemOverload = authoritative && currentDaily > baselineDaily;

  return {
    baselineDailyMinutes: baselineDaily,
    baselineWeeklyMinutes: baselineWeekly,
    currentDailyUsageMinutes: currentDaily,
    weeklyRotUsageMinutes: weeklyRot,
    weeklyReclaimedMinutes,
    weeklyDeltaRawMinutes,
    isSystemOverload,
    screenDataAuthoritative: authoritative,
  };
}

export function formatMinutesShort(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
