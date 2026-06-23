import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { grantAccessPassForMonitoredApps } from '../lib/accessPass';
import { getSocialLockEnabled } from '../lib/monitoredApps';
import { logReflection } from '../lib/reflectiveLog';
import { HoldToConfirmButton } from '../screens/onboarding/HoldToConfirmButton';
import { OB_FONTS } from '../screens/onboarding/tokens';
import { EDITORIAL_FADE_MS, unrot, unrotFonts } from '../theme';

export type ReflectiveLogPurpose = 'intercept' | 'practice';

const MOODS = ['Calm', 'Bored', 'Tired', 'Lost', 'Good'] as const;

const INTENTS = ['Send message', 'Create content', 'Seek comfort', 'Doomscroll'] as const;

const PAD = unrot.gutter;
const PLACEHOLDER_COLOR = 'rgba(26, 26, 26, 0.35)';
const HAIRLINE = 'rgba(26, 26, 26, 0.1)';
const CHIP_BORDER = 'rgba(26, 26, 26, 0.14)';
const NOTE_SURFACE = 'rgba(26, 26, 26, 0.04)';
const BAR_FILL_MS = 520;
const INK_HEX = '#1A1A1A';

function createLogStyles(onboarding: boolean) {
  const regular = onboarding ? OB_FONTS.regular : unrotFonts.interRegular;
  const bold = onboarding ? OB_FONTS.bold : unrotFonts.interBold;
  const light = onboarding ? OB_FONTS.regular : unrotFonts.interLight;
  const heading = onboarding ? OB_FONTS.regular : unrotFonts.heroSerifItalic;
  const mono = onboarding ? OB_FONTS.bold : unrotFonts.monoBold;

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: unrot.bg,
    },
    embeddedRoot: {
      flex: 1,
      minHeight: 480,
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
      fontFamily: regular,
      fontSize: 13,
      color: unrot.muted,
    },
    preamble: {
      fontFamily: regular,
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
      fontFamily: heading,
      fontSize: 24,
      lineHeight: 32,
      color: unrot.ink,
      marginBottom: 16,
      maxWidth: 340,
    },
    choiceList: {
      alignSelf: 'stretch',
    },
    choiceBigBarWrap: {
      alignSelf: 'stretch',
    },
    choiceBigBarWrapSpaced: {
      marginBottom: 12,
    },
    choiceBigBarDimmed: {
      opacity: 0.36,
    },
    choiceBigBarPressed: {
      opacity: 0.94,
      transform: [{ scale: 0.985 }],
    },
    choiceBigBarInner: {
      minHeight: 58,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: CHIP_BORDER,
      overflow: 'hidden',
      backgroundColor: NOTE_SURFACE,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'stretch',
      width: '100%',
    },
    choiceBigBarFill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: unrot.ink,
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
    },
    choiceBigBarFillFull: {
      borderTopRightRadius: 16,
      borderBottomRightRadius: 16,
    },
    choiceBigBarLabel: {
      fontFamily: regular,
      fontSize: 17,
      lineHeight: 24,
      textAlign: 'center',
      zIndex: 1,
      paddingVertical: 18,
      paddingHorizontal: 20,
    },
    choiceBigBarLabelLocked: {
      fontFamily: bold,
    },
    noteBlock: {
      marginTop: 32,
    },
    noteLabel: {
      fontFamily: heading,
      fontSize: 20,
      lineHeight: 28,
      color: unrot.ink,
      marginBottom: 6,
    },
    noteHint: {
      fontFamily: regular,
      fontSize: 13,
      lineHeight: 19,
      color: unrot.muted,
      marginBottom: 12,
    },
    noteInput: {
      fontFamily: regular,
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
      fontFamily: regular,
      fontSize: 14,
      color: unrot.muted,
    },
    reframeText: {
      marginTop: 36,
      fontFamily: light,
      fontSize: 19,
      lineHeight: 30,
      color: unrot.ink,
      letterSpacing: -0.2,
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
    continueBtnStretch: {
      alignSelf: 'stretch',
    },
    holdHint: {
      fontFamily: mono,
      fontSize: 10,
      letterSpacing: 1.5,
      color: unrot.muted,
      textAlign: 'center',
      marginBottom: 10,
      textTransform: 'uppercase',
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
      fontFamily: bold,
      fontSize: 16,
      letterSpacing: 0.15,
      color: '#FFFFFF',
    },
    continueLabelMuted: {
      fontFamily: regular,
      color: unrot.muted,
    },
  });
}

