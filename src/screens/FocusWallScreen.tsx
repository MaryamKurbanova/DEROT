import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { grantAccessPassForApp } from '../lib/accessPass';
import { logReflection } from '../lib/reflectiveLog';
import { EDITORIAL_FADE_MS, unrot, unrotFonts } from '../theme';

export type FocusWallPurpose = 'intercept' | 'practice';

const MOODS = ['Calm', 'Bored', 'Tired', 'Lost'] as const;

const INTENTS = [
  'Send message',
  'Create content',
  'Seek comfort',
  'Doomscroll',
] as const;

const PAD = unrot.gutter;
const PLACEHOLDER_COLOR = 'rgba(26, 26, 26, 0.35)';
const HAIRLINE = 'rgba(26, 26, 26, 0.1)';
const CHIP_BORDER = 'rgba(26, 26, 26, 0.14)';
const NOTE_SURFACE = 'rgba(26, 26, 26, 0.04)';
const CHOICE_SELECTED_WASH = 'rgba(26, 26, 26, 0.07)';

type Props = {
  visible: boolean;
  purpose: FocusWallPurpose;
  targetAppId: string;
  targetLabel: string;
  onClose: () => void;
  interceptPreamble?: string;
  onInterceptPassGranted?: () => void;
  onLogSaved?: () => void;
  onFlowAbandoned?: () => void;
  passDurationMinutes: number;
};

