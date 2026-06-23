import * as Haptics from 'expo-haptics';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { unrotFonts } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const LOG_TRIGGER_INK = '#0A0A0A';
const LOG_FAB_SIZE = 94;
const LOG_RING_STROKE = 3.5;
const LOG_RING_R = (LOG_FAB_SIZE - LOG_RING_STROKE) / 2 - 1;
const LOG_RING_C = 2 * Math.PI * LOG_RING_R;
const LOG_RING_TRACK = 'rgba(17, 17, 17, 0.1)';
const LOG_RING_ACCENT = LOG_TRIGGER_INK;
const LOG_RING_ACCENT_DIM = 'rgba(17, 17, 17, 0.1)';
const LOG_RING_FILL_MS = 520;
const LOG_RING_RESET_MS = 320;
const LOG_INNER_DISC = 72;
const HOME_CANVAS_BG = '#FAFAFA';
const HOME_CARD_BORDER = 'rgba(10, 10, 12, 0.09)';
const LOG_SECTION_TOP_MARGIN = 48;
const LOG_ANCHOR_MIN_HEIGHT = 120;

export function HomeLogFooter({
  loggedToday = false,
  onPress,
  accessibilityHint,
  minHeight = LOG_ANCHOR_MIN_HEIGHT,
}: {
  loggedToday?: boolean;
  onPress: () => void;
  accessibilityHint?: string;
  minHeight?: number;
}) {
  return (
    <View style={[styles.logRitualAnchor, { minHeight }]}>
      <HomeLogButton loggedToday={loggedToday} onPress={onPress} accessibilityHint={accessibilityHint} />
    </View>
  );
}

export function HomeLogScreen({
  children,
  minAnchorHeight = LOG_ANCHOR_MIN_HEIGHT,
  bleedHorizontal = 0,
}: {
  children: ReactNode;
  minAnchorHeight?: number;
  bleedHorizontal?: number;
}) {
  return (
    <View
      style={[
        styles.homeLogScreen,
        bleedHorizontal ? { marginHorizontal: -bleedHorizontal } : null,
      ]}
    >
      <View style={[styles.logRitualAnchor, { minHeight: minAnchorHeight }]}>{children}</View>
    </View>
  );
}

export function HomeLogButton({
  loggedToday = false,
  onPress,
  accessibilityHint = 'Press and hold until the ring completes, then release to open log.',
}: {
  loggedToday?: boolean;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  const ringProgress = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(1)).current;
  const ringAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const screenReaderOnRef = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      screenReaderOnRef.current = on;
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (on) => {
      screenReaderOnRef.current = on;
    });
    return () => sub.remove();
  }, []);

  const strokeDashoffset = ringProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [LOG_RING_C, 0],
  });

  const cx = LOG_FAB_SIZE / 2;
  const ringRotate = `rotate(-90 ${cx} ${cx})`;

  const resetRing = (duration = LOG_RING_RESET_MS) => {
    ringAnimRef.current?.stop();
    ringAnimRef.current = null;
    Animated.timing(ringProgress, {
      toValue: 0,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  const onPressIn = () => {
    ringAnimRef.current?.stop();
    ringProgress.setValue(0);
    Animated.spring(fabScale, {
      toValue: 0.97,
      friction: 7,
      tension: 480,
      useNativeDriver: true,
    }).start();
    ringAnimRef.current = Animated.timing(ringProgress, {
      toValue: 1,
      duration: LOG_RING_FILL_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    ringAnimRef.current.start();
  };

  const onPressOut = () => {
    ringAnimRef.current?.stop();
    ringAnimRef.current = null;
    Animated.spring(fabScale, {
      toValue: 1,
      friction: 5,
      tension: 320,
      useNativeDriver: true,
    }).start();
    ringProgress.stopAnimation((value) => {
      if (value >= 0.93) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
        resetRing(160);
      } else {
        resetRing(220);
      }
    });
  };

  const handleAccessibilityPress = () => {
    if (!screenReaderOnRef.current) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={handleAccessibilityPress}
      hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      style={styles.logFabHit}
      accessibilityRole="button"
      accessibilityLabel={
        loggedToday ? 'Log reflective entry. You have already logged today' : 'Log reflective entry. No log yet today'
      }
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: LOG_RING_ACCENT_DIM, borderless: true, radius: Math.round(LOG_FAB_SIZE / 2) }}
    >
      <Animated.View style={[styles.logFabOuter, { transform: [{ scale: fabScale }] }]}>
        <View style={styles.logFabRingLayer} importantForAccessibility="no">
          <Svg width={LOG_FAB_SIZE} height={LOG_FAB_SIZE}>
            <Circle
              cx={cx}
              cy={cx}
              r={LOG_RING_R}
              stroke={LOG_RING_TRACK}
              strokeWidth={LOG_RING_STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={cx}
              cy={cx}
              r={LOG_RING_R}
              stroke={LOG_RING_ACCENT}
              strokeWidth={LOG_RING_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${LOG_RING_C} ${LOG_RING_C}`}
              strokeDashoffset={strokeDashoffset}
              transform={ringRotate}
            />
          </Svg>
        </View>
        <View style={styles.logFabInnerDisc}>
          <Text style={styles.logTriggerTitle}>LOG</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  homeLogScreen: {
    flex: 1,
    minHeight: 360,
    backgroundColor: HOME_CANVAS_BG,
    alignSelf: 'stretch',
  },
  logRitualAnchor: {
    marginTop: LOG_SECTION_TOP_MARGIN,
    flexGrow: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: LOG_ANCHOR_MIN_HEIGHT,
    backgroundColor: HOME_CANVAS_BG,
  },
  logFabHit: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: HOME_CANVAS_BG,
  },
  logFabOuter: {
    width: LOG_FAB_SIZE,
    height: LOG_FAB_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logFabRingLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logFabInnerDisc: {
    width: LOG_INNER_DISC,
    height: LOG_INNER_DISC,
    borderRadius: LOG_INNER_DISC / 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: HOME_CARD_BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 14,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  logTriggerTitle: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: LOG_TRIGGER_INK,
  },
});
