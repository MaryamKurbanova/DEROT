import * as Haptics from 'expo-haptics';
import { Children, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  ActivityIndicator,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Line, Path, Rect, Stop } from 'react-native-svg';
import { formatImpactYears, impactStats, OB, OB_FONTS, spacing, unrot } from './tokens';
import { BrandAppIcon, type BrandAppId } from '../../components/BrandAppIcon';
import { HomeLogButton, HomeLogScreen } from '../../components/HomeLogButton';
import { getRecentLogs, type LogEntry } from '../../lib/reflectiveLog';
import { playOnboardingStampThud } from './onboardingStampSound';
import {
  openOnboardingNotificationSettings,
  requestOnboardingNotifications,
  requestOnboardingScreenTime,
  type ScreenTimeConnectResult,
} from '../../lib/onboardingPermissions';
import {
  primaryOnboardingGoal,
  transformationFeatureCards,
  transformationHoursSummary,
  transformationTargetDate,
  COMMITMENT_OPTIONS,
  lockInTagline,
  commitmentLevelPercent,
  phoneRelationshipLevelPercent,
  stripOptionEmoji,
} from './copy';
import { OB_EASE, OB_SPRING, STAGGER_MS } from './motion';

function StaggerFade({
  index,
  resetKey = 0,
  children,
}: {
  index: number;
  resetKey?: number;
  children: ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    opacity.setValue(0);
    y.setValue(10);
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.spring(opacity, { toValue: 1, ...OB_SPRING.reveal }),
        Animated.spring(y, { toValue: 0, ...OB_SPRING.reveal }),
      ]).start();
    }, index * STAGGER_MS);
    return () => clearTimeout(timer);
  }, [index, opacity, resetKey, y]);

  return <Animated.View style={{ opacity, transform: [{ translateY: y }] }}>{children}</Animated.View>;
}

export function StepCounter({ step, total }: { step: number; total: number }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.setValue(0.35);
    y.setValue(4);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, easing: OB_EASE, useNativeDriver: true }),
      Animated.spring(y, { toValue: 0, ...OB_SPRING.snap }),
    ]).start();
  }, [step, opacity, y]);

  return (
    <Animated.Text style={[styles.stepCounter, { opacity, transform: [{ translateY: y }] }]}>
      {String(step + 1).padStart(2, '0')} · {String(total).padStart(2, '0')}
    </Animated.Text>
  );
}

export function ProgressBar({ progress }: { progress: Animated.Value }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: OB_EASE, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 900, easing: OB_EASE, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
      <Animated.View
        style={[
          styles.progressHeadWrap,
          { left: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      >
        <Animated.View style={[styles.progressHead, { opacity: pulse }]} />
      </Animated.View>
    </View>
  );
}

export function SerifQuestion({ children }: { children: ReactNode }) {
  return <OnboardingChoiceHeading>{children}</OnboardingChoiceHeading>;
}

/** Bold top-aligned heading for onboarding choice screens — pair with StepShell gap={ONBOARDING_CHOICE_GAP}. */
export function OnboardingQuestion({ children }: { children: ReactNode }) {
  return <OnboardingChoiceHeading>{children}</OnboardingChoiceHeading>;
}

export function OnboardingChoiceHeading({
  kicker,
  children,
}: {
  kicker?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.onboardingChoiceIntroBlock}>
      {kicker ? <Text style={styles.onboardingChoiceKicker}>{kicker}</Text> : null}
      <Text style={styles.onboardingChoiceQuestion}>{children}</Text>
    </View>
  );
}

export const ONBOARDING_CHOICE_GAP = 24;

export function InsightBody({ children, style }: { children: string; style?: ViewStyle }) {
  return (
    <View style={style}>
      <Text style={styles.insightBody}>{children}</Text>
    </View>
  );
}

export function InsightLight({ children }: { children: string }) {
  return <Text style={styles.insightLight}>{children}</Text>;
}

export function BodyRegular({ children }: { children: string }) {
  return <Text style={styles.bodyRegular}>{children}</Text>;
}

export function Gap({ h }: { h: number }) {
  return <View style={{ height: h }} />;
}

export function TypewriterText({
  text,
  active,
  style,
  onComplete,
}: {
  text: string;
  active: boolean;
  style?: object;
  onComplete?: () => void;
}) {
  const [visible, setVisible] = useState(active ? '' : text);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setVisible(text);
      doneRef.current = true;
      return;
    }
    doneRef.current = false;
    setVisible('');
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setVisible(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        if (!doneRef.current) {
          doneRef.current = true;
          onComplete?.();
        }
      }
    }, 18);
    return () => clearInterval(timer);
  }, [active, onComplete, text]);

  return <Text style={[styles.insightLight, style]}>{visible}</Text>;
}

export function FadeInText({ text, delayMs = 0 }: { text: string; delayMs?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    opacity.setValue(0);
    y.setValue(8);
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 650,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(y, { toValue: 0, ...OB_SPRING.reveal }),
      ]).start();
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, opacity, text, y]);

  return (
    <Animated.Text style={[styles.insightLight, { opacity, transform: [{ translateY: y }] }]}>
      {text}
    </Animated.Text>
  );
}

export function TypewriterHeadline({ text, active, style }: { text: string; active: boolean; style?: object }) {
  const [visible, setVisible] = useState(active ? '' : text);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      setVisible(text);
      opacity.setValue(1);
      return;
    }
    setVisible('');
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setVisible(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }, 85);
    return () => clearInterval(timer);
  }, [active, opacity, text]);

  return (
    <Animated.Text style={[style, { opacity }]}>
      {visible}
      {active && visible.length < text.length ? '|' : ''}
    </Animated.Text>
  );
}

export function ChoiceRow({
  label,
  selected,
  onPress,
  hapticOnSelect = true,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  hapticOnSelect?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!selected) return;
    Animated.timing(scale, { toValue: 1, duration: 120, easing: OB_EASE, useNativeDriver: true }).start();
  }, [scale, selected]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        if (hapticOnSelect) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
      }}
      onPressIn={() =>
        Animated.timing(scale, { toValue: 0.985, duration: 80, easing: OB_EASE, useNativeDriver: true }).start()
      }
      onPressOut={() =>
        Animated.timing(scale, { toValue: 1, duration: 100, easing: OB_EASE, useNativeDriver: true }).start()
      }
    >
      <Animated.View
        style={[
          styles.choiceRow,
          selected && styles.choiceRowOn,
          { transform: [{ scale }] },
        ]}
      >
        <Text style={styles.choiceRowText}>{label}</Text>
        {selected ? (
          <View style={styles.choiceMark}>
            <Text style={styles.choiceMarkText}>✓</Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

export function RecapChoiceRow({ label }: { label: string }) {
  return (
    <View style={[styles.choiceRow, styles.choiceRowOn]} accessibilityState={{ selected: true }}>
      <Text style={styles.choiceRowText}>{label}</Text>
      <View style={styles.choiceMark}>
        <Text style={styles.choiceMarkText}>✓</Text>
      </View>
    </View>
  );
}

function ProfileRecapBox({ label, children, accent }: { label: string; children: ReactNode; accent?: boolean }) {
  return (
    <View style={styles.profileRecapSection}>
      <Text style={styles.profileRecapLabel}>{label}</Text>
      <View style={[styles.profileRecapBox, accent ? styles.profileRecapBoxAccent : null]}>{children}</View>
    </View>
  );
}

function ProfileRecapPill({ label }: { label: string }) {
  return (
    <View style={styles.profileRecapPill}>
      <Text style={styles.profileRecapPillText}>{label}</Text>
    </View>
  );
}

export function ProfileRecapStep({
  stepKey,
  name,
  selfRelationship,
  lifeObstacles,
}: {
  stepKey: number;
  name: string;
  selfRelationship: string | null;
  lifeObstacles: string[];
}) {
  return (
    <StepShell stepKey={stepKey} gap={28}>
      <Text style={styles.profileRecapThanks}>thanks, {name}</Text>
      <ProfileRecapBox label="where do you want to go" accent>
        <Text style={styles.profileRecapDestination}>Take control of my time and live my best life</Text>
      </ProfileRecapBox>
      <ProfileRecapBox label="where you are now">
        {selfRelationship ? (
          <Text style={styles.profileRecapValue}>{selfRelationship}</Text>
        ) : (
          <Text style={styles.profileRecapEmpty}>—</Text>
        )}
      </ProfileRecapBox>
      <ProfileRecapBox label="what's standing in your way">
        {lifeObstacles.length > 0 ? (
          <View style={styles.profileRecapPillWrap}>
            {lifeObstacles.map((label) => (
              <ProfileRecapPill key={label} label={label} />
            ))}
          </View>
        ) : (
          <Text style={styles.profileRecapEmpty}>—</Text>
        )}
      </ProfileRecapBox>
    </StepShell>
  );
}

export function DigitalReflectionStep({
  stepKey,
  active,
  scrollHours,
  escape,
  feeling,
}: {
  stepKey: number;
  active: boolean;
  scrollHours: string;
  escape: string;
  feeling: string;
}) {
  const [phase, setPhase] = useState(active ? 0 : 3);

  useEffect(() => {
    setPhase(active ? 0 : 3);
  }, [active, stepKey, scrollHours, escape, feeling]);

  return (
    <StepShell stepKey={stepKey} gap={28} stagger={false}>
      <Text style={styles.profileRecapThanks}>Your digital reflection.</Text>
      <ProfileRecapBox label="you scroll for" accent>
        <TypewriterText
          active={active && phase === 0}
          text={scrollHours}
          style={styles.profileRecapDestination}
          onComplete={() => setPhase(1)}
        />
      </ProfileRecapBox>
      <ProfileRecapBox label="mainly to escape">
        <TypewriterText
          active={active && phase === 1}
          text={escape}
          style={styles.profileRecapValue}
          onComplete={() => setPhase(2)}
        />
      </ProfileRecapBox>
      <ProfileRecapBox label="often leaving you feeling">
        <TypewriterText
          active={active && phase === 2}
          text={feeling}
          style={styles.profileRecapValue}
          onComplete={() => setPhase(3)}
        />
      </ProfileRecapBox>
    </StepShell>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RECLAIM_CURVE_LENGTH = 210;

function ReclaimingLifeChart({ active }: { active: boolean }) {
  const drawProgress = useRef(new Animated.Value(active ? 0 : 1)).current;
  const fadeProgress = useRef(new Animated.Value(active ? 0 : 1)).current;

  const w = 320;
  const h = 196;
  const plotLeft = 36;
  const plotRight = 312;
  const plotTop = 22;
  const plotBottom = 138;
  const splitX = 158;
  const baseY = 132;

  const beforePath = `M${plotLeft},${baseY} C68,${baseY + 2} 98,${baseY - 2} 128,${baseY + 1} S${splitX - 8},${baseY - 3} ${splitX},${baseY - 5}`;
  const afterPath = `M${splitX},${baseY - 5} C${splitX + 24},${baseY - 10} ${splitX + 52},${baseY - 38} ${splitX + 86},${baseY - 68} S${splitX + 132},34 ${plotRight},26`;
  const afterFill = `${afterPath} L${plotRight},${plotBottom + 4} L${splitX},${plotBottom + 4} Z`;

  useEffect(() => {
    if (!active) {
      drawProgress.setValue(1);
      fadeProgress.setValue(1);
      return;
    }
    drawProgress.setValue(0);
    fadeProgress.setValue(0);
    Animated.parallel([
      Animated.timing(drawProgress, {
        toValue: 1,
        duration: 1500,
        easing: OB_EASE,
        useNativeDriver: false,
      }),
      Animated.timing(fadeProgress, {
        toValue: 1,
        duration: 700,
        delay: 180,
        easing: OB_EASE,
        useNativeDriver: true,
      }),
    ]).start();
  }, [active, drawProgress, fadeProgress]);

  const strokeDashoffset = drawProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [RECLAIM_CURVE_LENGTH, 0],
  });

  const markerOpacity = drawProgress.interpolate({
    inputRange: [0.78, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.reclaimChartCard, { opacity: fadeProgress }]}>
      <View style={styles.reclaimChartHeader}>
        <Text style={styles.reclaimChartTitle}>Reclaiming your life</Text>
        <View style={styles.reclaimChartLegend}>
          <View style={styles.reclaimLegendItem}>
            <View style={[styles.reclaimLegendDot, styles.reclaimLegendDotMuted]} />
            <Text style={styles.reclaimLegendText}>Before</Text>
          </View>
          <View style={styles.reclaimLegendItem}>
            <View style={[styles.reclaimLegendDot, styles.reclaimLegendDotActive]} />
            <Text style={styles.reclaimLegendText}>After Unrot</Text>
          </View>
        </View>
      </View>

      <View style={styles.reclaimChartCanvas}>
        <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
          <Defs>
            <SvgLinearGradient id="reclaimZoneBefore" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={OB.ink} stopOpacity="0.03" />
              <Stop offset="100%" stopColor={OB.ink} stopOpacity="0.01" />
            </SvgLinearGradient>
            <SvgLinearGradient id="reclaimZoneAfter" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={OB.ink} stopOpacity="0.04" />
              <Stop offset="100%" stopColor={OB.ink} stopOpacity="0.1" />
            </SvgLinearGradient>
            <SvgLinearGradient id="reclaimCurveFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={OB.ink} stopOpacity="0.18" />
              <Stop offset="100%" stopColor={OB.ink} stopOpacity="0.02" />
            </SvgLinearGradient>
            <SvgLinearGradient id="reclaimStroke" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#444444" />
              <Stop offset="100%" stopColor={OB.ink} />
            </SvgLinearGradient>
          </Defs>

          <Rect x={plotLeft} y={plotTop} width={splitX - plotLeft} height={plotBottom - plotTop} fill="url(#reclaimZoneBefore)" rx={12} />
          <Rect x={splitX} y={plotTop} width={plotRight - splitX} height={plotBottom - plotTop} fill="url(#reclaimZoneAfter)" rx={12} />

          {[52, 84, 116].map((y) => (
            <Line
              key={y}
              x1={plotLeft}
              y1={y}
              x2={plotRight}
              y2={y}
              stroke={OB.hairline}
              strokeWidth={1}
            />
          ))}

          <Line
            x1={splitX}
            y1={plotTop}
            x2={splitX}
            y2={plotBottom + 4}
            stroke={OB.hairline}
            strokeWidth={1.5}
            strokeDasharray="4 5"
          />

          <Line x1={plotLeft} y1={plotBottom + 4} x2={plotRight} y2={plotBottom + 4} stroke={OB.ink} strokeWidth={1.5} strokeLinecap="round" />
          <Line x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom + 4} stroke={OB.ink} strokeWidth={1.5} strokeLinecap="round" />

          <Path
            d={beforePath}
            stroke={OB.secondary}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeDasharray="5 6"
            opacity={0.75}
          />

          <Path d={afterFill} fill="url(#reclaimCurveFill)" />

          <AnimatedPath
            d={afterPath}
            stroke="url(#reclaimStroke)"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={RECLAIM_CURVE_LENGTH}
            strokeDashoffset={strokeDashoffset}
          />

          <AnimatedCircle
            cx={plotRight}
            cy={26}
            r={10}
            fill={OB.ink}
            opacity={markerOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.12],
            })}
          />
          <AnimatedCircle cx={plotRight} cy={26} r={5.5} fill={OB.ink} opacity={markerOpacity} />
        </Svg>

        <View style={[styles.reclaimZoneLabel, styles.reclaimZoneLabelBefore, { left: plotLeft + 8 }]}>
          <Text style={styles.reclaimZoneLabelText}>Before Unrot</Text>
        </View>
        <View style={[styles.reclaimZoneLabel, styles.reclaimZoneLabelAfter, { right: 10 }]}>
          <Text style={[styles.reclaimZoneLabelText, styles.reclaimZoneLabelTextActive]}>After Unrot</Text>
        </View>
      </View>

      <View style={styles.reclaimChartFooter}>
        <Text style={styles.reclaimAxisY}>Life reclaimed</Text>
        <View style={styles.reclaimAxisX}>
          <Text style={styles.reclaimAxisXLabel}>Time</Text>
          <Text style={styles.reclaimAxisXArrow}>→</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export function AttentionLifeStep({ stepKey, active = true }: { stepKey: number; active?: boolean }) {
  const quoteOpacity = useRef(new Animated.Value(active ? 0 : 1)).current;
  const quoteY = useRef(new Animated.Value(active ? 14 : 0)).current;

  useEffect(() => {
    if (!active) {
      quoteOpacity.setValue(1);
      quoteY.setValue(0);
      return;
    }
    quoteOpacity.setValue(0);
    quoteY.setValue(14);
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(quoteOpacity, {
          toValue: 1,
          duration: 650,
          easing: OB_EASE,
          useNativeDriver: true,
        }),
        Animated.spring(quoteY, { toValue: 0, ...OB_SPRING.reveal }),
      ]).start();
    }, 1100);
    return () => clearTimeout(timer);
  }, [active, stepKey, quoteOpacity, quoteY]);

  return (
    <StepShell stepKey={stepKey} gap={28} stagger={false}>
      <View style={styles.attentionLifeIntro}>
        <Text style={styles.attentionLifeEyebrow}>your attention</Text>
        <Text style={styles.attentionLifeHeadline}>is your life.</Text>
      </View>
      <ReclaimingLifeChart active={active} />
      <Animated.View style={[styles.attentionLifeQuoteCard, { opacity: quoteOpacity, transform: [{ translateY: quoteY }] }]}>
        <Text style={styles.attentionLifeQuoteLead}>The goal isn&apos;t less screen time.</Text>
        <Text style={styles.attentionLifeQuoteEmphasis}>It&apos;s more life.</Text>
      </Animated.View>
    </StepShell>
  );
}

