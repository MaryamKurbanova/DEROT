import AsyncStorage from '@react-native-async-storage/async-storage';

const SYNCED_DATE_KEY = 'derot_home_synced_date';
const SYNCED_MINUTES_KEY = 'derot_home_synced_minutes';

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

let memoryMinutes = 0;
let memoryDate = '';
let hydratePromise: Promise<number> | null = null;

/** Last value saved by Settings → Sync Screen Time (same calendar day). */
export function getHomeSyncedTodayMinutes(): number {
  const today = localDateKey(new Date());
  if (memoryDate === today && memoryMinutes > 0) return memoryMinutes;
  return 0;
}

export async function loadHomeSyncedTodayMinutes(): Promise<number> {
  try {
    const today = localDateKey(new Date());
    const rows = await AsyncStorage.multiGet([SYNCED_DATE_KEY, SYNCED_MINUTES_KEY]);
    const dateRaw = rows[0]?.[1];
    const minRaw = rows[1]?.[1];
    if (dateRaw === today && minRaw != null) {
      const m = parseInt(minRaw, 10);
      if (Number.isFinite(m) && m > 0) {
        memoryMinutes = m;
        memoryDate = today;
        return m;
      }
    }
  } catch {
    /* ignore */
  }
  memoryMinutes = 0;
  memoryDate = '';
  return 0;
}

/** Load persisted sync once at app boot so home can show the last Settings sync. */
export function hydrateHomeSyncedTodayMinutes(): Promise<number> {
  if (hydratePromise == null) {
    hydratePromise = loadHomeSyncedTodayMinutes();
  }
  return hydratePromise;
}

export async function saveHomeSyncedTodayMinutes(minutes: number): Promise<void> {
  if (minutes < 1) return;
  const today = localDateKey(new Date());
  memoryMinutes = minutes;
  memoryDate = today;
  await AsyncStorage.multiSet([
    [SYNCED_DATE_KEY, today],
    [SYNCED_MINUTES_KEY, String(minutes)],
  ]);
}
