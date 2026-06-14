import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

type Props = {
  screenHrsDisplay: string;
  screenTimeCaption: string;
  screenTimeNeedsUnitSuffix: boolean;
  screenA11y: string;
  gradientColors: readonly [string, string, ...string[]];
  gradientLocations: readonly [number, number, ...number[]];
  styles: {
    metricBoxBase: object;
    monoLabelScreenTime: object;
    metricStat: object;
    metricStatUnit: object;
    metricCaption: object;
  };
};

/**
 * iOS uses the same gradient tile as other platforms.
 * Keep the implementation local here so the iOS resolver does not recurse
 * back into `ScreenTimeMetricTile.ios.tsx`.
 */
export function ScreenTimeMetricTile({
  screenHrsDisplay,
  screenTimeCaption,
  screenTimeNeedsUnitSuffix,
  screenA11y,
  gradientColors,
  gradientLocations,
  styles,
}: Props) {
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={screenA11y}>
      <LinearGradient
        colors={gradientColors}
        locations={gradientLocations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.metricBoxBase}
      >
        <Text style={styles.monoLabelScreenTime} importantForAccessibility="no">
          SCREEN TIME
        </Text>
        <Text style={styles.metricStat} importantForAccessibility="no">
          {screenHrsDisplay}
          {screenTimeNeedsUnitSuffix ? <Text style={styles.metricStatUnit}> h</Text> : null}
        </Text>
        <Text style={styles.metricCaption} importantForAccessibility="no">
          {screenTimeCaption}
        </Text>
      </LinearGradient>
    </View>
  );
}
