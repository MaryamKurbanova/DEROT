import AsyncStorage from '@react-native-async-storage/async-storage';
import { DISTRACTION_APPS } from './distractionApps';

const STORAGE_KEY = 'unrot_monitored_app_ids';

const DEFAULT_IDS = () => DISTRACTION_APPS.map((a) => a.id);

export async function getMonitoredAppIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw == null) return DEFAULT_IDS();
  try {
    const arr = JSON.parse(raw) as string[];
    if (!Array.isArray(arr)) return DEFAULT_IDS();
    if (arr.length === 0) return [];
    const valid = new Set(DISTRACTION_APPS.map((a) => a.id));
    const filtered = arr.filter((id) => valid.has(id));
    return filtered.length > 0 ? filtered : DEFAULT_IDS();
  } catch {
    return DEFAULT_IDS();
  }
}

export async function setMonitoredAppIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export async function isAppMonitored(appId: string): Promise<boolean> {
  const ids = await getMonitoredAppIds();
  return ids.includes(appId);
}

export async function setAppMonitored(appId: string, on: boolean): Promise<void> {
  const ids = new Set(await getMonitoredAppIds());
  if (on) ids.add(appId);
  else ids.delete(appId);
  await setMonitoredAppIds([...ids]);
}
