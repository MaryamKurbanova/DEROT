import { DEROT_SELECTION_ID, loadIosDeviceActivity } from './derotIosScreenTime';

export type DerotSelectionMeta = {
  applicationCount: number;
  categoryCount: number;
  webDomainCount: number;
  includeEntireCategory: boolean;
};

export function readDerotSelectionMeta(): DerotSelectionMeta | null {
  try {
    const da = loadIosDeviceActivity();
    if (!da?.isAvailable()) return null;

    const token = da.getFamilyActivitySelectionId(DEROT_SELECTION_ID);
    if (!token) return null;

    const { activitySelectionMetadata } =
      require('react-native-device-activity') as typeof import('react-native-device-activity');
    const meta = activitySelectionMetadata({ activitySelectionId: DEROT_SELECTION_ID });
    if (!meta) return null;
    return {
      applicationCount: meta.applicationCount ?? 0,
      categoryCount: meta.categoryCount ?? 0,
      webDomainCount: meta.webDomainCount ?? 0,
      includeEntireCategory: meta.includeEntireCategory ?? false,
    };
  } catch {
    return null;
  }
}

export function hasScreenTimeSelection(_meta: DerotSelectionMeta | null = readDerotSelectionMeta()): boolean {
  try {
    const da = loadIosDeviceActivity();
    if (!da?.isAvailable()) return false;
    const { AuthorizationStatus, getAuthorizationStatus } = da;
    return getAuthorizationStatus() === AuthorizationStatus.approved;
  } catch {
    return false;
  }
}

/** Label for the home Screen Time tile caption. */
export function formatScreenTimeScopeLabel(_meta: DerotSelectionMeta | null): string {
  return 'Today';
}

export function selectionTracksCategories(meta: DerotSelectionMeta | null): boolean {
  return (meta?.categoryCount ?? 0) > 0;
}
