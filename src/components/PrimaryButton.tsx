import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  enabled = true,
  style,
}: PrimaryButtonProps) {
  const opacity = useRef(new Animated.Value(enabled ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (enabled) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    opacity.setValue(0);
  }, [enabled, opacity]);

  const pressIn = () => {
    if (enabled) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    Animated.timing(scale, {
      toValue: 0.98,
      duration: 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (!enabled) return;
    onPress();
  };

  return (
    <Animated.View style={[styles.wrapper, style, { opacity, transform: [{ scale }] }]}>
      <Pressable
        onPress={handlePress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={!enabled}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.label}>{label.toUpperCase()}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 20,
  },
  button: {
    height: 64,
    borderRadius: 0,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 1,
  },
  buttonPressed: {},
  label: {
    color: '#000000',
    fontFamily: 'SF Mono',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
});
