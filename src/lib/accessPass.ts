import AsyncStorage from '@react-native-async-storage/async-storage';
import { DISTRACTION_APPS } from './distractionApps';
import { notifyAccessPassClearedToNative, notifyAccessPassGrantedToNative } from './interceptBridge';

const SMART_RESET_KEY = 'unrot_smart_reset_enabled';
/** @deprecated legacy global pass — cleared on first per-app grant */
const LEGACY_STORAGE_KEY = 'unrot_access_valid_until_ms';

/**
 * Fixed window after a completed reflective log. When this expires, opening the
 * monitored app shows the wall again (not “every 10 minutes” on a timer — on each
 * launch after the window has passed).
 */
export const PASS_DURATION_MS = 10 * 60 * 1000;

/** @deprecated Alias for PASS_DURATION_MS */
export const DEFAULT_PASS_DURATION_MS = PASS_DURATION_MS;

function passKey(appId: string): string {
  return `unrot_pass_until_${appId}`;
}

export async function getPassDurationMs(): Promise<number> {
  return PASS_DURATION_MS;
}

export async function getPassDurationMinutes(): Promise<number> {
  return Math.round(PASS_DURATION_MS / 60000);
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

/**
 * After ritual completes: this app (and only this app) is unlocked for PASS_DURATION_MS.
 */
export async function grantAccessPassForApp(appId: string, fromTime: number = Date.now()): Promise<void> {
  const untilMs = fromTime + PASS_DURATION_MS;
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
  await Promise.all(
    DISTRACTION_APPS.map(async (a) => {
      await AsyncStorage.removeItem(passKey(a.id));
      await notifyAccessPassClearedToNative(a.id);
    }),
  );
}

/** When user opens a distraction: show wall if that app has no active pass. */
export async function shouldShowFocusWallForApp(appId: string): Promise<boolean> {
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
  await AsyncStorage.setItem(LEGACY_STORAGE_KEY, String(fromTime + PASS_DURATION_MS));
}

/** @deprecated */
export async function clearAccessPass(): Promise<void> {
  await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
}

/** @deprecated */
export async function shouldShowFocusWallForLaunch(): Promise<boolean> {
  return !(await isAccessPassActive());
}
