import { StyleSheet, TextStyle, ViewStyle } from 'react-native';

/** High-end / monolith shell — OLED surface, hairline borders, white primary type. */
export const monolith = {
  primary: '#FFFFFF',
  surface: '#0A0A0A',
  border: '#1A1A1A',
  muted: '#444444',
  /** Industrial accent — active / monitored signal */
  signalAmber: '#FFB800',
  /** Signal button fill */
  signalBg: '#050505',
  /** Timeline / rail */
  railDash: '#222222',
} as const;

/** Spec: 0 0 20px rgba(255,255,255,0.05) on active tiles (RN shadow props). */
export const shadowTileActive: ViewStyle = {
  shadowColor: '#FFFFFF',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.05,
  shadowRadius: 20,
  elevation: 0,
};

/** White surfaces, black primary actions, neutral grays for text (legacy / light surfaces). */
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
 * App shell — aligned with monolith palette (main app is dark).
 */
export const shell = {
  bg: monolith.surface,
  surface: monolith.surface,
  surfaceElevated: '#101010',
  surfaceBorder: monolith.border,
  neon: monolith.primary,
  neonMuted: 'rgba(255,255,255,0.32)',
  neonGlow: 'transparent',
  neonWash: 'rgba(255,255,255,0.05)',
  neonLine: monolith.border,
  text: monolith.primary,
  textMuted: monolith.muted,
  textDim: 'rgba(255,255,255,0.45)',
  tabBar: monolith.surface,
  tabInactive: monolith.muted,
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
  uiLight: 'Nunito_300Light',
  uiSemi: 'Nunito_600SemiBold',
  mono: 'RobotoMono_400Regular',
  monoMedium: 'RobotoMono_500Medium',
  monoBold: 'RobotoMono_700Bold',
  monoSemi: 'RobotoMono_600SemiBold',
} as const;

/** Editorial light shell — pure white, no chrome. */
export const unrot = {
  bg: '#FFFFFF',
  ink: '#1A1A1A',
  muted: '#888888',
  /** Unselected log choices, dividers */
  choiceMuted: '#DDDDDD',
  /** Bottom narrative / hints */
  narrativeMuted: '#BBBBBB',
  timeline: '#DDDDDD',
  gutter: 40,
} as const;

export const EDITORIAL_FADE_MS = 800;

/** Must match `useFonts` keys in App.tsx. */
export const unrotFonts = {
  heroSerif: 'PlayfairDisplay_400Regular',
  heroSerifItalic: 'PlayfairDisplay_400Regular_Italic',
  interLight: 'Inter_300Light',
  interRegular: 'Inter_400Regular',
  interBold: 'Inter_700Bold',
  mono: 'RobotoMono_400Regular',
  monoBold: 'RobotoMono_700Bold',
} as const;

/** Typographic hierarchy: display / labels / body. */
export const typeScale = {
  display: {
    fontFamily: fontFamilies.monoMedium,
    fontSize: 48,
    lineHeight: 52,
    color: monolith.primary,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  label: {
    fontFamily: fontFamilies.monoBold,
    fontSize: 9,
    letterSpacing: 4,
    color: monolith.muted,
    textTransform: 'uppercase',
  } as TextStyle,
  body: {
    fontFamily: fontFamilies.ui,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.82)',
  } as TextStyle,
};

export const theme = {
  colors,
  monolith,
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
    fontFamily: fontFamilies.monoMedium,
    fontSize: 48,
    lineHeight: 52,
    color: shell.text,
    letterSpacing: -1,
  } as TextStyle,
  title: {
    fontFamily: fontFamilies.uiSemi,
    fontSize: 20,
    color: shell.text,
    letterSpacing: -0.2,
  } as TextStyle,
  body: {
    fontFamily: fontFamilies.ui,
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 20,
  } as TextStyle,
  label: {
    fontFamily: fontFamilies.monoBold,
    fontSize: 9,
    color: monolith.muted,
    letterSpacing: 4,
    textTransform: 'uppercase',
  } as TextStyle,
  caption: {
    fontFamily: fontFamilies.ui,
    fontSize: 13,
    color: shell.textDim,
    lineHeight: 18,
  } as TextStyle,
  timer: {
    fontFamily: fontFamilies.mono,
    fontSize: 40,
    color: monolith.primary,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
});