export function LogButtonIntroStep({
  stepKey,
  onHoldComplete,
}: {
  stepKey: number;
  onHoldComplete: () => void;
}) {
  return (
    <StepShell stepKey={stepKey} gap={0} stagger={false}>
      <HomeLogScreen bleedHorizontal={OB.padH} minAnchorHeight={120}>
        <HomeLogButton
          onPress={onHoldComplete}
          accessibilityHint="Press and hold until the ring completes, then release to continue."
        />
      </HomeLogScreen>
    </StepShell>
  );
}

function titleCaseWord(w: string): string {
  const t = w.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function journalMoodLabel(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.toUpperCase() === 'REFLECTION') return 'Reflection';
  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map(titleCaseWord)
    .join(' ');
}

function splitIntentLines(intent: string): { headline: string; detail?: string } {
  const t = intent.trim();
  const sep = ' — ';
  const i = t.indexOf(sep);
  if (i === -1) return { headline: t };
  const headline = t.slice(0, i).trim();
  const detail = t.slice(i + sep.length).trim();
  return { headline: headline || t, detail: detail || undefined };
}

function formatJournalPreviewTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function JournalPreviewCard({ entry }: { entry: LogEntry }) {
  const { headline, detail } = splitIntentLines(entry.intent);
  const moodLine = journalMoodLabel(entry.state);

  return (
    <View style={styles.journalPreviewCard}>
      <View style={styles.journalPreviewTopRow}>
        <Text style={styles.journalPreviewMood}>{moodLine}</Text>
        <Text style={styles.journalPreviewTime}>{formatJournalPreviewTime(entry.timestamp)}</Text>
      </View>
      <Text style={styles.journalPreviewHeadline}>{headline}</Text>
      {detail ? <Text style={styles.journalPreviewDetail}>{detail}</Text> : null}
    </View>
  );
}

export function FirstLogCelebrationStep({ stepKey }: { stepKey: number }) {
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const [entry, setEntry] = useState<LogEntry | null>(null);

  useEffect(() => {
    cardOpacity.setValue(0);
    Animated.timing(cardOpacity, { toValue: 1, duration: 320, easing: OB_EASE, useNativeDriver: true }).start();
  }, [cardOpacity, stepKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const logs = await getRecentLogs(1);
      if (!cancelled) setEntry(logs[0] ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [stepKey]);

  return (
    <StepShell stepKey={stepKey} gap={24} stagger={false}>
      <Text style={styles.firstLogCongrats}>🎉 Congratulations!</Text>
      <SerifQuestion>You&apos;ve completed your first log.</SerifQuestion>
      <Animated.View style={{ opacity: cardOpacity, width: '100%' }}>
        {entry ? (
          <JournalPreviewCard entry={entry} />
        ) : (
          <View style={styles.journalPreviewCard}>
            <View style={styles.journalPreviewTopRow}>
              <Text style={styles.journalPreviewMood}>Your mood</Text>
              <Text style={styles.journalPreviewTime}>Just now</Text>
            </View>
            <Text style={styles.journalPreviewHeadline}>Your intent</Text>
          </View>
        )}
      </Animated.View>
      <BodyRegular>
        Your logs will be saved in your journal, helping you uncover patterns in your habits
      </BodyRegular>
    </StepShell>
  );
}

export function DayOneStreakRevealStep({ stepKey }: { stepKey: number }) {
  const flameOpacity = useRef(new Animated.Value(0)).current;
  const flameScale = useRef(new Animated.Value(0.72)).current;
  const flameScaleY = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.35)).current;
  const countOpacity = useRef(new Animated.Value(0)).current;
  const countY = useRef(new Animated.Value(12)).current;
  const calendarOpacity = useRef(new Animated.Value(0)).current;
  const calendarY = useRef(new Animated.Value(14)).current;
  const streakCount = useCountUp(1, 650);

  useEffect(() => {
    flameOpacity.setValue(0);
    flameScale.setValue(0.72);
    flameScaleY.setValue(1);
    glowOpacity.setValue(0.35);
    countOpacity.setValue(0);
    countY.setValue(12);
    calendarOpacity.setValue(0);
    calendarY.setValue(14);

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.7, duration: 1400, easing: OB_EASE, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.35, duration: 1400, easing: OB_EASE, useNativeDriver: true }),
      ]),
    ).start();

    Animated.sequence([
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(flameOpacity, { toValue: 1, duration: 420, easing: OB_EASE, useNativeDriver: true }),
        Animated.spring(flameScale, { toValue: 1, ...OB_SPRING.reveal, useNativeDriver: true }),
      ]),
    ]).start(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      let flickerStep = 0;
      const flicker = () => {
        if (flickerStep >= 6) {
          flameScaleY.setValue(1);
          return;
        }
        Animated.timing(flameScaleY, {
          toValue: flickerStep % 2 === 0 ? 0.97 : 1.03,
          duration: 200,
          easing: OB_EASE,
          useNativeDriver: true,
        }).start(() => {
          flickerStep += 1;
          flicker();
        });
      };
      flicker();
    });

    Animated.sequence([
      Animated.delay(380),
      Animated.parallel([
        Animated.timing(countOpacity, { toValue: 1, duration: 320, easing: OB_EASE, useNativeDriver: true }),
        Animated.spring(countY, { toValue: 0, ...OB_SPRING.reveal, useNativeDriver: true }),
      ]),
    ]).start(() => {
      void playOnboardingStampThud();
    });

    Animated.sequence([
      Animated.delay(560),
      Animated.parallel([
        Animated.timing(calendarOpacity, { toValue: 1, duration: 360, easing: OB_EASE, useNativeDriver: true }),
        Animated.spring(calendarY, { toValue: 0, ...OB_SPRING.reveal, useNativeDriver: true }),
      ]),
    ]).start();
  }, [calendarOpacity, calendarY, countOpacity, countY, flameOpacity, flameScale, flameScaleY, glowOpacity, stepKey]);

  return (
    <StepShell stepKey={stepKey} gap={28} stagger={false}>
      <View style={styles.streakRevealTop}>
        <View style={styles.streakRevealFlameWrap}>
          <Animated.View style={[styles.streakRevealSoftGlow, { opacity: glowOpacity }]} />
          <Animated.View
            style={{
              opacity: flameOpacity,
              transform: [{ scale: flameScale }, { scaleY: flameScaleY }],
            }}
          >
            <FlameIcon size={64} />
          </Animated.View>
        </View>
        <Animated.View
          style={[
            styles.streakRevealCountBlock,
            { opacity: countOpacity, transform: [{ translateY: countY }] },
          ]}
        >
          <Text style={styles.streakRevealCountLarge}>{streakCount}</Text>
          <Text style={styles.streakRevealCountCaption}>day streak</Text>
        </Animated.View>
        <Animated.Text style={[styles.streakRevealTagline, { opacity: countOpacity }]}>
          The flame is lit.
        </Animated.Text>
      </View>

      <Animated.View
        style={[
          styles.streakRevealCalendarCard,
          { opacity: calendarOpacity, transform: [{ translateY: calendarY }] },
        ]}
      >
        <Text style={styles.streakWeekKicker}>LAST 7 DAYS</Text>
        <Gap h={14} />
        <StreakCalendarGrid celebrateToday days={7} />
      </Animated.View>

      <Animated.View style={{ opacity: calendarOpacity }}>
        <InsightLight>
          Log tomorrow to keep it alive. Every day you show up, the streak grows.
        </InsightLight>
      </Animated.View>
    </StepShell>
  );
}

const FRAMEWORK_RING_R = 54;
const FRAMEWORK_RING_C = 2 * Math.PI * FRAMEWORK_RING_R;
const FRAMEWORK_BUILD_MS = 3000;

