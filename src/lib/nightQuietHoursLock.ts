import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { DEROT_SELECTION_ID, loadIosDeviceActivity } from './derotIosScreenTime';

/** Separate from usage monitoring schedule — interval-only 8 PM → 8 AM. */
export const NIGHT_QUIET_ACTIVITY_NAME = 'DerotNightQuiet';

const STORAGE_KEY = 'derot_night_quiet_hours_enabled';

export async function getNightQuietHoursEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(STORAGE_KEY)) === '1';
}

export async function setNightQuietHoursEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, on ? '1' : '0');
}

export async function startNightQuietSchedule(): Promise<void> {
  const da = loadIosDeviceActivity();
  if (!da?.isAvailable()) {
    throw new Error('Screen Time needs a native iOS build (not Expo Go).');
  }

  const { AuthorizationStatus, configureActions, startMonitoring, cleanUpAfterActivity } = da;

  if (da.getAuthorizationStatus() !== AuthorizationStatus.approved) {
    throw new Error('Approve Screen Time access first.');
  }

  if (!da.getFamilyActivitySelectionId(DEROT_SELECTION_ID)) {
    throw new Error(
      'Choose TikTok, YouTube, Instagram, Snapchat, Facebook (or categories) in the picker below.',
    );
  }

  da.stopMonitoring([NIGHT_QUIET_ACTIVITY_NAME]);
  cleanUpAfterActivity(NIGHT_QUIET_ACTIVITY_NAME);

  configureActions({
    activityName: NIGHT_QUIET_ACTIVITY_NAME,
    callbackName: 'intervalDidStart',
    actions: [{ type: 'blockSelection', familyActivitySelectionId: DEROT_SELECTION_ID }],
  });

  configureActions({
    activityName: NIGHT_QUIET_ACTIVITY_NAME,
    callbackName: 'intervalDidEnd',
    actions: [{ type: 'unblockSelection', familyActivitySelectionId: DEROT_SELECTION_ID }],
  });

  await startMonitoring(
    NIGHT_QUIET_ACTIVITY_NAME,
    {
      intervalStart: { hour: 20, minute: 0, second: 0 },
      intervalEnd: { hour: 8, minute: 0, second: 0 },
      repeats: true,
    },
    [],
  );

  da.reloadDeviceActivityCenter();
}

export function stopNightQuietSchedule(): void {
  const da = loadIosDeviceActivity();
  if (!da?.isAvailable()) return;

  da.stopMonitoring([NIGHT_QUIET_ACTIVITY_NAME]);
  da.cleanUpAfterActivity(NIGHT_QUIET_ACTIVITY_NAME);
  try {
    da.unblockSelection({ activitySelectionId: DEROT_SELECTION_ID }, 'derot_night_quiet_off');
  } catch {
    // ignore
  }
  da.reloadDeviceActivityCenter();
}

/** Re-apply schedule after app relaunch if the user left night lock on. */
export async function syncNightQuietIfEnabled(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  if (!(await getNightQuietHoursEnabled())) return;
  try {
    await startNightQuietSchedule();
  } catch {
    // selection or auth may be missing; user can fix in Settings
  }
}
