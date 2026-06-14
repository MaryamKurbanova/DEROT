import { StyleSheet, Text, View } from 'react-native';
import { unrot, unrotFonts } from '../theme';

type Props = {
  onSelectionChange?: () => void;
  refreshToken?: number;
};

/** Non-iOS stub — Screen Time is iPhone-only. */
export function ScreenTimeView(_props: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.body}>Screen Time is available on iPhone only.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 8 },
  body: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 20,
    color: unrot.muted,
  },
});
