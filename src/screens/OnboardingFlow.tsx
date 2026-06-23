import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { saveOnboardingProfile, setOnboardingComplete } from '../lib/onboardingStorage';
import { ReflectiveLogSurface } from '../components/ReflectiveLogSurface';
import {
  AgeChoiceButton,
  AnimatedHoursCaption,
  AttentionLifeStep,
  BuildingFrameworkStep,
  ChoiceRow,
  ChoiceStack,
  CommitmentStep,
  DayOneStreakRevealStep,
  DigitalReflectionStep,
  FadeInHeadline,
  FirstLogCelebrationStep,
  FreeTrialPitchStep,
  FreeTrialReminderStep,
  FreeTrialStartStep,
  Gap,
  HowItWorksStep,
  LockInStep,
  LogButtonIntroStep,
  NotificationsConnectStep,
  PersonalizedSnapshotStep,
  PhoneTimeImpactStep,
  PlanReadyStep,
  ScreenTimeConnectStep,
  MindGoalsRecapStep,
  MultiChoiceRow,
  ONBOARDING_CHOICE_GAP,
  OnboardingChoiceHeading,
  OnboardingFooter,
  ProfileRecapStep,
  ProgressBar,
  SelectableAppChip,
  SelectedTargetIcons,
  SerifQuestion,
  StepCounter,
  StepShell,
  StaggerChipGrid,
  TransformationPlanStep,
  UnderlineInput,
} from './onboarding/components';
import {
  ageBenchmarkLine,
  COLD_OPEN_LINES,
  COST_MEMORY_PRESETS,
  digitalReflectionLines,
  hoursSliderTier,
  inferProtectTargetFromGoals,
  reframeForLog,
  type ProtectTarget,
} from './onboarding/copy';
import { OB_EASE, OB_SLIDE_OFFSET, OB_TRANSITION_MS } from './onboarding/motion';
import {
  AGE_BRACKETS,
  APP_INTENT_OPTIONS,
  LIFE_GOAL_OPTIONS,
  LIFE_OBSTACLE_OPTIONS,
  LOVED_TIME_FREQUENCY_OPTIONS,
  MIND_GOAL_OPTIONS,
  PHONE_RELATIONSHIP_OPTIONS,
  SELF_RELATIONSHIP_OPTIONS,
  DEVICE_POSITION_OPTIONS,
  FOCUS_VULNERABILITY_OPTIONS,
  PHONE_PICKUP_OPTIONS,
  formatHoursDisplay,
  HOURS_DEFAULT,
  HOURS_MAX,
  HOURS_MIN,
  HOURS_STEP,
  hoursCaption,
  OB,
  OB_FONTS,
  reclaimHoursGoal,
  selectedShieldTargets,
  SHIELD_TARGETS,
  spacing,
  TOTAL_ONBOARDING_STEPS,
  unrot,
  type ShieldTargetId,
} from './onboarding/tokens';

type Props = { onDone: () => void };

type OnboardingAnswers = {
  mindGoals: string[];
  lifeGoals: string[];
  lovedTimeFrequency: string | null;
  phoneRelationship: string | null;
  selfRelationship: string | null;
  lifeObstacles: string[];
  appIntent: string[];
  focusVulnerability: string | null;
  devicePosition: string | null;
  triggers: string[];
  protectTarget: ProtectTarget | null;
  phonePickups: string | null;
  reclaimedFocus: string | null;
  commitment: string | null;
};

