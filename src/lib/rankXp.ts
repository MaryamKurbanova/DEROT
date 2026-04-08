import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

const STORAGE_KEY = 'unrot_rank_xp_v1';

/** Ruler threshold corrected to 1000 XP (fits between Elite and Legend). */
export const RANKS = [
  { level: 1, title: 'Beginner', minXp: 0 },
  { level: 2, title: 'Knight', minXp: 100 },
  { level: 3, title: 'Warrior', minXp: 300 },
  { level: 4, title: 'Elite', minXp: 600 },
  { level: 5, title: 'Ruler', minXp: 1000 },
  { level: 6, title: 'Legend', minXp: 1500 },
  { level: 7, title: 'Ascended', minXp: 2000 },
  { level: 8, title: 'Unstoppable', minXp: 3000 },
] as const;

export type RankDef = (typeof RANKS)[number];

export type RankPersisted = {
  xp: number;
  level: number;
  streak: number;
  /** Last calendar day (local) we applied streak logic for a log (YYYY-MM-DD). */
  lastLogStreakDayKey: string | null;
  /** Calendar day we last awarded screen-time bonus (YYYY-MM-DD). */
  lastScreenBonusDayKey: string | null;
  /** Calendar day for today's XP tally (YYYY-MM-DD). */
  todayXpDateKey: string | null;
  /** XP gained from actions today (log + screen bonuses attributed to today). */
  todayXp: number;
};

export const DEFAULT_RANK_STATE: RankPersisted = {
  xp: 0,
  level: 1,
  streak: 0,
  lastLogStreakDayKey: null,
  lastScreenBonusDayKey: null,
  todayXpDateKey: null,
  todayXp: 0,
};

const DEFAULT_STATE = DEFAULT_RANK_STATE;

export function dayKeyLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function yesterdayKey(from: Date): string {
  const d = new Date(from);
  d.setDate(d.getDate() - 1);
  return dayKeyLocal(d);
}

export function getRankForXp(xp: number): RankDef {
  let current: RankDef = RANKS[0];
  for (const r of RANKS) {
    if (xp >= r.minXp) current = r;
  }
  return current;
}

export function getNextRank(current: RankDef): RankDef | null {
  const i = RANKS.findIndex((r) => r.level === current.level);
  return i >= 0 && i < RANKS.length - 1 ? RANKS[i + 1]! : null;
}

/** Progress 0–1 toward next rank; 1 if max rank. */
export function getProgressInCurrentTier(xp: number): number {
  const rank = getRankForXp(xp);
  const next = getNextRank(rank);
  if (!next) return 1;
  const span = next.minXp - rank.minXp;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (xp - rank.minXp) / span));
}

export async function loadRankState(): Promise<RankPersisted> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const p = JSON.parse(raw) as Partial<RankPersisted>;
    return {
      ...DEFAULT_STATE,
      ...p,
      xp: Math.max(0, Number(p.xp) || 0),
      level: Math.min(8, Math.max(1, Number(p.level) || 1)),
      streak: Math.max(0, Number(p.streak) || 0),
      lastLogStreakDayKey: typeof p.lastLogStreakDayKey === 'string' ? p.lastLogStreakDayKey : null,
      lastScreenBonusDayKey: typeof p.lastScreenBonusDayKey === 'string' ? p.lastScreenBonusDayKey : null,
      todayXpDateKey: typeof p.todayXpDateKey === 'string' ? p.todayXpDateKey : null,
      todayXp: Math.max(0, Number(p.todayXp) || 0),
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function saveRankState(s: RankPersisted): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function rollTodayXp(state: RankPersisted, todayKey: string, amount: number): RankPersisted {
  let todayXp = state.todayXp;
  if (state.todayXpDateKey !== todayKey) {
    todayXp = 0;
  }
  todayXp += amount;
  return {
    ...state,
    todayXpDateKey: todayKey,
    todayXp,
  };
}

function showLevelUpIfNeeded(prevXp: number, newXp: number): void {
  const prev = getRankForXp(prevXp);
  const next = getRankForXp(newXp);
  if (next.level > prev.level) {
    const msg = `You reached Level ${next.level} — ${next.title}.`;
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      alert(`Level up!\n${msg}`);
    } else {
      Alert.alert('Level up!', msg);
    }
  }
}

/** Call after a reflective log is saved successfully. +1 XP; streak updates on first log of local day. */
export async function awardReflectiveLogXp(): Promise<RankPersisted> {
  const todayKey = dayKeyLocal();
  const state = await loadRankState();
  const prevXp = state.xp;

  let streak = state.streak;
  const last = state.lastLogStreakDayKey;
  if (last !== todayKey) {
    if (last === yesterdayKey(new Date())) {
      streak = streak <= 0 ? 1 : streak + 1;
    } else if (last == null) {
      streak = 1;
    } else {
      streak = 1;
    }
  }

  let rolled = rollTodayXp(state, todayKey, 1);
  const newXp = rolled.xp + 1;
  const rank = getRankForXp(newXp);
  const next: RankPersisted = {
    ...rolled,
    xp: newXp,
    level: rank.level,
    streak,
    lastLogStreakDayKey: todayKey,
  };
  await saveRankState(next);
  showLevelUpIfNeeded(prevXp, newXp);
  return next;
}

/**
 * Highest tier only once per calendar day when screen data is authoritative.
 * < 2h → +10, < 4h → +5, < 6h → +3.
 */
export async function maybeAwardDailyScreenBonus(
  dailyUsageMinutes: number,
  authoritative: boolean,
): Promise<RankPersisted | null> {
  if (!authoritative) return null;
  const todayKey = dayKeyLocal();
  const state = await loadRankState();
  if (state.lastScreenBonusDayKey === todayKey) return null;

  const hours = dailyUsageMinutes / 60;
  let bonus = 0;
  if (hours < 2) bonus = 10;
  else if (hours < 4) bonus = 5;
  else if (hours < 6) bonus = 3;

  if (bonus === 0) {
    await saveRankState({ ...state, lastScreenBonusDayKey: todayKey });
    return null;
  }

  const prevXp = state.xp;
  const rolled = rollTodayXp(state, todayKey, bonus);
  const newXp = rolled.xp + bonus;
  const rank = getRankForXp(newXp);
  const next: RankPersisted = {
    ...rolled,
    xp: newXp,
    level: rank.level,
    lastScreenBonusDayKey: todayKey,
  };
  await saveRankState(next);
  showLevelUpIfNeeded(prevXp, newXp);
  return next;
}

/** Snapshot for UI (includes derived next rank XP). */
export type RankUiSnapshot = RankPersisted & {
  rank: RankDef;
  nextRank: RankDef | null;
  progress01: number;
  xpIntoTier: number;
  xpForNextLevel: number;
  nextThresholdXp: number;
};

export function toRankUiSnapshot(state: RankPersisted): RankUiSnapshot {
  const todayKey = dayKeyLocal();
  let todayXp = state.todayXp;
  if (state.todayXpDateKey !== todayKey) todayXp = 0;

  const rank = getRankForXp(state.xp);
  const nextRank = getNextRank(rank);
  const progress01 = getProgressInCurrentTier(state.xp);
  const nextThresholdXp = nextRank?.minXp ?? rank.minXp;
  const xpIntoTier = state.xp - rank.minXp;
  const xpForNextLevel = nextRank ? nextRank.minXp - state.xp : 0;

  return {
    ...state,
    todayXp,
    rank,
    nextRank,
    progress01,
    xpIntoTier,
    xpForNextLevel: Math.max(0, xpForNextLevel),
    nextThresholdXp,
  };
}
