import * as Haptics from 'expo-haptics';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  computeDangerZoneInsight,
  formatEditorialLuxuryDangerLineWithFeeling,
  getAllLogsForAnalytics,
  type LogEntry,
} from '../lib/reflectiveLog';
import { getReclaimedFocusSnapshot, type ReclaimedFocusSnapshot } from '../lib/reclaimedFocus';
import { getReclaimedMomentsToday } from '../lib/reclaimedMoments';
import { unrot, unrotFonts } from '../theme';

const G = unrot.gutter;

/** Home-only palette (journal unchanged). */
const HOME_PRIMARY = '#111111';
const HOME_SECONDARY = '#8A8A8A';
const HOME_LABEL = '#A0A0A0';
const HOME_SCREEN_TIME_TILE_BG = '#F2F2F2';
/** Near-black hero + pattern cards */
const HOME_INK_CARD = '#111111';
const HOME_PURE_WHITE = '#FFFFFF';
const HOME_METRIC_TILE_BORDER = 'rgba(17, 17, 17, 0.08)';
/** 24pt breathing room below dark hero before white metric row */
const HERO_TO_METRICS_GAP = 24;

const HOME_SECTION_GAP = 16;
const HOME_PAGE_PAD_H = 28;
const HOME_RADIUS = 20;
/** Space between metric tiles and editorial insight (unboxed). */
const METRICS_TO_INSIGHT_GAP = 60;
const HOME_INSIGHT_TEXT = '#333333';
const LOG_TRIGGER_INK = '#111111';
const LOG_ACCENT_BAR_W = 2;
const LOG_ACCENT_BAR_H = 20;
/** Space between insight and the ritual LOG block */
const LOG_SECTION_TOP_MARGIN = 48;
/** Minimum lift for the anchored LOG region on tall layouts */
const LOG_ANCHOR_MIN_HEIGHT = 120;
/** Extra scroll padding below LOG for thumb / home indicator */
const LOG_SCROLL_BOTTOM_COMFORT = 56;
/** After pull-to-refresh completes: hero highlight + insight pulse */
const REFRESH_HERO_GLOW_IN_MS = 140;
const REFRESH_HERO_GLOW_OUT_MS = 420;
const REFRESH_INSIGHT_DIP_MS = 160;
const REFRESH_INSIGHT_RISE_MS = 220;
const REFRESH_LINE_W = 2;
const REFRESH_LINE_H_MIN = 10;
const REFRESH_LINE_H_MAX = 32;
const REFRESH_LINE_CYCLE_MS = 480;
const LOG_RITUAL_PAD_H_REST = 16;
const LOG_RITUAL_PAD_H_PRESS = 26;
const LOG_PENDING_DOT_SIZE = 5;
/** Reclaimed Hours (hero) label */
const HOME_METRIC_LABEL_FONT_SIZE = 11;
const HOME_METRIC_LABEL_LINE_HEIGHT = 14;
/** Screen time / Moments tile labels — slightly smaller than hero */
const HOME_TILE_LABEL_FONT_SIZE = 10;
const HOME_TILE_LABEL_LINE_HEIGHT = 13;

const ZERO_H_M = '0 h 0 m';

/** TODO: remove — temporary hero reclaimed display for UI review */
const TEMP_RECLAIMED_HERO_DISPLAY: string | null = '400 m';

const RECLAIMED_COUNT_MS = 600;
/** Align reclaimed-hours count-up with hero segment stagger (see homeSegHero delay). */
const HERO_COUNT_START_DELAY_MS = 80;
/** Align moments count-up with metrics segment stagger (see homeSegMetrics delay). */
const METRICS_MOMENTS_COUNT_START_DELAY_MS = 120;

function reclaimedHeroSpoken(display: string): string {
  return display === ZERO_H_M ? 'zero hours, zero minutes' : display.replace(/h\b/g, 'hours').replace(/m\b/g, 'minutes');
}

function reclaimedHeroAccessibilityLabel(
  display: string,
  authoritative: boolean,
  contextual: string | null,
): string {
  const spoken = reclaimedHeroSpoken(display);
  let line = authoritative
    ? `Reclaimed hours this week, ${spoken}, versus your onboarding baseline`
    : `Reclaimed hours, ${spoken}`;
  if (contextual) line += `. ${contextual}`;
  return line;
}

function parseTempReclaimedMinutes(temp: string | null): number | null {
  if (temp == null) return null;
  const m = temp.match(/^([\d.]+)\s*m\b/i);
  if (m) return Number(m[1]);
  return null;
}