const COLD_OPEN_END = 3;
const AUTO_ADVANCE_STEPS = new Set([0, 1, 2]);
const HOURS_STEP_INDEX = 5;
const IMPACT_STEP_INDEX = 6;
const RECLAIM_STEP_INDEX = 7;
const MIND_GOALS_STEP_INDEX = 8;
const LIFE_GOALS_STEP_INDEX = 9;
const MIND_GOALS_RECAP_STEP_INDEX = 10;
const LOVED_TIME_STEP_INDEX = 11;
const PHONE_RELATIONSHIP_STEP_INDEX = 12;
const SELF_RELATIONSHIP_STEP_INDEX = 13;
const LIFE_OBSTACLES_STEP_INDEX = 14;
const PROFILE_RECAP_STEP_INDEX = 15;
const LOG_BUTTON_STEP_INDEX = 24;
const LOG_PRACTICE_STEP_INDEX = 25;
const FIRST_LOG_CELEBRATION_STEP_INDEX = 26;
const STREAK_REVEAL_STEP_INDEX = 27;
const BUILDING_FRAMEWORK_STEP_INDEX = 28;
const TRANSFORMATION_PLAN_STEP_INDEX = 30;
const FREE_TRIAL_PITCH_STEP_INDEX = 31;
const COMMITMENT_STEP_INDEX = 32;
const LOCK_IN_STEP_INDEX = 33;
const SCREEN_TIME_CONNECT_STEP_INDEX = 35;
const NOTIFICATIONS_CONNECT_STEP_INDEX = 36;
const FREE_TRIAL_REMINDER_STEP_INDEX = 37;
const FREE_TRIAL_START_STEP_INDEX = 38;

function footerLabel(step: number): string {
  const map: Record<number, string> = {
    23: 'GET STARTED',
    27: 'KEEP THE STREAK',
  };
  return map[step] ?? 'NEXT';
}