export function BuildingFrameworkStep({
  stepKey,
  onComplete,
}: {
  stepKey: number;
  onComplete: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(0.35)).current;
  const [percent, setPercent] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    progress.setValue(0);
    labelOpacity.setValue(0.35);
    setPercent(0);
    doneRef.current = false;

    const listenerId = progress.addListener(({ value }) => {
      setPercent(Math.round(value * 100));
    });

    Animated.timing(labelOpacity, { toValue: 1, duration: 420, easing: OB_EASE, useNativeDriver: true }).start();

    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: FRAMEWORK_BUILD_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    anim.start(({ finished }) => {
      if (!finished || doneRef.current) return;
      doneRef.current = true;
      setPercent(100);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => onComplete(), 480);
    });

    return () => {
      progress.removeListener(listenerId);
      anim.stop();
    };
  }, [labelOpacity, onComplete, progress, stepKey]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [FRAMEWORK_RING_C, 0],
  });

  const ringSize = 152;
  const ringCenter = ringSize / 2;

  return (
    <StepShell stepKey={stepKey} gap={28} stagger={false}>
      <View style={styles.frameworkRingStage}>
        <Svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
          <Circle
            cx={ringCenter}
            cy={ringCenter}
            r={FRAMEWORK_RING_R}
            stroke={OB.track}
            strokeWidth={3}
            fill="none"
          />
          <AnimatedCircle
            cx={ringCenter}
            cy={ringCenter}
            r={FRAMEWORK_RING_R}
            stroke={OB.ink}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${FRAMEWORK_RING_C} ${FRAMEWORK_RING_C}`}
            strokeDashoffset={dashOffset}
            rotation={-90}
            origin={`${ringCenter}, ${ringCenter}`}
          />
        </Svg>
        <Text style={styles.frameworkRingPercent}>{percent}%</Text>
      </View>
      <Animated.Text style={[styles.frameworkLabel, { opacity: labelOpacity }]}>
        building your framework…
      </Animated.Text>
    </StepShell>
  );
}

export function PlanReadyStep({ stepKey, name }: { stepKey: number; name: string }) {
  const displayName = name.trim() || 'friend';
  return (
    <StepShell stepKey={stepKey} gap={24} stagger={false}>
      <FadeInHeadline text={`alright ${displayName}, your plan is ready`} />
    </StepShell>
  );
}

const TRANSFORMATION_HOW_ITEMS = [
  {
    emoji: '🔒',
    title: 'a personal log, daily',
    body: 'Every check-in unlocks your apps with intention — a small pause before you scroll.',
  },
  {
    emoji: '📱',
    title: 'structure that works',
    body: 'Shields block temptation until you\u2019ve logged. No guilt. Just a clear gate between you and autopilot.',
  },
] as const;

export function TransformationPlanStep({
  stepKey,
  name,
  mindGoals,
  lifeGoals,
  reclaimGoalHours,
  bottomInset,
  onBegin,
}: {
  stepKey: number;
  name: string;
  mindGoals: readonly string[];
  lifeGoals: readonly string[];
  reclaimGoalHours: number;
  bottomInset: number;
  onBegin: () => void;
}) {
  const displayName = (name.trim() || 'friend').toLowerCase();
  const goal = primaryOnboardingGoal(mindGoals, lifeGoals);
  const targetDate = transformationTargetDate();
  const featureCards = transformationFeatureCards(mindGoals, lifeGoals);
  const hoursSummary = transformationHoursSummary(reclaimGoalHours, goal);
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    cardOpacity.setValue(0);
    cardY.setValue(12);
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 420, easing: OB_EASE, useNativeDriver: true }),
      Animated.spring(cardY, { toValue: 0, ...OB_SPRING.reveal, useNativeDriver: true }),
    ]).start();
  }, [cardOpacity, cardY, stepKey]);

  return (
    <StepShell stepKey={stepKey} gap={20} stagger={false}>
      <Animated.View
        style={[
          styles.transformationPlanCard,
          { opacity: cardOpacity, transform: [{ translateY: cardY }] },
        ]}
      >
        <Text style={styles.transformationPlanHeadline}>
          {displayName}, you will achieve {goal} by
        </Text>
        <View style={styles.transformationDatePill}>
          <Text style={styles.transformationDateText}>{targetDate}</Text>
        </View>
        <View style={styles.transformationFeatureRow}>
          {featureCards.map((card) => (
            <View key={card.label} style={styles.transformationFeatureCard}>
              <Text style={styles.transformationFeatureEmoji}>{card.emoji}</Text>
              <Text style={styles.transformationFeatureLabel}>{card.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.transformationSummaryPill}>
          <Text style={styles.transformationSummaryEmoji}>✨</Text>
          <Text style={styles.transformationSummaryText}>{hoursSummary}</Text>
        </View>
      </Animated.View>

      <Text style={styles.transformationSectionTitle}>how we&apos;ll get you there:</Text>

      {TRANSFORMATION_HOW_ITEMS.map((item) => (
        <View key={item.title} style={styles.transformationHowRow}>
          <View style={styles.transformationHowIcon}>
            <Text style={styles.transformationHowEmoji}>{item.emoji}</Text>
          </View>
          <View style={styles.transformationHowCopy}>
            <Text style={styles.transformationHowTitle}>{item.title}</Text>
            <Text style={styles.transformationHowBody}>{item.body}</Text>
          </View>
        </View>
      ))}

      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onBegin();
        }}
        style={({ pressed }) => [
          styles.transformationCtaWrap,
          { marginBottom: bottomInset + spacing.sm },
          pressed && { opacity: 0.92 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Begin my transformation"
      >
        <View style={styles.transformationCta}>
          <Text style={styles.transformationCtaLabel}>begin my transformation</Text>
        </View>
      </Pressable>
    </StepShell>
  );
}

export function FreeTrialPitchStep({
  stepKey,
  bottomInset,
  onContinue,
}: {
  stepKey: number;
  bottomInset: number;
  onContinue: () => void;
}) {
  const rootOpacity = useRef(new Animated.Value(0)).current;
  const rootY = useRef(new Animated.Value(16)).current;
  const compareOpacity = useRef(new Animated.Value(0)).current;
  const compareScale = useRef(new Animated.Value(0.96)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineY = useRef(new Animated.Value(10)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    rootOpacity.setValue(0);
    rootY.setValue(16);
    compareOpacity.setValue(0);
    compareScale.setValue(0.96);
    headlineOpacity.setValue(0);
    headlineY.setValue(10);
    ctaOpacity.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(rootOpacity, { toValue: 1, duration: 380, easing: OB_EASE, useNativeDriver: true }),
        Animated.spring(rootY, { toValue: 0, ...OB_SPRING.reveal, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(compareOpacity, { toValue: 1, duration: 420, easing: OB_EASE, useNativeDriver: true }),
        Animated.spring(compareScale, { toValue: 1, ...OB_SPRING.reveal, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(headlineOpacity, { toValue: 1, duration: 360, easing: OB_EASE, useNativeDriver: true }),
        Animated.spring(headlineY, { toValue: 0, ...OB_SPRING.reveal, useNativeDriver: true }),
      ]),
      Animated.timing(ctaOpacity, { toValue: 1, duration: 320, easing: OB_EASE, useNativeDriver: true }),
    ]).start();
  }, [
    compareOpacity,
    compareScale,
    ctaOpacity,
    headlineOpacity,
    headlineY,
    rootOpacity,
    rootY,
    stepKey,
  ]);

  return (
    <Animated.View
      style={[
        styles.freeTrialRoot,
        {
          opacity: rootOpacity,
          transform: [{ translateY: rootY }],
          paddingBottom: bottomInset + spacing.lg,
        },
      ]}
    >
      <View style={styles.freeTrialPolicyPill}>
        <Text style={styles.freeTrialPolicyText}>fair trial policy</Text>
      </View>

      <Animated.View
        style={[
          styles.freeTrialCompareWrap,
          {
            opacity: compareOpacity,
            transform: [{ scale: compareScale }],
          },
        ]}
      >
        <View style={styles.freeTrialCompareCard}>
          <View style={styles.freeTrialCompareSide}>
            <View style={styles.freeTrialIconRing}>
              <FreeTrialPeaceIcon />
            </View>
            <Text style={styles.freeTrialSideLabel}>peace</Text>
            <Text style={styles.freeTrialSideHint}>reclaimed focus</Text>
          </View>

          <View style={styles.freeTrialCompareDivider} />

          <View style={styles.freeTrialCompareSide}>
            <View style={styles.freeTrialIconRing}>
              <FreeTrialCoffeeIcon />
            </View>
            <Text style={styles.freeTrialSideLabel}>one coffee</Text>
            <Text style={styles.freeTrialSideHint}>per month</Text>
          </View>
        </View>

        <View style={styles.freeTrialVsBadge}>
          <Text style={styles.freeTrialVsBadgeText}>vs</Text>
        </View>
      </Animated.View>

      <Animated.View
        style={{
          opacity: headlineOpacity,
          transform: [{ translateY: headlineY }],
        }}
      >
        <Text style={styles.freeTrialHeadline}>UNROT is free{'\n'}for you to try.</Text>
      </Animated.View>

      <Animated.View style={{ opacity: ctaOpacity }}>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onContinue();
          }}
          style={({ pressed }) => [styles.freeTrialCta, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel="Sounds good"
        >
          <Text style={styles.freeTrialCtaLabel}>sounds good →</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function FreeTrialPeaceIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 48 48">
      <Circle cx={24} cy={24} r={19} stroke={OB.ink} strokeWidth={1.4} fill="none" opacity={0.12} />
      <Circle cx={24} cy={24} r={12} stroke={OB.ink} strokeWidth={1.4} fill="none" opacity={0.28} />
      <Circle cx={24} cy={24} r={4.5} fill={OB.ink} />
    </Svg>
  );
}

function FreeTrialCoffeeIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 48 48">
      <Path
        d="M13 16h18v14a7 7 0 0 1-7 7h-4a7 7 0 0 1-7-7V16z"
        stroke={OB.ink}
        strokeWidth={1.6}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M31 19h3.5a5 5 0 0 1 0 10H31"
        stroke={OB.ink}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M15 34h14" stroke={OB.ink} strokeWidth={1.4} strokeLinecap="round" opacity={0.35} />
      <Path d="M17 13h10" stroke={OB.ink} strokeWidth={1.4} strokeLinecap="round" opacity={0.35} />
    </Svg>
  );
}

export function CommitmentStep({
  stepKey,
  commitment,
  bottomInset,
  onSelect,
  onContinue,
}: {
  stepKey: number;
  commitment: string | null;
  bottomInset: number;
  onSelect: (value: string) => void;
  onContinue: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    opacity.setValue(0);
    y.setValue(12);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, easing: OB_EASE, useNativeDriver: true }),
      Animated.spring(y, { toValue: 0, ...OB_SPRING.reveal, useNativeDriver: true }),
    ]).start();
  }, [opacity, stepKey, y]);

  return (
    <Animated.View
      style={[
        styles.onboardingChoiceRoot,
        {
          opacity,
          transform: [{ translateY: y }],
          paddingBottom: bottomInset + spacing.md,
        },
      ]}
    >
      <OnboardingChoiceHeading kicker="so,">
        how committed are you to making this future happen?
      </OnboardingChoiceHeading>

      <ChoiceStack stepKey={stepKey}>
        {COMMITMENT_OPTIONS.map((option) => (
          <ChoiceRow
            key={option}
            label={option}
            selected={commitment === option}
            onPress={() => onSelect(option)}
          />
        ))}
      </ChoiceStack>

      <Pressable
        disabled={commitment == null}
        onPress={() => {
          if (commitment == null) return;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onContinue();
        }}
        style={({ pressed }) => [
          styles.onboardingChoiceCta,
          commitment == null && styles.onboardingChoiceCtaDisabled,
          pressed && commitment != null && { opacity: 0.92 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Continue"
      >
        <Text style={styles.onboardingChoiceCtaLabel}>continue</Text>
      </Pressable>
    </Animated.View>
  );
}

export function LockInStep({
  stepKey,
  commitment,
  bottomInset,
  onContinue,
}: {
  stepKey: number;
  commitment: string | null;
  bottomInset: number;
  onContinue: () => void;
}) {
  const rootOpacity = useRef(new Animated.Value(0)).current;
  const flameOpacity = useRef(new Animated.Value(0)).current;
  const flameScale = useRef(new Animated.Value(0.82)).current;
  const flameScaleY = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const copyOpacity = useRef(new Animated.Value(0)).current;
  const copyY = useRef(new Animated.Value(14)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    rootOpacity.setValue(0);
    flameOpacity.setValue(0);
    flameScale.setValue(0.82);
    flameScaleY.setValue(1);
    glowOpacity.setValue(0);
    copyOpacity.setValue(0);
    copyY.setValue(14);
    ctaOpacity.setValue(0);

    Animated.timing(rootOpacity, { toValue: 1, duration: 360, easing: OB_EASE, useNativeDriver: true }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.28, duration: 1200, easing: OB_EASE, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.12, duration: 1200, easing: OB_EASE, useNativeDriver: true }),
      ]),
    ).start();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(flameOpacity, { toValue: 1, duration: 480, easing: OB_EASE, useNativeDriver: true }),
        Animated.spring(flameScale, { toValue: 1, ...OB_SPRING.reveal, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(copyOpacity, { toValue: 1, duration: 420, easing: OB_EASE, useNativeDriver: true }),
        Animated.spring(copyY, { toValue: 0, ...OB_SPRING.reveal, useNativeDriver: true }),
      ]),
      Animated.timing(ctaOpacity, { toValue: 1, duration: 320, easing: OB_EASE, useNativeDriver: true }),
    ]).start(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      let flickerStep = 0;
      const flicker = () => {
        if (flickerStep >= 4) {
          flameScaleY.setValue(1);
          return;
        }
        Animated.timing(flameScaleY, {
          toValue: flickerStep % 2 === 0 ? 0.97 : 1.03,
          duration: 180,
          easing: OB_EASE,
          useNativeDriver: true,
        }).start(() => {
          flickerStep += 1;
          flicker();
        });
      };
      flicker();
    });
  }, [
    copyOpacity,
    copyY,
    ctaOpacity,
    flameOpacity,
    flameScale,
    flameScaleY,
    glowOpacity,
    rootOpacity,
    stepKey,
  ]);

  return (
    <Animated.View
      style={[
        styles.lockInRoot,
        {
          opacity: rootOpacity,
          paddingBottom: bottomInset + spacing.md,
        },
      ]}
    >
      <View style={styles.lockInHero}>
        <View style={styles.lockInFlameWrap}>
          <Animated.View style={[styles.lockInGlow, { opacity: glowOpacity }]} />
          <Animated.View
            style={{
              opacity: flameOpacity,
              transform: [{ scale: flameScale }, { scaleY: flameScaleY }],
            }}
          >
            <FlameIcon size={72} />
          </Animated.View>
        </View>

        <Animated.View
          style={{
            opacity: copyOpacity,
            transform: [{ translateY: copyY }],
            alignItems: 'center',
          }}
        >
          <Text style={styles.lockInHeadline}>lock in</Text>
          <Text style={styles.lockInTagline}>{lockInTagline(commitment)}</Text>
        </Animated.View>
      </View>

      <Animated.View style={{ opacity: ctaOpacity, width: '100%' }}>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onContinue();
          }}
          style={({ pressed }) => [styles.onboardingChoiceCta, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.onboardingChoiceCtaLabel}>continue</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function SnapshotLevelBar({
  percent,
  stepKey,
  lowLabel = 'low',
  highLabel = 'high',
  showPercent = true,
}: {
  percent: number;
  stepKey: number;
  lowLabel?: string;
  highLabel?: string;
  showPercent?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: clamped,
      duration: 720,
      easing: OB_EASE,
      useNativeDriver: false,
    }).start();
  }, [clamped, progress, stepKey]);

  const fillWidth = progress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.snapshotMeterWrap}>
      <View style={styles.snapshotMeterTrack}>
        <Animated.View style={[styles.snapshotMeterFill, { width: fillWidth }]} />
      </View>
      <View style={styles.snapshotMeterLabels}>
        <Text style={styles.snapshotMeterEdge}>{lowLabel}</Text>
        {showPercent ? <Text style={styles.snapshotMeterPercent}>{clamped}%</Text> : <View />}
        <Text style={styles.snapshotMeterEdge}>{highLabel}</Text>
      </View>
    </View>
  );
}

function SnapshotStatCard({
  label,
  children,
  accent,
}: {
  label: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <View style={[styles.snapshotStatCard, accent ? styles.snapshotStatCardAccent : null]}>
      <Text style={[styles.snapshotStatLabel, accent ? styles.snapshotStatLabelAccent : null]}>{label}</Text>
      {children}
    </View>
  );
}

export function PersonalizedSnapshotStep({
  stepKey,
  phoneRelationship,
  hoursPerDay,
  screenTimeCaption,
  commitment,
}: {
  stepKey: number;
  phoneRelationship: string | null;
  hoursPerDay: string;
  screenTimeCaption: string;
  commitment: string | null;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(16)).current;
  const commitmentPercent = commitmentLevelPercent(commitment);
  const phonePercent = phoneRelationshipLevelPercent(phoneRelationship);
  const commitmentLabel = commitment ? stripOptionEmoji(commitment) : '—';
  const phoneLabel = phoneRelationship ? stripOptionEmoji(phoneRelationship) : '—';

  useEffect(() => {
    opacity.setValue(0);
    y.setValue(16);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 440, easing: OB_EASE, useNativeDriver: true }),
      Animated.spring(y, { toValue: 0, ...OB_SPRING.reveal, useNativeDriver: true }),
    ]).start();
  }, [opacity, stepKey, y]);

  return (
    <Animated.View style={[styles.snapshotPageRoot, { opacity, transform: [{ translateY: y }] }]}>
      <View style={styles.snapshotHeaderBlock}>
        <Text style={styles.snapshotTitle}>your personalized snapshot</Text>
        <Text style={styles.snapshotRecapLead}>based on your answers, here&apos;s where you&apos;re at:</Text>
      </View>

      <View style={styles.snapshotStack}>
        <StaggerFade index={0} resetKey={stepKey}>
          <SnapshotStatCard label="daily screen time" accent>
            <Text style={styles.snapshotHeroValue}>{hoursPerDay}</Text>
            <Text style={styles.snapshotHeroUnit}>hours / day</Text>
            <Text style={styles.snapshotHeroCaption}>{screenTimeCaption}</Text>
          </SnapshotStatCard>
        </StaggerFade>

        <StaggerFade index={1} resetKey={stepKey}>
          <SnapshotStatCard label="relationship with your phone">
            <Text style={styles.snapshotStatValue}>{phoneLabel}</Text>
            <SnapshotLevelBar
              percent={phonePercent}
              stepKey={stepKey}
              lowLabel="strained"
              highLabel="healthy"
              showPercent={false}
            />
          </SnapshotStatCard>
        </StaggerFade>

        <StaggerFade index={2} resetKey={stepKey}>
          <SnapshotStatCard label="commitment level">
            <Text style={styles.snapshotStatValue}>{commitmentLabel}</Text>
            <SnapshotLevelBar percent={commitmentPercent} stepKey={stepKey} />
          </SnapshotStatCard>
        </StaggerFade>
      </View>

      <StaggerFade index={3} resetKey={stepKey}>
        <Text style={styles.snapshotEncouragement}>{lockInTagline(commitment)}</Text>
      </StaggerFade>
    </Animated.View>
  );
}

function ScreenTimeConnectGraphic({ size = 104 }: { size?: number }) {
  const gradientId = useId();
  const radius = size * 0.215;

  return (
    <View style={[styles.screenTimeIconShadow, { width: size, height: size, borderRadius: radius }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#9B8CFF" />
            <Stop offset="0.45" stopColor="#7B6CF6" />
            <Stop offset="1" stopColor="#5E5CE6" />
          </SvgLinearGradient>
        </Defs>
        <Rect width={size} height={size} rx={radius} fill={`url(#${gradientId})`} />
        <Path
          d={`M${size * 0.28} ${size * 0.18} H${size * 0.72} V${size * 0.28} C${size * 0.72} ${size * 0.36} ${size * 0.64} ${size * 0.4} ${size * 0.5} ${size * 0.48} C${size * 0.36} ${size * 0.4} ${size * 0.28} ${size * 0.36} ${size * 0.28} ${size * 0.28} Z`}
          fill="#FFFFFF"
        />
        <Path
          d={`M${size * 0.28} ${size * 0.82} H${size * 0.72} V${size * 0.72} C${size * 0.72} ${size * 0.64} ${size * 0.64} ${size * 0.6} ${size * 0.5} ${size * 0.52} C${size * 0.36} ${size * 0.6} ${size * 0.28} ${size * 0.64} ${size * 0.28} ${size * 0.72} Z`}
          fill="#FFFFFF"
        />
      </Svg>
    </View>
  );
}

