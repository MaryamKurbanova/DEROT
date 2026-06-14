import { Platform } from 'react-native';
import { expireMonitoredPassIfNeeded, isMonitoredPassActive } from './accessPass';
import { cancelSocialLockPassRelockSchedule } from './socialLockPassSchedule';

let relockTimer: ReturnType<typeof setTimeout> | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let activeUntilMs: number | null = null;

function clearRelockTimers(): void {
  if (relockTimer != null) {
    clearTimeout(relockTimer);
    relockTimer = null;
  }
  if (pollInterval != null) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function fireRelock(): Promise<void> {
  clearRelockTimers();
  activeUntilMs = null;
  if (Platform.OS !== 'ios') return;

  cancelSocialLockPassRelockSchedule();
  await expireMonitoredPassIfNeeded();
  const { syncMonitoredAppShields } =
    require('./monitoredAppShield') as typeof import('./monitoredAppShield');
  await syncMonitoredAppShields();
}

function maybeFireRelock(): void {
  if (activeUntilMs == null) return;
  if (Date.now() < activeUntilMs) return;
  void fireRelock();
}

/** Foreground backup: poll every second so re-lock matches the slider exactly. */
export function scheduleMonitoredPassRelock(untilMs: number): void {
  clearRelockTimers();
  activeUntilMs = untilMs;

  const delay = untilMs - Date.now();
  if (delay <= 0) {
    void fireRelock();
    return;
  }

  pollInterval = setInterval(maybeFireRelock, 1_000);
  relockTimer = setTimeout(() => {
    void fireRelock();
  }, delay + 100);
}

export function cancelMonitoredPassRelockSchedule(): void {
  clearRelockTimers();
  activeUntilMs = null;
  cancelSocialLockPassRelockSchedule();
}

/** Re-lock whenever the pass window has ended (even if storage was already cleared). */
export async function ensureMonitoredPassRelockState(): Promise<void> {
  await expireMonitoredPassIfNeeded();
  if (await isMonitoredPassActive()) return;
  if (Platform.OS !== 'ios') return;

  cancelSocialLockPassRelockSchedule();
  const { syncMonitoredAppShields } =
    require('./monitoredAppShield') as typeof import('./monitoredAppShield');
  await syncMonitoredAppShields();
}
