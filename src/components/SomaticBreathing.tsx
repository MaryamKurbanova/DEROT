import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors, fontFamilies, spacing } from '../theme';

const INHALE_MS = 5000;
const EXHALE_MS = 5000;

/** Inner disc starts tiny; scales to 1 = flush with inside of the outer ring. */
const SCALE_MIN = 0.08;
const SCALE_MAX = 1;

/** Outer ring subtle pulse (1–2% feel). */
const RING_INHALE_SCALE = 1.017;
const RING_EXHALE_SCALE = 1;

type Phase = 'inhale' | 'exhale';

type Props = {
  variant?: 'default' | 'zen';
  secondsRemaining?: number;
  /** Outer disc diameter (px). */
  outerDiameter?: number;
};

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

const DEFAULT_OUTER = 200;
const RING_STROKE = 2;

const easing = Easing.inOut(Easing.ease);

export function SomaticBreathing({
  variant = 'default',
  secondsRemaining,
  outerDiameter = DEFAULT_OUTER,
}: Props) {
  const scale = useRef(new Animated.Value(SCALE_MIN)).current;
  const shellOpacity = useRef(new Animated.Value(variant === 'zen' ? 0.48 : 0.42)).current;
  const glowOpacity = useRef(new Animated.Value(variant === 'zen' ? 0.07 : 0.03)).current;
  const ringPulse = useRef(new Animated.Value(RING_EXHALE_SCALE)).current;

  const [phase, setPhase] = useState<Phase>('inhale');
  const prevPhaseRef = useRef<Phase | null>(null);
  const breathSoundRef = useRef<Audio.Sound | null>(null);
  const isZen = variant === 'zen';

  const gradientId = useMemo(() => `breath-rg-${Math.random().toString(36).slice(2, 10)}`, []);

  useEffect(() => {
    void (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
        });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    const inhale = Animated.parallel([
      Animated.timing(scale, {
        toValue: SCALE_MAX,
        duration: INHALE_MS,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(shellOpacity, {
        toValue: isZen ? 0.96 : 0.88,
        duration: INHALE_MS,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: isZen ? 0.44 : 0.12,
        duration: INHALE_MS,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(ringPulse, {
        toValue: RING_INHALE_SCALE,
        duration: INHALE_MS,
        easing,
        useNativeDriver: true,
      }),
    ]);
    const exhale = Animated.parallel([
      Animated.timing(scale, {
        toValue: SCALE_MIN,
        duration: EXHALE_MS,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(shellOpacity, {
        toValue: isZen ? 0.48 : 0.42,
        duration: EXHALE_MS,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: isZen ? 0.07 : 0.03,
        duration: EXHALE_MS,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(ringPulse, {
        toValue: RING_EXHALE_SCALE,
        duration: EXHALE_MS,
        easing,
        useNativeDriver: true,
      }),
    ]);
    const loop = Animated.loop(Animated.sequence([inhale, exhale]));
    loop.start();
    return () => {
      loop.stop();
      scale.setValue(SCALE_MIN);
      shellOpacity.setValue(isZen ? 0.48 : 0.42);
      glowOpacity.setValue(isZen ? 0.07 : 0.03);
      ringPulse.setValue(RING_EXHALE_SCALE);
    };
  }, [scale, shellOpacity, glowOpacity, ringPulse, isZen]);

  useEffect(() => {
    setPhase('inhale');
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = (next: Phase, delayMs: number) => {
      if (cancelled) return;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setPhase(next);
        const following = next === 'inhale' ? 'exhale' : 'inhale';
        const pause = next === 'inhale' ? INHALE_MS : EXHALE_MS;
        scheduleNext(following, pause);
      }, delayMs);
    };

    scheduleNext('exhale', INHALE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (prevPhaseRef.current === phase) return;
    prevPhaseRef.current = phase;

    const src =
      phase === 'inhale'
        ? require('../../assets/sounds/breath-inhale.wav')
        : require('../../assets/sounds/breath-exhale.wav');

    let cancelled = false;

    void (async () => {
      const prev = breathSoundRef.current;
      breathSoundRef.current = null;
      if (prev) {
        try {
          await prev.stopAsync();
        } catch {
          /* ignore */
        }
        try {
          await prev.unloadAsync();
        } catch {
          /* ignore */
        }
      }
      if (cancelled) return;

      try {
        const { sound } = await Audio.Sound.createAsync(
          src,
          {
            shouldPlay: true,
            volume: 0.38,
            isLooping: false,
          },
          (st) => {
            if (!st.isLoaded || !st.didJustFinish) return;
            void sound.unloadAsync();
            if (breathSoundRef.current === sound) breathSoundRef.current = null;
          },
        );
        if (cancelled) {
          void sound.unloadAsync();
          return;
        }
        breathSoundRef.current = sound;
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase]);

  useEffect(() => {
    return () => {
      const s = breathSoundRef.current;
      breathSoundRef.current = null;
      if (s) void s.unloadAsync();
    };
  }, []);

  /** Zen: transition pulse + inhale ramp + soft exhale. */
  useEffect(() => {
    if (!isZen) return;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    void Haptics.selectionAsync();

    if (phase === 'inhale') {
      const ramp: { at: number; style: Haptics.ImpactFeedbackStyle }[] = [
        { at: 0, style: Haptics.ImpactFeedbackStyle.Light },
        { at: 1100, style: Haptics.ImpactFeedbackStyle.Light },
        { at: 2300, style: Haptics.ImpactFeedbackStyle.Medium },
        { at: 3500, style: Haptics.ImpactFeedbackStyle.Medium },
        { at: 4700, style: Haptics.ImpactFeedbackStyle.Light },
      ];
      for (const { at, style } of ramp) {
        timeouts.push(
          setTimeout(() => {
            void Haptics.impactAsync(style);
          }, at),
        );
      }
    } else {
      timeouts.push(
        setTimeout(() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        }, 100),
      );
      timeouts.push(
        setTimeout(() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        }, Math.floor(EXHALE_MS * 0.52)),
      );
    }

    return () => {
      for (const id of timeouts) clearTimeout(id);
    };
  }, [phase, isZen]);

  const s = isZen ? stylesZen : stylesDefault;
  const showTimer = isZen && secondsRemaining != null;

  const d = outerDiameter;
  /** Zen: white ring on black; default: inset ring stroke. */
  const ringStroke = isZen ? 2 : RING_STROKE;
  const innerD = d - 2 * ringStroke;

  const outerRingStyle = {
    width: d,
    height: d,
    borderRadius: d / 2,
    borderWidth: ringStroke,
  };

  return (
    <View style={s.root}>
      {showTimer ? <Text style={s.timer}>{formatClock(secondsRemaining)}</Text> : null}

      <Animated.View style={{ transform: [{ scale: ringPulse }] }}>
        <View style={[s.outerRing, outerRingStyle]}>
          <Text style={s.labelInRing} pointerEvents="none">
            {phase === 'inhale' ? 'Inhale' : 'Exhale'}
          </Text>

          <View style={s.innerCenterSlot}>
            <View style={[styles.innerStage, { width: innerD, height: innerD }]}>
              <Animated.View
                style={[
                  styles.breathScaled,
                  {
                    width: innerD,
                    height: innerD,
                    transform: [{ scale }],
                  },
                ]}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.glowHalo,
                    {
                      width: innerD * 1.14,
                      height: innerD * 1.14,
                      borderRadius: (innerD * 1.14) / 2,
                      opacity: glowOpacity,
                      backgroundColor: isZen ? 'rgba(255, 255, 255, 0.35)' : 'rgba(80, 80, 92, 0.22)',
                    },
                  ]}
                />
                <Animated.View style={[styles.svgClip, { opacity: shellOpacity }]}>
                  <Svg width={innerD} height={innerD}>
                    <Defs>
                      <RadialGradient
                        id={gradientId}
                        cx="42%"
                        cy="42%"
                        rx="58%"
                        ry="58%"
                        fx="38%"
                        fy="38%"
                      >
                        {isZen
                          ? [
                              <Stop key="z0" offset="0%" stopColor="#FFFFFF" stopOpacity={0.72} />,
                              <Stop key="z1" offset="45%" stopColor="#FFFFFF" stopOpacity={0.42} />,
                              <Stop key="z2" offset="100%" stopColor="#FFFFFF" stopOpacity={0.18} />,
                            ]
                          : [
                              <Stop key="d0" offset="0%" stopColor="#8E8E9A" stopOpacity={0.38} />,
                              <Stop key="d1" offset="50%" stopColor="#6A6A78" stopOpacity={0.22} />,
                              <Stop key="d2" offset="100%" stopColor="#5A5A64" stopOpacity={0.1} />,
                            ]}
                      </RadialGradient>
                    </Defs>
                    <Circle cx={innerD / 2} cy={innerD / 2} r={innerD / 2} fill={`url(#${gradientId})`} />
                  </Svg>
                </Animated.View>
              </Animated.View>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  innerStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathScaled: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowHalo: {
    position: 'absolute',
    alignSelf: 'center',
  },
  svgClip: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const stylesZen = StyleSheet.create({
  root: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#000000',
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderRadius: 0,
  },
  timer: {
    fontFamily: fontFamilies.mono,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  outerRing: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000',
    borderColor: '#FFFFFF',
  },
  labelInRing: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    zIndex: 2,
    textAlign: 'center',
    fontFamily: fontFamilies.uiSemi,
    fontSize: 18,
    letterSpacing: -0.2,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  innerCenterSlot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const stylesDefault = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: spacing.lg,
    backgroundColor: '#FFFFFF',
  },
  timer: {
    fontFamily: fontFamilies.mono,
    fontSize: 26,
    fontVariant: ['tabular-nums'],
    color: colors.ink,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  outerRing: {
    borderColor: 'rgba(60, 60, 67, 0.22)',
    backgroundColor: 'rgba(60, 60, 67, 0.03)',
    overflow: 'hidden',
    position: 'relative',
  },
  labelInRing: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    zIndex: 2,
    textAlign: 'center',
    fontFamily: fontFamilies.uiSemi,
    fontSize: 18,
    letterSpacing: -0.2,
    color: colors.inkMuted,
  },
  innerCenterSlot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