export function ScreenTimeConnectStep({
  stepKey,
  bottomInset,
  onConnected,
}: {
  stepKey: number;
  bottomInset: number;
  onConnected: () => void | Promise<void>;
}) {
  const rootOpacity = useRef(new Animated.Value(0)).current;
  const rootY = useRef(new Animated.Value(14)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.92)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setBusy(false);
  }, [stepKey]);

  useEffect(() => {
    rootOpacity.setValue(0);
    rootY.setValue(14);
    iconOpacity.setValue(0);
    iconScale.setValue(0.92);
    ctaOpacity.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(rootOpacity, { toValue: 1, duration: 380, easing: OB_EASE, useNativeDriver: true }),
        Animated.spring(rootY, { toValue: 0, ...OB_SPRING.reveal, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(iconOpacity, { toValue: 1, duration: 420, easing: OB_EASE, useNativeDriver: true }),
        Animated.spring(iconScale, { toValue: 1, ...OB_SPRING.reveal, useNativeDriver: true }),
      ]),
      Animated.timing(ctaOpacity, { toValue: 1, duration: 320, easing: OB_EASE, useNativeDriver: true }),
    ]).start();
  }, [ctaOpacity, iconOpacity, iconScale, rootOpacity, rootY, stepKey]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, { toValue: 1.06, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [glowScale, stepKey]);

  const handleConnect = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let result: ScreenTimeConnectResult = { ok: false, approved: false };
    try {
      result = await requestOnboardingScreenTime();
    } finally {
      setBusy(false);
    }

    if (result.ok) {
      await onConnected();
      return;
    }

    setError(result.message ?? 'Could not connect Screen Time.');
  };

  return (
    <Animated.View
      style={[
        styles.screenTimeConnectRoot,
        {
          opacity: rootOpacity,
          transform: [{ translateY: rootY }],
          paddingBottom: bottomInset + spacing.lg,
        },
      ]}
    >
      <View style={styles.screenTimeConnectHero}>
        <View style={styles.screenTimeConnectCopy}>
          <Text style={styles.screenTimeConnectTitle}>connect UNROT to screen time</Text>
          <Text style={styles.screenTimeConnectSubtext}>
            we use this to block your apps and show you your stats
          </Text>
        </View>

        <Animated.View
          style={[
            styles.screenTimeConnectIconWrap,
            { opacity: iconOpacity, transform: [{ scale: iconScale }] },
          ]}
        >
          <Animated.View style={[styles.screenTimeIconGlow, { transform: [{ scale: glowScale }] }]} />
          <ScreenTimeConnectGraphic size={104} />
        </Animated.View>
      </View>

      <Animated.View style={{ opacity: ctaOpacity, width: '100%', gap: 10 }}>
        {error ? <Text style={styles.screenTimeConnectError}>{error}</Text> : null}
        <Pressable
          onPress={() => void handleConnect()}
          disabled={busy}
          style={({ pressed }) => [
            styles.onboardingChoiceCta,
            busy && styles.onboardingChoiceCtaDisabled,
            pressed && !busy && { opacity: 0.92 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Connect Screen Time"
        >
          {busy ? (
            <ActivityIndicator color={OB.white} />
          ) : (
            <Text style={styles.onboardingChoiceCtaLabel}>connect</Text>
          )}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function NotificationsConnectGraphic({ size = 104 }: { size?: number }) {
  const gradientId = useId();
  const radius = size * 0.215;

  return (
    <View style={[styles.notificationsIconShadow, { width: size, height: size, borderRadius: radius }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FF6B6B" />
            <Stop offset="0.5" stopColor="#FF453A" />
            <Stop offset="1" stopColor="#FF3B30" />
          </SvgLinearGradient>
        </Defs>
        <Rect width={size} height={size} rx={radius} fill={`url(#${gradientId})`} />
        <Path
          d={`M${size * 0.5} ${size * 0.24} C${size * 0.38} ${size * 0.24} ${size * 0.28} ${size * 0.34} ${size * 0.28} ${size * 0.46} V${size * 0.58} L${size * 0.22} ${size * 0.66} H${size * 0.78} L${size * 0.72} ${size * 0.58} V${size * 0.46} C${size * 0.72} ${size * 0.34} ${size * 0.62} ${size * 0.24} ${size * 0.5} ${size * 0.24} Z`}
          fill="#FFFFFF"
        />
        <Path
          d={`M${size * 0.42} ${size * 0.72} C${size * 0.42} ${size * 0.78} ${size * 0.46} ${size * 0.82} ${size * 0.5} ${size * 0.82} C${size * 0.54} ${size * 0.82} ${size * 0.58} ${size * 0.78} ${size * 0.58} ${size * 0.72}`}
          stroke="#FFFFFF"
          strokeWidth={size * 0.04}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

export function NotificationsConnectStep({
  stepKey,
  bottomInset,
  onAllowed,
}: {
  stepKey: number;
  bottomInset: number;
  onAllowed: () => void | Promise<void>;
}) {
  const rootOpacity = useRef(new Animated.Value(0)).current;
  const rootY = useRef(new Animated.Value(14)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.92)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBusy(false);
  }, [stepKey]);

  useEffect(() => {
    rootOpacity.setValue(0);
    rootY.setValue(14);
    iconOpacity.setValue(0);
    iconScale.setValue(0.92);
    ctaOpacity.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(rootOpacity, { toValue: 1, duration: 380, easing: OB_EASE, useNativeDriver: true }),
        Animated.spring(rootY, { toValue: 0, ...OB_SPRING.reveal, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(iconOpacity, { toValue: 1, duration: 420, easing: OB_EASE, useNativeDriver: true }),
        Animated.spring(iconScale, { toValue: 1, ...OB_SPRING.reveal, useNativeDriver: true }),
      ]),
      Animated.timing(ctaOpacity, { toValue: 1, duration: 320, easing: OB_EASE, useNativeDriver: true }),
    ]).start();
  }, [ctaOpacity, iconOpacity, iconScale, rootOpacity, rootY, stepKey]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, { toValue: 1.06, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [glowScale, stepKey]);

  const handleAllow = async () => {
    if (busy) return;
    setBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await requestOnboardingNotifications();
      if (result.openSettings) {
        await openOnboardingNotificationSettings();
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('requestOnboardingNotifications', e);
      }
    } finally {
      setBusy(false);
      await onAllowed();
    }
  };

  return (
    <Animated.View
      style={[
        styles.screenTimeConnectRoot,
        {
          opacity: rootOpacity,
          transform: [{ translateY: rootY }],
          paddingBottom: bottomInset + spacing.lg,
        },
      ]}
    >
      <View style={styles.screenTimeConnectHero}>
        <View style={styles.screenTimeConnectCopy}>
          <Text style={styles.screenTimeConnectTitle}>Allow UNROT to send you notifications</Text>
        </View>

        <Animated.View
          style={[
            styles.screenTimeConnectIconWrap,
            { opacity: iconOpacity, transform: [{ scale: iconScale }] },
          ]}
        >
          <Animated.View style={[styles.notificationsIconGlow, { transform: [{ scale: glowScale }] }]} />
          <NotificationsConnectGraphic size={104} />
        </Animated.View>
      </View>

      <Animated.View style={{ opacity: ctaOpacity, width: '100%' }}>
        <Pressable
          onPress={() => void handleAllow()}
          disabled={busy}
          style={({ pressed }) => [
            styles.onboardingChoiceCta,
            busy && styles.onboardingChoiceCtaDisabled,
            pressed && !busy && { opacity: 0.92 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Allow notifications"
        >
          {busy ? (
            <ActivityIndicator color={OB.white} />
          ) : (
            <Text style={styles.onboardingChoiceCtaLabel}>allow</Text>
          )}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const FREE_TRIAL_DAYS = 3;
const FREE_TRIAL_YEARLY_PRICE = 29.99;
const FREE_TRIAL_YEARLY_PER_WEEK = (FREE_TRIAL_YEARLY_PRICE / 52).toFixed(2);
const FREE_TRIAL_WEEKLY_PLAN_PRICE = 4.99;

type TrialPlan = 'weekly' | 'yearly';

function trialChargeDateLabel(): string {
  const d = new Date();
  d.setDate(d.getDate() + FREE_TRIAL_DAYS);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function trialStartFinePrint(plan: TrialPlan): string {
  const priceLine =
    plan === 'yearly'
      ? `3 days free, then $${FREE_TRIAL_YEARLY_PRICE.toFixed(2)}/year ($${FREE_TRIAL_YEARLY_PER_WEEK}/week).`
      : `3 days free, then $${FREE_TRIAL_WEEKLY_PLAN_PRICE.toFixed(2)}/week.`;
  const billingLine = plan === 'yearly' ? 'Billed yearly.' : 'Billed weekly.';
  return `${priceLine}\n${billingLine}\nPlan auto-renews unless you cancel.`;
}

function TrialTimelineIcon({ type }: { type: 'lock' | 'bell' | 'crown' }) {
  const size = 34;
  return (
    <View style={[styles.trialTimelineIcon, { width: size, height: size, borderRadius: size / 2 }]}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        {type === 'lock' ? (
          <Path
            d="M8 10V8a4 4 0 1 1 8 0v2m-9 0h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"
            stroke="#FFFFFF"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        ) : null}
        {type === 'bell' ? (
          <Path
            d="M12 4.5c-2.2 0-4 1.7-4 3.8V11L6.5 13h11L16 11V8.3c0-2.1-1.8-3.8-4-3.8Zm0 13.5a2.2 2.2 0 0 0 2-1.2H10a2.2 2.2 0 0 0 2 1.2Z"
            fill="#FFFFFF"
          />
        ) : null}
        {type === 'crown' ? (
          <Path
            d="M5 17h14l-1.2-7.2-3.3 3.1L12 6.8 9.5 12.9 6.2 9.8 5 17Zm-1 2h16"
            stroke="#FFFFFF"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </Svg>
    </View>
  );
}

function TrialTimelineRow({
  type,
  title,
  body,
  isLast,
}: {
  type: 'lock' | 'bell' | 'crown';
  title: string;
  body: string;
  isLast?: boolean;
}) {
  return (
    <View style={styles.trialTimelineRow}>
      <View style={styles.trialTimelineTrack}>
        <TrialTimelineIcon type={type} />
        {!isLast ? <View style={styles.trialTimelineConnector} /> : null}
      </View>
      <View style={styles.trialTimelineCopy}>
        <Text style={styles.trialTimelineTitle}>{title}</Text>
        <Text style={styles.trialTimelineBody}>{body}</Text>
      </View>
    </View>
  );
}

export function FreeTrialStartStep({
  stepKey,
  bottomInset,
  onContinue,
}: {
  stepKey: number;
  bottomInset: number;
  onContinue: () => void;
}) {
  const rootOpacity = useRef(new Animated.Value(0)).current;
  const rootY = useRef(new Animated.Value(14)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const [plan, setPlan] = useState<TrialPlan>('yearly');
  const chargeDate = useMemo(() => trialChargeDateLabel(), [stepKey]);

  useEffect(() => {
    rootOpacity.setValue(0);
    rootY.setValue(14);
    footerOpacity.setValue(0);
    setPlan('yearly');

    Animated.sequence([
      Animated.parallel([
        Animated.timing(rootOpacity, { toValue: 1, duration: 380, easing: OB_EASE, useNativeDriver: true }),
        Animated.spring(rootY, { toValue: 0, ...OB_SPRING.reveal, useNativeDriver: true }),
      ]),
      Animated.timing(footerOpacity, { toValue: 1, duration: 320, easing: OB_EASE, useNativeDriver: true }),
    ]).start();
  }, [footerOpacity, rootOpacity, rootY, stepKey]);

  return (
    <Animated.View
      style={[
        styles.freeTrialStartRoot,
        {
          opacity: rootOpacity,
          transform: [{ translateY: rootY }],
          paddingBottom: bottomInset + spacing.lg,
        },
      ]}
    >
      <View style={styles.freeTrialStartContent}>
        <Text style={styles.freeTrialStartTitle}>start your 3-day FREE trial to continue</Text>

        <View style={styles.trialTimelineCard}>
          <TrialTimelineRow
            type="lock"
            title="today"
            body="unlock all of UNROT — app blocking, your personalized plan, streak tracking, and more."
          />
          <TrialTimelineRow
            type="bell"
            title="in 2 Days"
            body="we'll send you a reminder that your trial is ending soon."
          />
          <TrialTimelineRow
            type="crown"
            title="in 3 Days"
            body={`you'll be charged on ${chargeDate} unless you cancel anytime before.`}
            isLast
          />
        </View>

        <View style={styles.trialPlanRow}>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              setPlan('weekly');
            }}
            style={[
              styles.trialPlanCard,
              plan === 'weekly' ? styles.trialPlanCardSelected : null,
            ]}
          >
            <View style={[styles.trialPlanRadio, plan === 'weekly' ? styles.trialPlanRadioSelected : null]}>
              {plan === 'weekly' ? <Text style={styles.trialPlanRadioMark}>✓</Text> : null}
            </View>
            <Text style={styles.trialPlanLabel}>weekly</Text>
            <Text style={styles.trialPlanPrice}>${FREE_TRIAL_WEEKLY_PLAN_PRICE.toFixed(2)}/week</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              setPlan('yearly');
            }}
            style={[
              styles.trialPlanCard,
              styles.trialPlanCardYearly,
              plan === 'yearly' ? styles.trialPlanCardSelected : null,
            ]}
          >
            <View style={styles.trialPlanBadge}>
              <Text style={styles.trialPlanBadgeText}>3-day free trial</Text>
            </View>
            <View style={[styles.trialPlanRadio, plan === 'yearly' ? styles.trialPlanRadioSelected : null]}>
              {plan === 'yearly' ? <Text style={styles.trialPlanRadioMark}>✓</Text> : null}
            </View>
            <Text style={styles.trialPlanLabel}>yearly</Text>
            <Text style={styles.trialPlanPrice}>${FREE_TRIAL_YEARLY_PER_WEEK}/week</Text>
          </Pressable>
        </View>
      </View>

      <Animated.View style={[styles.freeTrialStartFooter, { opacity: footerOpacity }]}>
        <View style={styles.freeTrialReminderNoPayment}>
          <Text style={styles.freeTrialReminderCheck}>✓</Text>
          <Text style={styles.freeTrialReminderNoPaymentText}>No Payment Due Now</Text>
        </View>

        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onContinue();
          }}
          style={({ pressed }) => [styles.onboardingChoiceCta, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel="Start my free trial"
        >
          <Text style={styles.onboardingChoiceCtaLabel}>start my free trial</Text>
        </Pressable>

        <Text style={styles.freeTrialReminderPrice}>{trialStartFinePrint(plan)}</Text>
      </Animated.View>
    </Animated.View>
  );
}

function FreeTrialReminderBell({ size = 132 }: { size?: number }) {
  const badge = size * 0.24;
  return (
    <View style={{ width: size, height: size * 0.92, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <Svg width={size} height={size * 0.92} viewBox="0 0 132 122" fill="none">
        <Path
          d="M66 14c-14.2 0-25.8 11.2-25.8 25v18.8L24.8 86.4c-.8 1.2-.2 2.8 1.2 3.2 4.8 1.4 12.8 3.4 40 3.4s35.2-2 40-3.4c1.4-.4 2-2 .2-3.2L91.8 57.8V39c0-13.8-11.6-25-25.8-25Z"
          fill="#D8D8DC"
        />
        <Path
          d="M52.8 96.8c2.2 5.8 7.8 9.8 13.2 9.8s11-4 13.2-9.8"
          stroke="#D8D8DC"
          strokeWidth={7}
          strokeLinecap="round"
        />
      </Svg>
      <View
        style={[
          styles.freeTrialReminderBadge,
          {
            width: badge,
            height: badge,
            borderRadius: badge / 2,
            top: size * 0.04,
            right: size * 0.18,
          },
        ]}
      >
        <Text style={[styles.freeTrialReminderBadgeText, { fontSize: badge * 0.52 }]}>1</Text>
      </View>
    </View>
  );
}

export function FreeTrialReminderStep({
  stepKey,
  bottomInset,
  onContinue,
}: {
  stepKey: number;
  bottomInset: number;
  onContinue: () => void;
}) {
  const rootOpacity = useRef(new Animated.Value(0)).current;
  const rootY = useRef(new Animated.Value(14)).current;
  const bellOpacity = useRef(new Animated.Value(0)).current;
  const bellScale = useRef(new Animated.Value(0.94)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    rootOpacity.setValue(0);
    rootY.setValue(14);
    bellOpacity.setValue(0);
    bellScale.setValue(0.94);
    footerOpacity.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(rootOpacity, { toValue: 1, duration: 380, easing: OB_EASE, useNativeDriver: true }),
        Animated.spring(rootY, { toValue: 0, ...OB_SPRING.reveal, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(bellOpacity, { toValue: 1, duration: 420, easing: OB_EASE, useNativeDriver: true }),
        Animated.spring(bellScale, { toValue: 1, ...OB_SPRING.reveal, useNativeDriver: true }),
      ]),
      Animated.timing(footerOpacity, { toValue: 1, duration: 320, easing: OB_EASE, useNativeDriver: true }),
    ]).start();
  }, [bellOpacity, bellScale, footerOpacity, rootOpacity, rootY, stepKey]);

  return (
    <Animated.View
      style={[
        styles.freeTrialReminderRoot,
        {
          opacity: rootOpacity,
          transform: [{ translateY: rootY }],
          paddingBottom: bottomInset + spacing.lg,
        },
      ]}
    >
      <View style={styles.freeTrialReminderHero}>
        <Text style={styles.freeTrialReminderTitle}>
          we&apos;ll send you a reminder before your free trial ends
        </Text>

        <Animated.View
          style={[
            styles.freeTrialReminderBellWrap,
            { opacity: bellOpacity, transform: [{ scale: bellScale }] },
          ]}
        >
          <FreeTrialReminderBell size={132} />
        </Animated.View>
      </View>

      <Animated.View style={[styles.freeTrialReminderFooter, { opacity: footerOpacity }]}>
        <View style={styles.freeTrialReminderNoPayment}>
          <Text style={styles.freeTrialReminderCheck}>✓</Text>
          <Text style={styles.freeTrialReminderNoPaymentText}>No Payment Due Now</Text>
        </View>

        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onContinue();
          }}
          style={({ pressed }) => [styles.onboardingChoiceCta, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel="Continue for free"
        >
          <Text style={styles.onboardingChoiceCtaLabel}>continue for FREE</Text>
        </Pressable>

        <Text style={styles.freeTrialReminderPrice}>
          just ${FREE_TRIAL_YEARLY_PRICE.toFixed(2)} per year (${FREE_TRIAL_YEARLY_PER_WEEK}/week)
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const HOW_IT_WORKS_STEPS: ReadonlyArray<{
  text: string;
  detail?: string;
}> = [
  { text: 'log how you\u2019re feeling today' },
  { text: 'unlock your apps' },
  {
    text: 'your apps are unlocked for the time you choose,',
    detail: 'after that time they lock and you must log to unlock your apps again',
  },
];

function HowItWorksStepRow({
  index,
  text,
  detail,
  isLast,
  stepKey,
}: {
  index: number;
  text: string;
  detail?: string;
  isLast?: boolean;
  stepKey: number;
}) {
  return (
    <StaggerFade index={index + 1} resetKey={stepKey}>
      <View style={styles.howItWorksRow}>
        <View style={styles.howItWorksTrack}>
          <View style={styles.howItWorksNumber}>
            <Text style={styles.howItWorksNumberText}>{index + 1}</Text>
          </View>
          {!isLast ? <View style={styles.howItWorksConnector} /> : null}
        </View>
        <View style={styles.howItWorksCopy}>
          <Text style={styles.howItWorksText}>{text}</Text>
          {detail ? <Text style={styles.howItWorksDetail}>{detail}</Text> : null}
        </View>
      </View>
    </StaggerFade>
  );
}

export function HowItWorksStep({ stepKey }: { stepKey: number }) {
  return (
    <StepShell stepKey={stepKey} gap={24} stagger={false}>
      <StaggerFade index={0} resetKey={stepKey}>
        <Text style={styles.howItWorksTitle}>how it works</Text>
      </StaggerFade>
      <View style={styles.howItWorksCard}>
        {HOW_IT_WORKS_STEPS.map((step, index) => (
          <HowItWorksStepRow
            key={step.text}
            index={index}
            text={step.text}
            detail={step.detail}
            isLast={index === HOW_IT_WORKS_STEPS.length - 1}
            stepKey={stepKey}
          />
        ))}
      </View>
    </StepShell>
  );
}

export function MindGoalsRecapStep({
  stepKey,
  selections,
}: {
  stepKey: number;
  selections: string[];
}) {
  return (
    <StepShell stepKey={stepKey} gap={24}>
      <ChoiceStack stepKey={stepKey}>
        {selections.map((label) => (
          <RecapChoiceRow key={label} label={label} />
        ))}
      </ChoiceStack>
      <Text style={styles.recapAffirmation}>you&apos;re in the right place</Text>
    </StepShell>
  );
}

export function MultiChoiceRow({
  label,
  selected,
  onPress,
  hapticOnSelect = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  hapticOnSelect?: boolean;
}) {
  return <ChoiceRow label={label} selected={selected} onPress={onPress} hapticOnSelect={hapticOnSelect} />;
}

export function ChoiceStack({
  children,
  stepKey = 0,
  loose = false,
}: {
  children: ReactNode;
  stepKey?: number;
  loose?: boolean;
}) {
  const items = Children.toArray(children);
  return (
    <View style={[styles.choiceStack, loose ? { gap: 12 } : null]}>
      {items.map((child, index) => (
        <View key={`${stepKey}-${index}`}>{child}</View>
      ))}
    </View>
  );
}

export function AgeChoiceButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!selected) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.04, ...OB_SPRING.snap }),
      Animated.spring(scale, { toValue: 1, ...OB_SPRING.snap }),
    ]).start();
  }, [scale, selected]);

  return (
    <Pressable
      onPress={() => onPress()}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, ...OB_SPRING.press }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, ...OB_SPRING.press }).start()}
      style={styles.ageBtnWrap}
    >
      <Animated.View
        style={[
          styles.ageBtn,
          selected && styles.ageBtnSelected,
          { transform: [{ scale }] },
        ]}
      >
        <Text style={styles.ageBtnText}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function StaggerChipGrid({
  stepKey,
  children,
}: {
  stepKey: number;
  children: ReactNode;
}) {
  const items = Children.toArray(children);
  return (
    <View style={styles.chipGrid}>
      {items.map((child, index) => (
        <View key={`${stepKey}-${index}`} style={styles.chipCell}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function AnimatedHoursCaption({ text }: { text: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const y = useRef(new Animated.Value(0)).current;
  const prev = useRef(text);

  useEffect(() => {
    opacity.setValue(1);
    y.setValue(0);
  }, []);

  useEffect(() => {
    if (prev.current === text) return;
    prev.current = text;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(y, { toValue: 6, duration: 120, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) return;
      y.setValue(-6);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, easing: OB_EASE, useNativeDriver: true }),
        Animated.spring(y, { toValue: 0, ...OB_SPRING.snap }),
      ]).start();
    });
  }, [opacity, text, y]);

  return (
    <Animated.Text style={[styles.hoursCaption, { opacity, transform: [{ translateY: y }] }]}>
      {text}
    </Animated.Text>
  );
}

export function BlueprintSummaryCard({ reclaimGoal }: { reclaimGoal: number }) {
  const hours = useCountUp(reclaimGoal, 1100);

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryMetric}>
        Your customized goal is to reclaim <Text style={styles.summaryEm}>{hours}</Text> hours every 30 days
        from passive consumption.
      </Text>
    </View>
  );
}

