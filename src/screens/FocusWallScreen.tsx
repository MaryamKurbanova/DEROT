import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { grantAccessPassForApp } from '../lib/accessPass';
import { logReflection } from '../lib/reflectiveLog';
import { fontFamilies } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type FocusWallPurpose = 'intercept' | 'practice';

type Props = {
  visible: boolean;
  purpose: FocusWallPurpose;
  targetAppId: string;
  targetLabel: string;
  onClose: () => void;
};

const BG = '#FFFFFF';
const BORDER = '#E8E8E8';
const INK = '#2C2C2C';
const INK_MUTED = '#8A8A8A';
const SELECTED_BG = '#000000';
const SELECTED_TEXT = '#FFFFFF';

const MOOD_OPTIONS = ['Calm', 'Anxious', 'Bored', 'Lost'] as const;

const INTENT_OPTIONS = [
  'Send Message',
  'Seek Comfort',
  'Create Content',
  'Find something',
] as const;

const FADE_MS = 420;

export function FocusWallScreen({
  visible,
  purpose,
  targetAppId,
  targetLabel: _targetLabel,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [mood, setMood] = useState<string | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  const enterOpacity = useRef(new Animated.Value(0)).current;
  const enterY = useRef(new Animated.Value(8)).current;

  const resetSurface = useCallback(() => {
    setMood(null);
    setIntent(null);
    enterOpacity.setValue(0);
    enterY.setValue(8);
  }, [enterOpacity, enterY]);

  useLayoutEffect(() => {
    if (visible) {
      resetSurface();
    }
  }, [visible, resetSurface]);

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(enterOpacity, {
        toValue: 1,
        duration: FADE_MS,
        useNativeDriver: true,
      }),
      Animated.timing(enterY, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, enterOpacity, enterY]);

  const persistAndClose = useCallback(async () => {
    const m = mood;
    const i = intent;
    try {
      if (m && i) {
        await logReflection({ mood: m, intent: i });
      }
      if (purpose === 'intercept') {
        await grantAccessPassForApp(targetAppId);
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('FocusWallScreen persist', e);
      }
    } finally {
      onClose();
    }
  }, [mood, intent, purpose, targetAppId, onClose]);

  const onContinue = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    void persistAndClose();
  }, [persistAndClose]);

  const pickMood = (label: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    void Haptics.selectionAsync();
    setMood(label);
  };

  const pickIntent = (label: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    void Haptics.selectionAsync();
    setIntent(label);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              opacity: enterOpacity,
              transform: [{ translateY: enterY }],
            }}
          >
            <Text style={styles.whisper}>There's no rush.</Text>
            <Text style={styles.title}>How are you feeling?</Text>
            <View style={styles.grid}>
              {MOOD_OPTIONS.map((label) => {
                const selected = mood === label;
                return (
                  <Pressable
                    key={label}
                    onPress={() => pickMood(label)}
                    style={({ pressed }) => [
                      styles.pill,
                      selected && styles.pillSelected,
                      pressed && !selected && styles.pillPressed,
                    ]}
                  >
                    <Text style={[styles.pillLabel, selected && styles.pillLabelSelected]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.title, styles.titleSecond]}>What brings you here?</Text>
            <View style={styles.grid}>
              {INTENT_OPTIONS.map((label) => {
                const selected = intent === label;
                return (
                  <Pressable
                    key={label}
                    onPress={() => pickIntent(label)}
                    style={({ pressed }) => [
                      styles.pill,
                      selected && styles.pillSelected,
                      pressed && !selected && styles.pillPressed,
                    ]}
                  >
                    <Text style={[styles.pillLabel, selected && styles.pillLabelSelected]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </ScrollView>

        {mood && intent ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable
              onPress={onContinue}
              style={({ pressed }) => [styles.continueBtn, pressed && styles.continueBtnPressed]}
            >
              <Text style={styles.continueLabel}>Continue</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  whisper: {
    fontFamily: fontFamilies.ui,
    fontSize: 14,
    color: INK_MUTED,
    marginBottom: 28,
    letterSpacing: 0.2,
  },
  title: {
    fontFamily: fontFamilies.uiSemi,
    fontSize: 17,
    color: INK,
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  titleSecond: {
    marginTop: 32,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  pill: {
    width: '48%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  pillPressed: {
    backgroundColor: '#F6F6F6',
  },
  pillSelected: {
    backgroundColor: SELECTED_BG,
    borderColor: SELECTED_BG,
  },
  pillLabel: {
    fontFamily: fontFamilies.ui,
    fontSize: 15,
    color: INK,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  pillLabelSelected: {
    color: SELECTED_TEXT,
  },
  footer: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 0,
    paddingTop: 12,
    backgroundColor: BG,
  },
  continueBtn: {
    borderRadius: 25,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: BG,
  },
  continueBtnPressed: {
    backgroundColor: '#F6F6F6',
  },
  continueLabel: {
    fontFamily: fontFamilies.ui,
    fontSize: 16,
    color: INK,
    letterSpacing: 0.3,
  },
});
