import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamilies, spacing } from '../theme';

const FG = '#FFFFFF';
const GREY = '#888888';

type Props = {
  onChanged: () => void;
};

/**
 * iOS Screen Time / Family Controls must be wired in native code. This panel refreshes JS state
 * and nudges the user; full authorization still requires a dev build with entitlements.
 */
export function IosScreenTimePanel({ onChanged }: Props) {
  if (Platform.OS !== 'ios') return null;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          onChanged();
        }}
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.72 }]}
      >
        <Text style={styles.btnText}>CHECK AUTHORIZATION STATE</Text>
      </Pressable>
      <Text style={styles.hint}>
        If you use a native build with Family Controls, grant access in the system sheet, then tap
        here to refresh status.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  btn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: fontFamilies.monoSemi,
    fontSize: 12,
    letterSpacing: 2,
    color: FG,
  },
  hint: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.ui,
    fontSize: 13,
    color: GREY,
    lineHeight: 19,
  },
});
