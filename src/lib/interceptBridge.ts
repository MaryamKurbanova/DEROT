import { NativeEventEmitter, NativeModules, type NativeModule } from 'react-native';
export { requestInterceptWall } from './wallBridge';

/**
 * Native layer (required for real “open TikTok → wall” behavior):
 * When the user launches or brings a distraction app to the foreground, native code must
 * either call into JS `requestInterceptWall(distractionId)` or emit event `onDistractionLaunch`
 * on `NativeModules.UnrotIntercept` with `{ distractionId, nativeId }`.
 *
 * JS then opens the focus wall if: dashboard is ACTIVE, app is ON in Settings, and that app has
 * no valid hour pass. Completing the 60s exercise records stats and grants ~1h access for that
 * app only (`grantAccessPassForApp`).
 *
 * iOS: Family Controls / ManagedSettings / DeviceActivity (Screen Time) — optional shields to
 * block the target app until UNROT presents the ritual.
 * Android: AccessibilityService or similar to detect foreground package, optional overlay.
 * Expo Go: cannot ship this; use a dev build with native `UnrotIntercept`.
 */
export type AppLaunchPayload = {
  distractionId: string;
  /** Raw bundle / package for auditing */
  nativeId: string;
};

export type InterceptNativeModuleType = {
  /** Returns monitored bundle/package ids as JSON array string */
  getMonitoredIds?: () => Promise<string>;
  requestAuthorization?: () => Promise<boolean>;

  /**
   * iOS native should keep the current monitored list in sync with Settings.
   * Used for shielding + deciding which app ids are eligible to trigger the wall.
   */
  setMonitoredIds?: (ids: string[]) => Promise<void>;

  /** iOS native should keep the master ACTIVE/PAUSED in sync. */
  setInterceptArmed?: (armed: boolean) => Promise<void>;

  /**
   * Called when JS grants an access pass for `appId`.
   * native should unshield/block-lift for the `untilMs` window.
   */
  notifyAccessPassGranted?: (appId: string, untilMs: number) => Promise<void>;

  /** Called when JS clears access passes. native should remove any shields it added. */
  notifyAccessPassCleared?: (appId: string) => Promise<void>;

  /**
   * If native detected a monitored distraction app while JS was backgrounded,
   * it should return the latest pending `distractionId` and clear it so that
   * MainShell can open the focus wall the next time the user returns to UNROT.
   */
  getPendingDistractionId?: () => Promise<string | null>;
};

const NativeIntercept: InterceptNativeModuleType =
  (NativeModules as { UnrotIntercept?: InterceptNativeModuleType }).UnrotIntercept ?? {};

export const interceptNativeAvailable =
  typeof NativeIntercept.requestAuthorization === 'function';

/**
 * Listens for `onDistractionLaunch` from native `UnrotIntercept`. No-op until the module exists.
 */
export function subscribeDistractionLaunches(
  handler: (payload: AppLaunchPayload) => void,
): () => void {
  try {
    const mod = (NativeModules as { UnrotIntercept?: object }).UnrotIntercept;
    if (mod == null) return () => {};
    const emitter = new NativeEventEmitter(mod as NativeModule);
    const sub = emitter.addListener(
      'onDistractionLaunch',
      (e: { distractionId?: string; nativeId?: string }) => {
        const id = e?.distractionId;
        if (typeof id === 'string' && id.length > 0) {
          handler({
            distractionId: id,
            nativeId: typeof e?.nativeId === 'string' ? e.nativeId : '',
          });
        }
      },
    );
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

export async function requestInterceptAuthorization(): Promise<boolean> {
  if (typeof NativeIntercept.requestAuthorization === 'function') {
    try {
      return await NativeIntercept.requestAuthorization();
    } catch {
      return false;
    }
  }
  return false;
}

export async function syncMonitoredIdsToNative(ids: string[]): Promise<void> {
  try {
    if (typeof NativeIntercept.setMonitoredIds === 'function') {
      await NativeIntercept.setMonitoredIds(ids);
    }
  } catch {
    /* ignore */
  }
}

export async function syncInterceptArmedToNative(armed: boolean): Promise<void> {
  try {
    if (typeof NativeIntercept.setInterceptArmed === 'function') {
      await NativeIntercept.setInterceptArmed(armed);
    }
  } catch {
    /* ignore */
  }
}

export async function notifyAccessPassGrantedToNative(
  appId: string,
  untilMs: number,
): Promise<void> {
  try {
    if (typeof NativeIntercept.notifyAccessPassGranted === 'function') {
      await NativeIntercept.notifyAccessPassGranted(appId, untilMs);
    }
  } catch {
    /* ignore */
  }
}

export async function notifyAccessPassClearedToNative(appId: string): Promise<void> {
  try {
    if (typeof NativeIntercept.notifyAccessPassCleared === 'function') {
      await NativeIntercept.notifyAccessPassCleared(appId);
    }
  } catch {
    /* ignore */
  }
}

export async function getPendingDistractionIdFromNative(): Promise<string | null> {
  try {
    if (typeof NativeIntercept.getPendingDistractionId === 'function') {
      return await NativeIntercept.getPendingDistractionId();
    }
    return null;
  } catch {
    return null;
  }
}
