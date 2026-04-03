import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'unrot_focus_wall_trigger_ts_v1';
const WINDOW_MS = 60 * 60 * 1000;
const MAX_EVENTS = 400;

function prune(now: number, list: number[]): number[] {
  const cutoff = now - WINDOW_MS;
  return list.filter((t) => typeof t === 'number' && t >= cutoff).slice(-MAX_EVENTS);
}

/** Persist one focus-wall open (shield triggered for a monitored app). */
export async function recordFocusWallTrigger(): Promise<void> {
  const now = Date.now();
  const raw = await AsyncStorage.getItem(KEY);
  let list: number[] = [];
  if (raw) {
    try {
      const o = JSON.parse(raw) as unknown;
      list = Array.isArray(o) ? o.filter((x): x is number => typeof x === 'number') : [];
    } catch {
      list = [];
    }
  }
  list.push(now);
  list = prune(now, list);
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

/** Count of triggers in the rolling last 60 minutes (local clock). */
export async function getFocusWallTriggersLast60Minutes(): Promise<number> {
  const now = Date.now();
  const raw = await AsyncStorage.getItem(KEY);
  let list: number[] = [];
  if (raw) {
    try {
      const o = JSON.parse(raw) as unknown;
      list = Array.isArray(o) ? o.filter((x): x is number => typeof x === 'number') : [];
    } catch {
      list = [];
    }
  }
  const pruned = prune(now, list);
  if (pruned.length !== list.length) {
    await AsyncStorage.setItem(KEY, JSON.stringify(pruned));
  }
  return pruned.length;
}

/** One count per minute for the last 60 minutes (index 0 = 59 min ago, 59 = current minute). */
export async function getFocusWallTriggerBucketsLast60Minutes(): Promise<number[]> {
  const now = Date.now();
  const raw = await AsyncStorage.getItem(KEY);
  let list: number[] = [];
  if (raw) {
    try {
      const o = JSON.parse(raw) as unknown;
      list = Array.isArray(o) ? o.filter((x): x is number => typeof x === 'number') : [];
    } catch {
      list = [];
    }
  }
  const pruned = prune(now, list);
  if (pruned.length !== list.length) {
    await AsyncStorage.setItem(KEY, JSON.stringify(pruned));
  }
  const buckets = new Array<number>(60).fill(0);
  for (const t of pruned) {
    const deltaMin = Math.floor((now - t) / 60_000);
    if (deltaMin < 0 || deltaMin >= 60) continue;
    const idx = 59 - deltaMin;
    buckets[idx] += 1;
  }
  return buckets;
}

export type RotVelocityStatus = 'stable' | 'elevated' | 'high';

export function rotVelocityStatusFromCount(count: number): RotVelocityStatus {
  if (count <= 2) return 'stable';
  if (count <= 5) return 'elevated';
  return 'high';
}

export function rotVelocityStatusLabel(status: RotVelocityStatus): string {
  switch (status) {
    case 'stable':
      return '[ STATUS: STABLE ]';
    case 'elevated':
      return '[ STATUS: ELEVATED ]';
    case 'high':
      return '[ STATUS: HIGH_VELOCITY ]';
  }
}

export const ROT_VELOCITY_EXPLANATION =
  "Standard screen time is flat. Velocity measures the 'Dopamine Itch'—how many times you triggered the shield this hour. High velocity indicates a search for stimulus that isn't there.";

export const ROT_VELOCITY_HIGH_ALERT =
  'SYSTEM_ADVICE: TRIGGER 5-MINUTE ANALOG BREAK.';
