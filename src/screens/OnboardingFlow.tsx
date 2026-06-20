import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { saveOnboardingProfile, setOnboardingComplete } from '../lib/onboardingStorage';
import { ReflectiveLogSurface } from '../components/ReflectiveLogSurface';
import {
  AgeChoiceButton,
  AnimatedHoursCaption,
  BlueprintSummaryCard,
  BodyRegular,
  ChoiceRow,
  ChoiceStack,
  FadeInText,
  Gap,
  ImpactHeroCard,
  InsightBody,
  InsightLight,
  MultiChoiceRow,
  OnboardingFooter,
  ProgressBar,
  SelectableAppChip,
  SelectedTargetIcons,
  SerifQuestion,
  StepCounter,
  StepShell,
  StaggerChipGrid,
  StreakAchievementStep,
  StreakDayOneCelebration,
  TerminalLine,
  TypewriterHeadline,
  TypewriterText,
  UnderlineInput,
} from './onboarding/components';
import { OB_EASE, OB_SPRING } from './onboarding/motion';
import {
  AGE_BRACKETS,
  APP_INTENT_OPTIONS,
  DEVICE_POSITION_OPTIONS,
  FOCUS_VULNERABILITY_OPTIONS,
  formatHoursDisplay,
  HOURS_DEFAULT,
  HOURS_MAX,
  HOURS_MIN,
  HOURS_STEP,
  hoursCaption,
  impactStats,
  OB,
  reclaimHoursGoal,
  selectedShieldTargets,
  SHIELD_TARGETS,
  spacing,
  TOTAL_ONBOARDING_STEPS,
  unrot,
  unrotFonts,
  type ShieldTargetId,
} from './onboarding/tokens';

type Props = { onDone: () => void };

type OnboardingAnswers = {
  appIntent: string[];
  focusVulnerability: string | null;
  devicePosition: string | null;
  triggers: string[];
  phonePickups: string | null;
  reclaimedFocus: string | null;
  commitment: string | null;
};

function footerLabel(step: number): string {
  const map: Record<number, string> = {
    0: 'START',
    18: 'TRY IT NOW',
    19: 'LOG TO UNLOCK',
    21: 'KEEP THE STREAK',
    23: 'VIEW MY PROFILE',
    27: 'ENTER THE UNROT',
  };
  return map[step] ?? 'NEXT';
}

function primaryFeeling(answers: OnboardingAnswers): string {
  if (answers.appIntent.some((i) => i.includes('Passive entertainment'))) return 'numb';
  if (answers.appIntent.some((i) => i.includes('Connecting with friends'))) return 'disconnected';
  if (answers.appIntent.some((i) => i.includes('Seeking information'))) return 'restless';
  return 'restless';
}

function primaryTrigger(triggers: string[]): string {
  if (triggers.length === 0) return 'boredom';
  return triggers[0].toLowerCase();
}

function ProjectionChart() {
  const w = 280;
  const h = 120;
  const drift = 'M8,20 L60,35 L110,55 L160,72 L210,88 L272,98';
  const guard = 'M8,98 L60,82 L110,62 L160,45 L210,28 L272,12';

  return (
    <View style={styles.chartBox}>
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        <Path d={drift} stroke={OB.secondary} strokeWidth={2} fill="none" />
        <Path d={guard} stroke={OB.ink} strokeWidth={2} fill="none" />
      </Svg>
    </View>
  );
}

function ShieldMock() {
  const cardY = useRef(new Animated.Value(18)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    cardY.setValue(18);
    cardOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(cardY, { toValue: 0, ...OB_SPRING.reveal }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 480, easing: OB_EASE, useNativeDriver: true }),
    ]).start();
  }, [cardOpacity, cardY]);

  return (
    <View style={styles.shieldStage}>
      <View style={styles.shieldWireframe} />
      <Animated.View style={[styles.shieldCard, { opacity: cardOpacity, transform: [{ translateY: cardY }] }]}>
        <Text style={styles.shieldLabel}>[ INTERCEPT: UNROT LOCK ACTIVE ]</Text>
      </Animated.View>
    </View>
  );
}