function formatReclaimedHeroProgress(minutes: number, tempMMode: boolean): string {
  if (minutes < 0.5) return ZERO_H_M;
  if (tempMMode) return `${Math.round(minutes)} m`;
  const h = minutes / 60;
  return h < 10 && h % 1 !== 0 ? h.toFixed(1) : String(Math.round(h * 10) / 10).replace(/\.0$/, '');
}

/** Human meaning for weekly reclaimed minutes (not shown when nearly zero). */
function reclaimedContextualSubtitle(minutes: number): string | null {
  if (minutes < 15) return null;
  if (minutes < 55) return "That's time for a real breather this week.";
  if (minutes < 100) return "That's three long walks back in your week.";
  if (minutes < 200) return "Like a long afternoon, back in your hands.";
  if (minutes < 360) return "Closer to a full workday than a coffee break.";
  if (minutes < 520) return "Equivalent to a full night's sleep.";
  return "That's serious time you earned back.";
}

const HOME_ENTRANCE_MS = 800;
const HOME_STAGGER_DUR = 720;
/** Home ↔ Journal mode cross-fade */
const MODE_CROSSFADE_MS = 440;

const homeStyles = StyleSheet.create({
  column: {
    flexGrow: 1,
  },
  topSectionOpen: {
    marginBottom: HOME_SECTION_GAP,
    alignSelf: 'stretch',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navHit: {
    paddingVertical: 6,
  },
  navSerif: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 14,
    letterSpacing: 0.15,
    color: HOME_PRIMARY,
    opacity: 0.72,
  },
  homeDate: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 20,
    color: HOME_SECONDARY,
    marginBottom: 0,
    opacity: 0.92,
  },
  heroSoftOuter: {
    backgroundColor: HOME_INK_CARD,
    borderRadius: HOME_RADIUS,
    paddingHorizontal: 30,
    paddingVertical: 30,
    marginBottom: HERO_TO_METRICS_GAP,
    alignSelf: 'stretch',
  },
  heroSubtitle: {
    marginTop: 12,
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 19,
    color: HOME_LABEL,
    maxWidth: 320,
  },
  monoLabel: {
    fontFamily: unrotFonts.monoBold,
    fontSize: HOME_METRIC_LABEL_FONT_SIZE,
    lineHeight: HOME_METRIC_LABEL_LINE_HEIGHT,
    letterSpacing: 2,
    color: HOME_SECONDARY,
    marginBottom: 12,
  },
  /** Reclaimed value — same Inter Light 34/40 as Moments / Screen time (inverted on dark card). */
  heroMetricValue: {
    fontFamily: unrotFonts.interLight,
    fontSize: 34,
    lineHeight: 40,
    color: HOME_PURE_WHITE,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  heroMetricStack: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  heroMetricGlowLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  heroMetricGlowText: {
    fontFamily: unrotFonts.interLight,
    fontSize: 34,
    lineHeight: 40,
    color: HOME_PURE_WHITE,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    textShadowColor: 'rgba(255, 255, 255, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  metricsSplitRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    gap: 16,
    marginBottom: 0,
  },
  metricBoxBase: {
    flex: 1,
    minWidth: 0,
    borderRadius: HOME_RADIUS,
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  metricTileScreenTime: {
    backgroundColor: HOME_SCREEN_TIME_TILE_BG,
  },
  metricTileMoments: {
    backgroundColor: HOME_PURE_WHITE,
    borderWidth: 1,
    borderColor: HOME_METRIC_TILE_BORDER,
  },
  monoLabelScreenTime: {
    fontFamily: unrotFonts.monoBold,
    fontSize: HOME_TILE_LABEL_FONT_SIZE,
    lineHeight: HOME_TILE_LABEL_LINE_HEIGHT,
    letterSpacing: 2,
    color: HOME_LABEL,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  monoLabelMuted: {
    fontFamily: unrotFonts.monoBold,
    fontSize: HOME_TILE_LABEL_FONT_SIZE,
    lineHeight: HOME_TILE_LABEL_LINE_HEIGHT,
    letterSpacing: 2,
    color: HOME_SECONDARY,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  metricStat: {
    fontFamily: unrotFonts.interLight,
    fontSize: 34,
    lineHeight: 40,
    color: HOME_PRIMARY,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  metricStatUnit: {
    fontFamily: unrotFonts.interLight,
    fontSize: 18,
    lineHeight: 40,
    color: HOME_SECONDARY,
  },
  metricCaption: {
    marginTop: 8,
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    lineHeight: 17,
    color: HOME_SECONDARY,
  },
  insightOuter: {
    marginTop: METRICS_TO_INSIGHT_GAP,
    marginBottom: HOME_SECTION_GAP,
    alignSelf: 'stretch',
  },
  insightBody: {
    fontFamily: unrotFonts.interLight,
    fontSize: 16,
    lineHeight: 27,
    color: HOME_INSIGHT_TEXT,
    letterSpacing: -0.05,
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  logRitualAnchor: {
    marginTop: LOG_SECTION_TOP_MARGIN,
    flexGrow: 1,
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
    minHeight: LOG_ANCHOR_MIN_HEIGHT,
  },
  logHit: {
    alignSelf: 'stretch',
  },
  logRitualSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(17, 17, 17, 0.04)',
  },
  logBarColumn: {
    alignItems: 'center',
    marginRight: 14,
    width: Math.max(LOG_ACCENT_BAR_W, LOG_PENDING_DOT_SIZE + 2),
  },
  logPendingDotSlot: {
    height: 10,
    justifyContent: 'flex-end',
    marginBottom: 5,
    alignItems: 'center',
  },
  logPendingDot: {
    width: LOG_PENDING_DOT_SIZE,
    height: LOG_PENDING_DOT_SIZE,
    borderRadius: LOG_PENDING_DOT_SIZE / 2,
    backgroundColor: LOG_TRIGGER_INK,
  },
  logAccentBar: {
    width: LOG_ACCENT_BAR_W,
    height: LOG_ACCENT_BAR_H,
    backgroundColor: LOG_TRIGGER_INK,
  },
  logTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  logTriggerTitle: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: LOG_TRIGGER_INK,
  },
  logDoneCheck: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 11,
    letterSpacing: 0.2,
    color: HOME_SECONDARY,
    marginLeft: 6,
  },
  refreshRitualLine: {
    width: REFRESH_LINE_W,
    backgroundColor: LOG_TRIGGER_INK,
    borderRadius: 1,
    alignSelf: 'center',
  },
});

/** Thin vertical bar (LOG-like) that breathes while pull-to-refresh runs */
function HomeRefreshRitualLine() {
  const height = useRef(new Animated.Value(REFRESH_LINE_H_MIN)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(height, {
          toValue: REFRESH_LINE_H_MAX,
          duration: REFRESH_LINE_CYCLE_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(height, {
          toValue: REFRESH_LINE_H_MIN,
          duration: REFRESH_LINE_CYCLE_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      height.stopAnimation();
    };
  }, [height]);

  return (
    <Animated.View
      accessible={false}
      accessibilityElementsHidden
      style={[homeStyles.refreshRitualLine, { height }]}
    />
  );
}

function HomeTopNav({
  onOpenJournal,
  onOpenSettings,
}: {
  onOpenJournal: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <View style={homeStyles.topNav}>
      <Pressable onPress={onOpenJournal} hitSlop={14} style={homeStyles.navHit}>
        <Text style={homeStyles.navSerif}>Journal</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenSettings();
        }}
        hitSlop={14}
        style={homeStyles.navHit}
      >
        <Text style={homeStyles.navSerif}>Settings</Text>
      </Pressable>
    </View>
  );
}

function HomeTopSection({
  homeDateLine,
  onOpenJournal,
  onOpenSettings,
}: {
  homeDateLine: string;
  onOpenJournal: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <View style={homeStyles.topSectionOpen}>
      <HomeTopNav onOpenJournal={onOpenJournal} onOpenSettings={onOpenSettings} />
      <Text style={homeStyles.homeDate}>{homeDateLine}</Text>
    </View>
  );
}

function HomeHeroSection({
  displayFinal,
  targetMinutes,
  tempMMode,
  screenDataAuthoritative,
  contextualLine,
  animationNonce,
  refreshDelightNonce,
}: {
  displayFinal: string;
  targetMinutes: number;
  tempMMode: boolean;
  screenDataAuthoritative: boolean;
  contextualLine: string | null;
  animationNonce: number;
  refreshDelightNonce: number;
}) {
  const [shown, setShown] = useState(() =>
    targetMinutes < 0.5 ? displayFinal : formatReclaimedHeroProgress(0, tempMMode),
  );
  const animMinutes = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const refreshGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    let listenerId: string | undefined;

    const resetBaseline = () => {
      animMinutes.setValue(0);
      scale.setValue(1);
      setShown(targetMinutes < 0.5 ? displayFinal : formatReclaimedHeroProgress(0, tempMMode));
    };

    resetBaseline();

    if (targetMinutes < 0.5) {
      return () => {
        cancelled = true;
      };
    }

    const startTimer = setTimeout(() => {
      if (cancelled) return;
      listenerId = animMinutes.addListener(({ value }) => {
        if (!cancelled) setShown(formatReclaimedHeroProgress(value, tempMMode));
      });

      Animated.timing(animMinutes, {
        toValue: targetMinutes,
        duration: RECLAIMED_COUNT_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (listenerId != null) {
          animMinutes.removeListener(listenerId);
          listenerId = undefined;
        }
        if (cancelled || !finished) return;
        setShown(displayFinal);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        scale.setValue(1.042);
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 220,
          useNativeDriver: true,
        }).start();
      });
    }, HERO_COUNT_START_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      if (listenerId != null) animMinutes.removeListener(listenerId);
      animMinutes.stopAnimation();
    };
  }, [animationNonce, targetMinutes, displayFinal, tempMMode, animMinutes, scale]);

  useEffect(() => {
    if (refreshDelightNonce < 1) return;
    refreshGlow.setValue(0);
    Animated.sequence([
      Animated.timing(refreshGlow, {
        toValue: 1,
        duration: REFRESH_HERO_GLOW_IN_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(refreshGlow, {
        toValue: 0,
        duration: REFRESH_HERO_GLOW_OUT_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [refreshDelightNonce, refreshGlow]);

  return (
    <View
      style={homeStyles.heroSoftOuter}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={reclaimedHeroAccessibilityLabel(
        displayFinal,
        screenDataAuthoritative,
        contextualLine,
      )}
    >
      <Text style={homeStyles.monoLabel}>Reclaimed Hours</Text>
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={homeStyles.heroMetricStack}>
          <Text style={homeStyles.heroMetricValue} importantForAccessibility="no">
            {shown}
          </Text>
          <Animated.View
            style={[homeStyles.heroMetricGlowLayer, { opacity: refreshGlow }]}
            pointerEvents="none"
            importantForAccessibility="no"
          >
            <Text style={homeStyles.heroMetricGlowText} importantForAccessibility="no">
              {shown}
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
      {contextualLine ? (
        <Text style={homeStyles.heroSubtitle} importantForAccessibility="no">
          {contextualLine}
        </Text>
      ) : null}
    </View>
  );
}

function HomeMetricsBand({
  screenHrsDisplay,
  momentsCount,
  animationNonce,
}: {
  screenHrsDisplay: string;
  momentsCount: number;
  animationNonce: number;
}) {
  const [shownMoments, setShownMoments] = useState(0);
  const animMoments = useRef(new Animated.Value(0)).current;
  const momentsScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    let listenerId: string | undefined;

    animMoments.setValue(0);
    momentsScale.setValue(1);
    setShownMoments(0);

    if (momentsCount <= 0) {
      return () => {
        cancelled = true;
      };
    }

    const startTimer = setTimeout(() => {
      if (cancelled) return;
      listenerId = animMoments.addListener(({ value }) => {
        if (!cancelled) {
          setShownMoments(Math.min(momentsCount, Math.max(0, Math.round(value))));
        }
      });

      Animated.timing(animMoments, {
        toValue: momentsCount,
        duration: RECLAIMED_COUNT_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (listenerId != null) {
          animMoments.removeListener(listenerId);
          listenerId = undefined;
        }
        if (cancelled || !finished) return;
        setShownMoments(momentsCount);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        momentsScale.setValue(1.042);
        Animated.spring(momentsScale, {
          toValue: 1,
          friction: 7,
          tension: 220,
          useNativeDriver: true,
        }).start();
      });
    }, METRICS_MOMENTS_COUNT_START_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      if (listenerId != null) animMoments.removeListener(listenerId);
      animMoments.stopAnimation();
    };
  }, [animationNonce, momentsCount, animMoments, momentsScale]);

  const screenTimeNeedsUnitSuffix = !screenHrsDisplay.includes(' m');
  const screenA11y = `Screen time today, ${screenHrsDisplay}`;
  const momentsA11y = `Reclaimed moments today, ${momentsCount}`;
  return (
    <View style={homeStyles.metricsSplitRow}>
      <View
        style={[homeStyles.metricBoxBase, homeStyles.metricTileScreenTime]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={screenA11y}
      >
        <Text style={homeStyles.monoLabelScreenTime} importantForAccessibility="no">
          SCREEN TIME
        </Text>
        <Text style={homeStyles.metricStat} importantForAccessibility="no">
          {screenHrsDisplay}
          {screenTimeNeedsUnitSuffix ? <Text style={homeStyles.metricStatUnit}> h</Text> : null}
        </Text>
        <Text style={homeStyles.metricCaption} importantForAccessibility="no">
          Today
        </Text>
      </View>
      <View
        style={[homeStyles.metricBoxBase, homeStyles.metricTileMoments]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={momentsA11y}
      >
        <Text style={homeStyles.monoLabelMuted} importantForAccessibility="no">
          MOMENTS
        </Text>
        <Animated.View style={{ transform: [{ scale: momentsScale }] }}>
          <Text style={homeStyles.metricStat} importantForAccessibility="no">
            {String(shownMoments)}
          </Text>
        </Animated.View>
        <Text style={homeStyles.metricCaption} importantForAccessibility="no">
          Reclaimed today
        </Text>
      </View>
    </View>
  );
}

function HomeInsight({
  dangerZoneLine,
  refreshDelightNonce,
}: {
  dangerZoneLine: string;
  refreshDelightNonce: number;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (refreshDelightNonce < 1) return;
    pulse.setValue(1);
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 0.9,
        duration: REFRESH_INSIGHT_DIP_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 1,
        duration: REFRESH_INSIGHT_RISE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [refreshDelightNonce, pulse]);

  return (
    <View style={homeStyles.insightOuter} accessible accessibilityRole="text" accessibilityLabel={dangerZoneLine}>
      <Animated.View style={{ opacity: pulse }}>
        <Text style={homeStyles.insightBody} importantForAccessibility="no">
          {dangerZoneLine}
        </Text>
      </Animated.View>
    </View>
  );
}

function HomeLogFooter({
  loggedToday,
  onPress,
}: {
  loggedToday: boolean;
  onPress: () => void;
}) {
  const padH = useRef(new Animated.Value(LOG_RITUAL_PAD_H_REST)).current;

  const expand = () => {
    Animated.spring(padH, {
      toValue: LOG_RITUAL_PAD_H_PRESS,
      useNativeDriver: false,
      friction: 5,
      tension: 300,
    }).start();
  };

  const contract = () => {
    Animated.spring(padH, {
      toValue: LOG_RITUAL_PAD_H_REST,
      useNativeDriver: false,
      friction: 6,
      tension: 200,
    }).start();
  };

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onPressIn={expand}
      onPressOut={contract}
      hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
      style={homeStyles.logHit}
      accessibilityRole="button"
      accessibilityLabel={
        loggedToday ? 'Log reflective entry. You have already logged today' : 'Log reflective entry. No log yet today'
      }
    >
      <Animated.View style={[homeStyles.logRitualSurface, { paddingHorizontal: padH }]}>
        <View style={homeStyles.logBarColumn}>
          <View style={homeStyles.logPendingDotSlot} importantForAccessibility="no">
            {!loggedToday ? <View style={homeStyles.logPendingDot} /> : null}
          </View>
          <View style={homeStyles.logAccentBar} importantForAccessibility="no" />
        </View>
        <View style={homeStyles.logTitleRow}>
          <Text style={homeStyles.logTriggerTitle}>LOG</Text>
          {loggedToday ? (
            <Text style={homeStyles.logDoneCheck} importantForAccessibility="no">
              ✓
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

type Props = {
  statsTick: number;
  onOpenSettings: () => void;
  onStartReflectiveLog: () => void;
};

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatJournalTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatJournalDayHeading(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function titleCaseWord(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function moodLabelDisplay(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => titleCaseWord(w))
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

function journalMoodLine(stateRaw: string): string {
  const raw = stateRaw.trim();
  if (raw.toUpperCase() === 'REFLECTION') return 'Reflection';
  return moodLabelDisplay(raw);
}

function JournalEntryRow({ entry }: { entry: LogEntry }) {
  const { headline, detail } = splitIntentLines(entry.intent);
  const moodLine = journalMoodLine(entry.state);

  return (
    <View style={styles.journalEntry}>
      <View style={styles.journalEntryRow}>
        <Text style={styles.journalTime}>{formatJournalTime(entry.timestamp)}</Text>
        <View style={styles.journalEntryRight}>
          <Text style={styles.journalIntent} selectable>
            {moodLine}
            {` · ${headline}`}
          </Text>
          {detail ? (
            <Text style={styles.journalIntentDetail} selectable>
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function DashboardScreen({ statsTick, onOpenSettings, onStartReflectiveLog }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [view, setView] = useState<'home' | 'journal'>('home');
  /** Bumps when returning to home so reclaimed hours + moments count-ups replay. */
  const [homeCountAnimNonce, setHomeCountAnimNonce] = useState(1);
  const prevViewRef = useRef(view);
  const [analytics, setAnalytics] = useState<LogEntry[]>([]);
  const [reclaimedSnapshot, setReclaimedSnapshot] =
    useState<ReclaimedFocusSnapshot | null>(null);
  const [momentsCount, setMomentsCount] = useState(0);
  const [homeRefreshing, setHomeRefreshing] = useState(false);
  const [refreshDelightNonce, setRefreshDelightNonce] = useState(0);

  const modeHomeOpacity = useRef(new Animated.Value(1)).current;
  const modeJournalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const toHome = view === 'home';
    Animated.parallel([
      Animated.timing(modeHomeOpacity, {
        toValue: toHome ? 1 : 0,
        duration: MODE_CROSSFADE_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(modeJournalOpacity, {
        toValue: toHome ? 0 : 1,
        duration: MODE_CROSSFADE_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [view, modeHomeOpacity, modeJournalOpacity]);

  const homeShellOpacity = useRef(new Animated.Value(0)).current;
  const homeShellY = useRef(new Animated.Value(6)).current;
  const homeSegTop = useRef(new Animated.Value(0)).current;
  const homeSegHero = useRef(new Animated.Value(0)).current;
  const homeSegMetrics = useRef(new Animated.Value(0)).current;
  const homeSegDanger = useRef(new Animated.Value(0)).current;
  const homeSegFooter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (view !== 'home') return;
    homeShellOpacity.setValue(0);
    homeShellY.setValue(6);
    homeSegTop.setValue(0);
    homeSegHero.setValue(0);
    homeSegMetrics.setValue(0);
    homeSegDanger.setValue(0);
    homeSegFooter.setValue(0);
    const ease = Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(homeShellOpacity, {
        toValue: 1,
        duration: HOME_ENTRANCE_MS,
        easing: ease,
        useNativeDriver: true,
      }),
      Animated.timing(homeShellY, {
        toValue: 0,
        duration: HOME_ENTRANCE_MS,
        easing: ease,
        useNativeDriver: true,
      }),
      Animated.timing(homeSegTop, {
        toValue: 1,
        delay: 0,
        duration: HOME_STAGGER_DUR,
        easing: ease,
        useNativeDriver: true,
      }),
      Animated.timing(homeSegHero, {
        toValue: 1,
        delay: 80,
        duration: HOME_STAGGER_DUR,
        easing: ease,
        useNativeDriver: true,
      }),
      Animated.timing(homeSegMetrics, {
        toValue: 1,
        delay: 120,
        duration: HOME_STAGGER_DUR,
        easing: ease,
        useNativeDriver: true,
      }),
      Animated.timing(homeSegDanger, {
        toValue: 1,
        delay: 160,
        duration: HOME_STAGGER_DUR,
        easing: ease,
        useNativeDriver: true,
      }),
      Animated.timing(homeSegFooter, {
        toValue: 1,
        delay: 200,
        duration: HOME_STAGGER_DUR,
        easing: ease,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    view,
    homeShellOpacity,
    homeShellY,
    homeSegTop,
    homeSegHero,
    homeSegMetrics,
    homeSegDanger,
    homeSegFooter,
  ]);

  const refresh = useCallback(async () => {
    const [all, focusSnap, moments] = await Promise.all([
      getAllLogsForAnalytics(),
      getReclaimedFocusSnapshot(),
      getReclaimedMomentsToday(),
    ]);
    setAnalytics(all);
    setReclaimedSnapshot(focusSnap);
    setMomentsCount(moments);
  }, []);

  const onHomeRefresh = useCallback(async () => {
    setHomeRefreshing(true);
    try {
      await refresh();
    } finally {
      setHomeRefreshing(false);
      setRefreshDelightNonce((n) => n + 1);
    }
  }, [refresh]);

  const journalSorted = useMemo(
    () => [...analytics].sort((a, b) => b.timestamp - a.timestamp),
    [analytics],
  );

  const loggedToday = useMemo(() => {
    const today = dayKey(Date.now());
    return analytics.some((e) => dayKey(e.timestamp) === today);
  }, [analytics]);

  const logAnchorMinHeight = useMemo(
    () => Math.max(LOG_ANCHOR_MIN_HEIGHT, Math.round(windowHeight * 0.18)),
    [windowHeight],
  );

  const dangerInsight = useMemo(() => computeDangerZoneInsight(analytics), [analytics]);

  const dangerZoneLine = useMemo(
    () => formatEditorialLuxuryDangerLineWithFeeling(dangerInsight),
    [dangerInsight],
  );

  const screenHrsDisplay = useMemo(() => {
    if (reclaimedSnapshot == null || !reclaimedSnapshot.screenDataAuthoritative) return ZERO_H_M;
    const h = reclaimedSnapshot.currentDailyUsageMinutes / 60;
    if (h < 0.05) return ZERO_H_M;
    return h < 10 && h % 1 !== 0 ? h.toFixed(1) : String(Math.round(h * 10) / 10).replace(/\.0$/, '');
  }, [reclaimedSnapshot]);

  const reclaimedHrsDisplay = useMemo(() => {
    if (TEMP_RECLAIMED_HERO_DISPLAY != null) return TEMP_RECLAIMED_HERO_DISPLAY;
    if (reclaimedSnapshot == null || !reclaimedSnapshot.screenDataAuthoritative) return ZERO_H_M;
    const m = reclaimedSnapshot.weeklyReclaimedMinutes;
    if (m == null || m < 0.5) return ZERO_H_M;
    const h = m / 60;
    return h < 10 && h % 1 !== 0 ? h.toFixed(1) : String(Math.round(h * 10) / 10).replace(/\.0$/, '');
  }, [reclaimedSnapshot]);

  const reclaimedTargetMinutes = useMemo(() => {
    const parsed = parseTempReclaimedMinutes(TEMP_RECLAIMED_HERO_DISPLAY);
    if (parsed != null) return parsed;
    if (reclaimedSnapshot == null || !reclaimedSnapshot.screenDataAuthoritative) return 0;
    const w = reclaimedSnapshot.weeklyReclaimedMinutes;
    if (w == null || w < 0.5) return 0;
    return w;
  }, [reclaimedSnapshot]);

  const reclaimedContextLine = useMemo(
    () => reclaimedContextualSubtitle(reclaimedTargetMinutes),
    [reclaimedTargetMinutes],
  );

  const reclaimedTempMMode = TEMP_RECLAIMED_HERO_DISPLAY != null;

  useEffect(() => {
    void refresh();
  }, [refresh, statsTick]);

  useEffect(() => {
    if (view === 'home' && prevViewRef.current !== 'home') {
      setHomeCountAnimNonce((n) => n + 1);
    }
    prevViewRef.current = view;
  }, [view]);

  const openJournal = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setView('journal');
    void refresh();
  };

  const homeDateLine = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
    [statsTick],
  );

  const closeJournal = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setView('home');
  };

  let lastDay = '';
  const journalBlocks = journalSorted.map((e, i) => {
    const dk = dayKey(e.timestamp);
    const isFirstOfDay = dk !== lastDay;
    if (isFirstOfDay) lastDay = dk;
    const key = `${e.timestamp}-${e.state}-${i}`;
    return (
      <Fragment key={key}>
        {isFirstOfDay ? (
          <Text
            style={[styles.journalDayHeading, i > 0 && styles.journalDayHeadingSpaced]}
            accessibilityRole="header"
          >
            {formatJournalDayHeading(e.timestamp)}
          </Text>
        ) : null}
        <JournalEntryRow entry={e} />
      </Fragment>
    );
  });

  const screenDataOk = reclaimedSnapshot?.screenDataAuthoritative === true;

  return (
    <View style={styles.root}>
      <View style={styles.fill}>
        <Animated.View
          style={[
            styles.modeLayer,
            {
              opacity: modeHomeOpacity,
              zIndex: view === 'home' ? 2 : 1,
            },
          ]}
          pointerEvents={view === 'home' ? 'box-none' : 'none'}
        >
          <Animated.View
            style={[
              styles.fill,
              {
                opacity: homeShellOpacity,
                transform: [{ translateY: homeShellY }],
              },
            ]}
          >
            <View style={styles.fill}>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                  homeStyles.column,
                  {
                    paddingTop: insets.top + 16,
                    paddingBottom: Math.max(insets.bottom, 28) + LOG_SCROLL_BOTTOM_COMFORT,
                    paddingHorizontal: HOME_PAGE_PAD_H,
                  },
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={homeRefreshing}
                    onRefresh={onHomeRefresh}
                    tintColor={HOME_PURE_WHITE}
                    {...(Platform.OS === 'android'
                      ? { colors: [HOME_PURE_WHITE], progressBackgroundColor: HOME_PURE_WHITE }
                      : {})}
                  />
                }
              >
                <Animated.View style={{ opacity: homeSegTop }}>
                  <HomeTopSection
                    homeDateLine={homeDateLine}
                    onOpenJournal={openJournal}
                    onOpenSettings={onOpenSettings}
                  />
                </Animated.View>

                <Animated.View style={{ opacity: homeSegHero }}>
                  <HomeHeroSection
                    displayFinal={reclaimedHrsDisplay}
                    targetMinutes={reclaimedTargetMinutes}
                    tempMMode={reclaimedTempMMode}
                    screenDataAuthoritative={screenDataOk}
                    contextualLine={reclaimedContextLine}
                    animationNonce={homeCountAnimNonce}
                    refreshDelightNonce={refreshDelightNonce}
                  />
                </Animated.View>

                <Animated.View style={{ opacity: homeSegMetrics }}>
                  <HomeMetricsBand
                    screenHrsDisplay={screenHrsDisplay}
                    momentsCount={momentsCount}
                    animationNonce={homeCountAnimNonce}
                  />
                </Animated.View>

                <Animated.View style={{ opacity: homeSegDanger }}>
                  <HomeInsight dangerZoneLine={dangerZoneLine} refreshDelightNonce={refreshDelightNonce} />
                </Animated.View>

                <View style={[homeStyles.logRitualAnchor, { minHeight: logAnchorMinHeight }]}>
                  <Animated.View style={{ opacity: homeSegFooter }}>
                    <HomeLogFooter loggedToday={loggedToday} onPress={onStartReflectiveLog} />
                  </Animated.View>
                </View>
              </ScrollView>
              {homeRefreshing ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: insets.top + 14,
                    left: 0,
                    right: 0,
                    alignItems: 'center',
                    zIndex: 20,
                  }}
                >
                  <HomeRefreshRitualLine />
                </View>
              ) : null}
            </View>
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.modeLayer,
            {
              opacity: modeJournalOpacity,
              zIndex: view === 'journal' ? 2 : 1,
            },
          ]}
          pointerEvents={view === 'journal' ? 'box-none' : 'none'}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.journalScroll,
              {
                paddingTop: insets.top + 16,
                paddingHorizontal: HOME_PAGE_PAD_H,
                paddingBottom: Math.max(insets.bottom, G) + 24,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.journalBackRow}>
              <Pressable onPress={closeJournal} hitSlop={12} style={styles.navHit}>
                <Text style={styles.journalBackSerif}>back</Text>
              </Pressable>
            </View>
            <Text style={styles.journalContextDate}>{homeDateLine}</Text>
            <Text style={styles.journalScreenTitle}>Journal</Text>
            {journalSorted.length === 0 ? (
              <Text style={styles.journalEmpty}>Nothing logged yet.</Text>
            ) : (
              journalBlocks
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: unrot.bg,
  },
  fill: {
    flex: 1,
  },
  modeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  scroll: {
    flex: 1,
    backgroundColor: unrot.bg,
  },
  navHit: {
    paddingVertical: 6,
  },
  journalBackRow: {
    width: '100%',
    marginBottom: 16,
  },
  /** Same calendar string as home date; serif for journal continuity */
  journalContextDate: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 13,
    lineHeight: 20,
    color: unrot.muted,
    marginBottom: 20,
    letterSpacing: 0.2,
    opacity: 0.95,
  },
  journalBackSerif: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 17,
    letterSpacing: 0.15,
    color: unrot.ink,
  },
  journalScroll: {
    flexGrow: 1,
  },
  journalScreenTitle: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 42,
    lineHeight: 48,
    color: unrot.ink,
    marginBottom: 28,
    letterSpacing: -0.5,
  },
  journalDayHeading: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 15,
    lineHeight: 22,
    color: unrot.muted,
    marginBottom: 20,
  },
  journalDayHeadingSpaced: {
    marginTop: 36,
  },
  journalEmpty: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 14,
    lineHeight: 22,
    color: unrot.muted,
  },
  journalEntry: {
    marginBottom: 32,
  },
  journalEntryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  journalTime: {
    width: 56,
    marginRight: 16,
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    lineHeight: 18,
    color: unrot.muted,
    paddingTop: 4,
  },
  journalEntryRight: {
    flex: 1,
    minWidth: 0,
  },
  journalIntent: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 16,
    lineHeight: 24,
    color: unrot.ink,
    letterSpacing: -0.15,
  },
  journalIntentDetail: {
    marginTop: 8,
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 20,
    color: unrot.muted,
  },
});
