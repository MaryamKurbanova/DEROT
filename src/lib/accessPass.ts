import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { DISTRACTION_APPS } from './distractionApps';
import { notifyAccessPassClearedToNative, notifyAccessPassGrantedToNative } from './interceptBridge';
import { getMonitoredAppIds } from './monitoredApps';

const SMART_RESET_KEY = 'unrot_smart_reset_enabled';
/** @deprecated legacy global pass — cleared on first monitored grant */
const LEGACY_STORAGE_KEY = 'unrot_access_valid_until_ms';
/** Shared unlock window for all monitored apps after a reflective log. */
const MONITORED_PASS_UNTIL_KEY = 'unrot_monitored_pass_until_ms';
const PASS_DURATION_MINUTES_KEY = 'unrot_pass_duration_minutes';

export const PASS_DURATION_MINUTES_MIN = 5;
export const PASS_DURATION_MINUTES_MAX = 60;
export const PASS_DURATION_MINUTES_DEFAULT = 10;

/**
 * @deprecated Use getPassDurationMs() — duration is user-configurable (5–60 min).
 * Kept for any legacy imports; equals default window only.
 */
export const PASS_DURATION_MS = PASS_DURATION_MINUTES_DEFAULT * 60 * 1000;

/** @deprecated Use getPassDurationMs() */
export const DEFAULT_PASS_DURATION_MS = PASS_DURATION_MS;

function passKey(appId: string): string {
  return `unrot_pass_until_${appId}`;
}

async function readPassDurationMinutes(): Promise<number> {
  const raw = await AsyncStorage.getItem(PASS_DURATION_MINUTES_KEY);
  if (raw == null) return PASS_DURATION_MINUTES_DEFAULT;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return PASS_DURATION_MINUTES_DEFAULT;
  return Math.min(PASS_DURATION_MINUTES_MAX, Math.max(PASS_DURATION_MINUTES_MIN, n));
}

export async function getPassDurationMs(): Promise<number> {
  const m = await readPassDurationMinutes();
  return m * 60 * 1000;
}

export async function getPassDurationMinutes(): Promise<number> {
  return readPassDurationMinutes();
}

export async function setPassDurationMinutes(minutes: number): Promise<void> {
  const clamped = Math.min(
    PASS_DURATION_MINUTES_MAX,
    Math.max(PASS_DURATION_MINUTES_MIN, Math.round(minutes)),
  );
  await AsyncStorage.setItem(PASS_DURATION_MINUTES_KEY, String(clamped));
}

export async function getSmartResetEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(SMART_RESET_KEY);
  return raw === '1';
}

export async function setSmartResetEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(SMART_RESET_KEY, enabled ? '1' : '0');
}

export async function getAccessValidUntilForApp(appId: string): Promise<number | null> {
  const raw = await AsyncStorage.getItem(passKey(appId));
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function isAccessPassActiveForApp(appId: string, at: number = Date.now()): Promise<boolean> {
  const until = await getAccessValidUntilForApp(appId);
  return until != null && at < until;
}

export async function getMonitoredPassUntil(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(MONITORED_PASS_UNTIL_KEY);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** True while every monitored app shares an active post-log unlock window. */
export async function isMonitoredPassActive(at: number = Date.now()): Promise<boolean> {
  const until = await getMonitoredPassUntil();
  return until != null && at < until;
}

/** Clear stored pass timestamps once the unlock window has ended. */
export async function clearMonitoredPassStorage(): Promise<void> {
  await AsyncStorage.removeItem(MONITORED_PASS_UNTIL_KEY);
  await Promise.all(
    DISTRACTION_APPS.map(async (a) => {
      await AsyncStorage.removeItem(passKey(a.id));
      await notifyAccessPassClearedToNative(a.id);
    }),
  );
}

/** Returns true when a pass just expired and storage was cleared. */
export async function expireMonitoredPassIfNeeded(at: number = Date.now()): Promise<boolean> {
  const until = await getMonitoredPassUntil();
  if (until == null || at < until) return false;
  await clearMonitoredPassStorage();
  return true;
}

/**
 * After ritual completes: all monitored apps unlock together for the configured window.
 * Returns the expiry timestamp (ms).
 */
export async function grantAccessPassForMonitoredApps(fromTime: number = Date.now()): Promise<number> {
  const ms = await getPassDurationMs();
  const untilMs = fromTime + ms;
  const ids = await getMonitoredAppIds();
  await AsyncStorage.setItem(MONITORED_PASS_UNTIL_KEY, String(untilMs));
  await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  await Promise.all(
    ids.map(async (id) => {
      await AsyncStorage.setItem(passKey(id), String(untilMs));
      await notifyAccessPassGrantedToNative(id, untilMs);
    }),
  );

  if (Platform.OS === 'ios') {
    const { syncMonitoredAppShields } =
      require('./monitoredAppShield') as typeof import('./monitoredAppShield');
    const { scheduleMonitoredPassRelock } =
      require('./monitoredPassExpiry') as typeof import('./monitoredPassExpiry');
    const { scheduleSocialLockPassRelock } =
      require('./socialLockPassSchedule') as typeof import('./socialLockPassSchedule');
    await syncMonitoredAppShields();
    scheduleMonitoredPassRelock(untilMs);
    await scheduleSocialLockPassRelock(fromTime, untilMs);
  }

  return untilMs;
}

/**
 * @deprecated Prefer grantAccessPassForMonitoredApps — unlocks one app only.
 */
export async function grantAccessPassForApp(appId: string, fromTime: number = Date.now()): Promise<void> {
  const ms = await getPassDurationMs();
  const untilMs = fromTime + ms;
  await AsyncStorage.setItem(passKey(appId), String(untilMs));
  await notifyAccessPassGrantedToNative(appId, untilMs);
  await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
}

export async function clearAccessPassForApp(appId: string): Promise<void> {
  await AsyncStorage.removeItem(passKey(appId));
  await notifyAccessPassClearedToNative(appId);
}

export async function clearAllAccessPasses(): Promise<void> {
  await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  await AsyncStorage.removeItem(MONITORED_PASS_UNTIL_KEY);
  await Promise.all(
    DISTRACTION_APPS.map(async (a) => {
      await AsyncStorage.removeItem(passKey(a.id));
      await notifyAccessPassClearedToNative(a.id);
    }),
  );
}

/** When user opens a monitored distraction: show wall unless the shared pass is active. */
export async function shouldShowFocusWallForApp(appId: string): Promise<boolean> {
  if (await isMonitoredPassActive()) return false;
  return !(await isAccessPassActiveForApp(appId));
}

/** @deprecated use per-app APIs */
export async function getAccessValidUntil(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** @deprecated use isAccessPassActiveForApp */
export async function isAccessPassActive(at: number = Date.now()): Promise<boolean> {
  const until = await getAccessValidUntil();
  return until != null && at < until;
}

/** @deprecated */
export async function grantAccessPass(fromTime: number = Date.now()): Promise<void> {
  const ms = await getPassDurationMs();
  await AsyncStorage.setItem(LEGACY_STORAGE_KEY, String(fromTime + ms));
}

/** @deprecated */
export async function clearAccessPass(): Promise<void> {
  await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
}

/** @deprecated */
export async function shouldShowFocusWallForLaunch(): Promise<boolean> {
  return !(await isAccessPassActive());
}