export function AuditRecapCard({
  hours,
  topTrigger,
  protectTarget,
  reclaimGoal,
}: {
  hours: string;
  topTrigger: string;
  protectTarget: string;
  reclaimGoal: number;
}) {
  const rows = [
    { label: 'Daily scrolling', value: `${hours} hours` },
    { label: 'Strongest pull', value: topTrigger },
    { label: 'Protecting', value: protectTarget },
    { label: '30-day reclaim target', value: `${reclaimGoal} hours` },
  ];

  return (
    <View style={styles.recapCard}>
      <Text style={styles.recapKicker}>WHAT WE LEARNED</Text>
      <Gap h={16} />
      {rows.map((row) => (
        <View key={row.label} style={styles.recapRow}>
          <Text style={styles.recapLabel}>{row.label}</Text>
          <Text style={styles.recapValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function SignaturePad({
  onSignedChange,
}: {
  onSignedChange: (signed: boolean) => void;
}) {
  const [paths, setPaths] = useState<string[]>([]);
  const activePath = useRef('');
  const acceptedRef = useRef(false);
  const strokePointsRef = useRef(0);

  const markSigned = () => {
    if (acceptedRef.current) return;
    acceptedRef.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSignedChange(true);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        acceptedRef.current = false;
        strokePointsRef.current = 1;
        onSignedChange(false);
        const { locationX, locationY } = evt.nativeEvent;
        activePath.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        setPaths((prev) => [...prev, activePath.current]);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        activePath.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        strokePointsRef.current += 1;
        setPaths((prev) => {
          const next = [...prev];
          next[next.length - 1] = activePath.current;
          return next;
        });
        if (strokePointsRef.current >= 4) markSigned();
      },
      onPanResponderRelease: () => {
        if (strokePointsRef.current >= 2) markSigned();
      },
    }),
  ).current;

  const clear = () => {
    setPaths([]);
    activePath.current = '';
    acceptedRef.current = false;
    strokePointsRef.current = 0;
    onSignedChange(false);
  };

  return (
    <View>
      <View {...pan.panHandlers} style={styles.signatureSurface}>
        <Svg width="100%" height={220} viewBox="0 0 320 220" preserveAspectRatio="none">
          {paths.map((d, i) => (
            <Path
              key={i}
              d={d}
              stroke={OB.ink}
              strokeWidth={3.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
        {paths.length === 0 ? (
          <Text style={styles.signatureHint}>Sign with your finger — optional</Text>
        ) : null}
      </View>
      <Pressable onPress={clear} style={styles.signatureClear}>
        <Text style={styles.signatureClearText}>Clear</Text>
      </Pressable>
    </View>
  );
}

export function CohortProjectionChart() {
  const w = 280;
  const h = 140;
  const drift = 'M8,24 L60,38 L110,58 L160,76 L210,92 L272,102';
  const guard = 'M8,102 L60,86 L110,66 L160,48 L210,30 L272,14';
  const cohort = 'M8,96 L60,80 L110,62 L160,46 L210,32 L272,22';

  return (
    <View style={styles.chartBox}>
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        <Path d={drift} stroke={OB.secondary} strokeWidth={2} fill="none" />
        <Path d={guard} stroke={OB.ink} strokeWidth={2} fill="none" />
        <Path d={cohort} stroke={OB.insight} strokeWidth={2} strokeDasharray="4 4" fill="none" />
      </Svg>
      <Gap h={12} />
      <Text style={styles.chartLegend}>Illustrative cohort average — modeled, not live aggregate data.</Text>
    </View>
  );
}

export function SocialProofBlock() {
  return (
    <View style={styles.socialProof}>
      <Text style={styles.payBanner}>[ 2,400,000 MINUTES OF ROT PREVENTED WORLDWIDE ]</Text>
      <Gap h={20} />
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
    </View>
  );
}

export function SavePointOffer({
  onAccept,
  onDecline,
}: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <View style={styles.savePoint}>
      <SerifQuestion>Not ready to commit?</SerifQuestion>
      <Gap h={16} />
      <InsightLight>
        That is fair. Here is one quieter option before you decide — no pressure to subscribe today.
      </InsightLight>
      <Gap h={24} />
      <Pressable style={styles.planCard} onPress={onAccept}>
        <Text style={styles.planBadge}>One-time offer</Text>
        <Text style={styles.planLabel}>Annual plan</Text>
        <Text style={styles.planPrice}>$79.99 / year · ~$6.67 / month</Text>
      </Pressable>
      <Pressable onPress={onDecline} style={styles.skipBtn}>
        <Text style={styles.skipText}>Continue without subscribing</Text>
      </Pressable>
    </View>
  );
}

export function SkipForwardControl({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      return;
    }
    Animated.timing(opacity, { toValue: 1, duration: 480, easing: OB_EASE, useNativeDriver: true }).start();
  }, [opacity, visible]);

  if (!visible) return null;

  return (
    <Animated.View style={{ opacity }}>
      <Pressable onPress={onPress} style={styles.skipForwardBtn} accessibilityRole="button">
        <Text style={styles.skipForwardText}>Skip ahead</Text>
      </Pressable>
    </Animated.View>
  );
}

export function FadeInHeadline({ text }: { text: string }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [opacity, text]);

  return (
    <Animated.Text style={[styles.heyHeadline, { opacity }]}>{text}</Animated.Text>
  );
}

export function AppChip({
  code,
  brand,
  fill = OB.tile,
}: {
  code: string;
  brand?: BrandAppId;
  fill?: string;
}) {
  return (
    <View style={[styles.appChip, { backgroundColor: fill }]}>
      {brand ? (
        <BrandAppIcon name={brand} size={34} />
      ) : (
        <Text style={styles.appChipText}>{code}</Text>
      )}
    </View>
  );
}

export function SelectableAppChip({
  code,
  brand,
  selected,
  onPress,
  hapticOnSelect = false,
}: {
  code: string;
  brand?: BrandAppId;
  selected: boolean;
  onPress: () => void;
  hapticOnSelect?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!selected) return;
    Animated.timing(scale, { toValue: 1, duration: 120, easing: OB_EASE, useNativeDriver: true }).start();
  }, [scale, selected]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={code}
      onPress={() => {
        if (hapticOnSelect) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
      }}
      onPressIn={() =>
        Animated.timing(scale, { toValue: 0.94, duration: 80, easing: OB_EASE, useNativeDriver: true }).start()
      }
      onPressOut={() =>
        Animated.timing(scale, { toValue: 1, duration: 100, easing: OB_EASE, useNativeDriver: true }).start()
      }
      style={styles.chipPressable}
    >
      <Animated.View
        style={[
          styles.selectableChip,
          selected && styles.selectableChipOn,
          { transform: [{ scale }] },
        ]}
      >
        {brand ? (
          <BrandAppIcon name={brand} size={34} />
        ) : (
          <Text style={[styles.selectableChipText, selected && styles.selectableChipTextOn]}>{code}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function SelectedTargetIcons({
  targets,
}: {
  targets: ReadonlyArray<{ id: string; code: string; brand?: BrandAppId }>;
}) {
  return (
    <View style={styles.selectedTargetRow}>
      {targets.map((t) => (
        <View key={t.id} style={styles.selectedTargetChip}>
          {t.brand ? (
            <BrandAppIcon name={t.brand} size={22} />
          ) : (
            <Text style={styles.selectedTargetCode}>{t.code}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function useCountUp(value: number, durationMs = 900) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const progress = Math.min(1, (Date.now() - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(value * eased));
      if (progress >= 1) clearInterval(tick);
    }, 16);
    return () => clearInterval(tick);
  }, [durationMs, value]);

  return display;
}

function useCountUpDecimal(value: number, durationMs = 900) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const progress = Math.min(1, (Date.now() - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(value * eased * 10) / 10);
      if (progress >= 1) clearInterval(tick);
    }, 16);
    return () => clearInterval(tick);
  }, [durationMs, value]);

  return display;
}

export function UnderlineInput(props: TextInputProps) {
  const [focused, setFocused] = useState(false);
  const line = useRef(new Animated.Value(0.35)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(line, { toValue: focused || Boolean(props.value) ? 1 : 0.35, ...OB_SPRING.snap, useNativeDriver: false }),
      Animated.spring(lift, { toValue: focused ? 1 : 0, ...OB_SPRING.snap, useNativeDriver: true }),
    ]).start();
  }, [focused, line, lift, props.value]);

  const borderColor = line.interpolate({ inputRange: [0, 1], outputRange: ['#ECECEC', OB.ink] });

  return (
    <Animated.View style={{ transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] }}>
      <TextInput
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        placeholderTextColor={OB.label}
        style={[styles.underlineInput, props.style, { borderBottomColor: 'transparent' }]}
      />
      <Animated.View style={[styles.underlineBar, { opacity: line, backgroundColor: borderColor }]} />
    </Animated.View>
  );
}

