import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_RECLAIMED_MIN = 'unrot_reclaimed_minutes_total';
const KEY_INTERCEPTS = 'unrot_intercept_counts_json';
const KEY_LAST_ACTIVE = 'unrot_last_active_app_id';
/** ISO-like local date keys `YYYY-MM-DD` → minutes reclaimed that day */
const KEY_DAILY_RECLAIMED = 'unrot_daily_reclaimed_json';

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getDailyReclaimedMap(): Promise<Record<string, number>> {
  const raw = await AsyncStorage.getItem(KEY_DAILY_RECLAIMED);
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as Record<string, number>;
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

export type DayReclaimedPoint = {
  /** Short label for axis, e.g. Mon */
  label: string;
  minutes: number;
  dateKey: string;
};

/** Last `dayCount` calendar days (local), oldest first — for charts. */
export async function getReclaimedSeriesLastDays(dayCount: number): Promise<DayReclaimedPoint[]> {
  const daily = await getDailyReclaimedMap();
  const out: DayReclaimedPoint[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const dateKey = localDateKey(d);
    const minutes = daily[dateKey] ?? 0;
    const label = d.toLocaleDateString(undefined, { weekday: 'short' });
    out.push({ label, minutes, dateKey });
  }
  return out;
}

export async function getWeekReclaimedTotal(): Promise<number> {
  const series = await getReclaimedSeriesLastDays(7);
  return series.reduce((s, p) => s + p.minutes, 0);
}

/** One full focus wall = 1 minute toward “reclaimed” time. */
export async function getReclaimedMinutes(): Promise<number> {
  const v = await AsyncStorage.getItem(KEY_RECLAIMED_MIN);
  const n = v != null ? parseInt(v, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Total completed focus walls (+1 per `recordWallComplete`). Same backing value as `getReclaimedMinutes`. */
export async function getTotalWallCompletions(): Promise<number> {
  return getReclaimedMinutes();
}

export async function getInterceptCounts(): Promise<Record<string, number>> {
  const raw = await AsyncStorage.getItem(KEY_INTERCEPTS);
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as Record<string, number>;
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

export async function getLastActiveAppId(): Promise<string | null> {
  return AsyncStorage.getItem(KEY_LAST_ACTIVE);
}

/** Call when a 60s wall finishes for `appId`. */
export async function recordWallComplete(appId: string): Promise<void> {
  const total = await getReclaimedMinutes();
  await AsyncStorage.setItem(KEY_RECLAIMED_MIN, String(total + 1));

  const today = localDateKey(new Date());
  const daily = await getDailyReclaimedMap();
  daily[today] = (daily[today] ?? 0) + 1;
  await AsyncStorage.setItem(KEY_DAILY_RECLAIMED, JSON.stringify(daily));

  const counts = await getInterceptCounts();
  counts[appId] = (counts[appId] ?? 0) + 1;
  await AsyncStorage.setItem(KEY_INTERCEPTS, JSON.stringify(counts));

  await AsyncStorage.setItem(KEY_LAST_ACTIVE, appId);
}

export async function setLastActiveAppId(appId: string): Promise<void> {
  await AsyncStorage.setItem(KEY_LAST_ACTIVE, appId);
}
