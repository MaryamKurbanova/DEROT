import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'unrot_reclaimed_moments_day_v1';

type DayBucket = { ymd: string; count: number };

function ymd(d = new Date()): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${m}-${day}`;
}

async function readBucket(): Promise<DayBucket> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw == null) return { ymd: ymd(), count: 0 };
  try {
    const j = JSON.parse(raw) as DayBucket;
    if (typeof j.ymd !== 'string' || typeof j.count !== 'number') {
      return { ymd: ymd(), count: 0 };
    }
    if (j.ymd !== ymd()) return { ymd: ymd(), count: 0 };
    return j;
  } catch {
    return { ymd: ymd(), count: 0 };
  }
}

async function writeBucket(b: DayBucket): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(b));
}

export async function getReclaimedMomentsToday(): Promise<number> {
  const b = await readBucket();
  return b.ymd === ymd() ? b.count : 0;
}

/**
 * Once per reflective log session when the user leaves the log (any dismiss:
 * Exit, swipe, or tapping Continue closes the sheet).
 */
export async function incrementReclaimedOnReflectiveLogExit(): Promise<number> {
  const cur = ymd();
  const b = await readBucket();
  const base = b.ymd === cur ? b.count : 0;
  const next = { ymd: cur, count: base + 1 };
  await writeBucket(next);
  return next.count;
}
