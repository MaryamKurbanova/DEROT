import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'unrot_intercept_armed';

/**
 * Master switch for the ~60s focus ritual (Dashboard: ACTIVE / PAUSED).
 * When inactive, the exercise wall never opens; monitored-app list in Settings is unchanged.
 * When active, opening a monitored app can show the wall; completing it grants ~1h access for that app.
 */
export async function getInterceptArmed(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEY);
  if (v == null) return true;
  return v === '1';
}

export async function setInterceptArmed(armed: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, armed ? '1' : '0');
}
