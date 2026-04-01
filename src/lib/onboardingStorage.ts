import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_DONE = 'unrot_onboarding_complete';
const KEY_NAME = 'unrot_onboarding_name';
const KEY_AGE = 'unrot_onboarding_age';
const KEY_HOURS = 'unrot_onboarding_hours_daily';
/** Pre-app daily average (social + entertainment), minutes — set from onboarding hours/day. */
const KEY_BASELINE_MINUTES = 'unrot_daily_baseline_minutes';

export async function getOnboardingComplete(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEY_DONE);
  return v === '1';
}

export async function setOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEY_DONE, '1');
}

export async function resetOnboardingForDev(): Promise<void> {
  await AsyncStorage.multiRemove([KEY_DONE, KEY_NAME, KEY_AGE, KEY_HOURS, KEY_BASELINE_MINUTES]);
}

function hoursPerDayToBaselineMinutes(raw: string): number {
  const n = parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(Math.min(n, 24) * 60);
}

export async function saveOnboardingProfile(input: {
  name: string;
  age: string;
  hoursPerDay: string;
}): Promise<void> {
  const baselineMin = hoursPerDayToBaselineMinutes(input.hoursPerDay);
  await AsyncStorage.multiSet([
    [KEY_NAME, input.name],
    [KEY_AGE, input.age],
    [KEY_HOURS, input.hoursPerDay],
    [KEY_BASELINE_MINUTES, String(baselineMin)],
  ]);
}

export async function getStoredProfile(): Promise<{
  name: string;
  age: string;
  hoursPerDay: string;
}> {
  const [[, name], [, age], [, hours]] = await AsyncStorage.multiGet([KEY_NAME, KEY_AGE, KEY_HOURS]);
  return {
    name: name ?? '',
    age: age ?? '',
    hoursPerDay: hours ?? '',
  };
}

/** Daily baseline from onboarding (social + entertainment), in minutes. */
export async function getDailyBaselineMinutes(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY_BASELINE_MINUTES);
  if (raw != null) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  const p = await getStoredProfile();
  return hoursPerDayToBaselineMinutes(p.hoursPerDay);
}
