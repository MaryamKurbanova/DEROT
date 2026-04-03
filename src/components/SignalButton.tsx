import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { fontFamilies, monolith } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** 2px amber dot — top-right — when this control is the active selection. */
  signalActive?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SignalButton({
  label,
  onPress,
  disabled = false,
  signalActive = false,
  style,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    if (!disabled) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 50,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 400,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[styles.outer, style, { transform: [{ scale }] }]}>
      <Pressable
        onPress={() => {
          if (!disabled) onPress();
        }}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        style={({ pressed }) => [
          styles.btn,
          pressed && !disabled && styles.btnPressed,
          disabled && styles.btnDisabled,
        ]}
      >
        {({ pressed }) => (
          <View style={styles.inner}>
            {signalActive ? <View style={styles.signalDot} pointerEvents="none" /> : null}
            <Text
              style={[styles.label, pressed && !disabled && styles.labelPressed]}
              numberOfLines={2}
            >
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'relative',
  },
  btn: {
    minHeight: 60,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: monolith.signalBg,
    borderWidth: 1,
    borderColor: monolith.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: '100%',
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 4,
  },
  btnPressed: {
    backgroundColor: monolith.primary,
    borderColor: monolith.primary,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  signalDot: {
    position: 'absolute',
    top: 2,
    right: 10,
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: monolith.signalAmber,
    zIndex: 2,
  },
  label: {
    fontFamily: fontFamilies.mono,
    fontSize: 12,
    color: monolith.primary,
    letterSpacing: 1,
    textAlign: 'center',
  },
  labelPressed: {
    color: '#000000',
  },
});
