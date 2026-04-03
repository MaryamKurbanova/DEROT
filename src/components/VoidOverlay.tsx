import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Line, RadialGradient, Rect, Stop } from 'react-native-svg';

const GRAIN = 'rgba(255,255,255,0.015)';
/**
 * HUD void: #000 base, heavy edge vignette, film grain, 1px center crosshair (behind core readout).
 * pointerEvents: none
 */
export function VoidOverlay() {
  const { width: w, height: h } = useWindowDimensions();
  const cx = w / 2;
  const cy = h / 2;
  const cross = 14;

  const grainLines = useMemo(() => {
    const lines: { x1: string; y1: string; x2: string; y2: string; o: number }[] = [];
    let seed = 22411;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 180; i++) {
      lines.push({
        x1: `${(rnd() * 100).toFixed(2)}%`,
        y1: `${(rnd() * 100).toFixed(2)}%`,
        x2: `${(rnd() * 100).toFixed(2)}%`,
        y2: `${(rnd() * 100).toFixed(2)}%`,
        o: 0.012 + rnd() * 0.018,
      });
    }
    return lines;
  }, [w, h]);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.grainWash} />
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="voidVigTL" cx="0%" cy="0%" rx="58%" ry="58%">
            <Stop offset="0%" stopColor="#000000" stopOpacity={0.82} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="voidVigTR" cx="100%" cy="0%" rx="58%" ry="58%">
            <Stop offset="0%" stopColor="#000000" stopOpacity={0.82} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="voidVigBL" cx="0%" cy="100%" rx="58%" ry="58%">
            <Stop offset="0%" stopColor="#000000" stopOpacity={0.82} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="voidVigBR" cx="100%" cy="100%" rx="58%" ry="58%">
            <Stop offset="0%" stopColor="#000000" stopOpacity={0.82} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="voidVigRing" cx="50%" cy="50%" r="68%">
            <Stop offset="0%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="75%" stopColor="#000000" stopOpacity={0.35} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0.72} />
          </RadialGradient>
        </Defs>
        <Rect width={w} height={h} fill="url(#voidVigTL)" />
        <Rect width={w} height={h} fill="url(#voidVigTR)" />
        <Rect width={w} height={h} fill="url(#voidVigBL)" />
        <Rect width={w} height={h} fill="url(#voidVigBR)" />
        <Rect width={w} height={h} fill="url(#voidVigRing)" />
        <Line
          x1={cx - cross}
          y1={cy}
          x2={cx + cross}
          y2={cy}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={1}
        />
        <Line
          x1={cx}
          y1={cy - cross}
          x2={cx}
          y2={cy + cross}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={1}
        />
        {grainLines.map((ln, i) => (
          <Line
            key={i}
            x1={ln.x1}
            y1={ln.y1}
            x2={ln.x2}
            y2={ln.y2}
            stroke="rgba(255,255,255,1)"
            strokeWidth={0.3}
            opacity={ln.o}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 0,
  },
  grainWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GRAIN,
  },
});
