import { StyleSheet, TextStyle, ViewStyle } from 'react-native';

/** White surfaces, black primary actions, neutral grays for text. */
export const colors = {
  paper: '#FFFFFF',
  paperWarm: '#FFFFFF',
  paperRitual: '#FFFFFF',
  peach: '#F5F5F5',
  accent: '#000000',
  accentLight: '#333333',
  accentMuted: '#1C1C1E',
  accentWash: 'rgba(0, 0, 0, 0.08)',
  cyan: '#404040',
  cyanSoft: 'rgba(0, 0, 0, 0.06)',
  orange: '#000000',
  orangeMuted: '#1C1C1E',
  orangeWash: 'rgba(0, 0, 0, 0.08)',
  ink: '#000000',
  inkMuted: '#636366',
  inkFaint: '#8E8E93',
  hairline: 'rgba(0, 0, 0, 0.12)',
  wash: 'rgba(0, 0, 0, 0.06)',
  danger: '#FF3B30',
  oledBlack: '#FFFFFF',
  neonGreen: '#000000',
  mintGlow: '#404040',
  mintSoft: 'rgba(0, 0, 0, 0.88)',
  white80: '#000000',
  white45: '#636366',
  white12: 'rgba(0, 0, 0, 0.06)',
  white08: 'rgba(0, 0, 0, 0.06)',
  cyberCyan: '#404040',
  dimGreen: 'rgba(0, 0, 0, 0.2)',
  dimCyan: 'rgba(0, 0, 0, 0.15)',
  textMuted: '#636366',
  textFaint: '#8E8E93',
} as const;

/**
 * Main app shell — white field, neutral type and borders (home / stats / settings / tab bar).
 */
export const shell = {
  bg: '#FFFFFF',
  surface: '#FAFAFA',
  surfaceElevated: '#F0F0F0',
  surfaceBorder: 'rgba(0, 0, 0, 0.08)',
  /** Primary emphasis on light UI (headings, active tab, chart stroke) — not brand green. */
  neon: '#1C1C1E',
  neonMuted: 'rgba(28, 28, 30, 0.32)',
  neonGlow: 'transparent',
  neonWash: 'rgba(0, 0, 0, 0.05)',
  neonLine: 'rgba(0, 0, 0, 0.1)',
  text: '#1C1C1E',
  textMuted: '#636366',
  textDim: '#8E8E93',
  tabBar: '#FFFFFF',
  tabInactive: '#AEAEB2',
  overload: '#8E8E93',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 44,
} as const;

export const fontFamilies = {
  ui: 'Nunito_400Regular',
  uiSemi: 'Nunito_600SemiBold',
  mono: 'RobotoMono_400Regular',
  monoBold: 'RobotoMono_400Regular',
  monoSemi: 'RobotoMono_600SemiBold',
} as const;

export const theme = {
  colors,
  spacing,
  fontFamilies,
};

export const layout = StyleSheet.create({
  fill: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
});

export const textStyles = StyleSheet.create({
  hero: {
    fontFamily: fontFamilies.uiSemi,
    fontSize: 34,
    color: colors.ink,
    letterSpacing: -0.5,
  } as TextStyle,
  title: {
    fontFamily: fontFamilies.uiSemi,
    fontSize: 20,
    color: colors.ink,
    letterSpacing: -0.2,
  } as TextStyle,
  body: {
    fontFamily: fontFamilies.ui,
    fontSize: 16,
    color: colors.inkMuted,
    lineHeight: 24,
  } as TextStyle,
  label: {
    fontFamily: fontFamilies.uiSemi,
    fontSize: 13,
    color: colors.ink,
    letterSpacing: -0.1,
  } as TextStyle,
  caption: {
    fontFamily: fontFamilies.ui,
    fontSize: 13,
    color: colors.inkFaint,
    lineHeight: 18,
  } as TextStyle,
  timer: {
    fontFamily: fontFamilies.mono,
    fontSize: 40,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
});
