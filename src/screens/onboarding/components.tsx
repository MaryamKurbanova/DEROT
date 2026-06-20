import * as Haptics from 'expo-haptics';
import { Children, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { OB, spacing, unrot, unrotFonts } from './tokens';
import { BrandAppIcon, type BrandAppId } from '../../components/BrandAppIcon';
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
  return <Text style={styles.serifQ}>{children}</Text>;
}

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

export function TypewriterText({ text, active, style }: { text: string; active: boolean; style?: object }) {
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
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    }, 18);
    return () => clearInterval(timer);
  }, [active, text]);

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
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!selected) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.02, ...OB_SPRING.snap }),
      Animated.spring(scale, { toValue: 1, ...OB_SPRING.snap }),
    ]).start();
  }, [scale, selected]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={() => Animated.spring(scale, { toValue: 0.985, ...OB_SPRING.press }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, ...OB_SPRING.press }).start()}
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

export function MultiChoiceRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return <ChoiceRow label={label} selected={selected} onPress={onPress} />;
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
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
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
}: {
  code: string;
  brand?: BrandAppId;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!selected) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.06, ...OB_SPRING.snap }),
      Animated.spring(scale, { toValue: 1, ...OB_SPRING.snap }),
    ]).start();
  }, [scale, selected]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={code}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={() => Animated.spring(scale, { toValue: 0.94, ...OB_SPRING.press }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, ...OB_SPRING.press }).start()}
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

export function ImpactHeroCard({
  daysYear,
  yearsLife,
}: {
  daysYear: number;
  yearsLife: number;
}) {
  const days = useCountUp(daysYear);
  const years = useCountUpDecimal(yearsLife);
  const cardScale = useRef(new Animated.Value(0.96)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, ...OB_SPRING.reveal }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 420, easing: OB_EASE, useNativeDriver: true }),
    ]).start(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    });
  }, [cardOpacity, cardScale]);

  return (
    <Animated.View style={[styles.impactCard, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
      <Text style={styles.impactKicker}>AT YOUR CURRENT PACE</Text>
      <Gap h={12} />
      <Text style={styles.impactBody}>
        You are on track to spend <Text style={styles.impactEm}>{days}</Text> days this year staring at a
        screen. That is roughly <Text style={styles.impactEm}>{years}</Text> years of your remaining
        conscious life spent processing advertisements.
      </Text>
    </Animated.View>
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
    ]).start(() => {
      void Haptics.selectionAsync();
    });
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
      <StreakCalendarGrid />
    </StepShell>
  );
}