export function PhoneTimeImpactStep({
  stepKey,
  name,
  hoursPerDay,
}: {
  stepKey: number;
  name: string;
  hoursPerDay: number;
}) {
  const { hoursYear, daysYear, yearsLife } = impactStats(hoursPerDay);
  const hours = useCountUp(hoursYear, 1100);
  const days = useCountUp(daysYear, 1100);
  const years = useCountUpDecimal(yearsLife, 1100);

  return (
    <StepShell stepKey={stepKey} gap={28}>
      <Text style={styles.impactLead}>
        {name}, you&apos;ll spend <Text style={styles.impactHighlight}>{hours.toLocaleString()}</Text> hours on
        your phone this year.
      </Text>
      <Text style={styles.impactLine}>
        That&apos;s <Text style={styles.impactHighlight}>{days}</Text> days..
      </Text>
      <Text style={styles.impactLine}>
        or <Text style={styles.impactHighlight}>{formatImpactYears(years)}</Text> years over your lifetime..
      </Text>
      <Text style={styles.impactQuestion}>how much of this time can you take back?</Text>
    </StepShell>
  );
}

export function TerminalLine({ text, visible }: { text: string; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    y.setValue(6);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, easing: OB_EASE, useNativeDriver: true }),
      Animated.spring(y, { toValue: 0, ...OB_SPRING.snap }),
    ]).start();
  }, [opacity, visible, y]);

  if (!visible) return null;
  return (
    <Animated.Text style={[styles.terminalLine, { opacity, transform: [{ translateY: y }] }]}>
      {text}
    </Animated.Text>
  );
}

export function StreakAchievementStep({ stepKey }: { stepKey: number }) {
  return (
    <StepShell stepKey={stepKey} gap={24}>
      <SerifQuestion>First log registered.</SerifQuestion>
      <Text style={styles.streakLabelPlain}>[ CURRENT STREAK: 01 DAYS ]</Text>
      <Gap h={20} />
      <Text style={styles.streakCalendarKicker}>LAST 14 DAYS</Text>
      <Gap h={12} />
      <StreakCalendarGrid fillCompleted />
    </StepShell>
  );
}

export function StreakDayOneCelebration({
  stepKey,
  streakHint = 'Your first flame is lit.',
}: {
  stepKey: number;
  streakHint?: string;
}) {
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const fireOpacity = useRef(new Animated.Value(0)).current;
  const fireScale = useRef(new Animated.Value(0.7)).current;
  const fireScaleY = useRef(new Animated.Value(1)).current;
  const countOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    cardOpacity.setValue(0);
    fireOpacity.setValue(0);
    fireScale.setValue(0.7);
    fireScaleY.setValue(1);
    countOpacity.setValue(0);

    Animated.timing(cardOpacity, { toValue: 1, duration: 280, easing: OB_EASE, useNativeDriver: true }).start();

    Animated.sequence([
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(fireOpacity, { toValue: 1, duration: 400, easing: OB_EASE, useNativeDriver: true }),
        Animated.timing(fireScale, { toValue: 1, duration: 400, easing: OB_EASE, useNativeDriver: true }),
      ]),
    ]).start(() => {
      let step = 0;
      const flicker = () => {
        if (step >= 7) {
          fireScaleY.setValue(1);
          return;
        }
        const target = step % 2 === 0 ? 0.97 : 1.03;
        const duration = 220 + (step % 3) * 80;
        Animated.timing(fireScaleY, {
          toValue: target,
          duration,
          easing: OB_EASE,
          useNativeDriver: true,
        }).start(() => {
          step += 1;
          flicker();
        });
      };
      flicker();
    });

    Animated.sequence([
      Animated.delay(520),
      Animated.timing(countOpacity, { toValue: 1, duration: 260, easing: OB_EASE, useNativeDriver: true }),
    ]).start();
  }, [cardOpacity, countOpacity, fireOpacity, fireScale, fireScaleY]);

  return (
    <StepShell stepKey={stepKey} gap={28} stagger={false}>
      <SerifQuestion>First log registered.</SerifQuestion>
      <Animated.View style={[styles.streakHeroCard, { opacity: cardOpacity }]}>
        <View style={styles.streakFireStage}>
          <Animated.View
            style={{
              opacity: fireOpacity,
              transform: [{ scale: fireScale }, { scaleY: fireScaleY }],
            }}
          >
            <FlameIcon size={52} />
          </Animated.View>
        </View>
        <Animated.View style={[styles.streakCountRow, { opacity: countOpacity }]}>
          <Text style={styles.streakCountNum}>1</Text>
          <View>
            <Text style={styles.streakCountLabel}>day streak</Text>
            <Text style={styles.streakCountHint}>{streakHint}</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </StepShell>
  );
}

function StreakCalendarGrid({
  celebrateToday = false,
  fillCompleted = false,
  days = 14,
}: {
  celebrateToday?: boolean;
  fillCompleted?: boolean;
  days?: number;
}) {
  const order = Array.from({ length: days }, (_, i) => (days - 1 - i));
  const useWeekLayout = days <= 7;

  return (
    <View style={useWeekLayout ? styles.streakWeekCalendar : styles.streakCalendarGrid}>
      {order.map((dayOffset, visualIndex) => (
        <View key={dayOffset} style={useWeekLayout ? styles.streakWeekColumn : undefined}>
          {useWeekLayout ? (
            <Text style={styles.streakWeekDayLabel}>{weekdayLabelForOffset(dayOffset)}</Text>
          ) : null}
          <StreakCalendarCell
            index={visualIndex}
            today={dayOffset === 0}
            celebrateToday={celebrateToday}
            fillCompleted={fillCompleted}
            isLast={visualIndex === order.length - 1}
            weekLayout={useWeekLayout}
          />
        </View>
      ))}
    </View>
  );
}

function weekdayLabelForOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2).toUpperCase();
}

function StreakCalendarCell({
  index,
  today,
  celebrateToday,
  fillCompleted,
  isLast,
  weekLayout = false,
}: {
  index: number;
  today: boolean;
  celebrateToday?: boolean;
  fillCompleted?: boolean;
  isLast?: boolean;
  weekLayout?: boolean;
}) {
  const opacity = useRef(new Animated.Value(fillCompleted ? 0 : 1)).current;
  const scale = useRef(new Animated.Value(fillCompleted ? 0.82 : 1)).current;

  useEffect(() => {
    if (!fillCompleted) return;
    opacity.setValue(0);
    scale.setValue(0.82);
    Animated.sequence([
      Animated.delay(index * 40),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, easing: OB_EASE, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 180, easing: OB_EASE, useNativeDriver: true }),
      ]),
    ]).start(() => {
      if (isLast) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
  }, [fillCompleted, index, isLast, opacity, scale]);

  return (
    <Animated.View
      style={[
        weekLayout ? styles.streakWeekCell : styles.streakCalendarCell,
        today && (celebrateToday ? styles.streakCalendarCellTodayCelebrate : styles.streakCalendarCellToday),
        fillCompleted && today && styles.streakCalendarCellTodayCelebrate,
        { opacity, transform: [{ scale }] },
      ]}
    >
      {today && celebrateToday ? <FlameIcon size={weekLayout ? 18 : 14} /> : null}
    </Animated.View>
  );
}

