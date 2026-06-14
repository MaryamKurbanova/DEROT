import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { pullTodayScreenTimeMinutes } from '../lib/derotIosScreenTime';

type Props = {
  onSynced?: () => void;
  /** When false, timers are not scheduled (e.g. journal view). */
  active?: boolean;
};

/**
 * Lightweight pulls from app-group storage — no long blocking poll on home mount.
 */
export function ScreenTimeReportProbe({ onSynced, active = true }: Props) {
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  useEffect(() => {
    if (Platform.OS !== 'ios' || !active) return;

    const pull = () => {
      try {
        pullTodayScreenTimeMinutes();
        onSyncedRef.current?.();
      } catch {
        /* native bridge may not be ready yet */
      }
    };

    pull();
    const t0 = setTimeout(pull, 400);
    const t1 = setTimeout(pull, 1500);
    const t2 = setTimeout(pull, 4000);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active]);

  return null;
}
