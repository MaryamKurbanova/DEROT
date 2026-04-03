import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SignalButton } from './SignalButton';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  enabled?: boolean;
  /** Amber signal dot (e.g. active step in a flow). */
  signalActive?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  enabled = true,
  signalActive = false,
  style,
}: PrimaryButtonProps) {
  const opacity = useRef(new Animated.Value(enabled ? 1 : 0)).current;

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

  return (
    <Animated.View style={[styles.wrapper, style, { opacity }]}>
      <SignalButton
        label={label.toUpperCase()}
        onPress={onPress}
        disabled={!enabled}
        signalActive={signalActive}
        style={styles.fill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 20,
  },
  fill: {
    alignSelf: 'stretch',
  },
});