function FlameIcon({ size }: { size: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const outerId = `obFlameOuter-${uid}`;
  const innerId = `obFlameInner-${uid}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Defs>
        <SvgLinearGradient id={outerId} x1="12" y1="2" x2="12" y2="22">
          <Stop offset="0" stopColor="#FFB347" />
          <Stop offset="0.55" stopColor="#FF6B35" />
          <Stop offset="1" stopColor="#E85D04" />
        </SvgLinearGradient>
        <SvgLinearGradient id={innerId} x1="12" y1="8" x2="12" y2="20">
          <Stop offset="0" stopColor="#FFF3D6" />
          <Stop offset="1" stopColor="#FFB347" />
        </SvgLinearGradient>
      </Defs>
      <Path
        d="M12 2.5s-3.5 4.8-3.5 9.2c0 2.4 1.6 4.3 3.5 4.3s3.5-1.9 3.5-4.3c0-2.2-1.2-4.4-2.2-6.1.8 1.6 1.7 3.2 1.7 5.4a4.6 4.6 0 01-9.2 0C7 10.8 10.2 5.8 12 2.5z"
        fill={`url(#${outerId})`}
      />
      <Path
        d="M12 11.2c-1.1 1.6-1.8 3.1-1.8 4.8a2.8 2.8 0 005.6 0c0-1.4-.7-2.8-1.8-4.2-.3.9-.8 1.8-1.2 2.6-.4-.8-.6-1.6-.8-2.4z"
        fill={`url(#${innerId})`}
      />
    </Svg>
  );
}

export function OnboardingFooter({
  label,
  disabled,
  onPress,
  bottomInset,
  celebrate = false,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  bottomInset: number;
  celebrate?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const prevDisabled = useRef(disabled ?? false);

  useEffect(() => {
    if (prevDisabled.current && !disabled) {
      Animated.timing(scale, { toValue: 1, duration: 120, easing: OB_EASE, useNativeDriver: true }).start();
    }
    prevDisabled.current = disabled ?? false;
  }, [disabled, scale]);

  return (
    <View style={[styles.footer, { paddingBottom: bottomInset + spacing.lg }]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => {
          if (disabled) return;
          Animated.timing(scale, { toValue: 0.97, duration: 80, easing: OB_EASE, useNativeDriver: true }).start();
        }}
        onPressOut={() =>
          Animated.timing(scale, { toValue: 1, duration: 100, easing: OB_EASE, useNativeDriver: true }).start()
        }
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <View style={styles.footerBtnWrap}>
            <View
              style={[
                styles.footerBtn,
                disabled && styles.footerBtnDisabled,
                celebrate && !disabled && styles.footerBtnCelebrate,
              ]}
            >
              {celebrate && !disabled ? (
                <View style={styles.footerCelebrateRow}>
                  <FlameIcon size={16} />
                  <Text style={styles.footerBtnLabel}>{label}</Text>
                </View>
              ) : (
                <Text style={styles.footerBtnLabel}>{label}</Text>
              )}
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

export function StepShell({
  children,
  gap = 0,
  stagger = true,
  stepKey = 0,
}: {
  children: ReactNode;
  gap?: number;
  stagger?: boolean;
  stepKey?: number;
}) {
  const items = Children.toArray(children);
  return (
    <View style={[styles.stepShell, gap ? { gap } : null]}>
      {stagger
        ? items.map((child, index) => (
            <StaggerFade key={`${stepKey}-${index}`} index={index} resetKey={stepKey}>
              {child}
            </StaggerFade>
          ))
        : items}
    </View>
  );
}

const styles = StyleSheet.create({
  stepCounter: {
    alignSelf: 'flex-end',
    fontFamily: OB_FONTS.bold,
    fontSize: 11,
    color: OB.label,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2.5,
    marginBottom: 10,
  },
  progressTrack: { height: 2, borderRadius: 1, backgroundColor: unrot.choiceMuted, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 1, backgroundColor: OB.ink },
  progressHead: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: OB.ink,
  },
  progressHeadWrap: {
    position: 'absolute',
    top: -2,
    marginLeft: -3,
  },
  serifQ: {
    fontFamily: OB_FONTS.bold,
    fontSize: 28,
    lineHeight: 36,
    color: OB.ink,
    letterSpacing: -0.5,
  },
  onboardingQuestion: {
    fontFamily: OB_FONTS.bold,
    fontSize: 28,
    lineHeight: 36,
    color: OB.ink,
    letterSpacing: -0.5,
  },
  onboardingChoiceRoot: {
    flex: 1,
    minHeight: 520,
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  onboardingChoiceIntroBlock: {
    gap: 10,
  },
  onboardingChoiceKicker: {
    fontFamily: OB_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: OB.ink,
  },
  onboardingChoiceQuestion: {
    fontFamily: OB_FONTS.bold,
    fontSize: 28,
    lineHeight: 36,
    color: OB.ink,
    letterSpacing: -0.5,
  },
  insightBody: {
    fontFamily: OB_FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: OB.ink,
    letterSpacing: -0.05,
  },
  insightLight: {
    fontFamily: OB_FONTS.regular,
    fontSize: 19,
    lineHeight: 30,
    color: OB.insight,
    letterSpacing: -0.2,
  },
  bodyRegular: {
    fontFamily: OB_FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: OB.insight,
  },
  choiceRow: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: OB.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  choiceMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: OB.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceMarkText: {
    color: OB.white,
    fontSize: 13,
    fontWeight: '700',
    marginTop: -1,
  },
  choiceRowOn: { backgroundColor: OB.tile, borderColor: OB.ink },
  choiceRowPressed: { opacity: 0.96 },
  choiceRowText: {
    fontFamily: OB_FONTS.regular,
    fontSize: 15,
    lineHeight: 20,
    color: OB.ink,
    flex: 1,
  },
  recapAffirmation: {
    fontFamily: OB_FONTS.black,
    fontSize: 24,
    lineHeight: 32,
    color: OB.ink,
    letterSpacing: -0.35,
    marginTop: 8,
  },
  profileRecapThanks: {
    fontFamily: OB_FONTS.black,
    fontSize: 28,
    lineHeight: 34,
    color: OB.ink,
    letterSpacing: -0.45,
    marginBottom: 4,
  },
  snapshotRecapLead: {
    fontFamily: OB_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: OB.secondary,
  },
  profileRecapSection: {
    gap: 10,
  },
  profileRecapBox: {
    borderRadius: OB.radius,
    backgroundColor: OB.tile,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  profileRecapBoxAccent: {
    backgroundColor: OB.ink,
  },
  profileRecapLabel: {
    fontFamily: OB_FONTS.black,
    fontSize: 13,
    lineHeight: 18,
    color: OB.ink,
    letterSpacing: 0.2,
    textTransform: 'lowercase',
  },
  profileRecapDestination: {
    fontFamily: OB_FONTS.black,
    fontSize: 17,
    lineHeight: 26,
    color: OB.white,
    letterSpacing: -0.2,
  },
  profileRecapValue: {
    fontFamily: OB_FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: OB.ink,
    letterSpacing: -0.05,
  },
  profileRecapEmpty: {
    fontFamily: OB_FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: OB.secondary,
  },
  profileRecapPillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileRecapPill: {
    borderRadius: 999,
    backgroundColor: OB.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: OB.hairline,
  },
  profileRecapPillText: {
    fontFamily: OB_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: OB.ink,
    letterSpacing: -0.05,
  },
  reclaimChartCard: {
    borderRadius: OB.radius,
    backgroundColor: OB.white,
    borderWidth: 1,
    borderColor: OB.hairline,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    width: '100%',
    shadowColor: OB.ink,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  reclaimChartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  reclaimChartTitle: {
    flex: 1,
    fontFamily: OB_FONTS.black,
    fontSize: 15,
    lineHeight: 20,
    color: OB.ink,
    letterSpacing: -0.2,
  },
  reclaimChartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reclaimLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reclaimLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  reclaimLegendDotMuted: {
    backgroundColor: OB.secondary,
    opacity: 0.45,
  },
  reclaimLegendDotActive: {
    backgroundColor: OB.ink,
  },
  reclaimLegendText: {
    fontFamily: OB_FONTS.regular,
    fontSize: 11,
    lineHeight: 14,
    color: OB.secondary,
    letterSpacing: -0.05,
  },
  reclaimChartCanvas: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: OB.tile,
  },
  reclaimZoneLabel: {
    position: 'absolute',
    top: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderWidth: 1,
    borderColor: OB.hairline,
  },
  reclaimZoneLabelBefore: {
    maxWidth: '42%',
  },
  reclaimZoneLabelAfter: {
    maxWidth: '42%',
  },
  reclaimZoneLabelText: {
    fontFamily: OB_FONTS.bold,
    fontSize: 10,
    lineHeight: 12,
    color: OB.secondary,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  reclaimZoneLabelTextActive: {
    color: OB.ink,
  },
  reclaimChartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 2,
  },
  reclaimAxisY: {
    fontFamily: OB_FONTS.regular,
    fontSize: 11,
    lineHeight: 14,
    color: OB.label,
    letterSpacing: 0.15,
  },
  reclaimAxisX: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reclaimAxisXLabel: {
    fontFamily: OB_FONTS.bold,
    fontSize: 10,
    lineHeight: 12,
    color: OB.label,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  reclaimAxisXArrow: {
    fontFamily: OB_FONTS.regular,
    fontSize: 13,
    lineHeight: 13,
    color: OB.secondary,
  },
  attentionLifeIntro: {
    gap: 4,
  },
  attentionLifeEyebrow: {
    fontFamily: OB_FONTS.regular,
    fontSize: 16,
    lineHeight: 22,
    color: OB.secondary,
    letterSpacing: -0.05,
  },
  attentionLifeHeadline: {
    fontFamily: OB_FONTS.black,
    fontSize: 34,
    lineHeight: 38,
    color: OB.ink,
    letterSpacing: -0.7,
  },
  attentionLifeQuoteCard: {
    borderRadius: OB.radius,
    backgroundColor: OB.ink,
    paddingHorizontal: 22,
    paddingVertical: 22,
    gap: 6,
  },
  attentionLifeQuoteLead: {
    fontFamily: OB_FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: OB.heroMuted,
    letterSpacing: -0.05,
  },
  attentionLifeQuoteEmphasis: {
    fontFamily: OB_FONTS.black,
    fontSize: 22,
    lineHeight: 28,
    color: OB.white,
    letterSpacing: -0.3,
  },
  howItWorksTitle: {
    fontFamily: OB_FONTS.black,
    fontSize: 28,
    lineHeight: 34,
    color: OB.ink,
    letterSpacing: -0.45,
    textTransform: 'lowercase',
    marginBottom: 4,
  },
  howItWorksCard: {
    borderRadius: OB.radius,
    backgroundColor: OB.tile,
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  howItWorksRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 8,
  },
  howItWorksTrack: {
    alignItems: 'center',
    width: 34,
  },
  howItWorksNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: OB.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howItWorksNumberText: {
    fontFamily: OB_FONTS.black,
    fontSize: 14,
    lineHeight: 16,
    color: OB.white,
  },
  howItWorksConnector: {
    width: 2,
    flex: 1,
    minHeight: 28,
    marginTop: 8,
    borderRadius: 1,
    backgroundColor: 'rgba(17, 17, 17, 0.12)',
  },
  howItWorksCopy: {
    flex: 1,
    gap: 6,
    paddingTop: 5,
  },
  howItWorksText: {
    fontFamily: OB_FONTS.black,
    fontSize: 16,
    lineHeight: 24,
    color: OB.ink,
    letterSpacing: -0.15,
  },
  howItWorksDetail: {
    fontFamily: OB_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: OB.secondary,
    letterSpacing: -0.05,
  },
  choiceStack: { gap: 10 },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  chipCell: {
    width: 66,
    height: 66,
  },
  chipPressable: {
    width: '100%',
    height: '100%',
  },
  ageBtnWrap: {
    width: '47%',
  },
  ageBtn: {
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: OB.white,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  ageBtnSelected: {
    backgroundColor: OB.tile,
    borderColor: OB.ink,
  },
  ageBtnText: { fontFamily: OB_FONTS.regular, fontSize: 15, color: OB.ink },
  hoursCaption: {
    fontFamily: OB_FONTS.regular,
    fontSize: 13,
    color: OB.secondary,
    textAlign: 'center',
  },
  underlineBar: {
    height: 1,
    borderRadius: 1,
    marginTop: -1,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: OB.hairline,
    borderRadius: OB.radius,
    padding: 24,
  },
  summaryMetric: {
    fontFamily: OB_FONTS.regular,
    fontSize: 34,
    lineHeight: 42,
    color: OB.ink,
    letterSpacing: -0.4,
  },
  summaryEm: {
    fontFamily: OB_FONTS.regular,
    fontVariant: ['tabular-nums'],
  },
  appChip: {
    width: 66,
    height: 66,
    borderRadius: OB.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appChipText: {
    fontFamily: OB_FONTS.bold,
    fontSize: 12,
    color: OB.ink,
    letterSpacing: 0.5,
  },
  selectableChip: {
    width: '100%',
    height: '100%',
    borderRadius: OB.radius,
    borderWidth: 1,
    borderColor: '#ECECEC',
    backgroundColor: OB.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectableChipOn: {
    backgroundColor: OB.tile,
    borderColor: OB.tile,
  },
  selectableChipPressed: { opacity: 0.9 },
  selectableChipText: {
    fontFamily: OB_FONTS.bold,
    fontSize: 12,
    color: OB.ink,
    letterSpacing: 0.5,
  },
  selectableChipTextOn: {
    fontWeight: '800',
    letterSpacing: 1,
  },
  selectedTargetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedTargetChip: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: OB.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedTargetCode: {
    fontFamily: OB_FONTS.bold,
    fontSize: 10,
    color: OB.ink,
  },
  underlineInput: {
    fontFamily: OB_FONTS.regular,
    fontSize: 22,
    lineHeight: 30,
    color: OB.ink,
    backgroundColor: 'transparent',
    paddingVertical: 14,
    letterSpacing: -0.2,
  },
  impactLead: {
    fontFamily: OB_FONTS.regular,
    fontSize: 28,
    lineHeight: 38,
    color: OB.ink,
    letterSpacing: -0.4,
  },
  impactLine: {
    fontFamily: OB_FONTS.regular,
    fontSize: 24,
    lineHeight: 34,
    color: OB.ink,
    letterSpacing: -0.35,
  },
  impactQuestion: {
    fontFamily: OB_FONTS.regular,
    fontSize: 24,
    lineHeight: 34,
    color: OB.insight,
    letterSpacing: -0.35,
  },
  impactHighlight: {
    fontFamily: OB_FONTS.black,
    fontVariant: ['tabular-nums'],
    color: OB.ink,
  },
  terminalLine: {
    fontFamily: OB_FONTS.bold,
    fontSize: 11,
    letterSpacing: 2,
    color: OB.secondary,
    marginBottom: 12,
  },
  footer: {
    paddingHorizontal: OB.padH,
    paddingTop: spacing.lg,
    backgroundColor: unrot.bg,
  },
  footerBtnWrap: {
    position: 'relative',
  },
  footerBtn: {
    backgroundColor: OB.ink,
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  footerBtnDisabled: { opacity: 0.45 },
  footerBtnCelebrate: {
    borderWidth: 1.5,
    borderColor: OB.ink,
  },
  footerCelebrateGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: 'rgba(17, 17, 17, 0.06)',
  },
  footerCelebrateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerBtnPressed: { opacity: 0.92 },
  footerBtnLabel: {
    fontFamily: OB_FONTS.bold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: 0.1,
    color: OB.white,
  },
  stepShell: { width: '100%' },
  streakLabelPlain: {
    fontFamily: OB_FONTS.bold,
    fontSize: 14,
    letterSpacing: 2,
    color: OB.ink,
    textAlign: 'center',
  },
  streakHeroCard: {
    borderWidth: 1,
    borderColor: '#ECECEC',
    borderRadius: OB.radius,
    backgroundColor: OB.white,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  streakFireStage: {
    width: 112,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  streakFireGlow: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 107, 53, 0.18)',
  },
  streakSpark: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFB347',
  },
  streakCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  streakCountNum: {
    fontFamily: OB_FONTS.regular,
    fontSize: 56,
    lineHeight: 60,
    color: OB.ink,
    fontVariant: ['tabular-nums'],
  },
  streakCountLabel: {
    fontFamily: OB_FONTS.bold,
    fontSize: 11,
    letterSpacing: 2,
    color: OB.ink,
    textTransform: 'uppercase',
  },
  streakCountHint: {
    fontFamily: OB_FONTS.regular,
    fontSize: 13,
    color: OB.secondary,
    marginTop: 4,
  },
  streakCalendarKicker: {
    fontFamily: OB_FONTS.bold,
    fontSize: 10,
    letterSpacing: 2,
    color: OB.label,
    textAlign: 'center',
  },
  streakCalendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  streakCalendarCell: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ECECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCalendarCellToday: {
    backgroundColor: OB.ink,
    borderColor: OB.ink,
  },
  streakCalendarCellTodayCelebrate: {
    backgroundColor: OB.tile,
    borderColor: 'rgba(255, 107, 53, 0.45)',
  },
  heyHeadline: {
    fontFamily: OB_FONTS.regular,
    fontSize: 32,
    color: OB.ink,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  recapCard: {
    borderWidth: 1,
    borderColor: OB.hairline,
    borderRadius: OB.radius,
    padding: 20,
    backgroundColor: OB.white,
  },
  recapKicker: {
    fontFamily: OB_FONTS.bold,
    fontSize: 10,
    letterSpacing: 2,
    color: OB.label,
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: OB.hairline,
  },
  recapLabel: {
    flex: 1,
    fontFamily: OB_FONTS.regular,
    fontSize: 13,
    color: OB.secondary,
  },
  recapValue: {
    flex: 1,
    fontFamily: OB_FONTS.regular,
    fontSize: 13,
    color: OB.ink,
    textAlign: 'right',
  },
  signatureSurface: {
    borderWidth: 1,
    borderColor: OB.hairline,
    borderRadius: OB.radius,
    backgroundColor: OB.white,
    minHeight: 220,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  signatureHint: {
    position: 'absolute',
    alignSelf: 'center',
    fontFamily: OB_FONTS.regular,
    fontSize: 14,
    color: OB.label,
  },
  signatureClear: { alignSelf: 'flex-end', paddingVertical: 10 },
  signatureClearText: {
    fontFamily: OB_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: OB.secondary,
  },
  chartBox: {
    borderWidth: 1,
    borderColor: OB.hairline,
    borderRadius: OB.radius,
    padding: 16,
    width: '100%',
  },
  chartLegend: {
    fontFamily: OB_FONTS.regular,
    fontSize: 11,
    lineHeight: 16,
    color: OB.label,
  },
  socialProof: { width: '100%' },
  payBanner: {
    fontFamily: OB_FONTS.bold,
    fontSize: 11,
    letterSpacing: 2,
    color: OB.secondary,
    textAlign: 'center',
  },
  reviewQuote: {
    fontFamily: OB_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: OB.insight,
  },
  savePoint: { width: '100%' },
  planCard: {
    borderWidth: 1,
    borderColor: OB.hairline,
    borderRadius: OB.radius,
    padding: 20,
    marginBottom: 12,
    backgroundColor: OB.white,
  },
  planBadge: {
    fontFamily: OB_FONTS.bold,
    fontSize: 8,
    letterSpacing: 1.6,
    color: OB.ink,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  planLabel: { fontFamily: OB_FONTS.regular, fontSize: 18, color: OB.ink },
  planPrice: {
    fontFamily: OB_FONTS.bold,
    fontSize: 14,
    color: OB.ink,
    marginTop: 8,
  },
  skipBtn: { alignSelf: 'center', paddingVertical: spacing.lg },
  skipText: { fontFamily: OB_FONTS.regular, fontSize: 16, color: OB.secondary },
  skipForwardBtn: { alignSelf: 'center', paddingVertical: spacing.md },
  skipForwardText: {
    fontFamily: OB_FONTS.bold,
    fontSize: 11,
    letterSpacing: 2,
    color: OB.secondary,
    textTransform: 'uppercase',
  },
  firstLogCongrats: {
    fontFamily: OB_FONTS.bold,
    fontSize: 22,
    lineHeight: 30,
    color: OB.ink,
    textAlign: 'center',
  },
  journalPreviewCard: {
    borderRadius: 14,
    backgroundColor: OB.white,
    borderWidth: 1,
    borderColor: OB.hairline,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  journalPreviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 10,
  },
  journalPreviewMood: {
    fontFamily: OB_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: OB.secondary,
  },
  journalPreviewTime: {
    fontFamily: OB_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: OB.secondary,
    fontVariant: ['tabular-nums'],
  },
  journalPreviewHeadline: {
    fontFamily: OB_FONTS.regular,
    fontSize: 16,
    lineHeight: 23,
    color: OB.ink,
    letterSpacing: -0.14,
  },
  journalPreviewDetail: {
    marginTop: 8,
    fontFamily: OB_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: OB.label,
  },
  streakRevealTop: {
    alignItems: 'center',
    paddingTop: 8,
    gap: 6,
  },
  streakRevealFlameWrap: {
    width: 120,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  streakRevealSoftGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
  },
  streakRevealCountBlock: {
    alignItems: 'center',
    marginTop: 4,
  },
  streakRevealCountLarge: {
    fontFamily: OB_FONTS.regular,
    fontSize: 80,
    lineHeight: 84,
    color: OB.ink,
    fontVariant: ['tabular-nums'],
    letterSpacing: -3,
  },
  streakRevealCountCaption: {
    fontFamily: OB_FONTS.bold,
    fontSize: 11,
    letterSpacing: 2.8,
    color: OB.secondary,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  streakRevealTagline: {
    fontFamily: OB_FONTS.regular,
    fontSize: 17,
    lineHeight: 24,
    color: OB.insight,
    textAlign: 'center',
    marginTop: 4,
  },
  streakRevealCalendarCard: {
    width: '100%',
    borderRadius: OB.radius,
    borderWidth: 1,
    borderColor: OB.hairline,
    backgroundColor: OB.white,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  streakWeekKicker: {
    fontFamily: OB_FONTS.bold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: OB.label,
    textAlign: 'center',
  },
  streakWeekCalendar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 4,
  },
  streakWeekColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  streakWeekDayLabel: {
    fontFamily: OB_FONTS.bold,
    fontSize: 9,
    letterSpacing: 1,
    color: OB.label,
  },
  streakWeekCell: {
    width: '100%',
    maxWidth: 36,
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ECECEC',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OB.tile,
  },
  frameworkRingStage: {
    width: 152,
    height: 152,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameworkRingPercent: {
    position: 'absolute',
    fontFamily: OB_FONTS.regular,
    fontSize: 22,
    lineHeight: 28,
    color: OB.ink,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  frameworkLabel: {
    fontFamily: OB_FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: OB.secondary,
    textAlign: 'center',
  },
  transformationPlanCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: OB.ink,
    backgroundColor: OB.white,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
  },
  transformationPlanHeadline: {
    fontFamily: OB_FONTS.bold,
    fontSize: 17,
    lineHeight: 24,
    color: OB.ink,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  transformationDatePill: {
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: OB.ink,
    backgroundColor: OB.white,
  },
  transformationDateText: {
    fontFamily: OB_FONTS.regular,
    fontSize: 15,
    lineHeight: 20,
    color: OB.ink,
    textAlign: 'center',
  },
  transformationFeatureRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    width: '100%',
  },
  transformationFeatureCard: {
    flex: 1,
    backgroundColor: OB.white,
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 92,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  transformationFeatureEmoji: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 6,
  },
  transformationFeatureLabel: {
    fontFamily: OB_FONTS.regular,
    fontSize: 11,
    lineHeight: 15,
    color: OB.ink,
    textAlign: 'center',
  },
  transformationSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: OB.white,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    maxWidth: '100%',
  },
  transformationSummaryEmoji: {
    fontSize: 16,
    lineHeight: 20,
  },
  transformationSummaryText: {
    flex: 1,
    fontFamily: OB_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: OB.ink,
  },
  transformationSectionTitle: {
    fontFamily: OB_FONTS.bold,
    fontSize: 16,
    lineHeight: 22,
    color: OB.ink,
    marginTop: 4,
  },
  transformationHowRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  transformationHowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: OB.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  transformationHowEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  transformationHowCopy: {
    flex: 1,
    paddingTop: 2,
  },
  transformationHowTitle: {
    fontFamily: OB_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: OB.ink,
    marginBottom: 4,
  },
  transformationHowBody: {
    fontFamily: OB_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: OB.secondary,
  },
  transformationCtaWrap: {
    width: '100%',
    marginTop: 8,
  },
  transformationCta: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OB.ink,
  },
  transformationCtaLabel: {
    fontFamily: OB_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: OB.white,
    letterSpacing: 0.2,
  },
  freeTrialRoot: {
    flex: 1,
    minHeight: 520,
    paddingTop: spacing.sm,
    gap: spacing.xl,
    justifyContent: 'center',
  },
  freeTrialPolicyPill: {
    alignSelf: 'center',
    backgroundColor: OB.tile,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  freeTrialPolicyText: {
    fontFamily: OB_FONTS.bold,
    fontSize: 10,
    lineHeight: 14,
    color: OB.secondary,
    textAlign: 'center',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  freeTrialCompareWrap: {
    position: 'relative',
    width: '100%',
  },
  freeTrialCompareCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: OB.ink,
    backgroundColor: OB.white,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  freeTrialCompareSide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 28,
    gap: 10,
  },
  freeTrialCompareDivider: {
    width: 1.5,
    backgroundColor: OB.ink,
    opacity: 0.12,
    marginVertical: 18,
  },
  freeTrialIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: OB.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeTrialSideLabel: {
    fontFamily: OB_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: OB.ink,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  freeTrialSideHint: {
    fontFamily: OB_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: OB.secondary,
    textAlign: 'center',
  },
  freeTrialVsBadge: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -16,
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: OB.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: OB.white,
  },
  freeTrialVsBadgeText: {
    fontFamily: OB_FONTS.bold,
    fontSize: 10,
    lineHeight: 12,
    color: OB.white,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  freeTrialHeadline: {
    fontFamily: OB_FONTS.bold,
    fontSize: 28,
    lineHeight: 34,
    color: OB.ink,
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  freeTrialCta: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OB.ink,
  },
  freeTrialCtaLabel: {
    fontFamily: OB_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: OB.white,
    letterSpacing: 0.2,
  },
  onboardingChoiceCtaDisabled: {
    opacity: 0.45,
  },
  onboardingChoiceCta: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OB.ink,
  },
  onboardingChoiceCtaLabel: {
    fontFamily: OB_FONTS.bold,
    fontSize: 17,
    lineHeight: 22,
    color: OB.white,
    letterSpacing: 0.1,
  },
  lockInRoot: {
    flex: 1,
    minHeight: 520,
    justifyContent: 'space-between',
    gap: spacing.xl,
  },
  lockInHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  lockInFlameWrap: {
    width: 132,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockInGlow: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(255, 107, 53, 0.18)',
  },
  lockInHeadline: {
    fontFamily: OB_FONTS.bold,
    fontSize: 40,
    lineHeight: 46,
    color: OB.ink,
    letterSpacing: -1,
    textAlign: 'center',
  },
  lockInTagline: {
    fontFamily: OB_FONTS.regular,
    fontSize: 17,
    lineHeight: 24,
    color: OB.secondary,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 280,
  },
  snapshotPageRoot: {
    width: '100%',
    gap: spacing.lg,
  },
  snapshotHeaderBlock: {
    gap: 8,
  },
  snapshotTitle: {
    fontFamily: OB_FONTS.bold,
    fontSize: 28,
    lineHeight: 36,
    color: OB.ink,
    letterSpacing: -0.5,
  },
  snapshotStack: {
    gap: 12,
  },
  snapshotStatCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: OB.ink,
    backgroundColor: OB.white,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  snapshotStatCardAccent: {
    backgroundColor: OB.ink,
    borderColor: OB.ink,
  },
  snapshotStatLabel: {
    fontFamily: OB_FONTS.bold,
    fontSize: 11,
    lineHeight: 14,
    color: OB.secondary,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  snapshotStatLabelAccent: {
    color: 'rgba(255, 255, 255, 0.55)',
  },
  snapshotHeroValue: {
    fontFamily: OB_FONTS.bold,
    fontSize: 48,
    lineHeight: 52,
    color: OB.white,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  snapshotHeroUnit: {
    fontFamily: OB_FONTS.regular,
    fontSize: 16,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.72)',
    marginTop: -4,
  },
  snapshotHeroCaption: {
    fontFamily: OB_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 4,
  },
  snapshotStatValue: {
    fontFamily: OB_FONTS.bold,
    fontSize: 17,
    lineHeight: 24,
    color: OB.ink,
    letterSpacing: -0.2,
  },
  snapshotMeterWrap: {
    gap: 8,
    marginTop: 2,
  },
  snapshotMeterTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: OB.track,
    overflow: 'hidden',
  },
  snapshotMeterFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: OB.ink,
  },
  snapshotMeterLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  snapshotMeterEdge: {
    fontFamily: OB_FONTS.regular,
    fontSize: 11,
    lineHeight: 14,
    color: OB.secondary,
    textTransform: 'lowercase',
  },
  snapshotMeterPercent: {
    fontFamily: OB_FONTS.bold,
    fontSize: 12,
    lineHeight: 14,
    color: OB.ink,
    fontVariant: ['tabular-nums'],
  },
  snapshotEncouragement: {
    fontFamily: OB_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: OB.secondary,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginTop: 4,
  },
  screenTimeConnectRoot: {
    flex: 1,
    minHeight: 520,
    justifyContent: 'space-between',
    gap: spacing.xl,
  },
  screenTimeConnectHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingTop: spacing.md,
  },
  screenTimeConnectCopy: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  screenTimeConnectTitle: {
    fontFamily: OB_FONTS.bold,
    fontSize: 28,
    lineHeight: 34,
    color: OB.ink,
    letterSpacing: -0.45,
    textAlign: 'center',
  },
  screenTimeConnectSubtext: {
    fontFamily: OB_FONTS.regular,
    fontSize: 16,
    lineHeight: 23,
    color: OB.secondary,
    textAlign: 'center',
    maxWidth: 300,
    textTransform: 'lowercase',
  },
  screenTimeConnectIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    minHeight: 148,
  },
  screenTimeIconShadow: {
    overflow: 'hidden',
    shadowColor: '#5E5CE6',
    shadowOpacity: 0.34,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  screenTimeIconGlow: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(94, 92, 230, 0.16)',
  },
  screenTimeConnectError: {
    fontFamily: OB_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: '#C44',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  notificationsIconShadow: {
    overflow: 'hidden',
    shadowColor: '#FF3B30',
    shadowOpacity: 0.34,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  notificationsIconGlow: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(255, 59, 48, 0.14)',
  },
  freeTrialReminderRoot: {
    flex: 1,
    minHeight: 520,
    justifyContent: 'space-between',
    gap: spacing.xl,
  },
  freeTrialReminderHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingTop: spacing.md,
    paddingHorizontal: 8,
  },
  freeTrialReminderTitle: {
    fontFamily: OB_FONTS.bold,
    fontSize: 28,
    lineHeight: 36,
    color: OB.ink,
    letterSpacing: -0.45,
    textAlign: 'center',
    textTransform: 'lowercase',
    maxWidth: 320,
  },
  freeTrialReminderBellWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  freeTrialReminderBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
  },
  freeTrialReminderBadgeText: {
    fontFamily: OB_FONTS.bold,
    color: OB.white,
    lineHeight: 18,
  },
  freeTrialReminderFooter: {
    width: '100%',
    gap: 14,
    alignItems: 'center',
  },
  freeTrialReminderNoPayment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  freeTrialReminderCheck: {
    fontFamily: OB_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: OB.ink,
  },
  freeTrialReminderNoPaymentText: {
    fontFamily: OB_FONTS.bold,
    fontSize: 16,
    lineHeight: 22,
    color: OB.ink,
  },
  freeTrialReminderPrice: {
    fontFamily: OB_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: OB.secondary,
    textAlign: 'center',
  },
  freeTrialStartRoot: {
    flex: 1,
    minHeight: 520,
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  freeTrialStartContent: {
    gap: 18,
  },
  freeTrialStartTitle: {
    fontFamily: OB_FONTS.bold,
    fontSize: 28,
    lineHeight: 36,
    color: OB.ink,
    letterSpacing: -0.45,
    textAlign: 'center',
    textTransform: 'lowercase',
    paddingHorizontal: 4,
  },
  trialTimelineCard: {
    gap: 4,
    paddingTop: 4,
  },
  trialTimelineRow: {
    flexDirection: 'row',
    gap: 14,
  },
  trialTimelineTrack: {
    width: 34,
    alignItems: 'center',
  },
  trialTimelineIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OB.ink,
  },
  trialTimelineConnector: {
    width: 3,
    flex: 1,
    minHeight: 28,
    marginVertical: 4,
    borderRadius: 999,
    backgroundColor: OB.track,
  },
  trialTimelineCopy: {
    flex: 1,
    paddingBottom: 18,
    gap: 4,
  },
  trialTimelineTitle: {
    fontFamily: OB_FONTS.bold,
    fontSize: 16,
    lineHeight: 22,
    color: OB.ink,
    textTransform: 'lowercase',
  },
  trialTimelineBody: {
    fontFamily: OB_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: OB.secondary,
  },
  trialPlanRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  trialPlanCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: OB.track,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 6,
    backgroundColor: OB.white,
    minHeight: 118,
    justifyContent: 'flex-end',
  },
  trialPlanCardYearly: {
    marginTop: 12,
  },
  trialPlanCardSelected: {
    borderColor: OB.ink,
    borderWidth: 2,
  },
  trialPlanBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: OB.ink,
  },
  trialPlanBadgeText: {
    fontFamily: OB_FONTS.bold,
    fontSize: 11,
    lineHeight: 14,
    color: OB.white,
    textTransform: 'lowercase',
  },
  trialPlanRadio: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: OB.track,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OB.white,
  },
  trialPlanRadioSelected: {
    borderColor: OB.ink,
    backgroundColor: OB.ink,
  },
  trialPlanRadioMark: {
    fontFamily: OB_FONTS.bold,
    fontSize: 12,
    lineHeight: 14,
    color: OB.white,
  },
  trialPlanLabel: {
    fontFamily: OB_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: OB.ink,
    textTransform: 'lowercase',
  },
  trialPlanPrice: {
    fontFamily: OB_FONTS.regular,
    fontSize: 14,
    lineHeight: 18,
    color: OB.secondary,
  },
  freeTrialStartFooter: {
    width: '100%',
    gap: 14,
    alignItems: 'center',
  },
});
