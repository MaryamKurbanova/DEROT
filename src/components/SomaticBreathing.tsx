import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors, fontFamilies, spacing } from '../theme';

/** Slightly elongated for a calmer, premium cadence (~11.4s per full cycle). */
const INHALE_MS = 5600;
const EXHALE_MS = 5800;

/** Original simple crossfade — clearer, slightly “wavier” handoff. */
/** Audible but calm — inhale WAV peaks higher than exhale in the files. */
const MAX_BREATH_VOL = 0.27;
const CROSSFADE_MS = 480;
const CROSSFADE_STEPS = 16;

const SCALE_MIN = 0.08;
const SCALE_MAX = 1;

/** Subtle inhale overshoot target before settling to 1. */
const INHALE_OVERSHOOT = 1.038;
const OVERSHOOT_FRACTION = 0.82;

/** Main breath curve: slow start/end, organic mid (health-app feel). */
const easeBreathIn = Easing.bezier(0.42, 0, 0.58, 1);
const easeSettle = Easing.out(Easing.cubic);
const easeBreathOut = Easing.bezier(0.33, 0.08, 0.25, 1);

const RING_INHALE_SCALE = 1.014;
const RING_EXHALE_SCALE = 1;

type Phase = 'inhale' | 'exhale';

type Props = {
  variant?: 'default' | 'zen';
  secondsRemaining?: number;
  outerDiameter?: number;
};

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function steppedCrossfade(
  incoming: Audio.Sound,
  outgoing: Audio.Sound | null,
  targetVol: number,
): Promise<void> {
  try {
    await incoming.setVolumeAsync(0);
    await incoming.setPositionAsync(0);
    await incoming.playAsync();
  } catch {
    return;
  }
  const dt = CROSSFADE_MS / CROSSFADE_STEPS;
  for (let i = 0; i <= CROSSFADE_STEPS; i++) {
    const p = i / CROSSFADE_STEPS;
    const eased = 0.5 - 0.5 * Math.cos(Math.PI * p);
    try {
      await incoming.setVolumeAsync(eased * targetVol);
      if (outgoing) await outgoing.setVolumeAsync((1 - eased) * targetVol * 0.94);
    } catch {
      /* ignore */
    }
    await sleep(dt);
  }
  if (outgoing) {
    try {
      await outgoing.stopAsync();
      await outgoing.setVolumeAsync(targetVol);
    } catch {
      /* ignore */
    }
  }
}

const DEFAULT_OUTER = 200;
const RING_STROKE = 2;

