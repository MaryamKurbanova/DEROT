import { Easing } from 'react-native';

export const OB_SPRING = {
  press: { tension: 320, friction: 22, useNativeDriver: true as const },
  snap: { tension: 220, friction: 16, useNativeDriver: true as const },
  reveal: { tension: 90, friction: 14, useNativeDriver: true as const },
  unlock: { tension: 180, friction: 12, useNativeDriver: true as const },
};

export const OB_EASE = Easing.bezier(0.22, 0.99, 0.36, 1);

export const STAGGER_MS = 55;
