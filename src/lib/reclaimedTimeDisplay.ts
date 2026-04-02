import {
  formatMinutesShort,
  type ReclaimedFocusSnapshot,
} from './reclaimedFocus';

/** All-caps headline for the dashboard hero (weekly reclaimed vs baseline). */
export function formatReclaimedWeeklyHeadline(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 1) {
    return 'NO RECLAIMED TIME THIS WEEK YET.';
  }
  if (m < 60) {
    return `YOU HAVE RECLAIMED ${m} MINUTE${m === 1 ? '' : 'S'} THIS WEEK.`;
  }
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) {
    return `YOU HAVE RECLAIMED ${h} HOUR${h === 1 ? '' : 'S'} THIS WEEK.`;
  }
  return `YOU HAVE RECLAIMED ${h} HOUR${h === 1 ? '' : 'S'} AND ${rem} MIN THIS WEEK.`;
}

/**
 * Plain-language analogy for reclaimed time (not literal conversion — motivational scale).
 */
export function realLifeAnalogueForReclaimedMinutes(totalMinutes: number): string {
  const h = totalMinutes / 60;
  if (totalMinutes < 20) {
    return 'Enough time to stretch, breathe, and reset without touching the feed.';
  }
  if (totalMinutes < 45) {
    return 'About enough time for a workout or a long walk.';
  }
  if (totalMinutes < 90) {
    return 'Roughly a movie, a deep dinner with someone, or a few solid chapters of a book.';
  }
  if (h < 4) {
    return 'Enough time for a serious deep-work block — or half a day away from the scroll.';
  }
  if (h < 8) {
    return 'About one full workday you didn’t lose to distractions.';
  }
  if (h < 16) {
    return 'Close to two full workdays — or many evenings back in your week.';
  }
  if (h < 24) {
    return 'Multiple workdays of focus — like reading a full book or finishing a big project.';
  }
  return 'A major slice of your week back — more than most people get in a month.';
}

export function formatReclaimedMathLine(snap: ReclaimedFocusSnapshot): string {
  const screen = formatMinutesShort(snap.weeklyRotUsageMinutes);
  const baseline = formatMinutesShort(snap.baselineWeeklyMinutes);
  const reclaimed =
    snap.weeklyReclaimedMinutes != null
      ? formatMinutesShort(snap.weeklyReclaimedMinutes)
      : '—';
  return `IPHONE SCREEN TIME (MONITORED, 7D): ${screen} · YOUR BASELINE (7D): ${baseline} · RECLAIMED: ${reclaimed}`;
}