export function OnboardingFlow({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [hoursValue, setHoursValue] = useState(HOURS_DEFAULT);
  const [sliderInteracted, setSliderInteracted] = useState(false);
  const [costMemory, setCostMemory] = useState('');
  const [costPreset, setCostPreset] = useState<string | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<ShieldTargetId[]>([]);
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    mindGoals: [],
    lifeGoals: [],
    lovedTimeFrequency: null,
    phoneRelationship: null,
    selfRelationship: null,
    lifeObstacles: [],
    appIntent: [],
    focusVulnerability: null,
    devicePosition: null,
    triggers: [],
    protectTarget: null,
    phonePickups: null,
    reclaimedFocus: null,
    commitment: null,
  });

  const highlightedTargets = useMemo(() => selectedShieldTargets(selectedTargets), [selectedTargets]);

  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentX = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_ONBOARDING_STEPS)).current;
  const stepTransitionSkip = useRef(true);
  const transitioningRef = useRef(false);
  const sliderTierRef = useRef(hoursSliderTier(HOURS_DEFAULT));

  const trimmedName = name.trim() || 'friend';
  const reclaimGoal = reclaimHoursGoal(hoursValue);
  const reflectionLines = useMemo(
    () =>
      digitalReflectionLines({
        hours: formatHoursDisplay(hoursValue),
        appIntent: answers.appIntent,
        focusVulnerability: answers.focusVulnerability,
        selfRelationship: answers.selfRelationship,
        phoneRelationship: answers.phoneRelationship,
      }),
    [hoursValue, answers.appIntent, answers.focusVulnerability, answers.selfRelationship, answers.phoneRelationship],
  );
  const isLogStep = step === LOG_PRACTICE_STEP_INDEX;
  const hideLogButtonFooter = step === LOG_BUTTON_STEP_INDEX;
  const hideBuildingFrameworkFooter = step === BUILDING_FRAMEWORK_STEP_INDEX;
  const hideTransformationPlanFooter = step === TRANSFORMATION_PLAN_STEP_INDEX;
  const hideFreeTrialPitchFooter = step === FREE_TRIAL_PITCH_STEP_INDEX;
  const hideCommitmentFooter = step === COMMITMENT_STEP_INDEX;
  const hideLockInFooter = step === LOCK_IN_STEP_INDEX;
  const hideScreenTimeConnectFooter = step === SCREEN_TIME_CONNECT_STEP_INDEX;
  const hideNotificationsConnectFooter = step === NOTIFICATIONS_CONNECT_STEP_INDEX;
  const hideFreeTrialReminderFooter = step === FREE_TRIAL_REMINDER_STEP_INDEX;
  const hideFreeTrialStartFooter = step === FREE_TRIAL_START_STEP_INDEX;
  const hideProgress = step <= COLD_OPEN_END || isLogStep;

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
    contentX.setValue(OB_SLIDE_OFFSET);
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 1, duration: OB_TRANSITION_MS, easing: OB_EASE, useNativeDriver: true }),
      Animated.timing(contentX, { toValue: 0, duration: OB_TRANSITION_MS, easing: OB_EASE, useNativeDriver: true }),
    ]).start();
  }, [step, contentOpacity, contentX]);

  useEffect(() => {
    if (step !== HOURS_STEP_INDEX) return;
    sliderTierRef.current = hoursSliderTier(hoursValue);
  }, [hoursValue, step]);

  const toggleShieldTarget = (id: ShieldTargetId) => {
    setSelectedTargets((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const toggleMindGoal = (label: string) => {
    setAnswers((a) => {
      const on = a.mindGoals.includes(label);
      return {
        ...a,
        mindGoals: on ? a.mindGoals.filter((t) => t !== label) : [...a.mindGoals, label],
      };
    });
  };

  const toggleLifeGoal = (label: string) => {
    setAnswers((a) => {
      const on = a.lifeGoals.includes(label);
      return {
        ...a,
        lifeGoals: on ? a.lifeGoals.filter((t) => t !== label) : [...a.lifeGoals, label],
      };
    });
  };

  const toggleLifeObstacle = (label: string) => {
    setAnswers((a) => {
      const on = a.lifeObstacles.includes(label);
      return {
        ...a,
        lifeObstacles: on ? a.lifeObstacles.filter((t) => t !== label) : [...a.lifeObstacles, label],
      };
    });
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

  const canContinue = useCallback((): boolean => {
    switch (step) {
      case 3:
        return name.trim().length > 0;
      case 4:
        return age.length > 0;
      case 5:
        return hoursValue >= HOURS_MIN;
      case MIND_GOALS_STEP_INDEX:
        return answers.mindGoals.length > 0;
      case LIFE_GOALS_STEP_INDEX:
        return answers.lifeGoals.length > 0;
      case LOVED_TIME_STEP_INDEX:
        return answers.lovedTimeFrequency != null;
      case PHONE_RELATIONSHIP_STEP_INDEX:
        return answers.phoneRelationship != null;
      case SELF_RELATIONSHIP_STEP_INDEX:
        return answers.selfRelationship != null;
      case LIFE_OBSTACLES_STEP_INDEX:
        return answers.lifeObstacles.length > 0;
      case 16:
        return selectedTargets.length > 0;
      case 17:
        return answers.appIntent.length > 0;
      case 18:
        return answers.focusVulnerability != null;
      case 19:
        return answers.devicePosition != null;
      case 20:
        return answers.phonePickups != null;
      case 32:
        return answers.commitment != null;
      default:
        return true;
    }
  }, [step, name, age, sliderInteracted, hoursValue, costPreset, costMemory, answers, selectedTargets]);

  const transitionToStep = useCallback(
    async (nextStep: number) => {
      if (nextStep === step || transitioningRef.current) return;
      transitioningRef.current = true;

      try {
        await new Promise<void>((resolve) => {
          Animated.parallel([
            Animated.timing(contentOpacity, { toValue: 0, duration: OB_TRANSITION_MS, easing: OB_EASE, useNativeDriver: true }),
            Animated.timing(contentX, { toValue: -OB_SLIDE_OFFSET, duration: OB_TRANSITION_MS, easing: OB_EASE, useNativeDriver: true }),
          ]).start(({ finished }) => {
            if (finished) resolve();
          });
        });

        setStep(nextStep);
      } finally {
        transitioningRef.current = false;
      }
    },
    [step, contentOpacity, contentX],
  );

  const transitionToNextStep = useCallback(async () => {
    if (step >= TOTAL_ONBOARDING_STEPS - 1) return;
    await transitionToStep(step + 1);
  }, [step, transitionToStep]);

  const advanceColdOpenOnTap = useCallback(() => {
    if (!AUTO_ADVANCE_STEPS.has(step)) return;
    void transitionToNextStep();
  }, [step, transitionToNextStep]);

  const completeLogStep = useCallback(async () => {
    await transitionToNextStep();
  }, [transitionToNextStep]);

  const goNext = async () => {
    if (!canContinue()) return;

    if (step === HOURS_STEP_INDEX) {
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
    await setOnboardingComplete();
    onDone();
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.welcomeCenter}>
            <FadeInHeadline text="Hey." />
          </View>
        );
      case 1:
        return (
          <StepShell stepKey={step} gap={20} stagger={false}>
            <Text style={styles.coldOpenBold}>
              Ever feel like your phone gets more attention than you?
            </Text>
            <Text style={styles.coldOpenSimple}>You&apos;re not alone.</Text>
            <Text style={styles.coldOpenSimple}>Distractions are everywhere</Text>
            <Text style={styles.coldOpenSimple}>
              Quietly pulling you away from the peace you&apos;re looking for.
            </Text>
          </StepShell>
        );
      case 2:
        return (
          <StepShell stepKey={step} gap={20} stagger={false}>
            <Text style={styles.coldOpenBold}>UNROT helps you put YOU first</Text>
            <Text style={styles.coldOpenSimple}>It&apos;s simple</Text>
            <Text style={styles.coldOpenSimple}>everyday</Text>
            <Text style={styles.coldOpenSimple}>you log to unlock your social media apps</Text>
          </StepShell>
        );
      case 3:
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
      case 4:
        return (
          <StepShell stepKey={step} gap={ONBOARDING_CHOICE_GAP}>
            <OnboardingChoiceHeading>How old are you, {trimmedName}?</OnboardingChoiceHeading>
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
      case HOURS_STEP_INDEX:
        return (
          <StepShell stepKey={step} gap={36}>
            <Text style={styles.coldOpenBold}>How long are you on your phone each day?</Text>
            <View style={styles.hoursBlock}>
              <Text style={styles.hoursBig}>{formatHoursDisplay(hoursValue)}</Text>
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
                  const tier = hoursSliderTier(v);
                  if (tier !== sliderTierRef.current) {
                    sliderTierRef.current = tier;
                    void Haptics.selectionAsync();
                  }
                }}
                onSlidingComplete={() => {
                  setSliderInteracted(true);
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
      case IMPACT_STEP_INDEX:
        return <PhoneTimeImpactStep stepKey={step} name={trimmedName} hoursPerDay={hoursValue} />;
      case RECLAIM_STEP_INDEX:
        return (
          <StepShell stepKey={step} gap={20} stagger={false}>
            <Text style={styles.coldOpenBold}>it doesn&apos;t have to be this way</Text>
            <Text style={styles.coldOpenBold}>do you want to reclaim your life?</Text>
            <Text style={styles.coldOpenSimple}>let&apos;s build a plan for you</Text>
          </StepShell>
        );
      case MIND_GOALS_STEP_INDEX:
        return (
          <StepShell stepKey={step} gap={ONBOARDING_CHOICE_GAP}>
            <OnboardingChoiceHeading kicker="I want to..">What&apos;s on your mind?</OnboardingChoiceHeading>
            <ChoiceStack stepKey={step}>
              {MIND_GOAL_OPTIONS.map((o) => (
                <MultiChoiceRow
                  key={o}
                  label={o}
                  selected={answers.mindGoals.includes(o)}
                  onPress={() => toggleMindGoal(o)}
                />
              ))}
            </ChoiceStack>
          </StepShell>
        );
      case LIFE_GOALS_STEP_INDEX:
        return (
          <StepShell stepKey={step} gap={ONBOARDING_CHOICE_GAP}>
            <OnboardingChoiceHeading>what are your life goals?</OnboardingChoiceHeading>
            <ChoiceStack stepKey={step}>
              {LIFE_GOAL_OPTIONS.map((o) => (
                <MultiChoiceRow
                  key={o}
                  label={o}
                  selected={answers.lifeGoals.includes(o)}
                  onPress={() => toggleLifeGoal(o)}
                />
              ))}
            </ChoiceStack>
          </StepShell>
        );
      case MIND_GOALS_RECAP_STEP_INDEX:
        return (
          <MindGoalsRecapStep
            stepKey={step}
            selections={MIND_GOAL_OPTIONS.filter((o) => answers.mindGoals.includes(o))}
          />
        );
      case LOVED_TIME_STEP_INDEX:
        return (
          <StepShell stepKey={step} gap={ONBOARDING_CHOICE_GAP}>
            <OnboardingChoiceHeading kicker="Be honest...">
              How often do you spend uninterrupted time doing something you love (not scrolling)?
            </OnboardingChoiceHeading>
            <ChoiceStack stepKey={step}>
              {LOVED_TIME_FREQUENCY_OPTIONS.map((o) => (
                <ChoiceRow
                  key={o}
                  label={o}
                  selected={answers.lovedTimeFrequency === o}
                  onPress={() => setAnswers((a) => ({ ...a, lovedTimeFrequency: o }))}
                />
              ))}
            </ChoiceStack>
          </StepShell>
        );
      case PHONE_RELATIONSHIP_STEP_INDEX:
        return (
          <StepShell stepKey={step} gap={ONBOARDING_CHOICE_GAP}>
            <OnboardingChoiceHeading>
              and how would you describe your relationship with your phone?
            </OnboardingChoiceHeading>
            <ChoiceStack stepKey={step}>
              {PHONE_RELATIONSHIP_OPTIONS.map((o) => (
                <ChoiceRow
                  key={o}
                  label={o}
                  selected={answers.phoneRelationship === o}
                  onPress={() => setAnswers((a) => ({ ...a, phoneRelationship: o }))}
                />
              ))}
            </ChoiceStack>
          </StepShell>
        );
      case SELF_RELATIONSHIP_STEP_INDEX:
        return (
          <StepShell stepKey={step} gap={ONBOARDING_CHOICE_GAP}>
            <OnboardingChoiceHeading>
              How would you describe your relationship with yourself?
            </OnboardingChoiceHeading>
            <ChoiceStack stepKey={step}>
              {SELF_RELATIONSHIP_OPTIONS.map((o) => (
                <ChoiceRow
                  key={o}
                  label={o}
                  selected={answers.selfRelationship === o}
                  onPress={() => setAnswers((a) => ({ ...a, selfRelationship: o }))}
                />
              ))}
            </ChoiceStack>
          </StepShell>
        );
      case LIFE_OBSTACLES_STEP_INDEX:
        return (
          <StepShell stepKey={step} gap={ONBOARDING_CHOICE_GAP}>
            <OnboardingChoiceHeading>
              what&apos;s the main thing that gets in the way of the life you want?
            </OnboardingChoiceHeading>
            <ChoiceStack stepKey={step}>
              {LIFE_OBSTACLE_OPTIONS.map((o) => (
                <MultiChoiceRow
                  key={o}
                  label={o}
                  selected={answers.lifeObstacles.includes(o)}
                  onPress={() => toggleLifeObstacle(o)}
                />
              ))}
            </ChoiceStack>
          </StepShell>
        );
      case PROFILE_RECAP_STEP_INDEX:
        return (
          <ProfileRecapStep
            stepKey={step}
            name={trimmedName}
            selfRelationship={answers.selfRelationship}
            lifeObstacles={LIFE_OBSTACLE_OPTIONS.filter((o) => answers.lifeObstacles.includes(o))}
          />
        );
      case 16:
        return (
          <StepShell stepKey={step}>
            <SerifQuestion>Where is your attention directed?</SerifQuestion>
            <Gap h={16} />
            <Text style={styles.discoverySubtitle}>
              Select the primary platforms you wish to shield. We will customize your reflection baseline around these
              choices.
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
                  hapticOnSelect
                />
              ))}
            </StaggerChipGrid>
          </StepShell>
        );
      case 17:
        return (
          <StepShell stepKey={step} gap={ONBOARDING_CHOICE_GAP}>
            <OnboardingChoiceHeading>What do you mainly use these apps for?</OnboardingChoiceHeading>
            <SelectedTargetIcons targets={highlightedTargets} />
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
      case 18:
        return (
          <StepShell stepKey={step} gap={ONBOARDING_CHOICE_GAP}>
            <OnboardingChoiceHeading>When do you find it hardest to focus?</OnboardingChoiceHeading>
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
      case 19:
        return (
          <StepShell stepKey={step} gap={ONBOARDING_CHOICE_GAP}>
            <OnboardingChoiceHeading>
              Where do you usually keep your phone while working/studying?
            </OnboardingChoiceHeading>
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
      case 20:
        return (
          <StepShell stepKey={step} gap={ONBOARDING_CHOICE_GAP}>
            <OnboardingChoiceHeading>How many times a day do you pick up your phone?</OnboardingChoiceHeading>
            <ChoiceStack stepKey={step}>
              {PHONE_PICKUP_OPTIONS.map((o) => (
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
      case 21:
        return (
          <DigitalReflectionStep
            stepKey={step}
            active={step === 21}
            scrollHours={reflectionLines.scrollHours}
            escape={reflectionLines.escape}
            feeling={reflectionLines.feeling}
          />
        );
      case 22:
        return <AttentionLifeStep stepKey={step} active={step === 22} />;
      case 23:
        return <HowItWorksStep stepKey={step} />;
      case 24:
        return (
          <LogButtonIntroStep
            stepKey={step}
            onHoldComplete={() => void transitionToStep(LOG_PRACTICE_STEP_INDEX)}
          />
        );
      case 26:
        return <FirstLogCelebrationStep stepKey={step} />;
      case 27:
        return <DayOneStreakRevealStep stepKey={step} />;
      case 28:
        return (
          <BuildingFrameworkStep
            stepKey={step}
            onComplete={() => void transitionToNextStep()}
          />
        );
      case 29:
        return <PlanReadyStep stepKey={step} name={trimmedName} />;
      case 30:
        return (
          <TransformationPlanStep
            stepKey={step}
            name={trimmedName}
            mindGoals={answers.mindGoals}
            lifeGoals={answers.lifeGoals}
            reclaimGoalHours={reclaimGoal}
            bottomInset={insets.bottom}
            onBegin={() => void transitionToNextStep()}
          />
        );
      case 31:
        return (
          <FreeTrialPitchStep
            stepKey={step}
            bottomInset={insets.bottom}
            onContinue={() => void transitionToNextStep()}
          />
        );
      case 32:
        return (
          <CommitmentStep
            stepKey={step}
            commitment={answers.commitment}
            bottomInset={insets.bottom}
            onSelect={(value) => setAnswers((a) => ({ ...a, commitment: value }))}
            onContinue={() => void transitionToNextStep()}
          />
        );
      case 33:
        return (
          <LockInStep
            stepKey={step}
            commitment={answers.commitment}
            bottomInset={insets.bottom}
            onContinue={() => {
              setAnswers((a) => ({
                ...a,
                protectTarget:
                  a.protectTarget ??
                  inferProtectTargetFromGoals(a.mindGoals, a.lifeGoals),
              }));
              void transitionToNextStep();
            }}
          />
        );
      case 34:
        return (
          <PersonalizedSnapshotStep
            stepKey={step}
            phoneRelationship={answers.phoneRelationship}
            hoursPerDay={formatHoursDisplay(hoursValue)}
            screenTimeCaption={hoursCaption(hoursValue)}
            commitment={answers.commitment}
          />
        );
      case 35:
        return (
          <ScreenTimeConnectStep
            stepKey={step}
            bottomInset={insets.bottom}
            onConnected={() => void transitionToNextStep()}
          />
        );
      case 36:
        return (
          <NotificationsConnectStep
            stepKey={step}
            bottomInset={insets.bottom}
            onAllowed={() => void transitionToNextStep()}
          />
        );
      case 37:
        return (
          <FreeTrialReminderStep
            stepKey={step}
            bottomInset={insets.bottom}
            onContinue={() => void transitionToNextStep()}
          />
        );
      case 38:
        return (
          <FreeTrialStartStep
            stepKey={step}
            bottomInset={insets.bottom}
            onContinue={() => void finishOnboarding()}
          />
        );
      default:
        return null;
    }
  };

  const showFooter =
    !AUTO_ADVANCE_STEPS.has(step) &&
    !isLogStep &&
    !hideLogButtonFooter &&
    !hideBuildingFrameworkFooter &&
    !hideTransformationPlanFooter &&
    !hideFreeTrialPitchFooter &&
    !hideCommitmentFooter &&
    !hideLockInFooter &&
    !hideScreenTimeConnectFooter &&
    !hideNotificationsConnectFooter &&
    !hideFreeTrialReminderFooter &&
    !hideFreeTrialStartFooter;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: isLogStep ? 0 : insets.top + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {!hideProgress ? (
        <View style={[styles.progressHeader, isLogStep ? styles.progressHeaderLog : null]}>
          <StepCounter step={step} total={TOTAL_ONBOARDING_STEPS} />
          <ProgressBar progress={progressAnim} />
        </View>
      ) : null}
      {isLogStep ? (
        <Animated.View
          style={[
            styles.logStepWrap,
            { opacity: contentOpacity, transform: [{ translateX: contentX }] },
          ]}
        >
          <ReflectiveLogSurface
            purpose="practice"
            targetAppId="onboarding"
            showExit={false}
            topInset={insets.top}
            bottomInset={insets.bottom}
            getReframeLine={reframeForLog}
            onComplete={() => void completeLogStep()}
          />
        </Animated.View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled
          >
            <Animated.View
              style={[
                styles.bodyWrap,
                hideLogButtonFooter ? styles.bodyWrapLogIntro : null,
                { opacity: contentOpacity, transform: [{ translateX: contentX }] },
              ]}
            >
              {AUTO_ADVANCE_STEPS.has(step) ? (
                <Pressable
                  style={styles.coldOpenTap}
                  onPress={advanceColdOpenOnTap}
                  accessibilityRole="button"
                  accessibilityLabel="Continue"
                >
                  {renderStep()}
                </Pressable>
              ) : (
                renderStep()
              )}
            </Animated.View>
          </ScrollView>
          {showFooter ? (
            <OnboardingFooter
              label={footerLabel(step)}
              disabled={!canContinue()}
              celebrate={step === STREAK_REVEAL_STEP_INDEX}
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
  progressHeader: { marginBottom: spacing.lg, paddingHorizontal: OB.padH },
  progressHeaderLog: { paddingHorizontal: OB.padH },
  logStepWrap: { flex: 1 },
  bodyWrap: { flex: 1, minHeight: 272, justifyContent: 'center', paddingTop: spacing.sm },
  bodyWrapLogIntro: { justifyContent: 'flex-end', paddingTop: 0, minHeight: 360 },
  coldOpenTap: {
    flex: 1,
    minHeight: 360,
    justifyContent: 'center',
  },
  welcomeCenter: { alignItems: 'center', justifyContent: 'center' },
  coldOpenBold: {
    fontFamily: OB_FONTS.black,
    fontSize: 24,
    lineHeight: 32,
    color: OB.ink,
    letterSpacing: -0.35,
  },
  coldOpenSimple: {
    fontFamily: OB_FONTS.regular,
    fontSize: 16,
    lineHeight: 26,
    color: OB.insight,
    letterSpacing: -0.1,
  },
  bodyInkRegular: {
    fontFamily: OB_FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: OB.ink,
  },
  microHint: {
    fontFamily: OB_FONTS.bold,
    fontSize: 10,
    color: OB.label,
    letterSpacing: 1.5,
    marginTop: 8,
  },
  ageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  hoursBlock: { alignItems: 'center' },
  hoursBig: {
    fontFamily: OB_FONTS.regular,
    fontSize: 34,
    color: OB.ink,
    fontVariant: ['tabular-nums'],
  },
  hoursUnit: {
    fontFamily: OB_FONTS.bold,
    fontSize: 11,
    color: OB.label,
    letterSpacing: 2,
    marginTop: 6,
    marginBottom: spacing.md,
  },
  slider: { width: '100%', height: 44 },
  discoverySubtitle: {
    fontFamily: OB_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: OB.secondary,
  },
});
