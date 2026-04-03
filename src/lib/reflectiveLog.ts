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
  /** Distraction app id when logged from focus wall (optional for legacy entries). */
  appId?: string;
};

function normalizeEntry(raw: unknown): LogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const ts = o.timestamp;
  if (typeof ts !== 'number') return null;
  const hour = typeof o.hour === 'number' ? o.hour : new Date(ts).getHours();
  if (typeof o.state === 'string' && typeof o.intent === 'string') {
    const appId = typeof o.appId === 'string' ? o.appId : undefined;
    return { timestamp: ts, state: o.state, intent: o.intent, hour, appId };
  }
  if (typeof o.feeling === 'string' && typeof o.reason === 'string') {
    const appId = typeof o.appId === 'string' ? o.appId : undefined;
    return { timestamp: ts, state: o.feeling, intent: o.reason, hour, appId };
  }
  return null;
}

export async function appendReflectiveLog(input: {
  state: string;
  intent: string;
  appId?: string;
  at?: Date;
}): Promise<void> {
  const d = input.at ?? new Date();
  const entry: LogEntry = {
    timestamp: d.getTime(),
    state: input.state,
    intent: input.intent.trim(),
    hour: d.getHours(),
    ...(input.appId ? { appId: input.appId } : {}),
  };
  const prev = await loadAll();
  prev.unshift(entry);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prev.slice(0, MAX_STORED)));
}

/** Focus wall / reflective log — same storage as `appendReflectiveLog`. */
export async function logReflection(input: {
  mood?: string;
  intent?: string;
  /** Freeform intercept answer (monolith log). */
  reflection?: string;
  appId?: string;
}): Promise<void> {
  const trimmed = input.reflection?.trim();
  if (trimmed) {
    await appendReflectiveLog({
      state: 'REFLECTION',
      intent: trimmed,
      ...(input.appId ? { appId: input.appId } : {}),
    });
    return;
  }
  if (input.mood && input.intent) {
    await appendReflectiveLog({
      state: input.mood,
      intent: input.intent,
      ...(input.appId ? { appId: input.appId } : {}),
    });
  }
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

/** One-hour window starting at `startHour24` (0–23), e.g. 21 → "9:00 PM – 10:00 PM". */
export function formatHourRangeAmPm(startHour24: number): string {
  const piece = (h: number): string => {
    const hour24 = ((h % 24) + 24) % 24;
    const ampm = hour24 < 12 ? 'AM' : 'PM';
    let h12 = hour24 % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:00 ${ampm}`;
  };
  return `${piece(startHour24)} – ${piece(startHour24 + 1)}`;
}

/**
 * Danger-zone copy: hour + lowercase am/pm on both sides, no minutes.
 * e.g. 14 → "2pm - 3pm"
 */
export function formatDangerZoneEditorialRange(startHour24: number): string {
  const norm = (h: number) => ((h % 24) + 24) % 24;
  const start = norm(startHour24);
  const end = norm(startHour24 + 1);
  const mer = (h: number) => (h < 12 ? 'am' : 'pm');
  const to12 = (h: number) => {
    let x = h % 12;
    if (x === 0) x = 12;
    return x;
  };
  const startStr = `${to12(start)}${mer(start)}`;
  const endStr = `${to12(end)}${mer(end)}`;
  return `${startStr} - ${endStr}`;
}

export type DangerZoneInsight = {
  startHour: number;
  state: string;
  /** Joint (hour + mood) bucket count when that pairing is the signal; 0 if from peak-hour + top-mood fallback. */
  jointCount: number;
};

/**
 * “Danger zone”: the (local hour, mood) pair that shows up most in logs, else peak hour + most common mood.
 * Needs at least three entries before we surface anything.
 */
export function computeDangerZoneInsight(entries: LogEntry[]): DangerZoneInsight | null {
  if (entries.length < 3) return null;

  const joint = new Map<string, number>();
  for (const e of entries) {
    const key = `${e.hour}\0${e.state}`;
    joint.set(key, (joint.get(key) ?? 0) + 1);
  }

  let bestKey: string | null = null;
  let bestN = 0;
  for (const [k, n] of joint) {
    if (bestKey == null || n > bestN || (n === bestN && k < bestKey)) {
      bestN = n;
      bestKey = k;
    }
  }

  if (bestN >= 2 && bestKey != null) {
    const tab = bestKey.indexOf('\0');
    const hour = Number(bestKey.slice(0, tab));
    const state = bestKey.slice(tab + 1);
    if (!Number.isNaN(hour) && hour >= 0 && hour <= 23 && state) {
      return { startHour: hour, state, jointCount: bestN };
    }
  }

  const h = computePeakHour(entries);
  const s = computePrimaryTrigger(entries);
  if (h == null || s == null) return null;
  return { startHour: h, state: s, jointCount: 0 };
}

export function formatDangerZoneSentence(insight: DangerZoneInsight): string {
  const time = formatHourRangeAmPm(insight.startHour);
  const raw = truncateReason(insight.state.trim(), 48);
  const feeling =
    raw.length > 0 ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : raw;
  return `You are most likely to rot at ${time} when feeling ${feeling}.`;
}

/** e.g. "You are more likely to rot between 2pm and 3pm." */
export function formatEditorialLuxuryDangerLine(insight: DangerZoneInsight | null): string {
  if (insight == null) {
    return 'You are more likely to rot between reflective moments—keep logging to reveal your pattern.';
  }
  const range = formatDangerZoneEditorialRange(insight.startHour);
  return `You are more likely to rot between ${range}.`;
}

/**
 * Same editorial time window as `formatEditorialLuxuryDangerLine`, plus
 * “when feeling …” from the insight mood when present.
 */
export function formatEditorialLuxuryDangerLineWithFeeling(insight: DangerZoneInsight | null): string {
  const base = formatEditorialLuxuryDangerLine(insight);
  if (insight == null) return base;
  const raw = truncateReason(insight.state.trim(), 40);
  if (!raw) return base;
  const feeling =
    raw.length > 0 ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : raw;
  const trimmed = base.replace(/\.\s*$/, '');
  return `${trimmed} when feeling ${feeling}.`;
}

/** `VULNERABILITY: 20:00 — 21:00` (24h, em dash). */
export function formatVulnerabilityWindow24(insight: DangerZoneInsight | null): string {
  if (insight == null) return 'VULNERABILITY: --:-- — --:--';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const h = ((insight.startHour % 24) + 24) % 24;
  const next = (h + 1) % 24;
  return `VULNERABILITY: ${pad(h)}:00 — ${pad(next)}:00`;
}

/** HUD line: `MOST LIKELY TO ROT: [8:00 PM - 9:00 PM] // [ANXIOUS]` */
export function formatDangerZoneHUDLine(insight: DangerZoneInsight): string {
  const piece = (hour24: number): string => {
    const h = ((hour24 % 24) + 24) % 24;
    const ampm = h < 12 ? 'AM' : 'PM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:00 ${ampm}`;
  };
  const start = insight.startHour;
  const win = `[${piece(start)} - ${piece(start + 1)}]`;
  const raw = truncateReason(insight.state.trim(), 24);
  const tagRaw = raw.length > 0 ? raw.replace(/\s+/g, '_').toUpperCase() : 'UNKNOWN';
  const tag = `[${tagRaw}]`;
  return `MOST LIKELY TO ROT: ${win} // ${tag}`;
}

export function truncateReason(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}