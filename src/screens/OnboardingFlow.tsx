import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';
import { useEffect, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandAppIcon, type BrandAppId } from '../components/BrandAppIcon';
import {
  saveOnboardingProfile,
  setOnboardingComplete,
} from '../lib/onboardingStorage';
import { spacing, unrot, unrotFonts } from '../theme';

/** Align with Dashboard home surface + type */
const OB_PAD_H = 28;
const OB_INK = '#111111';
const OB_SECONDARY = '#8A8A8A';
const OB_LABEL = '#A0A0A0';
const OB_INSIGHT = '#333333';
const OB_TILE = '#F2F2F2';
const OB_HAIRLINE = 'rgba(17, 17, 17, 0.08)';
const OB_RADIUS = 20;
const OB_HERO = '#111111';
const OB_WHITE = '#FFFFFF';
const OB_HERO_MUTED = 'rgba(255, 255, 255, 0.55)';

const ONBOARD_APP_IDS: { key: string; id: BrandAppId; a11yName: string }[] = [
  { key: 'tiktok', id: 'tiktok', a11yName: 'TikTok' },
  { key: 'snapchat', id: 'snapchat', a11yName: 'Snapchat' },
  { key: 'instagram', id: 'instagram', a11yName: 'Instagram' },
  { key: 'facebook', id: 'facebook', a11yName: 'Facebook' },
];

type Props = { onDone: () => void };

const TOTAL_STEPS = 10;

const AGE_BRACKETS = [
  { label: '13–17', store: '13-17' },
  { label: '18–24', store: '18-24' },
  { label: '25–34', store: '25-34' },
  { label: '35–44', store: '35-44' },
  { label: '45–54', store: '45-54' },
  { label: '55+', store: '55+' },
] as const;

const HOURS_SLIDER_MIN = 1;
const HOURS_SLIDER_MAX = 12;
const HOURS_SLIDER_STEP = 0.5;
const HOURS_SLIDER_DEFAULT = 3;

function formatHoursForStorage(h: number): string {
  const r = Math.round(h * 10) / 10;
  return Number.isInteger(r) ? String(Math.round(r)) : r.toFixed(1);
}

function getSliderCaption(hours: number): string {
  if (hours <= 5) return 'Above average focus.';
  if (hours <= 8) return 'Significant daily rot.';
  return 'Critical levels detected.';
}

function TypewriterText({ text, active }: { text: string; active: boolean }) {
  const [visibleText, setVisibleText] = useState(active ? '' : text);

  useEffect(() => {
    if (!active) {
      setVisibleText(text);
      return;
    }
    setVisibleText('');
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setVisibleText(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, 22);
    return () => clearInterval(timer);
  }, [active, text]);

  return <Text style={styles.editorialLine}>{visibleText}</Text>;
}

