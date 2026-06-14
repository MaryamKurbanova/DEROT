import { StyleSheet, Text, View } from 'react-native';
import { ScreenTimeReportHost } from './ScreenTimeReportHost';
import { unrot, unrotFonts } from '../theme';

type Props = {
  onSelectionChange?: () => void;
  refreshToken?: number;
};

/** Hidden report host used during Settings sync (no visible picker). */
export function ScreenTimeView({ refreshToken = 0 }: Props) {
  return (
    <View style={styles.root}>
      <ScreenTimeReportHost enabled inline refreshToken={refreshToken} />
      <Text style={styles.note}>Screen Time tracks all apps for today after you approve access.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
  note: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    lineHeight: 18,
    color: unrot.muted,
  },
});
