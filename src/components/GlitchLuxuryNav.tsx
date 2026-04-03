import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

const INK_DEFAULT = 'rgba(255, 255, 255, 0.72)';
const STROKE = 1;

function JournalGlyph({ ink }: { ink: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M5 4.5 h6.2 v17 H5 Z M12.8 4.5 H19 v17 h-6.2 Z"
        stroke={ink}
        strokeWidth={STROKE}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="miter"
      />
      <Line x1="12" y1="5" x2="12" y2="21" stroke={ink} strokeWidth={STROKE} strokeLinecap="square" />
    </Svg>
  );
}

function SettingsGlyph({ ink }: { ink: string }) {
  const rays = [0, 60, 120, 180, 240, 300].map((deg) => {
    const r = (deg * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    return (
      <Line
        key={deg}
        x1={12 + c * 4.2}
        y1={12 + s * 4.2}
        x2={12 + c * 9.2}
        y2={12 + s * 9.2}
        stroke={ink}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    );
  });
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Circle cx={12} cy={12} r={6.2} stroke={ink} strokeWidth={STROKE} fill="none" />
      {rays}
    </Svg>
  );
}

type NavProps = {
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

export function GlitchJournalNav({ onPress, accessibilityLabel, style }: NavProps) {
  return (
    <GlitchNavButton onPress={onPress} accessibilityLabel={accessibilityLabel} style={style}>
      {(ink) => <JournalGlyph ink={ink} />}
    </GlitchNavButton>
  );
}

export function GlitchSettingsNav({ onPress, accessibilityLabel, style }: NavProps) {
  return (
    <GlitchNavButton onPress={onPress} accessibilityLabel={accessibilityLabel} style={style}>
      {(ink) => <SettingsGlyph ink={ink} />}
    </GlitchNavButton>
  );
}

function GlitchNavButton({
  onPress,
  accessibilityLabel,
  style,
  children,
}: NavProps & { children: (ink: string) => ReactNode }) {
  return (
    <Pressable
      onPressIn={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      onPress={() => onPress()}
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      {({ pressed }) => {
        const ink = pressed ? 'rgba(255, 255, 255, 0.95)' : INK_DEFAULT;
        return (
          <View style={{ transform: [{ translateY: pressed ? -2 : 0 }] }}>{children(ink)}</View>
        );
      }}
    </Pressable>
  );
}