export function StreakDayOneCelebration({ stepKey }: { stepKey: number }) {
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const fireScale = useRef(new Animated.Value(0)).current;
  const fireBob = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const countScale = useRef(new Animated.Value(0)).current;
  const countOpacity = useRef(new Animated.Value(0)).current;
  const spark1 = useRef(new Animated.Value(0)).current;
  const spark2 = useRef(new Animated.Value(0)).current;
  const spark3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    cardScale.setValue(0.92);
    cardOpacity.setValue(0);
    fireScale.setValue(0);
    countScale.setValue(0);
    countOpacity.setValue(0);
    spark1.setValue(0);
    spark2.setValue(0);
    spark3.setValue(0);

    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 420, easing: OB_EASE, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, ...OB_SPRING.reveal }),
    ]).start();

    Animated.sequence([
      Animated.delay(180),
      Animated.spring(fireScale, { toValue: 1, ...OB_SPRING.snap }),
    ]).start(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });

    Animated.sequence([
      Animated.delay(420),
      Animated.parallel([
        Animated.spring(countScale, { toValue: 1, ...OB_SPRING.snap }),
        Animated.timing(countOpacity, { toValue: 1, duration: 260, easing: OB_EASE, useNativeDriver: true }),
      ]),
    ]).start(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    });

    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(fireBob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(fireBob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    bob.start();

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 1100, easing: OB_EASE, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0, duration: 1100, easing: OB_EASE, useNativeDriver: true }),
      ]),
    );
    glow.start();

    const sparkAnim = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 700, easing: OB_EASE, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 700, easing: OB_EASE, useNativeDriver: true }),
        ]),
      );

    const s1 = sparkAnim(spark1, 0);
    const s2 = sparkAnim(spark2, 220);
    const s3 = sparkAnim(spark3, 440);
    s1.start();
    s2.start();
    s3.start();

    return () => {
      bob.stop();
      glow.stop();
      s1.stop();
      s2.stop();
      s3.stop();
    };
  }, [
    cardOpacity,
    cardScale,
    countOpacity,
    countScale,
    fireBob,
    fireScale,
    glowPulse,
    spark1,
    spark2,
    spark3,
  ]);

  const fireTranslateY = fireBob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const glowOpacity = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.62] });
  const glowScale = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });

  const sparkStyle = (v: Animated.Value, x: number, y: number) => ({
    opacity: v,
    transform: [
      { translateX: x },
      { translateY: y },
      {
        scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
      },
    ],
  });

  return (
    <StepShell stepKey={stepKey} gap={28} stagger={false}>
      <StaggerFade index={0} resetKey={stepKey}>
        <SerifQuestion>First log registered.</SerifQuestion>
      </StaggerFade>
      <StaggerFade index={1} resetKey={stepKey}>
        <Animated.View
          style={[
            styles.streakHeroCard,
            { opacity: cardOpacity, transform: [{ scale: cardScale }] },
          ]}
        >
          <View style={styles.streakFireStage}>
            <Animated.View
              style={[
                styles.streakFireGlow,
                { opacity: glowOpacity, transform: [{ scale: glowScale }] },
              ]}
            />
            <Animated.View style={[styles.streakSpark, sparkStyle(spark1, -34, -18)]} />
            <Animated.View style={[styles.streakSpark, sparkStyle(spark2, 36, -24)]} />
            <Animated.View style={[styles.streakSpark, sparkStyle(spark3, 8, -38)]} />
            <Animated.View
              style={{
                transform: [{ scale: fireScale }, { translateY: fireTranslateY }],
              }}
            >
              <FlameIcon size={52} />
            </Animated.View>
          </View>
          <Animated.View
            style={[
              styles.streakCountRow,
              { opacity: countOpacity, transform: [{ scale: countScale }] },
            ]}
          >
            <Text style={styles.streakCountNum}>1</Text>
            <View>
              <Text style={styles.streakCountLabel}>day streak</Text>
              <Text style={styles.streakCountHint}>Your first flame is lit.</Text>
            </View>
          </Animated.View>
        </Animated.View>
      </StaggerFade>
      <StaggerFade index={2} resetKey={stepKey}>
        <Text style={styles.streakCalendarKicker}>LAST 14 DAYS</Text>
        <Gap h={12} />
        <StreakCalendarGrid celebrateToday />
      </StaggerFade>
    </StepShell>
  );
}

function StreakCalendarGrid({ celebrateToday = false }: { celebrateToday?: boolean }) {
  const cells = Array.from({ length: 14 }, (_, i) => i);
  return (
    <View style={styles.streakCalendarGrid}>
      {cells.map((i) => (
        <StreakCalendarCell key={i} index={i} today={i === 0} celebrateToday={celebrateToday} />
      ))}
    </View>
  );
}

