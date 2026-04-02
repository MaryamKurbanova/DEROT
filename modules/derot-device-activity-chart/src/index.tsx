import { requireNativeViewManager } from 'expo-modules-core';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';

type NativeProps = {
  familyActivitySelectionId: string;
  style?: StyleProp<ViewStyle>;
};

const NativeChartView = (() => {
  try {
    return requireNativeViewManager<NativeProps>('DerotDeviceActivityChart');
  } catch {
    return null;
  }
})();

export type DerotDeviceActivityChartProps = {
  familyActivitySelectionId: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Embeds Apple’s `DeviceActivityReport` (SwiftUI) for the given persisted Family Activity selection.
 * Requires a **native iOS build** with the `DerotDeviceActivityReport` extension target (prebuild) and iOS 16+.
 */
export function DerotDeviceActivityChart({
  familyActivitySelectionId,
  style,
}: DerotDeviceActivityChartProps) {
  if (Platform.OS !== 'ios' || NativeChartView == null) {
    return null;
  }
  return (
    <NativeChartView familyActivitySelectionId={familyActivitySelectionId} style={style} />
  );
}
