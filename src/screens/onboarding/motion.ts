import { Easing } from 'react-native';

/** Primary onboarding easing — slightly snappy, non-bouncy. */
export const OB_EASE = Easing.bezier(0.2, 0, 0, 1);

/** Stamp reveal only — slight overshoot-and-settle. */
export const OB_STAMP_EASE = Easing.bezier(0.34, 1.2, 0.64, 1);

export const OB_TRANSITION_MS = 280;
export const OB_SLIDE_OFFSET = 28;
export const OB_HOLD_MS = 900;
export const OB_HOLD_POP_MS = 140;

export const OB_SPRING = {
  press: { tension: 320, friction: 22, useNativeDriver: true as const },
  snap: { tension: 220, friction: 16, useNativeDriver: true as const },
  reveal: { tension: 90, friction: 14, useNativeDriver: true as const },
  unlock: { tension: 180, friction: 12, useNativeDriver: true as const },
};

export const STAGGER_MS = 55;
