import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'unrot_reflective_logs_v1';
const MAX_STORED = 500;

export type LogEntry = {
  /** Epoch ms */
  timestamp: number;
  /** Section 01 — current state */
  state: string;
  /** Section 02 — access intent */
  intent: string;
  /** Local hour 0–23 at log time */
  hour: number;
};

function normalizeEntry(raw: unknown): LogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const ts = o.timestamp;
  if (typeof ts !== 'number') return null;
  const hour = typeof o.hour === 'number' ? o.hour : new Date(ts).getHours();
  if (typeof o.state === 'string' && typeof o.intent === 'string') {
    return { timestamp: ts, state: o.state, intent: o.intent, hour };
  }
  if (typeof o.feeling === 'string' && typeof o.reason === 'string') {
    return { timestamp: ts, state: o.feeling, intent: o.reason, hour };
  }
  return null;
}

export async function appendReflectiveLog(input: {
  state: string;
  intent: string;
  at?: Date;
}): Promise<void> {
  const d = input.at ?? new Date();
  const entry: LogEntry = {
    timestamp: d.getTime(),
    state: input.state,
    intent: input.intent.trim(),
    hour: d.getHours(),
  };
  const prev = await loadAll();
  prev.unshift(entry);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prev.slice(0, MAX_STORED)));
}

/** Focus wall / reflective log — same storage as `appendReflectiveLog`. */
export async function logReflection(input: { mood: string; intent: string }): Promise<void> {
  await appendReflectiveLog({ state: input.mood, intent: input.intent });
}

async function loadAll(): Promise<LogEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw == null) return [];
  try {
    const arr = JSON.parse(raw) as unknown[];
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeEntry).filter((e): e is LogEntry => e != null);
  } catch {
    return [];
  }
}

/** Newest first */
export async function getRecentLogs(limit: number): Promise<LogEntry[]> {
  const all = await loadAll();
  return all.slice(0, limit);
}

/** All entries, newest first — for analytics */
export async function getAllLogsForAnalytics(): Promise<LogEntry[]> {
  return loadAll();
}

/** Most frequent state (Section 01). */
export function computePrimaryTrigger(entries: LogEntry[]): string | null {
  if (entries.length === 0) return null;
  const counts = new Map<string, number>();
  for (const e of entries) {
    counts.set(e.state, (counts.get(e.state) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [k, v] of counts) {
    if (v > bestN) {
      bestN = v;
      best = k;
    }
  }
  return best;
}

/** Hour 0–23 with the most log entries */
export function computePeakHour(entries: LogEntry[]): number | null {
  if (entries.length === 0) return null;
  const counts = new Map<number, number>();
  for (const e of entries) {
    counts.set(e.hour, (counts.get(e.hour) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestN = 0;
  for (const [h, v] of counts) {
    if (v > bestN) {
      bestN = v;
      best = h;
    }
  }
  return best;
}

export function formatHourWindow(hour: number): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const next = (hour + 1) % 24;
  return `${pad(hour)}:00–${pad(next)}:00`;
}

export function truncateReason(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}