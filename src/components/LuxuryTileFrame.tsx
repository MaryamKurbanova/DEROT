import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { fontFamilies } from '../theme';

const TILE_BG = 'rgba(255, 255, 255, 0.03)';
const TILE_BORDER = 'rgba(255, 255, 255, 0.1)';
const CORNER_MUTED = 'rgba(255, 255, 255, 0.35)';

type Props = {
  children: ReactNode;
  refTL?: string;
  refTR?: string;
  refBL?: string;
  refBR?: string;
  /** High-visibility amber outline (velocity hot state). */
  highOutline?: boolean;
  style?: ViewStyle;
};

export function LuxuryTileFrame({
  children,
  refTL = 'REF_000',
  refTR = 'SYS_A',
  refBL = 'IDX_00',
  refBR = 'LOG_RAW',
  highOutline = false,
  style,
}: Props) {
  return (
    <View
      style={[
        styles.tile,
        highOutline && styles.tileHigh,
        style,
      ]}
    >
      <Text style={[styles.corner, styles.cornerTL]}>{refTL}</Text>
      <Text style={[styles.corner, styles.cornerTR]}>{refTR}</Text>
      <Text style={[styles.corner, styles.cornerBL]}>{refBL}</Text>
      <Text style={[styles.corner, styles.cornerBR]}>{refBR}</Text>
      <View style={styles.tileInner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: TILE_BG,
    borderWidth: 0.5,
    borderColor: TILE_BORDER,
    borderRadius: 2,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
    position: 'relative',
    overflow: 'visible',
  },
  tileHigh: {
    borderColor: '#FFB800',
    borderWidth: 1,
  },
  tileInner: {
    paddingTop: 22,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  corner: {
    position: 'absolute',
    fontFamily: fontFamilies.mono,
    fontSize: 6,
    letterSpacing: 0.8,
    color: CORNER_MUTED,
    textTransform: 'uppercase',
    zIndex: 2,
  },
  cornerTL: { top: 6, left: 8 },
  cornerTR: { top: 6, right: 8 },
  cornerBL: { bottom: 6, left: 8 },
  cornerBR: { bottom: 6, right: 8 },
});
