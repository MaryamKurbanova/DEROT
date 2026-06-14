import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { DISTRACTION_APPS } from './distractionApps';
import { syncMonitoredIdsToNative } from './interceptBridge';
import { syncSocialLockFlagToNative } from './socialLockPassSchedule';

const SOCIAL_LOCK_KEY = 'unrot_social_lock_enabled';

export async function getSocialLockEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(SOCIAL_LOCK_KEY)) === '1';
}

export async function setSocialLockEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(SOCIAL_LOCK_KEY, on ? '1' : '0');
  if (Platform.OS === 'ios') {
    syncSocialLockFlagToNative(on);
  }
  const ids = on ? DISTRACTION_APPS.map((a) => a.id) : [];
  await syncMonitoredIdsToNative(ids);
}

/** All distraction apps when master lock is on; none when off. */
export async function getMonitoredAppIds(): Promise<string[]> {
  if (!(await getSocialLockEnabled())) return [];
  return DISTRACTION_APPS.map((a) => a.id);
}

export async function isAppMonitored(appId: string): Promise<boolean> {
  if (!(await getSocialLockEnabled())) return false;
  return DISTRACTION_APPS.some((a) => a.id === appId);
}