type LogStyles = ReturnType<typeof createLogStyles>;

export type ReflectiveLogSurfaceProps = {
  purpose: ReflectiveLogPurpose;
  targetAppId: string;
  onComplete: () => void;
  showExit?: boolean;
  onExit?: () => void;
  interceptPreamble?: string;
  onInterceptPassGranted?: (untilMs: number) => void;
  onLogSaved?: () => void;
  embedded?: boolean;
  horizontalBleed?: number;
  topInset?: number;
  bottomInset?: number;
  /** When set, shows a tailored line after submit instead of "Recorded." */
  getReframeLine?: (mood: string, intent: string) => string;
  reframeDelayMs?: number;
  /** Onboarding screen 31 — press-and-hold to submit. */
  holdToConfirm?: boolean;
  /** Suppress haptics on mood/intent bar selection (onboarding trial). */
  quietInteraction?: boolean;
};

function BarChoiceRow<T extends string>({
  label,
  isLast,
  locked,
  siblingLocked,
  onCommit,
  quietInteraction = false,
  styles,
}: {
  label: T;
  isLast: boolean;
  locked: boolean;
  siblingLocked: boolean;
  onCommit: () => void;
  quietInteraction?: boolean;
  styles: LogStyles;
}) {
  const progress = useRef(new Animated.Value(locked ? 1 : 0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const fillCompletedRef = useRef(false);

  useEffect(() => {
    progress.setValue(locked ? 1 : 0);
    if (!locked) fillCompletedRef.current = false;
  }, [locked, progress]);

  useEffect(() => {
    return () => {
      animRef.current?.stop();
    };
  }, []);

  const disabled = siblingLocked && !locked;

  const onPressIn = () => {
    if (disabled || locked) return;
    fillCompletedRef.current = false;
    animRef.current?.stop();
    progress.setValue(0);
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: BAR_FILL_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animRef.current = run;
    run.start(({ finished }) => {
      if (finished && !fillCompletedRef.current) {
        fillCompletedRef.current = true;
        if (!quietInteraction) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        onCommit();
      }
    });
  };

  const onPressOut = () => {
    if (locked || fillCompletedRef.current) return;
    animRef.current?.stop();
    animRef.current = null;
    Animated.timing(progress, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const labelColor = progress.interpolate({
    inputRange: [0, 0.38, 0.72, 1],
    outputRange: [INK_HEX, INK_HEX, '#FFFFFF', '#FFFFFF'],
  });

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: locked, disabled }}
      accessibilityHint="Tap and hold until the bar fills to lock this answer."
      style={({ pressed }) => [
        styles.choiceBigBarWrap,
        !isLast && styles.choiceBigBarWrapSpaced,
        disabled && styles.choiceBigBarDimmed,
        pressed && !disabled && !locked && styles.choiceBigBarPressed,
      ]}
    >
      <View style={styles.choiceBigBarInner}>
        <Animated.View
          style={[styles.choiceBigBarFill, locked && styles.choiceBigBarFillFull, { width: fillWidth }]}
        />
        <Animated.Text
          style={[
            styles.choiceBigBarLabel,
            locked && styles.choiceBigBarLabelLocked,
            { color: labelColor },
          ]}
        >
          {label}
        </Animated.Text>
      </View>
    </Pressable>
  );
}

function ReflectiveChoices<T extends string>({
  options,
  selected,
  onPick,
  quietInteraction = false,
  styles,
}: {
  options: readonly T[];
  selected: T | null;
  onPick: (t: T) => void;
  quietInteraction?: boolean;
  styles: LogStyles;
}) {
  const siblingLocked = selected !== null;
  return (
    <View style={styles.choiceList} accessibilityRole="radiogroup">
      {options.map((opt, index) => {
        const isLast = index === options.length - 1;
        return (
          <BarChoiceRow
            key={opt}
            label={opt}
            isLast={isLast}
            locked={selected === opt}
            siblingLocked={siblingLocked}
            onCommit={() => onPick(opt)}
            quietInteraction={quietInteraction}
            styles={styles}
          />
        );
      })}
    </View>
  );
}

export function ReflectiveLogSurface({
  purpose,
  targetAppId,
  onComplete,
  showExit = false,
  onExit,
  interceptPreamble,
  onInterceptPassGranted,
  onLogSaved,
  embedded = false,
  horizontalBleed = 0,
  topInset = 0,
  bottomInset = 0,
  getReframeLine,
  reframeDelayMs = 2200,
  holdToConfirm = false,
  quietInteraction = false,
}: ReflectiveLogSurfaceProps) {
  const [mood, setMood] = useState<(typeof MOODS)[number] | null>(null);
  const [intent, setIntent] = useState<(typeof INTENTS)[number] | null>(null);
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState(false);
  const [reframeLine, setReframeLine] = useState<string | null>(null);
  const savedRef = useRef(false);
  const fadeOpacity = useRef(new Animated.Value(embedded ? 1 : 0)).current;
  const styles = useMemo(() => createLogStyles(embedded), [embedded]);

  useEffect(() => {
    if (embedded) {
      fadeOpacity.setValue(1);
      return;
    }
    fadeOpacity.setValue(0);
    Animated.timing(fadeOpacity, {
      toValue: 1,
      duration: EDITORIAL_FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [embedded, fadeOpacity]);

  const persistAndClose = useCallback(async () => {
    if (mood == null || intent == null) return;
    const noteTrim = note.trim();
    const intentLine = noteTrim ? `${intent} — ${noteTrim}` : intent;
    try {
      await logReflection({ mood, intent: intentLine, appId: targetAppId });
      const socialLockOn = await getSocialLockEnabled();
      if (purpose === 'intercept' || socialLockOn) {
        const untilMs = await grantAccessPassForMonitoredApps();
        onInterceptPassGranted?.(untilMs);
      }
      savedRef.current = true;
      onLogSaved?.();
      if (!holdToConfirm) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      const line = getReframeLine?.(mood, intent) ?? null;
      setReframeLine(line);
      setSuccess(true);
      setTimeout(() => {
        onComplete();
      }, line ? reframeDelayMs : 1000);
    } catch (e) {
      if (__DEV__) {
        console.warn('ReflectiveLogSurface persist', e);
      }
    }
  }, [mood, intent, note, purpose, targetAppId, onComplete, onInterceptPassGranted, onLogSaved, getReframeLine, reframeDelayMs, holdToConfirm]);

  const canSubmit = mood != null && intent != null;

  const body = (
    <Animated.View style={[styles.fadeWrap, { opacity: fadeOpacity }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topInset + (embedded ? 0 : 16),
            paddingHorizontal: PAD,
            paddingBottom: 168 + bottomInset,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {showExit && !success ? (
          <Pressable
            onPress={onExit}
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
          <ReflectiveChoices options={MOODS} selected={mood} onPick={setMood} quietInteraction={quietInteraction} styles={styles} />
        </View>

        <View style={[styles.section, styles.sectionSpaced]}>
          <Text style={styles.question}>What is your intent?</Text>
          <ReflectiveChoices options={INTENTS} selected={intent} onPick={setIntent} quietInteraction={quietInteraction} styles={styles} />
        </View>

        <View style={styles.noteBlock}>
          <Text style={styles.noteLabel}>Anything to add?</Text>
          <Text style={styles.noteHint}>Optional — a word or two is enough.</Text>
          <TextInput
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
          <Text style={reframeLine ? styles.reframeText : styles.successText}>
            {reframeLine ?? 'Recorded.'}
          </Text>
        ) : null}
      </ScrollView>

      {!success ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(bottomInset, 20) + 12,
              paddingHorizontal: PAD,
              paddingTop: 20,
            },
          ]}
        >
          {holdToConfirm ? (
            <>
              <Text style={styles.holdHint}>Press and hold to confirm</Text>
              <HoldToConfirmButton
                label="Continue"
                disabled={!canSubmit}
                onComplete={() => void persistAndClose()}
                style={styles.continueBtnStretch}
              />
            </>
          ) : (
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
              <Text style={[styles.continueLabel, !canSubmit && styles.continueLabelMuted]}>Continue</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </Animated.View>
  );

  if (embedded) {
    return (
      <View style={[styles.embeddedRoot, horizontalBleed ? { marginHorizontal: -horizontalBleed } : null]}>
        {body}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={topInset}
    >
      {body}
    </KeyboardAvoidingView>
  );
}
