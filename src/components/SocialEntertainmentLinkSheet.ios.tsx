import { useCallback, useRef } from 'react';
import { type NativeSyntheticEvent } from 'react-native';
import { DeviceActivitySelectionSheetViewPersisted } from 'react-native-device-activity';
import {
  isSocialLockSelectionLinked,
  SOCIAL_LOCK_SELECTION_ID,
  syncMonitoredAppShields,
} from '../lib/monitoredAppShield';

type SelectionMeta = {
  applicationCount?: number;
  categoryCount?: number;
  webDomainCount?: number;
  includeEntireCategory?: boolean;
};

type Props = {
  visible: boolean;
  /** cancelled=true when user closed without choosing any apps/categories */
  onDismiss: (cancelled: boolean) => void;
  onLinked?: () => void;
};

function hasSelection(meta: SelectionMeta): boolean {
  return (meta.applicationCount ?? 0) > 0 || (meta.categoryCount ?? 0) > 0;
}

/** One-time iOS picker: select social & entertainment apps (or categories) to lock together. */
export function SocialEntertainmentLinkSheet({ visible, onDismiss, onLinked }: Props) {
  const lastMetaRef = useRef<SelectionMeta | null>(null);

  const finishIfReady = useCallback(async () => {
    const linked = isSocialLockSelectionLinked() || hasSelection(lastMetaRef.current ?? {});
    if (!linked) return false;
    await syncMonitoredAppShields();
    onLinked?.();
    onDismiss(false);
    return true;
  }, [onDismiss, onLinked]);

  const handleSelectionChange = useCallback(
    (event: NativeSyntheticEvent<SelectionMeta>) => {
      lastMetaRef.current = event.nativeEvent;
    },
    [],
  );

  const handleDismissRequest = useCallback(() => {
    // Native persists selection on a short debounce — wait before we decide success vs cancel.
    setTimeout(() => {
      void finishIfReady().then((ok) => {
        if (!ok) onDismiss(true);
      });
    }, 300);
  }, [finishIfReady, onDismiss]);

  if (!visible) return null;

  return (
    <DeviceActivitySelectionSheetViewPersisted
      familyActivitySelectionId={SOCIAL_LOCK_SELECTION_ID}
      includeEntireCategory
      headerText="Social & entertainment apps"
      footerText="Select the apps or categories you want locked until you complete your log."
      onSelectionChange={handleSelectionChange}
      onDismissRequest={handleDismissRequest}
    />
  );
}