export function OnboardingFlow({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [hoursValue, setHoursValue] = useState(HOURS_DEFAULT);
  const [sliderInteracted, setSliderInteracted] = useState(false);
  const [loadingLine, setLoadingLine] = useState(0);
  const [selectedTargets, setSelectedTargets] = useState<ShieldTargetId[]>([]);
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    appIntent: [],
    focusVulnerability: null,
    devicePosition: null,
    triggers: [],
    phonePickups: null,
    reclaimedFocus: null,
    commitment: null,
  });

  const highlightedTargets = useMemo(() => selectedShieldTargets(selectedTargets), [selectedTargets]);

  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentY = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_ONBOARDING_STEPS)).current;
  const stepTransitionSkip = useRef(true);
  const hoursPulse = useRef(new Animated.Value(1)).current;

  const trimmedName = name.trim() || 'friend';
  const { daysYear, yearsLife } = impactStats(hoursValue);
  const reclaimGoal = reclaimHoursGoal(hoursValue);
  const isLogStep = step === 20;
  const isPaywallStep = step === TOTAL_ONBOARDING_STEPS - 1;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (step + 1) / TOTAL_ONBOARDING_STEPS,
      duration: 480,
      easing: OB_EASE,
      useNativeDriver: false,
    }).start();
  }, [step, progressAnim]);

  useEffect(() => {
    if (stepTransitionSkip.current) {
      stepTransitionSkip.current = false;
      return;
    }
    contentOpacity.setValue(0);
    contentY.setValue(14);
    contentScale.setValue(0.968);
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 1, duration: 360, easing: OB_EASE, useNativeDriver: true }),
      Animated.spring(contentY, { toValue: 0, ...OB_SPRING.reveal }),
      Animated.spring(contentScale, { toValue: 1, ...OB_SPRING.reveal }),
    ]).start();
  }, [step, contentOpacity, contentY, contentScale]);

  useEffect(() => {
    if (step !== 6) return;
    Animated.sequence([
      Animated.spring(hoursPulse, { toValue: 1.06, ...OB_SPRING.snap }),
      Animated.spring(hoursPulse, { toValue: 1, ...OB_SPRING.snap }),
    ]).start();
  }, [hoursPulse, hoursValue, step]);

  useEffect(() => {
    if (step !== 22) return;
    void (async () => {
      try {
        const StoreReview = require('expo-store-review') as {
          isAvailableAsync?: () => Promise<boolean>;
          requestReview?: () => Promise<void>;
        };
        if (StoreReview.isAvailableAsync && (await StoreReview.isAvailableAsync())) {
          await StoreReview.requestReview?.();
        }
      } catch {
        /* optional native module */
      }
    })();
  }, [step]);

  useEffect(() => {
    if (step !== 23) {
      setLoadingLine(0);
      return;
    }
    const lines = 3;
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setLoadingLine(i);
      if (i >= lines) clearInterval(t);
    }, 900);
    return () => clearInterval(t);
  }, [step]);

  const toggleShieldTarget = (id: ShieldTargetId) => {
    setSelectedTargets((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const toggleAppIntent = (label: string) => {
    setAnswers((a) => {
      const on = a.appIntent.includes(label);
      return {
        ...a,
        appIntent: on ? a.appIntent.filter((t) => t !== label) : [...a.appIntent, label],
      };
    });
  };

  const toggleTrigger = (label: string) => {
    setAnswers((a) => {
      const on = a.triggers.includes(label);
      return {
        ...a,
        triggers: on ? a.triggers.filter((t) => t !== label) : [...a.triggers, label],
      };
    });
  };

  const canContinue = useCallback((): boolean => {
    switch (step) {
      case 0:
        return true;
      case 4:
        return name.trim().length > 0;
      case 5:
        return age.length > 0;
      case 6:
        return sliderInteracted && hoursValue >= HOURS_MIN;
      case 9:
        return selectedTargets.length > 0;
      case 10:
        return answers.appIntent.length > 0;
      case 11:
        return answers.focusVulnerability != null;
      case 12:
        return answers.devicePosition != null;
      case 13:
        return answers.triggers.length > 0;
      case 15:
        return answers.phonePickups != null;
      case 16:
        return answers.reclaimedFocus != null;
      case 23:
        return loadingLine >= 3;
      case 25:
        return answers.commitment != null;
      default:
        return true;
    }
  }, [step, name, age, sliderInteracted, hoursValue, answers, selectedTargets, loadingLine]);

  const transitionToNextStep = useCallback(async () => {
    if (step >= TOTAL_ONBOARDING_STEPS - 1) return;

    await new Promise<void>((resolve) => {
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 0, duration: 180, easing: OB_EASE, useNativeDriver: true }),
        Animated.timing(contentY, { toValue: -12, duration: 180, easing: OB_EASE, useNativeDriver: true }),
        Animated.timing(contentScale, { toValue: 0.982, duration: 180, easing: OB_EASE, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) resolve();
      });
    });

    setStep((s) => s + 1);
  }, [step, contentOpacity, contentScale, contentY]);

  const completeLogStep = useCallback(async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await transitionToNextStep();
  }, [transitionToNextStep]);

  const goNext = async () => {
    if (!canContinue()) return;
    const milestone = step === 7 || step === 21 || step === 27;
    if (milestone) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (step === 6) {
      await saveOnboardingProfile({
        name: trimmedName,
        age: age.trim(),
        hoursPerDay: formatHoursDisplay(hoursValue),
      });
    }

    if (step >= TOTAL_ONBOARDING_STEPS - 1) return;

    await transitionToNextStep();
  };

  const finishOnboarding = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setOnboardingComplete();
    onDone();
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.welcomeCenter}>
            <TypewriterHeadline text="Hey." active={step === 0} style={styles.heyHeadline} />
            <Gap h={16} />
            <FadeInText text="Your time is slipping away quietly." delayMs={900} />
          </View>
        );
      case 1:
        return (
          <StepShell stepKey={step} gap={24}>
            <SerifQuestion>Where does the day go?</SerifQuestion>
            <InsightLight>
              Modern algorithms are explicitly engineered to capture your focus and trade it for ad revenue.
            </InsightLight>
          </StepShell>
        );
      case 2:
        return (
          <StepShell stepKey={step} gap={24}>
            <SerifQuestion>Why can&apos;t you just look away?</SerifQuestion>
            <InsightLight>
              Because willpower cannot defeat a machine that updates its strategy every single time you swipe.
            </InsightLight>
          </StepShell>
        );
      case 3:
        return (
          <StepShell stepKey={step} gap={20}>
            <SerifQuestion>What is UNROT?</SerifQuestion>
            <Text style={styles.bodyInkRegular}>
              A physical circuit breaker for your habits. Your chosen entertainment apps are completely shielded
              until you complete a conscious reflection ritual.
            </Text>
          </StepShell>
        );
      case 4:
        return (
          <StepShell stepKey={step} gap={32}>
            <SerifQuestion>What should we call you?</SerifQuestion>
            <UnderlineInput
              value={name}
              onChangeText={setName}
              placeholder="First name"
              autoCapitalize="words"
              returnKeyType="done"
            />
            <Text style={styles.microHint}>PRESS NEXT TO COMMIT</Text>
          </StepShell>
        );
      case 5:
        return (
          <StepShell stepKey={step} gap={28}>
            <SerifQuestion>Select your age bracket, {trimmedName}.</SerifQuestion>
            <View style={styles.ageGrid}>
              {AGE_BRACKETS.map((opt) => (
                <AgeChoiceButton
                  key={opt.store}
                  label={opt.label}
                  selected={age === opt.store}
                  onPress={() => setAge(opt.store)}
                />
              ))}
            </View>
          </StepShell>
        );
      case 6:
        return (
          <StepShell stepKey={step} gap={36}>
            <SerifQuestion>Be completely honest.</SerifQuestion>
            <View style={styles.hoursBlock}>
              <Animated.Text style={[styles.hoursBig, { transform: [{ scale: hoursPulse }] }]}>
                {formatHoursDisplay(hoursValue)}
              </Animated.Text>
              <Text style={styles.hoursUnit}>HOURS / DAY SCROLLING</Text>
              <Slider
                style={styles.slider}
                minimumValue={HOURS_MIN}
                maximumValue={HOURS_MAX}
                step={HOURS_STEP}
                value={hoursValue}
                onValueChange={(v) => {
                  setHoursValue(v);
                  if (!sliderInteracted) setSliderInteracted(true);
                }}
                onSlidingComplete={() => {
                  setSliderInteracted(true);
                  void Haptics.selectionAsync();
                }}
                minimumTrackTintColor={OB.ink}
                maximumTrackTintColor={OB.track}
                thumbTintColor={Platform.OS === 'android' ? OB.ink : undefined}
              />
              <Gap h={16} />
              <AnimatedHoursCaption text={hoursCaption(hoursValue)} />
            </View>
          </StepShell>
        );
      case 7:
        return (
          <StepShell stepKey={step} gap={24}>
            <SerifQuestion>The cost of tracking glass.</SerifQuestion>
            <ImpactHeroCard daysYear={daysYear} yearsLife={yearsLife} />
          </StepShell>
        );
      case 8:
        return (
          <StepShell stepKey={step} gap={20}>
            <SerifQuestion>It does not have to be this way.</SerifQuestion>
            <InsightLight>
              We are going to build a personalized boundary system to protect your time. Let&apos;s audit your
              primary sources of screen rot.
            </InsightLight>
          </StepShell>
        );
      case 9:
        return (
          <StepShell stepKey={step}>
            <SerifQuestion>Where is your attention directed?</SerifQuestion>
            <Gap h={16} />
            <Text style={styles.discoverySubtitle}>
              Select the primary platforms you wish to shield. We will customize your reflection baseline around
              these choices.
            </Text>
            <Gap h={24} />
            <StaggerChipGrid stepKey={step}>
              {SHIELD_TARGETS.map((t) => (
                <SelectableAppChip
                  key={t.id}
                  code={t.code}
                  brand={t.brand}
                  selected={selectedTargets.includes(t.id)}
                  onPress={() => toggleShieldTarget(t.id)}
                />
              ))}
            </StaggerChipGrid>
          </StepShell>
        );
      case 10:
        return (
          <StepShell stepKey={step}>
            <SerifQuestion>What do you mainly use these apps for?</SerifQuestion>
            <Gap h={16} />
            <SelectedTargetIcons targets={highlightedTargets} />
            <Gap h={16} />
            <ChoiceStack stepKey={step}>
              {APP_INTENT_OPTIONS.map((o) => (
                <MultiChoiceRow
                  key={o}
                  label={o}
                  selected={answers.appIntent.includes(o)}
                  onPress={() => toggleAppIntent(o)}
                />
              ))}
            </ChoiceStack>
          </StepShell>
        );
      case 11:
        return (
          <StepShell stepKey={step}>
            <SerifQuestion>When do you find it hardest to focus?</SerifQuestion>
            <Gap h={16} />
            <Text style={styles.discoverySubtitle}>
              Identifying your specific focus vulnerability helps the intercept engine calculate your optimal pass
              window durations.
            </Text>
            <Gap h={16} />
            <ChoiceStack stepKey={step}>
              {FOCUS_VULNERABILITY_OPTIONS.map((o) => (
                <ChoiceRow
                  key={o}
                  label={o}
                  selected={answers.focusVulnerability === o}
                  onPress={() => setAnswers((a) => ({ ...a, focusVulnerability: o }))}
                />
              ))}
            </ChoiceStack>
          </StepShell>
        );
      case 12:
        return (
          <StepShell stepKey={step}>
            <SerifQuestion>Where is your device usually positioned when working?</SerifQuestion>
            <Gap h={16} />
            <Text style={styles.discoverySubtitle}>
              Physical proximity dictating reflex-based picking is the primary driver of device checking cycles.
            </Text>
            <Gap h={16} />
            <ChoiceStack stepKey={step}>
              {DEVICE_POSITION_OPTIONS.map((o) => (
                <ChoiceRow
                  key={o}
                  label={o}
                  selected={answers.devicePosition === o}
                  onPress={() => setAnswers((a) => ({ ...a, devicePosition: o }))}
                />
              ))}
            </ChoiceStack>
          </StepShell>
        );
      case 13:
        return (
          <StepShell stepKey={step} gap={24}>
            <SerifQuestion>When is your urge to scroll strongest?</SerifQuestion>
            <ChoiceStack stepKey={step}>
              {['Right after waking up', 'During working hours', 'To avoid stress or boredom'].map((o) => (
                <MultiChoiceRow
                  key={o}
                  label={o}
                  selected={answers.triggers.includes(o)}
                  onPress={() => toggleTrigger(o)}
                />
              ))}
            </ChoiceStack>
          </StepShell>
        );
      case 14:
        return (
          <StepShell stepKey={step} gap={28} stagger={false}>
            <SerifQuestion>Your digital reflection.</SerifQuestion>
            <TypewriterText
              active={step === 14}
              text={`You scroll for ${formatHoursDisplay(hoursValue)} hours a day primarily to escape ${primaryTrigger(answers.triggers)}, frequently leaving you feeling ${primaryFeeling(answers)}.`}
            />
          </StepShell>
        );
      case 15:
        return (
          <StepShell stepKey={step} gap={24}>
            <SerifQuestion>How many times a day do you pick up your phone without a clear goal?</SerifQuestion>
            <ChoiceStack stepKey={step}>
              {['20 - 50 times', '50 - 100 times', 'Over 100 times'].map((o) => (
                <ChoiceRow
                  key={o}
                  label={o}
                  selected={answers.phonePickups === o}
                  onPress={() => setAnswers((a) => ({ ...a, phonePickups: o }))}
                />
              ))}
            </ChoiceStack>
          </StepShell>
        );
      case 16:
        return (
          <StepShell stepKey={step} gap={24}>
            <SerifQuestion>What do you plan to do with your reclaimed focus?</SerifQuestion>
            <ChoiceStack stepKey={step}>
              {['Creative work', 'Deep mental clarity', 'Physical presence'].map((o) => (
                <ChoiceRow
                  key={o}
                  label={o}
                  selected={answers.reclaimedFocus === o}
                  onPress={() => setAnswers((a) => ({ ...a, reclaimedFocus: o }))}
                />
              ))}
            </ChoiceStack>
          </StepShell>
        );
      case 17:
        return (
          <StepShell stepKey={step} gap={20}>
            <SerifQuestion>The projection of attention.</SerifQuestion>
            <ProjectionChart />
          </StepShell>
        );
      case 18:
        return (
          <StepShell stepKey={step} gap={16}>
            <SerifQuestion>Your profile is calculated.</SerifQuestion>
            <InsightLight>Now, let&apos;s practice the exact mechanism that will guard your time.</InsightLight>
          </StepShell>
        );
      case 19:
        return <ShieldMock />;
      case 21:
        return <StreakDayOneCelebration stepKey={step} />;
      case 22:
        return <StreakAchievementStep stepKey={step} />;
      case 23:
        return (
          <View style={styles.loadingStep}>
            <ActivityIndicator color={OB.ink} size="large" />
            <Gap h={32} />
            <TerminalLine
              visible={loadingLine >= 1}
              text="[ CALCULATING RECLAIMED TARGETS... SUCCESS ]"
            />
            <TerminalLine
              visible={loadingLine >= 2}
              text="[ APPORTIONING PASS INTERVAL WINDOWS... DONE ]"
            />
            <TerminalLine
              visible={loadingLine >= 3}
              text="[ DEPLOYING FAMILY CONTROLS DEVICE SHIELDS... READY ]"
            />
          </View>
        );
      case 24:
        return (
          <StepShell stepKey={step} gap={24}>
            <SerifQuestion>Your customized blueprint.</SerifQuestion>
            <BlueprintSummaryCard reclaimGoal={reclaimGoal} />
          </StepShell>
        );
      case 25:
        return (
          <StepShell stepKey={step} gap={28}>
            <SerifQuestion>How committed are you to protecting your remaining focus?</SerifQuestion>
            <ChoiceStack stepKey={step} loose>
              {[
                'Highly committed. I need my life back.',
                'Just testing it out.',
              ].map((o) => (
                <ChoiceRow
                  key={o}
                  label={o}
                  selected={answers.commitment === o}
                  onPress={() => setAnswers((a) => ({ ...a, commitment: o }))}
                />
              ))}
            </ChoiceStack>
          </StepShell>
        );
      case 26:
        return (
          <StepShell stepKey={step} gap={24}>
            <SerifQuestion>A matter of value.</SerifQuestion>
            <View style={styles.compareCard}>
              <View style={styles.compareRow}>
                <Text style={styles.compareLeft}>Single commercial coffee ($9.99)</Text>
                <Text style={styles.compareRight}>One month of absolute mental sovereignty ($9.99)</Text>
              </View>
              <View style={[styles.compareRow, { marginTop: 16 }]}>
                <Text style={styles.compareLeftSub}>15 minutes of artificial energy.</Text>
                <Text style={styles.compareRightSub}>Hundreds of hours of pure focus returned to you.</Text>
              </View>
            </View>
          </StepShell>
        );
      case 27:
        return (
          <StepShell stepKey={step} gap={20}>
            <SerifQuestion>The system is fully calibrated, {trimmedName}.</SerifQuestion>
            <BodyRegular>
              Your shields are ready for deployment. The gates are set. Your focus belongs entirely to you.
            </BodyRegular>
          </StepShell>
        );
      case 28:
        return (
          <View style={styles.paywall}>
            <Text style={styles.payBanner}>[ 2,400,000 MINUTES OF ROT PREVENTED WORLDWIDE ]</Text>
            <Gap h={24} />
            <Text style={styles.reviewQuote}>
              &ldquo;UNROT finally made me pause before opening TikTok. Game changer.&rdquo;
            </Text>
            <Gap h={12} />
            <Text style={styles.reviewQuote}>
              &ldquo;The log ritual is short but it actually breaks the trance.&rdquo;
            </Text>
            <Gap h={12} />
            <Text style={styles.reviewQuote}>
              &ldquo;Worth every penny for the hours I got back.&rdquo;
            </Text>
            <Gap h={24} />
            <Pressable style={styles.planCard} onPress={() => void finishOnboarding()}>
              <Text style={styles.planLabel}>Weekly</Text>
              <Text style={styles.planPrice}>$9.99 / week</Text>
            </Pressable>
            <Pressable
              style={[styles.planCard, styles.planCardEmphasis]}
              onPress={() => void finishOnboarding()}
            >
              <Text style={styles.planBadge}>Common pick</Text>
              <Text style={styles.planLabel}>Monthly</Text>
              <Text style={styles.planPrice}>$39.99 / month</Text>
            </Pressable>
            <Pressable style={styles.activateBtn} onPress={() => void finishOnboarding()}>
              <Text style={styles.activateBtnLabel}>ACTIVATE MY SHIELDS</Text>
            </Pressable>
            <Text style={styles.legal}>
              Subscription renews automatically. Cancel anytime in Settings. Terms and privacy apply.
            </Text>
            <Pressable onPress={() => void finishOnboarding()} style={styles.skipBtn}>
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
      <View style={[styles.progressHeader, isLogStep ? styles.progressHeaderLog : null]}>
        <StepCounter step={step} total={TOTAL_ONBOARDING_STEPS} />
        <ProgressBar progress={progressAnim} />
      </View>
      {isLogStep ? (
        <Animated.View
          style={[
            styles.logStepWrap,
            { opacity: contentOpacity, transform: [{ translateY: contentY }, { scale: contentScale }] },
          ]}
        >
          <ReflectiveLogSurface
            embedded
            horizontalBleed={OB.padH}
            purpose="practice"
            targetAppId="onboarding"
            showExit={false}
            bottomInset={insets.bottom}
            onComplete={() => void completeLogStep()}
          />
        </Animated.View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.bodyWrap,
                { opacity: contentOpacity, transform: [{ translateY: contentY }, { scale: contentScale }] },
              ]}
            >
              {renderStep()}
            </Animated.View>
          </ScrollView>
          {!isPaywallStep ? (
            <OnboardingFooter
              label={footerLabel(step)}
              disabled={!canContinue()}
              celebrate={step === 21}
              onPress={() => void goNext()}
              bottomInset={insets.bottom}
            />
          ) : null}
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: unrot.bg },
  scroll: { flexGrow: 1, paddingHorizontal: OB.padH, paddingBottom: spacing.xxl },
  progressHeader: { marginBottom: spacing.lg },
  progressHeaderLog: { paddingHorizontal: OB.padH },
  logStepWrap: { flex: 1 },
  bodyWrap: { flex: 1, minHeight: 272, justifyContent: 'center', paddingTop: spacing.sm },
  welcomeCenter: { alignItems: 'center', justifyContent: 'center' },
  heyHeadline: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 32,
    color: OB.ink,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  bodyInkRegular: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 15,
    lineHeight: 24,
    color: OB.ink,
  },
  microHint: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 10,
    color: OB.label,
    letterSpacing: 1.5,
    marginTop: 8,
  },
  ageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  ageBtn: {
    flexGrow: 1,
    minWidth: '46%',
    paddingVertical: 16,
    borderRadius: OB.radius,
    borderWidth: 1,
    borderColor: OB.hairline,
    alignItems: 'center',
    backgroundColor: OB.white,
  },
  ageBtnOn: { backgroundColor: OB.tile, borderWidth: 0 },
  ageBtnText: { fontFamily: unrotFonts.heroSerif, fontSize: 15, color: OB.ink },
  ageBtnTextOn: { color: OB.ink },
  hoursBlock: { alignItems: 'center' },
  hoursBig: {
    fontFamily: unrotFonts.interLight,
    fontSize: 34,
    color: OB.ink,
    fontVariant: ['tabular-nums'],
  },
  hoursUnit: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 11,
    color: OB.label,
    letterSpacing: 2,
    marginTop: 6,
    marginBottom: spacing.md,
  },
  slider: { width: '100%', height: 44 },
  hoursCaption: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    color: OB.secondary,
  },
  centerRow: { flexDirection: 'row', justifyContent: 'center' },
  discoverySubtitle: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 20,
    color: OB.secondary,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  choiceStack: { gap: 10 },
  choiceStackLoose: { gap: 12 },
  chartBox: {
    borderWidth: 1,
    borderColor: OB.hairline,
    borderRadius: OB.radius,
    padding: 16,
    width: '100%',
  },
  shieldStage: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldWireframe: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OB.tile,
    borderRadius: OB.radius,
    opacity: 0.6,
  },
  shieldCard: {
    backgroundColor: OB.white,
    borderRadius: OB.radius,
    borderWidth: 1,
    borderColor: OB.hairline,
    paddingVertical: 28,
    paddingHorizontal: 20,
    zIndex: 1,
  },
  shieldLabel: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 12,
    color: OB.ink,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  loadingStep: { alignItems: 'center', paddingVertical: spacing.lg },
  terminalLine: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 11,
    letterSpacing: 2,
    color: OB.secondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: OB.hairline,
    borderRadius: OB.radius,
    padding: 24,
  },
  summaryMetric: {
    fontFamily: unrotFonts.interLight,
    fontSize: 34,
    lineHeight: 42,
    color: OB.ink,
    letterSpacing: -0.5,
  },
  compareCard: {
    borderWidth: 1,
    borderColor: OB.hairline,
    borderRadius: OB.radius,
    padding: 20,
  },
  compareRow: { flexDirection: 'row', gap: 12 },
  compareLeft: {
    flex: 1,
    flexShrink: 1,
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    color: OB.label,
  },
  compareRight: {
    flex: 1,
    flexShrink: 1,
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    color: OB.ink,
  },
  compareLeftSub: {
    flex: 1,
    flexShrink: 1,
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    color: OB.label,
  },
  compareRightSub: {
    flex: 1,
    flexShrink: 1,
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    color: OB.ink,
  },
  paywall: { paddingBottom: spacing.xxl },
  payBanner: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 11,
    letterSpacing: 2,
    color: OB.secondary,
    textAlign: 'center',
  },
  reviewQuote: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 20,
    color: OB.insight,
  },
  planCard: {
    borderWidth: 1,
    borderColor: OB.hairline,
    borderRadius: OB.radius,
    padding: 20,
    marginBottom: 12,
    backgroundColor: OB.white,
  },
  planCardEmphasis: { backgroundColor: OB.tile, borderColor: OB.tile },
  planBadge: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 8,
    letterSpacing: 1.6,
    color: OB.ink,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  planLabel: { fontFamily: unrotFonts.heroSerif, fontSize: 18, color: OB.ink },
  planPrice: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 14,
    color: OB.ink,
    marginTop: 8,
  },
  activateBtn: {
    backgroundColor: OB.ink,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  activateBtnLabel: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 14,
    letterSpacing: 1.2,
    color: OB.white,
  },
  legal: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 10,
    lineHeight: 14,
    color: OB.label,
    marginTop: 12,
    textAlign: 'center',
  },
  skipBtn: { alignSelf: 'center', paddingVertical: spacing.lg },
  skipText: { fontFamily: unrotFonts.heroSerif, fontSize: 16, color: OB.secondary },
});
