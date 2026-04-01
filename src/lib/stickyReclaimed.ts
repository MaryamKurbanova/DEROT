import {
  formatMinutesShort,
  type ReclaimedFocusSnapshot,
} from './reclaimedFocus';

export type StickyCopy = {
  label: string;
  headline: string;
  compareLine?: string;
  realLife: string;
  showConnectHint: boolean;
  connectButtonLabel?: string;
};

export function buildStickyCopy(snap: ReclaimedFocusSnapshot): StickyCopy {
  if (!snap.screenDataAuthoritative) {
    return {
      label: 'STICKY',
      headline: 'Connect usage reporting',
      realLife:
        'Authorize Screen Time (iOS) or usage access (Android) to compare this week’s distraction time to your onboarding baseline.',
      showConnectHint: true,
      connectButtonLabel: 'OPEN SETTINGS · SCREEN TIME',
    };
  }

  if (snap.isSystemOverload) {
    return {
      label: 'OVERLOAD',
      headline: 'Above daily baseline',
      compareLine: `Today ${formatMinutesShort(snap.currentDailyUsageMinutes)} · baseline ${formatMinutesShort(snap.baselineDailyMinutes)}`,
      realLife: 'Pause before opening the next distraction app.',
      showConnectHint: false,
    };
  }

  const reclaimed = snap.weeklyReclaimedMinutes;
  if (reclaimed != null && reclaimed > 0) {
    return {
      label: 'RECLAIMED',
      headline: `${formatMinutesShort(reclaimed)} under baseline`,
      compareLine: `This week ${formatMinutesShort(snap.weeklyRotUsageMinutes)} · baseline ${formatMinutesShort(snap.baselineWeeklyMinutes)}`,
      realLife: 'You are under the weekly average you set in onboarding.',
      showConnectHint: false,
    };
  }

  return {
    label: 'STICKY',
    headline: 'On track',
    compareLine:
      snap.weeklyDeltaRawMinutes <= 0
        ? undefined
        : `${formatMinutesShort(snap.weeklyRotUsageMinutes)} this week`,
    realLife: 'Keep monitoring in Settings.',
    showConnectHint: false,
  };
}