export function OnboardingFlow({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [hoursValue, setHoursValue] = useState(HOURS_SLIDER_DEFAULT);
  const [showUnlockLine, setShowUnlockLine] = useState(false);
  const [sliderInteracted, setSliderInteracted] = useState(false);

  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentY = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;
  const stepTransitionSkip = useRef(true);
  const hoursPulse = useRef(new Animated.Value(1)).current;
  const lastHapticStep = useRef(Math.round(HOURS_SLIDER_DEFAULT * 2));

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (step + 1) / TOTAL_STEPS,
      duration: 520,
      easing: Easing.bezier(0.22, 0.99, 0.36, 1),
      useNativeDriver: false,
    }).start();
  }, [step, progressAnim]);

  useEffect(() => {
    if (stepTransitionSkip.current) {
      stepTransitionSkip.current = false;
      return;
    }
    contentOpacity.setValue(0);
    contentY.setValue(10);
    contentScale.setValue(0.972);
    const easeOut = Easing.bezier(0.22, 0.99, 0.36, 1);
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 400,
        easing: easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(contentY, {
        toValue: 0,
        duration: 400,
        easing: easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(contentScale, {
        toValue: 1,
        duration: 440,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step, contentOpacity, contentY, contentScale]);

  useEffect(() => {
    if (step !== 3) {
      setShowUnlockLine(false);
      return;
    }
    const t = setTimeout(() => setShowUnlockLine(true), 3000);
    return () => clearTimeout(t);
  }, [step]);

  const daysYear = hoursValue > 0 ? Math.round((hoursValue * 365) / 24) : 0;
  const yearsSpentScrolling =
    hoursValue > 0 ? Math.round(((hoursValue * 80) / 24) * 10) / 10 : 0;
  const trimmedName = name.trim() || 'friend';

  const onHoursChange = (v: number) => {
    setHoursValue(v);
    if (!sliderInteracted) setSliderInteracted(true);
    const currentStep = Math.round(v * 2);
    if (currentStep !== lastHapticStep.current) {
      lastHapticStep.current = currentStep;
      void Haptics.selectionAsync();
      hoursPulse.stopAnimation();
      hoursPulse.setValue(1);
      Animated.sequence([
        Animated.timing(hoursPulse, {
          toValue: 1.05,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(hoursPulse, {
          toValue: 1,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const goNext = async () => {
    void Haptics.selectionAsync();
    if (step === 8) {
      await saveOnboardingProfile({
        name: trimmedName,
        age: age.trim(),
        hoursPerDay: formatHoursForStorage(hoursValue),
      });
      setStep(9);
      return;
    }
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  };

  const finishOnboarding = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setOnboardingComplete();
    onDone();
  };

  const canContinue =
    step === 3
      ? showUnlockLine
      : step === 4
        ? name.trim().length > 0
        : step === 5
          ? age.trim().length > 0
          : step === 6
            ? hoursValue >= HOURS_SLIDER_MIN
            : true;
  const ctaOk = canContinue && !(step === 6 && !sliderInteracted);

  const renderBody = () => {
    switch (step) {
      case 0:
        return (
          <TypewriterText
            text="Your time is the only currency you can't earn back."
            active={step === 0}
          />
        );
      case 1:
        return (
          <TypewriterText
            text="And social media is taking that away from you."
            active={step === 1}
          />
        );
      case 2:
        return (
          <TypewriterText
            text="Unrot is the tool to reclaim your stolen hours."
            active={step === 2}
          />
        );
      case 3:
        return (
          <View style={styles.centerBlock}>
            <View style={styles.appsRow}>
              {ONBOARD_APP_IDS.map((app) => (
                <View key={app.key} style={styles.appChip} accessibilityLabel={app.a11yName} accessibilityRole="image">
                  <BrandAppIcon name={app.id} size={36} />
                </View>
              ))}
            </View>
            {!showUnlockLine ? (
              <TypewriterText
                text="It's simple: once an hour we block these apps."
                active={step === 3 && !showUnlockLine}
              />
            ) : (
              <TypewriterText
                text="Once you complete your 10 second log, your apps unlock for the next 10 minutes."
                active={step === 3 && showUnlockLine}
              />
            )}
          </View>
        );
      case 4:
        return (
          <View style={styles.inputBlock}>
            <Text style={styles.fieldKicker}>Your name</Text>
            <Text style={styles.line}>What should we call you?</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="First name"
              placeholderTextColor={OB_LABEL}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={() => ctaOk && void goNext()}
              autoCapitalize="words"
            />
          </View>
        );
      case 5:
        return (
          <View style={styles.inputBlock}>
            <Text style={styles.fieldKicker}>Age</Text>
            <Text style={styles.line}>How old are you?</Text>
            <View style={styles.ageGrid}>
              {AGE_BRACKETS.map((opt) => {
                const on = age === opt.store;
                return (
                  <Pressable
                    key={opt.store}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setAge(opt.store);
                    }}
                    style={({ pressed }) => [styles.ageBtn, on && styles.ageBtnOn, pressed && styles.ageBtnPressed]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.ageBtnText, on && styles.ageBtnTextOn]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      case 6:
        return (
          <View style={styles.sliderStepOnly}>
            <Text style={styles.line}>Be honest, how many hours a day do you spend on the screen?</Text>
            <View style={styles.sliderColumn}>
              <Slider
                style={styles.sliderRowTrack}
                minimumValue={HOURS_SLIDER_MIN}
                maximumValue={HOURS_SLIDER_MAX}
                step={HOURS_SLIDER_STEP}
                value={hoursValue}
                onValueChange={onHoursChange}
                onSlidingComplete={() => {
                  setSliderInteracted(true);
                  void Haptics.selectionAsync();
                }}
                minimumTrackTintColor={OB_INK}
                maximumTrackTintColor={unrot.choiceMuted}
                thumbTintColor={Platform.OS === 'android' ? OB_INK : undefined}
              />
              <Animated.View style={{ transform: [{ scale: hoursPulse }] }}>
                <Text style={styles.sliderHoursBig}>{formatHoursForStorage(hoursValue)}</Text>
                <Text style={styles.sliderUnit}>hours / day</Text>
              </Animated.View>
            </View>
            <Text style={styles.sliderCaption}>{getSliderCaption(hoursValue)}</Text>
          </View>
        );
      case 7:
        return (
          <View style={styles.impactHeroCard}>
            <Text style={styles.impactHeroKicker}>AT YOUR CURRENT PACE</Text>
            <Text style={styles.impactHeroLine}>
              You lose about <Text style={styles.impactHeroEm}>{daysYear}</Text> full days yearly to the feed.
            </Text>
            <Text style={[styles.impactHeroLine, styles.impactHeroLineGap]}>
              Across an 80-year life, that compounds to roughly <Text style={styles.impactHeroEm}>{yearsSpentScrolling}</Text>{' '}
              years scrolling if nothing changes.
            </Text>
          </View>
        );
      case 8:
        return (
          <TypewriterText
            text={`${trimmedName}, start now — before another year scrolls past.`}
            active={step === 8}
          />
        );
      case 9:
        return (
          <View style={styles.paywall}>
            <Text style={styles.payEyebrow}>UNROT</Text>
            <Text style={styles.payTitle}>Choose your cadence</Text>
            <Text style={styles.paySubtitle}>Same ritual either way — pick what fits.</Text>
            <Pressable onPress={finishOnboarding} style={({ pressed }) => [styles.planCard, pressed && styles.planCardPressed]}>
              <View style={styles.planRow}>
                <Text style={styles.planLabel}>Weekly</Text>
                <Text style={styles.planChevron}>→</Text>
              </View>
              <Text style={styles.planPrice}>$9.99 / week</Text>
            </Pressable>
            <Pressable
              onPress={finishOnboarding}
              style={({ pressed }) => [styles.planCard, styles.planCardEmphasis, pressed && styles.planCardPressed]}
            >
              <View style={styles.planBadgeInline}>
                <Text style={styles.planBadgeText}>Common pick</Text>
              </View>
              <View style={styles.planRow}>
                <Text style={styles.planLabel}>Monthly</Text>
                <Text style={styles.planChevron}>→</Text>
              </View>
              <Text style={styles.planPrice}>$39.99 / month</Text>
            </Pressable>
            <Text style={styles.payNote}>
              This build unlocks after you choose a plan — connect RevenueCat or native IAP for billing later.
            </Text>
            <Pressable onPress={finishOnboarding} style={styles.skipBtn}>
              <Text style={styles.skipText}>Maybe later</Text>
            </Pressable>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.brandMark}>UNROT</Text>
        <View style={styles.progressHeader}>
          <Text style={styles.progressFraction}>
            {String(step + 1).padStart(2, '0')} · {String(TOTAL_STEPS).padStart(2, '0')}
          </Text>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          </View>
        </View>
        <Animated.View
          style={[styles.bodyWrap, { opacity: contentOpacity, transform: [{ translateY: contentY }, { scale: contentScale }] }]}
        >
          {renderBody()}
        </Animated.View>
      </ScrollView>
      {step !== 9 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Pressable
            onPress={() => void goNext()}
            disabled={!ctaOk}
            style={({ pressed }) => [
              styles.nextButton,
              !ctaOk && styles.nextButtonDisabled,
              pressed && ctaOk && styles.nextButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Next"
            accessibilityState={{ disabled: !ctaOk }}
          >
            <Text style={styles.nextButtonLabel}>NEXT</Text>
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: unrot.bg },
  scroll: { flexGrow: 1, paddingHorizontal: OB_PAD_H, paddingBottom: spacing.xxl },
  brandMark: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 9,
    letterSpacing: 3,
    color: OB_SECONDARY,
    marginBottom: spacing.md,
    opacity: 0.85,
  },
  progressHeader: { marginBottom: spacing.lg },
  progressFraction: {
    alignSelf: 'flex-end',
    fontFamily: unrotFonts.monoBold,
    fontSize: 11,
    color: OB_LABEL,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  progressTrack: { height: 2, borderRadius: 1, backgroundColor: unrot.choiceMuted, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 1, backgroundColor: OB_INK },
  bodyWrap: { flex: 1, minHeight: 272, justifyContent: 'center', paddingTop: spacing.sm, paddingRight: 2 },
  /** Narrative steps — home insight voice */
  editorialLine: {
    fontFamily: unrotFonts.interLight,
    fontSize: 19,
    lineHeight: 30,
    color: OB_INSIGHT,
    letterSpacing: -0.2,
  },
  centerBlock: { gap: spacing.lg + 8 },
  appsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'flex-start' },
  appChip: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OB_WHITE,
    borderRadius: OB_RADIUS,
    borderWidth: 1,
    borderColor: OB_HAIRLINE,
  },
  fieldKicker: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 8,
    color: OB_SECONDARY,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  inputBlock: { gap: spacing.md },
  line: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 18,
    lineHeight: 26,
    color: OB_INK,
    letterSpacing: -0.2,
  },
  input: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 22,
    lineHeight: 30,
    color: OB_INK,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: OB_HAIRLINE,
    paddingVertical: 14,
    marginTop: 4,
    letterSpacing: -0.2,
  },
  ageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: spacing.sm },
  ageBtn: {
    flexGrow: 1,
    minWidth: '46%',
    paddingVertical: 16,
    paddingHorizontal: spacing.sm,
    borderRadius: OB_RADIUS,
    borderWidth: 1,
    borderColor: OB_HAIRLINE,
    alignItems: 'center',
    backgroundColor: OB_WHITE,
  },
  ageBtnOn: { borderColor: OB_INK, backgroundColor: OB_TILE },
  ageBtnPressed: { opacity: 0.88 },
  ageBtnText: { fontFamily: unrotFonts.heroSerif, fontSize: 15, color: OB_SECONDARY, letterSpacing: -0.1 },
  ageBtnTextOn: { color: OB_INK },
  sliderStepOnly: { gap: spacing.lg + 4 },
  sliderColumn: { marginTop: spacing.md, gap: spacing.md },
  sliderRowTrack: { width: '100%', height: 44 },
  sliderHoursBig: {
    fontFamily: unrotFonts.interLight,
    fontSize: 34,
    lineHeight: 40,
    color: OB_INK,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  sliderUnit: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 8,
    color: OB_LABEL,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  sliderCaption: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 14,
    color: OB_SECONDARY,
    marginTop: spacing.sm,
    letterSpacing: -0.05,
  },
  impactHeroCard: {
    alignSelf: 'stretch',
    backgroundColor: OB_HERO,
    borderRadius: OB_RADIUS,
    paddingHorizontal: 28,
    paddingVertical: 28,
    marginTop: 4,
  },
  impactHeroKicker: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 8,
    letterSpacing: 2.2,
    color: OB_HERO_MUTED,
    marginBottom: 14,
  },
  impactHeroLine: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 16,
    lineHeight: 27,
    color: OB_WHITE,
    letterSpacing: -0.05,
  },
  impactHeroLineGap: { marginTop: 18 },
  impactHeroEm: {
    fontFamily: unrotFonts.interLight,
    fontSize: 17,
    color: OB_WHITE,
    fontVariant: ['tabular-nums'],
  },
  paywall: { paddingBottom: spacing.lg, paddingTop: spacing.xs },
  payEyebrow: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 8,
    letterSpacing: 3,
    color: OB_LABEL,
    marginBottom: 12,
  },
  payTitle: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 34,
    lineHeight: 40,
    color: OB_INK,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  paySubtitle: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 15,
    lineHeight: 22,
    color: OB_SECONDARY,
    marginBottom: spacing.lg,
    letterSpacing: -0.05,
  },
  planCard: {
    borderRadius: OB_RADIUS,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: OB_HAIRLINE,
    backgroundColor: OB_WHITE,
  },
  planCardEmphasis: { borderColor: OB_INK, backgroundColor: OB_TILE },
  planCardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planBadgeInline: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: OB_INK,
    paddingBottom: 4,
  },
  planBadgeText: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 8,
    color: OB_INK,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  planLabel: { fontFamily: unrotFonts.heroSerif, fontSize: 18, color: OB_INK, letterSpacing: -0.2 },
  planChevron: { fontFamily: unrotFonts.heroSerif, fontSize: 18, color: OB_SECONDARY, marginTop: 1 },
  planPrice: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 12,
    color: OB_SECONDARY,
    marginTop: 10,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.4,
  },
  payNote: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    lineHeight: 18,
    color: OB_LABEL,
    marginTop: spacing.lg,
    letterSpacing: -0.05,
  },
  skipBtn: { alignSelf: 'center', paddingVertical: spacing.lg, marginTop: spacing.sm },
  skipText: { fontFamily: unrotFonts.heroSerif, fontSize: 16, color: OB_SECONDARY, letterSpacing: -0.1 },
  footer: {
    paddingHorizontal: OB_PAD_H,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: OB_HAIRLINE,
    paddingTop: spacing.lg,
    backgroundColor: unrot.bg,
  },
  nextButton: {
    alignSelf: 'stretch',
    backgroundColor: OB_INK,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  nextButtonPressed: { opacity: 0.92 },
  nextButtonDisabled: { opacity: 0.38 },
  nextButtonLabel: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: OB_WHITE,
  },
});