function StreakCalendarCell({
  index,
  today,
  celebrateToday,
}: {
  index: number;
  today: boolean;
  celebrateToday?: boolean;
}) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scale.setValue(0);
    Animated.sequence([
      Animated.delay(index * 42),
      Animated.spring(scale, { toValue: 1, ...OB_SPRING.snap }),
    ]).start(() => {
      if (!today) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.16, ...OB_SPRING.snap }),
        Animated.spring(scale, { toValue: 1, ...OB_SPRING.snap }),
      ]).start();
    });
  }, [index, scale, today]);

  return (
    <Animated.View
      style={[
        styles.streakCalendarCell,
        today && (celebrateToday ? styles.streakCalendarCellTodayCelebrate : styles.streakCalendarCellToday),
        { transform: [{ scale }] },
      ]}
    >
      {today && celebrateToday ? <FlameIcon size={14} /> : null}
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
        <LinearGradient id={outerId} x1="12" y1="2" x2="12" y2="22">
          <Stop offset="0" stopColor="#FFB347" />
          <Stop offset="0.55" stopColor="#FF6B35" />
          <Stop offset="1" stopColor="#E85D04" />
        </LinearGradient>
        <LinearGradient id={innerId} x1="12" y1="8" x2="12" y2="20">
          <Stop offset="0" stopColor="#FFF3D6" />
          <Stop offset="1" stopColor="#FFB347" />
        </LinearGradient>
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
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!celebrate || disabled) {
      glow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, easing: OB_EASE, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 900, easing: OB_EASE, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [celebrate, disabled, glow]);

  useEffect(() => {
    if (prevDisabled.current && !disabled) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.03, ...OB_SPRING.unlock }),
        Animated.spring(scale, { toValue: 1, ...OB_SPRING.unlock }),
      ]).start();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    prevDisabled.current = disabled ?? false;
  }, [disabled, scale]);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <View style={[styles.footer, { paddingBottom: bottomInset + spacing.lg }]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => {
          if (disabled) return;
          void Haptics.impactAsync(
            celebrate ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
          );
          Animated.spring(scale, { toValue: 0.97, ...OB_SPRING.press }).start();
        }}
        onPressOut={() => Animated.spring(scale, { toValue: 1, ...OB_SPRING.press }).start()}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <View style={styles.footerBtnWrap}>
            {celebrate && !disabled ? (
              <Animated.View
                style={[
                  styles.footerCelebrateGlow,
                  { opacity: glowOpacity, transform: [{ scale: glowScale }] },
                ]}
              />
            ) : null}
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
    fontFamily: unrotFonts.monoBold,
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
    fontFamily: unrotFonts.heroSerif,
    fontSize: 18,
    lineHeight: 26,
    color: OB.ink,
    letterSpacing: -0.2,
  },
  insightBody: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 15,
    lineHeight: 24,
    color: OB.ink,
    letterSpacing: -0.05,
  },
  insightLight: {
    fontFamily: unrotFonts.interLight,
    fontSize: 19,
    lineHeight: 30,
    color: OB.insight,
    letterSpacing: -0.2,
  },
  bodyRegular: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 15,
    lineHeight: 24,
    color: OB.insight,
  },
  choiceRow: {
    borderRadius: OB.radius,
    borderWidth: 1,
    borderColor: '#ECECEC',
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: OB.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  choiceMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: OB.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceMarkText: {
    color: OB.white,
    fontSize: 12,
    fontWeight: '700',
    marginTop: -1,
  },
  choiceRowOn: { backgroundColor: OB.tile, borderColor: OB.tile },
  choiceRowPressed: { opacity: 0.9 },
  choiceRowText: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 14,
    color: OB.ink,
    letterSpacing: -0.05,
    flex: 1,
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
    borderRadius: OB.radius,
    alignItems: 'center',
    backgroundColor: OB.white,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  ageBtnSelected: {
    backgroundColor: OB.tile,
    borderColor: OB.tile,
  },
  ageBtnText: { fontFamily: unrotFonts.heroSerif, fontSize: 15, color: OB.ink },
  hoursCaption: {
    fontFamily: unrotFonts.interRegular,
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
    fontFamily: unrotFonts.interLight,
    fontSize: 34,
    lineHeight: 42,
    color: OB.ink,
    letterSpacing: -0.4,
  },
  summaryEm: {
    fontFamily: unrotFonts.interLight,
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
    fontFamily: unrotFonts.monoBold,
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
    fontFamily: unrotFonts.monoBold,
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
    fontFamily: unrotFonts.monoBold,
    fontSize: 10,
    color: OB.ink,
  },
  underlineInput: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 22,
    lineHeight: 30,
    color: OB.ink,
    backgroundColor: 'transparent',
    paddingVertical: 14,
    letterSpacing: -0.2,
  },
  impactCard: {
    backgroundColor: OB.hero,
    borderRadius: OB.radius,
    padding: 28,
  },
  impactKicker: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 10,
    letterSpacing: 2,
    color: OB.heroMuted,
    textTransform: 'uppercase',
  },
  impactBody: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 16,
    lineHeight: 26,
    color: OB.white,
  },
  impactEm: {
    fontFamily: unrotFonts.interLight,
    fontVariant: ['tabular-nums'],
  },
  terminalLine: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 11,
    letterSpacing: 2,
    color: OB.secondary,
    marginBottom: 12,
  },
  footer: {
    paddingHorizontal: OB.padH,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: OB.hairline,
    paddingTop: spacing.lg,
    backgroundColor: unrot.bg,
  },
  footerBtnWrap: {
    position: 'relative',
  },
  footerBtn: {
    backgroundColor: OB.ink,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  footerBtnDisabled: { opacity: 0.38 },
  footerBtnCelebrate: {
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.35)',
  },
  footerCelebrateGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 107, 53, 0.22)',
  },
  footerCelebrateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerBtnPressed: { opacity: 0.92 },
  footerBtnLabel: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 14,
    letterSpacing: 1.2,
    color: OB.white,
  },
  stepShell: { width: '100%' },
  streakLabelPlain: {
    fontFamily: unrotFonts.monoBold,
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
    fontFamily: unrotFonts.interLight,
    fontSize: 56,
    lineHeight: 60,
    color: OB.ink,
    fontVariant: ['tabular-nums'],
  },
  streakCountLabel: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 11,
    letterSpacing: 2,
    color: OB.ink,
    textTransform: 'uppercase',
  },
  streakCountHint: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    color: OB.secondary,
    marginTop: 4,
  },
  streakCalendarKicker: {
    fontFamily: unrotFonts.monoBold,
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
});