function ReflectiveChoices<T extends string>({
  options,
  selected,
  onPick,
}: {
  options: readonly T[];
  selected: T | null;
  onPick: (t: T) => void;
}) {
  return (
    <View style={styles.choiceList} accessibilityRole="radiogroup">
      {options.map((opt, index) => {
        const isOn = selected === opt;
        const isLast = index === options.length - 1;
        return (
          <Pressable
            key={opt}
            onPress={() => onPick(opt)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isOn }}
            style={({ pressed }) => [
              styles.choiceRowItem,
              !isLast && styles.choiceRowDivider,
              isOn && styles.choiceRowSelected,
              pressed && { opacity: 0.75 },
            ]}
          >
            <Text style={isOn ? styles.choiceLabelSelected : styles.choiceLabel}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FocusWallScreen({
  visible,
  purpose,
  targetAppId,
  targetLabel: _targetLabel,
  onClose,
  interceptPreamble,
  onInterceptPassGranted,
  onLogSaved,
  onFlowAbandoned,
  passDurationMinutes: _passDurationMinutes,
}: Props) {
  const insets = useSafeAreaInsets();
  const [mood, setMood] = useState<(typeof MOODS)[number] | null>(null);
  const [intent, setIntent] = useState<(typeof INTENTS)[number] | null>(null);
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState(false);
  const savedRef = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const fadeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      fadeOpacity.setValue(0);
      return;
    }
    fadeOpacity.setValue(0);
    Animated.timing(fadeOpacity, {
      toValue: 1,
      duration: EDITORIAL_FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeOpacity]);

  const resetSurface = useCallback(() => {
    setMood(null);
    setIntent(null);
    setNote('');
    setSuccess(false);
    savedRef.current = false;
  }, []);

  useLayoutEffect(() => {
    if (visible) {
      resetSurface();
    }
  }, [visible, resetSurface]);

  const dismissWithoutSave = useCallback(() => {
    if (savedRef.current) return;
    onFlowAbandoned?.();
    onClose();
  }, [onClose, onFlowAbandoned]);

  const exitReflectiveLog = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dismissWithoutSave();
  }, [dismissWithoutSave]);

  const pickMood = (m: (typeof MOODS)[number]) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMood(m);
  };

  const pickIntent = (i: (typeof INTENTS)[number]) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIntent(i);
  };

  const persistAndClose = useCallback(async () => {
    if (mood == null || intent == null) return;
    const noteTrim = note.trim();
    const intentLine = noteTrim ? `${intent} — ${noteTrim}` : intent;
    try {
      await logReflection({ mood, intent: intentLine, appId: targetAppId });
      if (purpose === 'intercept') {
        await grantAccessPassForApp(targetAppId);
        onInterceptPassGranted?.();
      }
      savedRef.current = true;
      onLogSaved?.();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (e) {
      if (__DEV__) {
        console.warn('FocusWallScreen persist', e);
      }
    }
  }, [mood, intent, note, purpose, targetAppId, onClose, onInterceptPassGranted, onLogSaved]);

  const canSubmit = mood != null && intent != null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      transparent={false}
      onRequestClose={dismissWithoutSave}
      onDismiss={() => {
        if (!savedRef.current) {
          onFlowAbandoned?.();
          onClose();
        }
      }}
    >
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <Animated.View style={[styles.fadeWrap, { opacity: fadeOpacity }]}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: insets.top + 16,
                paddingHorizontal: PAD,
                paddingBottom: 168 + insets.bottom,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!success ? (
              <Pressable
                onPress={exitReflectiveLog}
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel="Exit reflective log without saving"
                style={({ pressed }) => [styles.exitHit, pressed && { opacity: 0.45 }]}
              >
                <Text style={styles.exitText}>Exit</Text>
              </Pressable>
            ) : null}

            {purpose === 'intercept' && interceptPreamble ? (
              <Text style={styles.preamble}>{interceptPreamble}</Text>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.question}>How are you feeling?</Text>
              <ReflectiveChoices options={MOODS} selected={mood} onPick={pickMood} />
            </View>

            <View style={[styles.section, styles.sectionSpaced]}>
              <Text style={styles.question}>What is your intent?</Text>
              <ReflectiveChoices options={INTENTS} selected={intent} onPick={pickIntent} />
            </View>

            <View style={styles.noteBlock}>
              <Text style={styles.noteLabel}>Anything to add?</Text>
              <Text style={styles.noteHint}>Optional — a word or two is enough.</Text>
              <TextInput
                ref={inputRef}
                value={note}
                onChangeText={setNote}
                placeholder="Tap to write…"
                placeholderTextColor={PLACEHOLDER_COLOR}
                style={styles.noteInput}
                multiline
                cursorColor={unrot.ink}
                selectionColor={unrot.ink}
                underlineColorAndroid="transparent"
                textAlignVertical="top"
              />
            </View>

            {success ? (
              <Text style={styles.successText}>Recorded.</Text>
            ) : null}
          </ScrollView>

          {!success ? (
            <View
              style={[
                styles.footer,
                {
                  paddingBottom: Math.max(insets.bottom, 20) + 12,
                  paddingHorizontal: PAD,
                  paddingTop: 20,
                },
              ]}
            >
              <Pressable
                onPress={() => void persistAndClose()}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit }}
                style={({ pressed }) => [
                  styles.continueBtn,
                  canSubmit ? styles.continueBtnOn : styles.continueBtnOff,
                  pressed && canSubmit && styles.continueBtnPressed,
                ]}
              >
                <Text style={[styles.continueLabel, !canSubmit && styles.continueLabelMuted]}>
                  Continue
                </Text>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: unrot.bg,
  },
  fadeWrap: {
    flex: 1,
    backgroundColor: unrot.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  exitHit: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    marginBottom: 8,
  },
  exitText: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    color: unrot.muted,
  },
  preamble: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 20,
    color: unrot.muted,
    marginBottom: 28,
    maxWidth: 320,
  },
  section: {
    paddingBottom: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  sectionSpaced: {
    marginTop: 28,
  },
  question: {
    fontFamily: unrotFonts.heroSerifItalic,
    fontSize: 24,
    lineHeight: 32,
    color: unrot.ink,
    marginBottom: 16,
    maxWidth: 340,
  },
  choiceList: {
    alignSelf: 'stretch',
  },
  choiceRowItem: {
    paddingVertical: 17,
    paddingHorizontal: 4,
  },
  choiceRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  choiceRowSelected: {
    backgroundColor: CHOICE_SELECTED_WASH,
    marginHorizontal: -4,
    paddingHorizontal: 8,
  },
  choiceLabel: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 17,
    lineHeight: 24,
    color: unrot.ink,
  },
  choiceLabelSelected: {
    fontFamily: unrotFonts.interBold,
    fontSize: 17,
    lineHeight: 24,
    color: unrot.ink,
  },
  noteBlock: {
    marginTop: 32,
  },
  noteLabel: {
    fontFamily: unrotFonts.heroSerifItalic,
    fontSize: 20,
    lineHeight: 28,
    color: unrot.ink,
    marginBottom: 6,
  },
  noteHint: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 19,
    color: unrot.muted,
    marginBottom: 12,
  },
  noteInput: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 15,
    lineHeight: 23,
    color: unrot.ink,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 96,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CHIP_BORDER,
    backgroundColor: NOTE_SURFACE,
  },
  successText: {
    marginTop: 36,
    fontFamily: unrotFonts.interRegular,
    fontSize: 14,
    color: unrot.muted,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: unrot.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
  },
  continueBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    minHeight: 52,
  },
  continueBtnOn: {
    backgroundColor: unrot.ink,
  },
  continueBtnOff: {
    backgroundColor: NOTE_SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CHIP_BORDER,
  },
  continueBtnPressed: {
    opacity: 0.82,
  },
  continueLabel: {
    fontFamily: unrotFonts.interBold,
    fontSize: 16,
    letterSpacing: 0.15,
    color: '#FFFFFF',
  },
  continueLabelMuted: {
    fontFamily: unrotFonts.interRegular,
    color: unrot.muted,
  },
});
