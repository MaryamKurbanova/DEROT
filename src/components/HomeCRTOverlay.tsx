import { useMemo } from 'react';
import type { Animated } from 'react-native';
import { Animated as RNAnimated, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Line, RadialGradient, Rect, Stop, Defs } from 'react-native-svg';

/** Full-screen CRT: vignette + subtle grain (≈1% feel) + drifting scanline. pointerEvents: none */
export function HomeCRTOverlay({
  scanlineTranslateY,
}: {
  scanlineTranslateY: Animated.AnimatedInterpolation<number>;
}) {
  const { width: w, height: h } = useWindowDimensions();

  const grainLines = useMemo(() => {
    const lines: { x1: string; y1: string; x2: string; y2: string; o: number }[] = [];
    let seed = 1337;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 180; i++) {
      const x1 = `${(rnd() * 100).toFixed(2)}%`;
      const y1 = `${(rnd() * 100).toFixed(2)}%`;
      const x2 = `${(rnd() * 100).toFixed(2)}%`;
      const y2 = `${(rnd() * 100).toFixed(2)}%`;
      lines.push({ x1, y1, x2, y2, o: 0.012 + rnd() * 0.018 });
    }
    return lines;
  }, [w, h]);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="vignetteLux" cx="50%" cy="48%" r="72%">
            <Stop offset="0%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="58%" stopColor="#000000" stopOpacity={0.14} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0.56} />
          </RadialGradient>
        </Defs>
        <Rect width={w} height={h} fill="url(#vignetteLux)" />
        {grainLines.map((ln, i) => (
          <Line
            key={i}
            x1={ln.x1}
            y1={ln.y1}
            x2={ln.x2}
            y2={ln.y2}
            stroke="rgba(255,255,255,1)"
            strokeWidth={0.35}
            opacity={ln.o}
          />
        ))}
      </Svg>
      <RNAnimated.View
        style={[
          styles.scanline,
          { width: w, transform: [{ translateY: scanlineTranslateY }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  scanline: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 1,
    backgroundColor: '#FFFFFF',
    opacity: 0.05,
  },
});