export function SomaticBreathing({
  variant = 'default',
  secondsRemaining,
  outerDiameter = DEFAULT_OUTER,
}: Props) {
  const scale = useRef(new Animated.Value(SCALE_MIN)).current;
  const shellOpacity = useRef(new Animated.Value(variant === 'zen' ? 0.5 : 0.42)).current;
  const glowOpacity = useRef(new Animated.Value(variant === 'zen' ? 0.08 : 0.03)).current;
  const ringPulse = useRef(new Animated.Value(RING_EXHALE_SCALE)).current;
  const rippleScale = useRef(new Animated.Value(1)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(1)).current;

  const [phase, setPhase] = useState<Phase>('inhale');
  const inhaleRef = useRef<Audio.Sound | null>(null);
  const exhaleRef = useRef<Audio.Sound | null>(null);
  const activeBreathRef = useRef<Audio.Sound | null>(null);
  const crossfadeLock = useRef(false);

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

  /** Preload breath cues (simple airy pink beds — see generate-breath-wavs.mjs). */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const inH = require('../../assets/sounds/breath-inhale.wav');
        const exH = require('../../assets/sounds/breath-exhale.wav');
        const androidInit =
          Platform.OS === 'android'
            ? { androidImplementation: 'MediaPlayer' as const }
            : {};
        const [{ sound: sIn }, { sound: sEx }] = await Promise.all([
          Audio.Sound.createAsync(inH, { shouldPlay: false, volume: 0, ...androidInit }),
          Audio.Sound.createAsync(exH, { shouldPlay: false, volume: 0, ...androidInit }),
        ]);
        if (cancelled) {
          void sIn.unloadAsync();
          void sEx.unloadAsync();
          return;
        }
        inhaleRef.current = sIn;
        exhaleRef.current = sEx;
      } catch {
        /* optional assets — session stays visual-only */
      }
    })();
    return () => {
      cancelled = true;
      void inhaleRef.current?.unloadAsync();
      void exhaleRef.current?.unloadAsync();
      inhaleRef.current = null;
      exhaleRef.current = null;
    };
  }, []);

  useEffect(() => {
    labelOpacity.setValue(0);
    Animated.timing(labelOpacity, {
      toValue: 1,
      duration: isZen ? 620 : 480,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [phase, labelOpacity, isZen]);

  const inhaleAnim = useMemo(
    () =>
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: INHALE_OVERSHOOT,
            duration: INHALE_MS * OVERSHOOT_FRACTION,
            easing: easeBreathIn,
            useNativeDriver: true,
          }),
          Animated.timing(shellOpacity, {
            toValue: isZen ? 0.94 : 0.88,
            duration: INHALE_MS * OVERSHOOT_FRACTION,
            easing: easeBreathIn,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: isZen ? 0.5 : 0.14,
            duration: INHALE_MS * OVERSHOOT_FRACTION,
            easing: easeBreathIn,
            useNativeDriver: true,
          }),
          Animated.timing(ringPulse, {
            toValue: RING_INHALE_SCALE,
            duration: INHALE_MS * OVERSHOOT_FRACTION,
            easing: easeBreathIn,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.parallel([
              Animated.timing(rippleOpacity, {
                toValue: 0.14,
                duration: INHALE_MS * 0.38,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(rippleScale, {
                toValue: 1.095,
                duration: INHALE_MS * 0.5,
                easing: easeBreathIn,
                useNativeDriver: true,
              }),
            ]),
            Animated.parallel([
              Animated.timing(rippleOpacity, {
                toValue: 0,
                duration: INHALE_MS * 0.35,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(rippleScale, {
                toValue: 1,
                duration: INHALE_MS * 0.35,
                easing: easeSettle,
                useNativeDriver: true,
              }),
            ]),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: SCALE_MAX,
            duration: INHALE_MS * (1 - OVERSHOOT_FRACTION),
            easing: easeSettle,
            useNativeDriver: true,
          }),
          Animated.timing(shellOpacity, {
            toValue: isZen ? 0.9 : 0.85,
            duration: INHALE_MS * (1 - OVERSHOOT_FRACTION),
            easing: easeSettle,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: isZen ? 0.42 : 0.11,
            duration: INHALE_MS * (1 - OVERSHOOT_FRACTION),
            easing: easeSettle,
            useNativeDriver: true,
          }),
          Animated.timing(ringPulse, {
            toValue: 1.006,
            duration: INHALE_MS * (1 - OVERSHOOT_FRACTION),
            easing: easeSettle,
            useNativeDriver: true,
          }),
        ]),
      ]),
    [
      scale,
      shellOpacity,
      glowOpacity,
      ringPulse,
      rippleOpacity,
      rippleScale,
      isZen,
    ],
  );

  const exhaleAnim = useMemo(
    () =>
      Animated.parallel([
        Animated.timing(scale, {
          toValue: SCALE_MIN,
          duration: EXHALE_MS,
          easing: easeBreathOut,
          useNativeDriver: true,
        }),
        Animated.timing(shellOpacity, {
          toValue: isZen ? 0.5 : 0.42,
          duration: EXHALE_MS,
          easing: easeBreathOut,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: isZen ? 0.07 : 0.03,
          duration: EXHALE_MS,
          easing: easeBreathOut,
          useNativeDriver: true,
        }),
        Animated.timing(ringPulse, {
          toValue: RING_EXHALE_SCALE,
          duration: EXHALE_MS,
          easing: easeBreathOut,
          useNativeDriver: true,
        }),
      ]),
    [scale, shellOpacity, glowOpacity, ringPulse, isZen],
  );

  useEffect(() => {
    rippleOpacity.setValue(0);
    rippleScale.setValue(1);
    const loop = Animated.loop(Animated.sequence([inhaleAnim, exhaleAnim]));
    loop.start();
    return () => {
      loop.stop();
      scale.setValue(SCALE_MIN);
      shellOpacity.setValue(isZen ? 0.5 : 0.42);
      glowOpacity.setValue(isZen ? 0.07 : 0.03);
      ringPulse.setValue(RING_EXHALE_SCALE);
      rippleOpacity.setValue(0);
      rippleScale.setValue(1);
    };
  }, [inhaleAnim, exhaleAnim, scale, shellOpacity, glowOpacity, ringPulse, rippleOpacity, rippleScale, isZen]);

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
    if (!isZen) return;
    const sIn = inhaleRef.current;
    const sEx = exhaleRef.current;
    if (!sIn || !sEx) return;
    if (crossfadeLock.current) return;
    void (async () => {
      crossfadeLock.current = true;
      const incoming = phase === 'inhale' ? sIn : sEx;
      const outgoing =
        activeBreathRef.current && activeBreathRef.current !== incoming
          ? activeBreathRef.current
          : null;
      activeBreathRef.current = incoming;
      await steppedCrossfade(incoming, outgoing, MAX_BREATH_VOL);
      crossfadeLock.current = false;
    })();
  }, [phase, isZen]);

  /** Zen: gentle inhale ramp haptics + soft exhale boundary. */
  useEffect(() => {
    if (!isZen) return;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    if (phase === 'inhale') {
      const marks = [0, Math.floor(INHALE_MS * 0.28), Math.floor(INHALE_MS * 0.55), Math.floor(INHALE_MS * 0.78)];
      for (const at of marks) {
        timeouts.push(
          setTimeout(() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
          }, at),
        );
      }
    } else {
      timeouts.push(
        setTimeout(() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        }, 40),
      );
      timeouts.push(
        setTimeout(() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        }, Math.floor(EXHALE_MS * 0.48)),
      );
    }
    return () => {
      for (const t of timeouts) clearTimeout(t);
    };
  }, [phase, isZen]);

  const s = isZen ? stylesZen : stylesDefault;
  const showTimer = isZen && secondsRemaining != null;

  const d = outerDiameter;
  const ringStroke = isZen ? 1.5 : RING_STROKE;
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
          {isZen ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.backHalo,
                {
                  width: d * 1.35,
                  height: d * 1.35,
                  borderRadius: (d * 1.35) / 2,
                  opacity: glowOpacity,
                },
              ]}
            />
          ) : null}

          <Animated.Text style={[s.labelInRing, { opacity: labelOpacity }]} pointerEvents="none">
            {phase === 'inhale' ? 'Breathe in' : isZen ? 'Soft release' : 'Ease out'}
          </Animated.Text>

          <View style={s.innerCenterSlot}>
            {isZen ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.rippleRing,
                  {
                    width: innerD + 28,
                    height: innerD + 28,
                    borderRadius: (innerD + 28) / 2,
                    opacity: rippleOpacity,
                    transform: [{ scale: rippleScale }],
                  },
                ]}
              />
            ) : null}
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
                      backgroundColor: isZen ? 'rgba(200, 210, 255, 0.28)' : 'rgba(80, 80, 92, 0.22)',
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
                              <Stop key="z0" offset="0%" stopColor="#F8F8FF" stopOpacity={0.55} />,
                              <Stop key="z1" offset="42%" stopColor="#C8D0F0" stopOpacity={0.32} />,
                              <Stop key="z2" offset="100%" stopColor="#6A6A8C" stopOpacity={0.14} />,
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
  backHalo: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(130, 140, 220, 0.12)',
  },
  rippleRing: {
    position: 'absolute',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
});

const stylesZen = StyleSheet.create({
  root: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: spacing.sm,
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
    overflow: 'visible',
    position: 'relative',
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelInRing: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    zIndex: 4,
    textAlign: 'center',
    fontFamily: fontFamilies.uiLight,
    fontSize: 14,
    letterSpacing: 3,
    color: 'rgba(255, 255, 255, 0.34)',
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
    borderColor: 'rgba(60, 60, 67,0.22)',
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
    fontFamily: fontFamilies.uiLight,
    fontSize: 16,
    letterSpacing: 0.8,
    color: 'rgba(60, 60, 67, 0.45)',
  },
  innerCenterSlot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
