import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  onPress: () => void;
  children: (state: { pressed: boolean }) => ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  hitSlop?: number;
};

/** Light haptic on press-in; outer wrapper nudges up 2px when pressed (no background). */
export function VoidGlowPressable({
  onPress,
  children,
  style,
  accessibilityLabel,
  hitSlop = 12,
}: Props) {
  return (
    <Pressable
      onPress={() => onPress()}
      onPressIn={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      style={style}
    >
      {({ pressed }) => (
        <View
          style={
            pressed
              ? {
                  transform: [{ translateY: -2 }],
                }
              : undefined
          }
        >
          {children({ pressed })}
        </View>
      )}
    </Pressable>
  );
}
