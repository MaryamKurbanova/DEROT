import { StyleSheet, Text, View } from 'react-native';
import { fontFamilies } from '../theme';

type Props = {
  title: string;
};

/** 7px caps sub-label + 30px rule; aligns to content grid (parent supplies padding). */
export function VoidSectionHeader({ title }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.rule} />
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 28,
    marginBottom: 12,
  },
  rule: {
    width: 30,
    height: 1,
    backgroundColor: 'rgba(68, 68, 68, 0.9)',
  },
  title: {
    fontFamily: fontFamilies.mono,
    fontSize: 7,
    color: '#444444',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
});
