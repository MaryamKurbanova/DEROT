import { Platform } from 'react-native';
import type { ActivitySelectionInput } from 'react-native-device-activity';
import type { ShieldActions, ShieldConfiguration } from 'react-native-device-activity';
import { DISTRACTION_APPS } from './distractionApps';
import { expireMonitoredPassIfNeeded, isMonitoredPassActive } from './accessPass';
import { isIosScreenTimeApproved, loadIosDeviceActivity } from './derotIosScreenTime';
import { getSocialLockEnabled } from './monitoredApps';
import {
  cancelSocialLockPassRelockSchedule,
  syncSocialLockFlagToNative,
} from './socialLockPassSchedule';

/** One Screen Time selection for all social & entertainment apps. */
export const SOCIAL_LOCK_SELECTION_ID = 'derot_social_entertainment_lock';

const SHIELD_CONFIG_PREFIX = 'shieldConfigurationForSelection_';
const SHIELD_ACTIONS_PREFIX = 'shieldActionsForSelection_';

type DeviceActivityApi = NonNullable<ReturnType<typeof loadIosDeviceActivity>>;
type SelectionRef = ActivitySelectionInput & { activitySelectionId: string };

function loadDeviceActivityApi() {
  if (Platform.OS !== 'ios') return null;
  try {
    return require('react-native-device-activity') as typeof import('react-native-device-activity');
  } catch {
    return null;
  }
}

function selectionRef(): SelectionRef {
  return { activitySelectionId: SOCIAL_LOCK_SELECTION_ID };
}

function safeRemoveFromWhitelist(da: DeviceActivityApi, selection: SelectionRef, triggeredBy: string): void {
  try {
    da.removeSelectionFromWhitelistAndUpdateBlock(selection, triggeredBy);
  } catch {
    /* selection may not be whitelisted */
  }
}

/** Keep blocklist intact; whitelist bypasses shields until the pass ends. */
function unlockForPass(da: DeviceActivityApi, selection: SelectionRef): void {
  da.blockSelection(selection, 'derot_social_lock');
  try {
    da.addSelectionToWhitelistAndUpdateBlock(selection, 'derot_pass_unlock');
  } catch {
    // Categories without includeEntireCategory cannot whitelist — fall back to full unblock.
    da.unblockSelection(selection, 'derot_pass_unlock_legacy');
  }
}

/** Drop whitelist first (instant re-lock when blocklist still holds the selection), then ensure blocked. */
function relockAfterPass(da: DeviceActivityApi, selection: SelectionRef): void {
  safeRemoveFromWhitelist(da, selection, 'derot_pass_expired');
  da.blockSelection(selection, 'derot_social_lock');
  try {
    da.refreshManagedSettingsStore();
    da.reloadDeviceActivityCenter();
  } catch {
    /* ignore */
  }
}

export function isSocialLockSelectionLinked(): boolean {
  try {
    const da = loadIosDeviceActivity();
    const api = loadDeviceActivityApi();
    if (!da?.isAvailable() || !api) return false;

    if (!da.getFamilyActivitySelectionId(SOCIAL_LOCK_SELECTION_ID)) return false;

    const meta = api.activitySelectionMetadata({ activitySelectionId: SOCIAL_LOCK_SELECTION_ID });
    return (meta?.applicationCount ?? 0) > 0 || (meta?.categoryCount ?? 0) > 0;
  } catch {
    return false;
  }
}

function writeSocialLockShield(): void {
  const da = loadIosDeviceActivity();
  if (!da?.isAvailable()) return;

  const shieldConfiguration: ShieldConfiguration = {
    title: 'Locked by UNROT',
    subtitle: 'Complete your log in UNROT to unlock these apps.',
    primaryButtonLabel: 'Open UNROT',
    primaryButtonBackgroundColor: { red: 26, green: 26, blue: 26, alpha: 1 },
    primaryButtonLabelColor: { red: 255, green: 255, blue: 255, alpha: 1 },
    iconSystemName: 'hand.raised.fill',
  };

  const shieldActions = {
    primary: {
      behavior: 'close' as const,
      type: 'openUrl',
      url: 'derot://',
    },
    secondary: {
      behavior: 'close' as const,
    },
  } as unknown as ShieldActions;

  da.userDefaultsSet(`${SHIELD_CONFIG_PREFIX}${SOCIAL_LOCK_SELECTION_ID}`, {
    ...shieldConfiguration,
    updatedAt: new Date().toISOString(),
  });
  da.userDefaultsSet(`${SHIELD_ACTIONS_PREFIX}${SOCIAL_LOCK_SELECTION_ID}`, {
    ...shieldActions,
    updatedAt: new Date().toISOString(),
  });
}

function clearLegacyPerAppBlocks(da: DeviceActivityApi): void {
  for (const app of DISTRACTION_APPS) {
    const legacy = { activitySelectionId: `derot_lock_${app.id}` };
    try {
      da.removeSelectionFromWhitelistAndUpdateBlock(legacy, 'derot_legacy_cleanup');
      da.unblockSelection(legacy, 'derot_legacy_cleanup');
    } catch {
      /* ignore */
    }
  }
}

/**
 * Block or unblock the shared social/entertainment selection based on master toggle + pass.
 */
export async function syncMonitoredAppShields(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const da = loadIosDeviceActivity();
  if (!da?.isAvailable() || !isIosScreenTimeApproved()) return;

  clearLegacyPerAppBlocks(da);

  await expireMonitoredPassIfNeeded();

  const selection = selectionRef();
  const socialLockOn = await getSocialLockEnabled();
  const linked = isSocialLockSelectionLinked();
  syncSocialLockFlagToNative(socialLockOn);

  if (!socialLockOn || !linked) {
    cancelSocialLockPassRelockSchedule();
    safeRemoveFromWhitelist(da, selection, 'derot_social_off');
    da.unblockSelection(selection, 'derot_social_off');
    return;
  }

  writeSocialLockShield();

  const passActive = await isMonitoredPassActive();

  if (passActive) {
    unlockForPass(da, selection);
    try {
      da.refreshManagedSettingsStore();
    } catch {
      /* ignore */
    }
    return;
  }

  cancelSocialLockPassRelockSchedule();
  relockAfterPass(da, selection);
}

export async function ensureScreenTimeApprovedForLock(): Promise<boolean> {
  const da = loadIosDeviceActivity();
  if (!da?.isAvailable()) return false;

  const { AuthorizationStatus, getAuthorizationStatus, requestAuthorization } = da;
  if (getAuthorizationStatus() !== AuthorizationStatus.approved) {
    await requestAuthorization('individual');
  }
  return getAuthorizationStatus() === AuthorizationStatus.approved;
}
