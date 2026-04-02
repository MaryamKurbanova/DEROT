import AsyncStorage from '@react-native-async-storage/async-storage';

/** Written only after the user finishes breathing *and* the reflective log in one intercept flow. */
const KEY = 'unrot_last_breath_plus_log_ritual_ms';

/** How long until the next intercept must include breathing again (still always includes log after). */
export const BREATHING_INTERCEPT_INTERVAL_MS = 4 * 60 * 60 * 1000;

export async function getLastBreathPlusLogRitualCompletedMs(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function markBreathPlusLogRitualCompleted(at: number = Date.now()): Promise<void> {
  await AsyncStorage.setItem(KEY, String(at));
}

/**
 * When true, the user must complete the breathing step *before* the reflective log, then the log,
 * before unlock. When false, they only complete the reflective log (still every time the pass has expired).
 */
export async function shouldRequireBreathingBeforeReflectiveLog(now: number = Date.now()): Promise<boolean> {
  const last = await getLastBreathPlusLogRitualCompletedMs();
  if (last == null) return true;
  return now - last >= BREATHING_INTERCEPT_INTERVAL_MS;
}
