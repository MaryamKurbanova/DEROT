import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamilies, spacing } from '../theme';

type ParticleSpec = { leftPct: number; topPct: number; duration: number; delay: number; drift: number };

type Props = {
  children: React.ReactNode;
  /** Session countdown, e.g. "0:30" */
  timerText: string;
  /** e.g. blurred close chip in top corners */
  headerAccessory?: React.ReactNode;
  /** Optional copy under the orb */
  bottomSlot?: React.ReactNode;
  /** Extra bottom padding (e.g. tab bar height above home indicator). */
  extraBottomInset?: number;
};

/** Deep navy → void black with a whisper of violet (luxury wellness). */
const GRADIENT_COLORS = ['#0B1022', '#05060C', '#0A0614'] as const;
const GRADIENT_LOCATIONS = [0, 0.52, 1] as const;

function FloatingParticles() {
  const specs = useMemo<ParticleSpec[]>(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        leftPct: ((i * 17 + 11) % 92) + 4,
        topPct: ((i * 23 + 7) % 78) + 8,
        duration: 5200 + (i % 5) * 900,
        delay: i * 140,
        drift: 4 + (i % 3) * 2,
      })),
    [],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {specs.map((s, i) => (
        <DriftDot key={i} {...s} />
      ))}
      {/* subtle static grain specks */}
      {specs.slice(0, 8).map((s, i) => (
        <View
          key={`g-${i}`}
          style={[
            styles.grainDot,
            {
              left: `${s.leftPct}%`,
              top: `${s.topPct + 12}%`,
              opacity: 0.035 + (i % 3) * 0.01,
            },
          ]}
        />
      ))}
    </View>
  );
}

function DriftDot({ leftPct, topPct, duration, delay, drift }: ParticleSpec) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(y, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(y, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }, delay);
    return () => clearTimeout(t);
  }, [y, duration, delay]);

  const translateY = y.interpolate({
    inputRange: [0, 1],
    outputRange: [-drift, drift],
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: `${leftPct}%`,
          top: `${topPct}%`,
          transform: [{ translateY }],
        },
      ]}
    />
  );
}

export function BreathingPremiumShell({
  children,
  timerText,
  headerAccessory,
  bottomSlot,
  extraBottomInset = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const introDim = useRef(new Animated.Value(1)).current;
  const radialPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    introDim.setValue(1);
    Animated.timing(introDim, {
      toValue: 0,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [introDim]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(radialPulse, {
          toValue: 1,
          duration: 8000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(radialPulse, {
          toValue: 0,
          duration: 8000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [radialPulse]);

  const haloScale = radialPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const haloOpacity = radialPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.22],
  });

  return (
    <LinearGradient colors={[...GRADIENT_COLORS]} locations={[...GRADIENT_LOCATIONS]} style={styles.flex}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.introVeil,
          {
            opacity: introDim,
          },
        ]}
      />
      <FloatingParticles />
      {/* ambient radial glow behind orb */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientGlow,
          {
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          },
        ]}
      />

      <View
        style={[
          styles.column,
          { paddingBottom: insets.bottom + extraBottomInset + spacing.sm },
        ]}
      >
        <View style={[styles.safeTop, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.topRow}>
            <View style={styles.topSideStart}>{headerAccessory ?? null}</View>
            <BlurChip intensity={Platform.OS === 'ios' ? 28 : 18} timerText={timerText} />
            <View style={styles.topSide} />
          </View>
        </View>

        <View style={styles.orbRegion}>{children}</View>

        {bottomSlot ? <View style={styles.bottomRegion}>{bottomSlot}</View> : null}
      </View>
    </LinearGradient>
  );
}

function BlurChip({ intensity, timerText }: { intensity: number; timerText: string }) {
  const inner = (
    <View style={styles.timerInner}>
      <Text style={styles.timerText} accessibilityRole="timer">
        {timerText}
      </Text>
    </View>
  );
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} tint="dark" style={styles.blurCapsule}>
        {inner}
      </BlurView>
    );
  }
  return <View style={[styles.blurCapsule, styles.blurFallback]}>{inner}</View>;
}

/** Minimal glass pill for “close” / secondary actions (iOS blur, Android frosted fallback). */
export function GlassPillButton({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const body = (
    <Text
      style={styles.pillLabel}
      numberOfLines={1}
      maxFontSizeMultiplier={1.2}
      importantForAccessibility="no"
    >
      {label}
    </Text>
  );
  const chip =
    Platform.OS === 'ios' ? (
      <BlurView intensity={26} tint="dark" style={styles.pillBlur}>
        {body}
      </BlurView>
    ) : (
      <View style={[styles.pillBlur, styles.blurFallback]}>{body}</View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.pillPress, pressed && { opacity: 0.7 }]}
    >
      {chip}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  introVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  ambientGlow: {
    position: 'absolute',
    alignSelf: 'center',
    top: '34%',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(120, 130, 220, 0.35)',
    marginTop: -170,
  },
  particle: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
    marginLeft: -1,
    marginTop: -1,
  },
  grainDot: {
    position: 'absolute',
    width: 1,
    height: 1,
    borderRadius: 0.5,
    backgroundColor: '#FFFFFF',
    marginLeft: -0.5,
    marginTop: -0.5,
  },
  column: {
    flex: 1,
  },
  safeTop: {
    paddingHorizontal: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topSide: {
    flex: 1,
  },
  topSideStart: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  blurCapsule: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  blurFallback: {
    backgroundColor: 'rgba(20,22,34,0.55)',
  },
  timerInner: {
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  timerText: {
    fontFamily: fontFamilies.uiLight,
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  orbRegion: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomRegion: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  pillPress: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  pillBlur: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  pillLabel: {
    fontFamily: fontFamilies.uiLight,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
