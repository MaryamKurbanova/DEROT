import { Platform } from 'react-native';
import { spacing, unrot } from '../../theme';
import { BrandAppIcon, type BrandAppId } from '../../components/BrandAppIcon';

export const TOTAL_ONBOARDING_STEPS = 39;

/** Onboarding typography — Arial on iOS; closest system sans on Android. */
export const OB_FONTS = {
  regular: Platform.select({ ios: 'Arial', android: 'sans-serif', default: 'Arial' }) as string,
  bold: Platform.select({ ios: 'Arial-BoldMT', android: 'sans-serif-medium', default: 'Arial' }) as string,
  black: Platform.select({ ios: 'Arial-Black', android: 'sans-serif-black', default: 'Arial' }) as string,
} as const;

export const OB = {
  padH: 28,
  ink: '#111111',
  secondary: '#8A8A8A',
  label: '#A0A0A0',
  insight: '#333333',
  tile: '#F2F2F2',
  hairline: 'rgba(17, 17, 17, 0.08)',
  radius: 20,
  hero: '#111111',
  white: '#FFFFFF',
  heroMuted: 'rgba(255, 255, 255, 0.55)',
  track: '#DDDDDD',
} as const;

export { spacing, unrot };

export const AGE_BRACKETS = [
  { label: '13–17', store: '13-17' },
  { label: '18–24', store: '18-24' },
  { label: '25–34', store: '25-34' },
  { label: '35–44', store: '35-44' },
  { label: '45–54', store: '45-54' },
  { label: '55+', store: '55+' },
] as const;

export const HOURS_MIN = 1;
export const HOURS_MAX = 12;
export const HOURS_STEP = 0.5;
export const HOURS_DEFAULT = 3;

export function formatHoursDisplay(h: number): string {
  const r = Math.round(h * 10) / 10;
  return Number.isInteger(r) ? String(Math.round(r)) : r.toFixed(1);
}

export function hoursCaption(h: number): string {
  if (h <= 3) return 'Above average focus';
  if (h <= 6) return 'Significant daily rot';
  return 'Critical levels';
}

/** Annual phone-time projection from daily hours (80-year lifetime for years). */
export function impactStats(hoursPerDay: number): {
  hoursYear: number;
  daysYear: number;
  yearsLife: number;
} {
  if (hoursPerDay <= 0) return { hoursYear: 0, daysYear: 0, yearsLife: 0 };
  const hoursYear = Math.round(hoursPerDay * 365);
  const daysYear = Math.round((hoursPerDay * 365) / 24);
  const yearsLife = Math.round(((hoursPerDay * 80) / 24) * 10) / 10;
  return { hoursYear, daysYear, yearsLife };
}

export function formatImpactYears(years: number): string {
  return Number.isInteger(years) ? String(years) : years.toFixed(1);
}

export function reclaimHoursGoal(hoursPerDay: number): number {
  return Math.round(hoursPerDay * 0.25 * 30 * 10) / 10;
}

export type ShieldTargetId = 'tt' | 'ig' | 'yt' | 'sc' | 'fb' | 'x';

export const SHIELD_TARGETS: ReadonlyArray<{
  id: ShieldTargetId;
  code: string;
  label: string;
  brand?: BrandAppId;
}> = [
  { id: 'tt', code: 'TT', label: 'Short-form', brand: 'tiktok' },
  { id: 'ig', code: 'IG', label: 'Image feeds', brand: 'instagram' },
  { id: 'yt', code: 'YT', label: 'Video', brand: 'youtube' },
  { id: 'sc', code: 'SC', label: 'Snaps', brand: 'snapchat' },
  { id: 'fb', code: 'FB', label: 'Social', brand: 'facebook' },
  { id: 'x', code: 'X', label: 'X', brand: 'x' },
];

const SHIELD_TARGET_BY_ID = Object.fromEntries(SHIELD_TARGETS.map((t) => [t.id, t])) as Record<
  ShieldTargetId,
  (typeof SHIELD_TARGETS)[number]
>;

export function selectedShieldTargets(ids: ShieldTargetId[]) {
  return ids.map((id) => SHIELD_TARGET_BY_ID[id]).filter(Boolean);
}

export const MIND_GOAL_OPTIONS = [
  '⏳ Reclaim my time',
  '📚 Focus on what matters',
  '☀️ Feel more present',
  '🧠 Reduce mindless scrolling',
  '💬 Spend more time with people',
  '🎨 Make time for my hobbies',
  '🌱 Build healthier habits',
  '✨ Be more intentional with my day',
] as const;

export const LIFE_GOAL_OPTIONS = [
  '💼 Grow my career',
  '📚 Learn something new',
  '💪 Improve my health',
  '❤️ Strengthen my relationships',
  '🎨 Be more creative',
  '🌍 Travel and explore',
  '💰 Build financial security',
  '🏡 Create a peaceful life',
  '🌱 Grow as a person',
  '🧘 Live more intentionally',
] as const;

export const LOVED_TIME_FREQUENCY_OPTIONS = [
  '🌱 Every day',
  '☀️ A few times a week',
  '🍃 Once in a while',
  '🌙 I can\u2019t remember',
] as const;

export const PHONE_RELATIONSHIP_OPTIONS = [
  '📱 I use it when I need it',
  '⚖️ We have a healthy balance',
  '⏳ I spend more time on it than I\u2019d like',
  '🌱 I\u2019m working on taking back control',
] as const;

export const SELF_RELATIONSHIP_OPTIONS = [
  '🌱 I\u2019m growing and learning',
  '⚖️ I feel mostly at peace with myself',
  '🌫️ I feel distracted or disconnected',
  '🌧️ I can be hard on myself sometimes',
  '🌿 I\u2019m working on improving it',
] as const;

export const LIFE_OBSTACLE_OPTIONS = [
  '📱 Social media distractions',
  '⏳ Procrastination',
  '🔋 Low energy',
  '🌪️ Stress or overthinking',
  '🕒 Not enough time',
  '🔁 Habit loops',
] as const;

export const APP_INTENT_OPTIONS = [
  '💬 Stay connected',
  '🔍 Learn something',
  '🎬 Be entertained',
  '⏳ Pass the time',
  '🌙 Unwind',
  '📣 Keep up with what\u2019s happening',
] as const;

export const FOCUS_VULNERABILITY_OPTIONS = [
  '📚 During deep work or studying',
  '🔄 Between tasks and activities',
  '🌙 Late at night',
] as const;

export const DEVICE_POSITION_OPTIONS = [
  '📱 On my desk',
  '👖 In my pocket/close by',
  '🚪 Out of reach',
] as const;

export const PHONE_PICKUP_OPTIONS = ['20–50', '50–100', 'over 100'] as const;
