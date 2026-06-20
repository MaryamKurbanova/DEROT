import { spacing, unrot, unrotFonts } from '../../theme';
import { BrandAppIcon, type BrandAppId } from '../../components/BrandAppIcon';

export const TOTAL_ONBOARDING_STEPS = 29;

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

export { spacing, unrot, unrotFonts };

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

export function impactStats(hours: number): { daysYear: number; yearsLife: number } {
  const daysYear = hours > 0 ? Math.round((hours * 365) / 24) : 0;
  const yearsLife = hours > 0 ? Math.round(((hours * 80) / 24) * 10) / 10 : 0;
  return { daysYear, yearsLife };
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

export const APP_INTENT_OPTIONS = [
  'Connecting with friends, messaging, and community updates',
  'Seeking information, tutorials, news, or inspiration',
  'Passive entertainment, white noise, and killing empty time',
] as const;

export const FOCUS_VULNERABILITY_OPTIONS = [
  'During deep-work or study sessions requiring high cognitive effort',
  'In transitions between tasks when my mind seeks quick stimulation',
  'Late at night when trying to wind down or fall asleep',
] as const;

export const DEVICE_POSITION_OPTIONS = [
  'Face-up on my desk directly within my field of vision',
  'In my pocket, prompting quick responses to haptic notifications',
  'Across the room or put away out of immediate reach',
] as const;
