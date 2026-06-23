import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { OB, OB_FONTS, spacing } from './tokens';
import { OB_EASE, OB_HOLD_MS, OB_HOLD_POP_MS } from './motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_R = 27;
const RING_C = 2 * Math.PI * RING_R;

type Props = {
  label: string;
  disabled?: boolean;
  onComplete: () => void;
  holdMs?: number;
  dark?: boolean;
  style?: object;
};

export function HoldToConfirmButton({
  label,
  disabled = false,
  onComplete,
  holdMs = OB_HOLD_MS,
  dark = true,
  style,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      animRef.current?.stop();
    };
  }, []);

  const reset = () => {
    completedRef.current = false;
    animRef.current?.stop();
    animRef.current = null;
    progress.setValue(0);
  };

  const onPressIn = () => {
    if (disabled || completedRef.current) return;
    reset();
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: holdMs,
      easing: OB_EASE,
      useNativeDriver: false,
    });
    animRef.current = run;
    run.start(({ finished }) => {
      if (!finished || completedRef.current) return;
      completedRef.current = true;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.08,
          duration: OB_HOLD_POP_MS / 2,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: OB_HOLD_POP_MS / 2,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        onComplete();
      });
    });
  };

  const onPressOut = () => {
    if (completedRef.current) return;
    reset();
  };

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_C, 0],
  });

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint="Press and hold to confirm."
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        <View style={styles.wrap}>
          <Svg width={58} height={58} style={styles.ringSvg} pointerEvents="none">
            <Circle
              cx={29}
              cy={29}
              r={RING_R}
              stroke={OB.hairline}
              strokeWidth={1.5}
              fill="none"
            />
            <AnimatedCircle
              cx={29}
              cy={29}
              r={RING_R}
              stroke={OB.ink}
              strokeWidth={1.5}
              fill="none"
              strokeDasharray={`${RING_C} ${RING_C}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              rotation={-90}
              origin="29, 29"
            />
          </Svg>
          <View style={[styles.btn, dark ? styles.btnDark : styles.btnLight, disabled && styles.btnDisabled]}>
            <Text style={[styles.label, dark ? styles.labelDark : styles.labelLight, disabled && styles.labelMuted]}>
              {label}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  ringSvg: {
    position: 'absolute',
    alignSelf: 'center',
  },
  btn: {
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  btnDark: {
    backgroundColor: OB.ink,
  },
  btnLight: {
    backgroundColor: OB.white,
    borderWidth: 1,
    borderColor: OB.hairline,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  label: {
    fontFamily: OB_FONTS.bold,
    fontSize: 14,
    letterSpacing: 1.2,
  },
  labelDark: {
    color: OB.white,
  },
  labelLight: {
    color: OB.ink,
  },
  labelMuted: {
    opacity: 0.55,
  },
});
