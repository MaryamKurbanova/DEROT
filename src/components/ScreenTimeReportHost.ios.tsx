import { useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import {
  DerotDeviceActivityChart,
  isDerotDeviceActivityChartLinked,
  resetDerotDeviceActivityChartLinkCache,
} from '../../modules/derot-device-activity-chart/src';
import {
  DEROT_SELECTION_ID,
  isIosScreenTimeApproved,
  setScreenTimeRuntimeReady,
} from '../lib/derotIosScreenTime';

type Props = {
  enabled?: boolean;
  /** Bump to remount Apple's report view and refresh today's total. */
  refreshToken?: number;
  /** When true, lay out inside parent (Settings) instead of off-screen. */
  inline?: boolean;
  /** When true with inline, show the native report in the layout (not hidden off-screen). */
  visible?: boolean;
};

const REPORT_SIZE = 320;

/**
 * Off-screen DeviceActivityReport host so the report extension can write
 * DEROT_REPORT_TODAY_MINUTES. iOS skips tiny or zero-opacity views — keep a real layout size.
 */
export function ScreenTimeReportHost({
  enabled = true,
  refreshToken = 0,
  inline = false,
  visible = false,
}: Props) {
  const [chartKey, setChartKey] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    setScreenTimeRuntimeReady(true);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !enabled) return;
    setChartKey((k) => k + 1);
  }, [enabled, refreshToken]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        resetDerotDeviceActivityChartLinkCache();
        setChartKey((k) => k + 1);
      }
    });
    return () => sub.remove();
  }, [enabled]);

  if (!enabled || Platform.OS !== 'ios') return null;

  let shouldRender = false;
  try {
    shouldRender = isIosScreenTimeApproved();
  } catch {
    shouldRender = false;
  }

  if (!shouldRender) return null;

  const chartLinked = isDerotDeviceActivityChartLinked();

  const showInline = inline && visible;
  const reportHeight = showInline ? 120 : REPORT_SIZE;

  return (
    <View
      pointerEvents={showInline ? 'auto' : 'none'}
      collapsable={false}
      style={
        showInline
          ? { width: '100%', height: reportHeight, opacity: 1, overflow: 'hidden' }
          : inline
            ? { width: '100%', height: REPORT_SIZE, opacity: 1, overflow: 'hidden' }
            : {
                position: 'absolute',
                top: 0,
                left: -REPORT_SIZE,
                width: REPORT_SIZE,
                height: REPORT_SIZE,
                opacity: 1,
                overflow: 'hidden',
              }
      }
    >
      {chartLinked ? (
        <DerotDeviceActivityChart
          key={chartKey}
          familyActivitySelectionId={DEROT_SELECTION_ID}
          style={{ width: '100%', height: reportHeight }}
        />
      ) : null}
    </View>
  );
}
