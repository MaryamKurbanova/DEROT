import { requireNativeViewManager, requireOptionalNativeModule } from 'expo-modules-core';
import { useMemo } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';

type NativeProps = {
  familyActivitySelectionId: string;
  style?: StyleProp<ViewStyle>;
};

type NativeModule = {
  isAvailable?: () => boolean;
  ensureAppSelectionForBundle?: (appId: string, bundleIdentifier: string) => boolean;
};

export type DerotDeviceActivityChartProps = {
  familyActivitySelectionId: string;
  style?: StyleProp<ViewStyle>;
};

const NATIVE_MODULE_NAME = 'DerotDeviceActivityChart';

let chartLinkedCache: boolean | null = null;

function probeNativeModule(): boolean {
  try {
    const mod = requireOptionalNativeModule<NativeModule>(NATIVE_MODULE_NAME);
    if (mod?.isAvailable?.() === true) return true;
    if (mod != null) return true;
    const expoModules = (globalThis as { expo?: { modules?: Record<string, unknown> } }).expo?.modules;
    return expoModules?.[NATIVE_MODULE_NAME] != null;
  } catch {
    return false;
  }
}

/** Reset after a native rebuild so detection is re-run. */
export function resetDerotDeviceActivityChartLinkCache(): void {
  chartLinkedCache = null;
}

/**
 * True when the iOS dev build includes the DeviceActivityReport host module.
 */
export function isDerotDeviceActivityChartLinked(): boolean {
  if (Platform.OS !== 'ios') return false;
  if (chartLinkedCache != null) return chartLinkedCache;
  chartLinkedCache = probeNativeModule();
  return chartLinkedCache;
}

/**
 * Resolve a Screen Time token for a known bundle id and store it as derot_lock_{appId}.
 * When this succeeds, toggling an app ON can lock it immediately without a picker.
 */
export function ensureAppSelectionForBundle(appId: string, bundleIdentifier: string): boolean {
  if (Platform.OS !== 'ios' || !isDerotDeviceActivityChartLinked()) return false;
  try {
    const mod = requireOptionalNativeModule<NativeModule>(NATIVE_MODULE_NAME);
    return mod?.ensureAppSelectionForBundle?.(appId, bundleIdentifier) === true;
  } catch {
    return false;
  }
}

function loadNativeChartView() {
  if (!isDerotDeviceActivityChartLinked()) return null;
  try {
    return requireNativeViewManager<NativeProps>(NATIVE_MODULE_NAME);
  } catch {
    return null;
  }
}

/**
 * Embeds Apple's DeviceActivityReport when the native module is in the iOS build.
 * Returns null if the module is missing (avoids crash / black screen in dev client).
 */
export function DerotDeviceActivityChart({
  familyActivitySelectionId,
  style,
}: DerotDeviceActivityChartProps) {
  const linked = isDerotDeviceActivityChartLinked();
  const NativeChartView = useMemo(() => {
    if (Platform.OS !== 'ios' || !linked) return null;
    return loadNativeChartView();
  }, [linked]);

  if (!linked || NativeChartView == null) {
    return null;
  }
  return (
    <NativeChartView familyActivitySelectionId={familyActivitySelectionId} style={style} />
  );
}
