import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  ROT_VELOCITY_EXPLANATION,
  ROT_VELOCITY_HIGH_ALERT,
  rotVelocityStatusFromCount,
} from '../lib/rotVelocity';
import { fontFamilies } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LABEL_MUTED = 'rgba(255,255,255,0.42)';
const EXPLAIN_COLOR = 'rgba(255,255,255,0.45)';
const HIGH_COLOR = '#FFB800';
const SPARK_LOW = '#222222';

const GRID_GUTTER = 24;

type Props = {
  triggerCount: number;
  buckets: number[];
};

function VelocitySparkPath({
  buckets,
  width,
  stroke,
  opacity,
}: {
  buckets: number[];
  width: number;
  stroke: string;
  opacity: Animated.AnimatedInterpolation<number> | Animated.Value;
}) {
  const h = 38;
  if (width < 8) return null;
  const max = Math.max(1, ...buckets);
  const n = buckets.length;
  const span = Math.max(1, n - 1);
  const step = width / span;
  const pts = buckets.map((v, i) => {
    const x = i * step;
    const t = v / max;
    const y = h - 2 - t * (h - 6);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const d = pts.map((p, i) => (i === 0 ? `M ${p}` : `L ${p}`)).join(' ');

  return (
    <Animated.View style={[styles.sparkSvg, { opacity }]}>
      <Svg width={width} height={h}>
        <Path d={d} fill="none" stroke={stroke} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

export function RotVelocityModule({ triggerCount, buckets }: Props) {
  const [explainOpen, setExplainOpen] = useState(false);
  const { width: screenW } = useWindowDimensions();
  const sparkW = Math.max(96, screenW - GRID_GUTTER * 2);
  const status = rotVelocityStatusFromCount(triggerCount);
  const isHigh = status === 'high';
  const sparkStroke = isHigh ? HIGH_COLOR : SPARK_LOW;

  const flicker = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 0.8, duration: 1100, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flicker]);

  const toggleExplain = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExplainOpen((o) => !o);
  }, []);

  const series = buckets.length ? buckets : new Array(60).fill(0);

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.headerSpacer} />
        <Pressable
          onPress={toggleExplain}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={explainOpen ? 'Hide velocity explanation' : 'Show velocity explanation'}
          style={({ pressed }) => [styles.infoBtn, pressed && { transform: [{ translateY: -2 }] }]}
          onPressIn={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        >
          <Text style={[styles.infoIcon, explainOpen && { color: '#FFFFFF' }]}>(i)</Text>
        </Pressable>
      </View>
      <View style={styles.sparkWrap}>
        <VelocitySparkPath buckets={series} width={sparkW} stroke={sparkStroke} opacity={flicker} />
      </View>
      {explainOpen ? <Text style={styles.explain}>{ROT_VELOCITY_EXPLANATION}</Text> : null}
      {isHigh ? <Text style={styles.highAdvice}>{ROT_VELOCITY_HIGH_ALERT}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  headerSpacer: {
    flex: 1,
  },
  infoBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  infoIcon: {
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    color: LABEL_MUTED,
  },
  sparkWrap: {
    marginTop: 4,
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  sparkSvg: {
    overflow: 'visible',
  },
  explain: {
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    lineHeight: 15,
    color: EXPLAIN_COLOR,
    fontStyle: 'italic',
    marginTop: 10,
    letterSpacing: 0.2,
  },
  highAdvice: {
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    lineHeight: 14,
    color: HIGH_COLOR,
    letterSpacing: 0.6,
    marginTop: 10,
    textTransform: 'uppercase',
  },
});
