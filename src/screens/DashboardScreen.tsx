import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
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
  formatEditorialLuxuryDangerLine,
  formatHourRangeAmPm,
  getAllLogsForAnalytics,
  type DangerZoneInsight,
  type LogEntry,
} from '../lib/reflectiveLog';
import { getReclaimedFocusSnapshot, type ReclaimedFocusSnapshot } from '../lib/reclaimedFocus';
import { getReclaimedMomentsToday } from '../lib/reclaimedMoments';
import {
  DEFAULT_RANK_STATE,
  loadRankState,
  maybeAwardDailyScreenBonus,
  toRankUiSnapshot,
  type RankUiSnapshot,
} from '../lib/rankXp';
import Svg, { Circle } from 'react-native-svg';
import { unrot, unrotFonts } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const G = unrot.gutter;

/**
 * Home — quiet editorial: sharp ink, cool neutrals, paper cards (journal unchanged).
 */
const HOME_PRIMARY = '#0A0A0A';
const HOME_SECONDARY = '#6B6B6B';
const HOME_LABEL = '#9A9A9A';
const HOME_CARD_GRADIENT = ['#FFFFFF', '#F6F5F4', '#EEECEA'] as const;
const HOME_CARD_GRADIENT_LOCATIONS = [0, 0.5, 1] as const;
const HOME_CARD_BORDER = 'rgba(10, 10, 12, 0.09)';
/** @deprecated naming — use HOME_CARD_* */
const HOME_RANK_GRADIENT = HOME_CARD_GRADIENT;
const HOME_RANK_GRADIENT_LOCATIONS = HOME_CARD_GRADIENT_LOCATIONS;
const HOME_RANK_BORDER = HOME_CARD_BORDER;
const HOME_RANK_STREAK_SURFACE = '#FFFFFF';
const HOME_RANK_STREAK_BORDER = 'rgba(10, 10, 12, 0.08)';
const HOME_HERO_GRADIENT = HOME_CARD_GRADIENT;
const HOME_HERO_GRADIENT_LOCATIONS = HOME_CARD_GRADIENT_LOCATIONS;
const HOME_HERO_BORDER = HOME_CARD_BORDER;
const HOME_METRIC_SCREEN_GRADIENT = HOME_CARD_GRADIENT;
const HOME_METRIC_SCREEN_GRADIENT_LOCATIONS = HOME_CARD_GRADIENT_LOCATIONS;
const HOME_METRIC_SCREEN_BORDER = HOME_CARD_BORDER;
const HOME_METRIC_MOMENTS_GRADIENT = HOME_CARD_GRADIENT;
const HOME_METRIC_MOMENTS_GRADIENT_LOCATIONS = HOME_CARD_GRADIENT_LOCATIONS;
const HOME_METRIC_MOMENTS_BORDER = HOME_CARD_BORDER;
const HOME_PURE_WHITE = '#FFFFFF';
/** Slight lift from cards */
const HOME_CANVAS_BG = '#FAFAFA';
/** Space below Reclaimed Time card before metric row */
const HERO_TO_METRICS_GAP = 22;

const HOME_SECTION_GAP = 20;
const HOME_PAGE_PAD_H = 24;
const HOME_RADIUS = 20;
/** Space between metric tiles and danger-zone card */
const METRICS_TO_DANGER_GAP = 22;
const LOG_TRIGGER_INK = HOME_PRIMARY;
/** Circular LOG — press-and-hold fills black ring around disc */
const LOG_FAB_SIZE = 94;
const LOG_RING_STROKE = 3.5;
const LOG_RING_R = (LOG_FAB_SIZE - LOG_RING_STROKE) / 2 - 1;
const LOG_RING_C = 2 * Math.PI * LOG_RING_R;
const LOG_RING_TRACK = 'rgba(17, 17, 17, 0.1)';
const LOG_RING_ACCENT = LOG_TRIGGER_INK;
const LOG_RING_ACCENT_DIM = 'rgba(17, 17, 17, 0.1)';
const LOG_RING_FILL_MS = 520;
const LOG_RING_RESET_MS = 320;
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
const LOG_INNER_DISC = 72;
/** Reclaimed Time (hero) label */
const HOME_METRIC_LABEL_FONT_SIZE = 10;
const HOME_METRIC_LABEL_LINE_HEIGHT = 13;
/** Screen time / Moments tile labels */
const HOME_TILE_LABEL_FONT_SIZE = 9;
const HOME_TILE_LABEL_LINE_HEIGHT = 12;

const ZERO_H_M = '0 h 0 m';

/** TODO: remove — temporary hero reclaimed display for UI review */
const TEMP_RECLAIMED_HERO_DISPLAY: string | null = '400 m';

const RECLAIMED_COUNT_MS = 600;
/** Align reclaimed-time count-up with hero segment stagger (see homeSegHero delay). */
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
    ? `Reclaimed time this week, ${spoken}, versus your onboarding baseline`
    : `Reclaimed time, ${spoken}`;
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
    marginBottom: 4,
    alignSelf: 'stretch',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  navHit: {
    paddingVertical: 8,
  },
  navSerif: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    letterSpacing: 0.35,
    color: HOME_SECONDARY,
  },
  homeDate: {
    fontFamily: unrotFonts.heroSerifItalic,
    fontSize: 16,
    lineHeight: 24,
    color: HOME_PRIMARY,
    marginBottom: 20,
    letterSpacing: 0.08,
    opacity: 0.72,
  },
  homeRankStripOuter: {
    alignSelf: 'stretch',
    marginBottom: 16,
    borderRadius: HOME_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: HOME_RANK_BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 24,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  homeRankStripPressed: {
    opacity: 0.93,
    transform: [{ scale: 0.998 }],
  },
  homeRankGradientPad: {
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  homeRankKickerLite: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 9,
    letterSpacing: 2.4,
    color: HOME_LABEL,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  homeRankHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  homeRankTitleMain: {
    flex: 1,
    minWidth: 0,
    fontFamily: unrotFonts.heroSerif,
    fontSize: 24,
    lineHeight: 28,
    color: HOME_PRIMARY,
    letterSpacing: -0.45,
  },
  homeRankStreakChip: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HOME_RANK_STREAK_SURFACE,
    borderWidth: 1,
    borderColor: HOME_RANK_STREAK_BORDER,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  homeRankStreakChipText: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    lineHeight: 16,
    color: HOME_PRIMARY,
    fontVariant: ['tabular-nums'],
  },
  homeRankSubline: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 19,
    color: HOME_SECONDARY,
    marginBottom: 16,
    opacity: 1,
  },
  homeRankXpTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(10, 10, 12, 0.08)',
    overflow: 'hidden',
  },
  homeRankXpFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: HOME_PRIMARY,
  },
  homeRankMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 12,
  },
  homeRankMetaLeft: {
    flex: 1,
    minWidth: 0,
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    lineHeight: 16,
    color: HOME_SECONDARY,
    fontVariant: ['tabular-nums'],
    opacity: 0.92,
  },
  homeRankMetaRight: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: HOME_PRIMARY,
    fontVariant: ['tabular-nums'],
    opacity: 0.45,
  },
  heroSoftOuterWrap: {
    alignSelf: 'stretch',
    borderRadius: HOME_RADIUS,
    overflow: 'hidden',
    marginBottom: HERO_TO_METRICS_GAP,
    borderWidth: 1,
    borderColor: HOME_HERO_BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 24,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  heroGradientPad: {
    paddingHorizontal: 26,
    paddingVertical: 26,
  },
  heroSubtitle: {
    marginTop: 16,
    fontFamily: unrotFonts.interRegular,
    fontSize: 14,
    lineHeight: 22,
    color: HOME_SECONDARY,
    maxWidth: 360,
    opacity: 1,
  },
  monoLabel: {
    fontFamily: unrotFonts.monoBold,
    fontSize: HOME_METRIC_LABEL_FONT_SIZE,
    lineHeight: HOME_METRIC_LABEL_LINE_HEIGHT,
    letterSpacing: 2.4,
    color: HOME_LABEL,
    marginBottom: 12,
    opacity: 1,
  },
  /** Reclaimed time — largest numeric on home */
  heroMetricValue: {
    fontFamily: unrotFonts.interLight,
    fontSize: 38,
    lineHeight: 44,
    color: HOME_PRIMARY,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.6,
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
    fontSize: 38,
    lineHeight: 44,
    color: HOME_PRIMARY,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.6,
    textShadowColor: 'rgba(255, 255, 255, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  metricsSplitRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    gap: 12,
    marginBottom: 0,
  },
  metricBoxBase: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  metricTileShellScreen: {
    flex: 1,
    minWidth: 0,
    borderRadius: HOME_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: HOME_METRIC_SCREEN_BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 18,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  metricTileShellMoments: {
    flex: 1,
    minWidth: 0,
    borderRadius: HOME_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: HOME_METRIC_MOMENTS_BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 18,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  monoLabelScreenTime: {
    fontFamily: unrotFonts.monoBold,
    fontSize: HOME_TILE_LABEL_FONT_SIZE,
    lineHeight: HOME_TILE_LABEL_LINE_HEIGHT,
    letterSpacing: 2.2,
    color: HOME_LABEL,
    textTransform: 'uppercase',
    marginBottom: 8,
    opacity: 1,
  },
  monoLabelMuted: {
    fontFamily: unrotFonts.monoBold,
    fontSize: HOME_TILE_LABEL_FONT_SIZE,
    lineHeight: HOME_TILE_LABEL_LINE_HEIGHT,
    letterSpacing: 2.2,
    color: HOME_LABEL,
    textTransform: 'uppercase',
    marginBottom: 8,
    opacity: 1,
  },
  metricStat: {
    fontFamily: unrotFonts.interLight,
    fontSize: 32,
    lineHeight: 38,
    color: HOME_PRIMARY,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.55,
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
    color: HOME_LABEL,
    opacity: 1,
  },
  insightOuter: {
    marginTop: METRICS_TO_DANGER_GAP,
    marginBottom: 0,
    alignSelf: 'stretch',
  },
  insightCardShell: {
    alignSelf: 'stretch',
    borderRadius: HOME_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: HOME_CARD_BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 18,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  insightGradientPad: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  /** Slightly under metricStat (32) so the window string fits the card calmly */
  insightDangerTime: {
    fontFamily: unrotFonts.interLight,
    fontSize: 29,
    lineHeight: 35,
    color: HOME_PRIMARY,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  insightTimePlaceholder: {
    color: HOME_SECONDARY,
    opacity: 0.55,
  },
  insightFooterCaption: {
    marginTop: 8,
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    lineHeight: 17,
    color: HOME_LABEL,
    opacity: 1,
  },
  logRitualAnchor: {
    marginTop: LOG_SECTION_TOP_MARGIN,
    flexGrow: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: LOG_ANCHOR_MIN_HEIGHT,
    backgroundColor: HOME_CANVAS_BG,
  },
  logFabHit: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: HOME_CANVAS_BG,
  },
  logFabOuter: {
    width: LOG_FAB_SIZE,
    height: LOG_FAB_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logFabRingLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logFabInnerDisc: {
    width: LOG_INNER_DISC,
    height: LOG_INNER_DISC,
    borderRadius: LOG_INNER_DISC / 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: HOME_PURE_WHITE,
    borderWidth: 1,
    borderColor: HOME_CARD_BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 14,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  logTriggerTitle: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: LOG_TRIGGER_INK,
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

function HomeRankStrip({
  rankUi,
  onOpenRank,
}: {
  rankUi: RankUiSnapshot;
  onOpenRank: () => void;
}) {
  const streakLabel = rankUi.streak === 1 ? 'day' : 'days';
  const pct = Math.round(rankUi.progress01 * 100);
  const tierSpan = rankUi.nextRank ? rankUi.nextRank.minXp - rankUi.rank.minXp : 1;
  const xpIntoTier = Math.max(0, rankUi.xp - rankUi.rank.minXp);
  const subline =
    rankUi.nextRank != null
      ? `Next rank · ${rankUi.nextRank.title}`
      : `Peak rank · ${rankUi.xp.toLocaleString()} XP earned`;
  const metaLeft = rankUi.nextRank
    ? `${xpIntoTier} / ${tierSpan} XP this tier`
    : `${rankUi.xp.toLocaleString()} XP total`;

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onOpenRank();
      }}
      style={({ pressed }) => [
        homeStyles.homeRankStripOuter,
        pressed && homeStyles.homeRankStripPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Rank ${rankUi.rank.title}. Streak ${rankUi.streak} ${streakLabel}. ${pct} percent toward next rank. ${metaLeft}. Open details.`}
      android_ripple={{ color: 'rgba(42, 37, 32, 0.08)' }}
    >
      <LinearGradient
        colors={[...HOME_RANK_GRADIENT]}
        locations={[...HOME_RANK_GRADIENT_LOCATIONS]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={homeStyles.homeRankGradientPad}
      >
        <Text style={homeStyles.homeRankKickerLite}>Rank</Text>
        <View style={homeStyles.homeRankHeaderRow}>
          <Text style={homeStyles.homeRankTitleMain} numberOfLines={1}>
            {rankUi.rank.title}
          </Text>
          <View style={homeStyles.homeRankStreakChip} importantForAccessibility="no">
            <Text style={homeStyles.homeRankStreakChipText}>
              🔥 {rankUi.streak} {streakLabel}
            </Text>
          </View>
        </View>
        <Text style={homeStyles.homeRankSubline} numberOfLines={2}>
          {subline}
        </Text>
        <View style={homeStyles.homeRankXpTrack} importantForAccessibility="no">
          <View
            style={[
              homeStyles.homeRankXpFill,
              { width: `${Math.round(rankUi.progress01 * 10000) / 100}%` },
            ]}
          />
        </View>
        <View style={homeStyles.homeRankMetaRow} importantForAccessibility="no">
          <Text style={homeStyles.homeRankMetaLeft} numberOfLines={1}>
            {metaLeft}
          </Text>
          <Text style={homeStyles.homeRankMetaRight}>{rankUi.nextRank ? `${pct}%` : 'MAX'}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function HomeTopSection({
  homeDateLine,
  onOpenJournal,
  onOpenSettings,
  rankUi,
  onOpenRank,
}: {
  homeDateLine: string;
  onOpenJournal: () => void;
  onOpenSettings: () => void;
  rankUi: RankUiSnapshot;
  onOpenRank: () => void;
}) {
  return (
    <View style={homeStyles.topSectionOpen}>
      <HomeTopNav onOpenJournal={onOpenJournal} onOpenSettings={onOpenSettings} />
      <Text style={homeStyles.homeDate}>{homeDateLine}</Text>
      <HomeRankStrip rankUi={rankUi} onOpenRank={onOpenRank} />
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
      style={homeStyles.heroSoftOuterWrap}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={reclaimedHeroAccessibilityLabel(
        displayFinal,
        screenDataAuthoritative,
        contextualLine,
      )}
    >
      <LinearGradient
        colors={[...HOME_HERO_GRADIENT]}
        locations={[...HOME_HERO_GRADIENT_LOCATIONS]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={homeStyles.heroGradientPad}
      >
        <Text style={homeStyles.monoLabel} numberOfLines={2}>
          Reclaimed Time This Week
        </Text>
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
      </LinearGradient>
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
      <View style={homeStyles.metricTileShellScreen} accessible accessibilityRole="text" accessibilityLabel={screenA11y}>
        <LinearGradient
          colors={[...HOME_METRIC_SCREEN_GRADIENT]}
          locations={[...HOME_METRIC_SCREEN_GRADIENT_LOCATIONS]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={homeStyles.metricBoxBase}
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
        </LinearGradient>
      </View>
      <View style={homeStyles.metricTileShellMoments} accessible accessibilityRole="text" accessibilityLabel={momentsA11y}>
        <LinearGradient
          colors={[...HOME_METRIC_MOMENTS_GRADIENT]}
          locations={[...HOME_METRIC_MOMENTS_GRADIENT_LOCATIONS]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={homeStyles.metricBoxBase}
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
        </LinearGradient>
      </View>
    </View>
  );
}

function HomeInsight({
  insight,
  refreshDelightNonce,
}: {
  insight: DangerZoneInsight | null;
  refreshDelightNonce: number;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  const timeLine = insight != null ? formatHourRangeAmPm(insight.startHour) : '—';
  const bottomCaption =
    insight != null
      ? 'You are more likely to rot at this time.'
      : formatEditorialLuxuryDangerLine(null);
  const accessibilityLabel =
    insight != null
      ? `Danger zone. ${timeLine}. You are more likely to rot at this time.`
      : `Danger zone. ${bottomCaption}`;

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
    <View
      style={homeStyles.insightOuter}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={homeStyles.insightCardShell}>
        <Animated.View style={{ opacity: pulse }}>
          <LinearGradient
            colors={[...HOME_CARD_GRADIENT]}
            locations={[...HOME_CARD_GRADIENT_LOCATIONS]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={homeStyles.insightGradientPad}
          >
            <Text style={homeStyles.monoLabelScreenTime} importantForAccessibility="no">
              DANGER ZONE
            </Text>
            <Text
              style={[
                homeStyles.insightDangerTime,
                insight == null ? homeStyles.insightTimePlaceholder : null,
              ]}
              importantForAccessibility="no"
              numberOfLines={2}
            >
              {timeLine}
            </Text>
            <Text style={homeStyles.insightFooterCaption} importantForAccessibility="no">
              {bottomCaption}
            </Text>
          </LinearGradient>
        </Animated.View>
      </View>
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
  const ringProgress = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(1)).current;
  const ringAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const screenReaderOnRef = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      screenReaderOnRef.current = on;
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (on) => {
      screenReaderOnRef.current = on;
    });
    return () => sub.remove();
  }, []);

  const strokeDashoffset = ringProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [LOG_RING_C, 0],
  });

  const cx = LOG_FAB_SIZE / 2;
  const ringRotate = `rotate(-90 ${cx} ${cx})`;

  const resetRing = (duration = LOG_RING_RESET_MS) => {
    ringAnimRef.current?.stop();
    ringAnimRef.current = null;
    Animated.timing(ringProgress, {
      toValue: 0,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  const onPressIn = () => {
    ringAnimRef.current?.stop();
    ringProgress.setValue(0);
    Animated.spring(fabScale, {
      toValue: 0.97,
      friction: 7,
      tension: 480,
      useNativeDriver: true,
    }).start();
    ringAnimRef.current = Animated.timing(ringProgress, {
      toValue: 1,
      duration: LOG_RING_FILL_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    ringAnimRef.current.start();
  };

  const onPressOut = () => {
    ringAnimRef.current?.stop();
    ringAnimRef.current = null;
    Animated.spring(fabScale, {
      toValue: 1,
      friction: 5,
      tension: 320,
      useNativeDriver: true,
    }).start();
    ringProgress.stopAnimation((value) => {
      if (value >= 0.93) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
        resetRing(160);
      } else {
        resetRing(220);
      }
    });
  };

  const handleAccessibilityPress = () => {
    if (!screenReaderOnRef.current) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={handleAccessibilityPress}
      hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      style={homeStyles.logFabHit}
      accessibilityRole="button"
      accessibilityLabel={
        loggedToday ? 'Log reflective entry. You have already logged today' : 'Log reflective entry. No log yet today'
      }
      accessibilityHint="Press and hold until the ring completes, then release to open log."
      android_ripple={{ color: LOG_RING_ACCENT_DIM, borderless: true, radius: Math.round(LOG_FAB_SIZE / 2) }}
    >
      <Animated.View style={[homeStyles.logFabOuter, { transform: [{ scale: fabScale }] }]}>
        <View style={homeStyles.logFabRingLayer} importantForAccessibility="no">
          <Svg width={LOG_FAB_SIZE} height={LOG_FAB_SIZE}>
            <Circle
              cx={cx}
              cy={cx}
              r={LOG_RING_R}
              stroke={LOG_RING_TRACK}
              strokeWidth={LOG_RING_STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={cx}
              cy={cx}
              r={LOG_RING_R}
              stroke={LOG_RING_ACCENT}
              strokeWidth={LOG_RING_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${LOG_RING_C} ${LOG_RING_C}`}
              strokeDashoffset={strokeDashoffset}
              transform={ringRotate}
            />
          </Svg>
        </View>
        <View style={homeStyles.logFabInnerDisc}>
          <Text style={homeStyles.logTriggerTitle}>LOG</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

type Props = {
  statsTick: number;
  onOpenSettings: () => void;
  onOpenRank: () => void;
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

export function DashboardScreen({ statsTick, onOpenSettings, onOpenRank, onStartReflectiveLog }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [view, setView] = useState<'home' | 'journal'>('home');
  /** Bumps when returning to home so reclaimed time + moments count-ups replay. */
  const [homeCountAnimNonce, setHomeCountAnimNonce] = useState(1);
  const prevViewRef = useRef(view);
  const [analytics, setAnalytics] = useState<LogEntry[]>([]);
  const [reclaimedSnapshot, setReclaimedSnapshot] =
    useState<ReclaimedFocusSnapshot | null>(null);
  const [momentsCount, setMomentsCount] = useState(0);
  const [rankUi, setRankUi] = useState<RankUiSnapshot>(() => toRankUiSnapshot(DEFAULT_RANK_STATE));
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
    await maybeAwardDailyScreenBonus(focusSnap.currentDailyUsageMinutes, focusSnap.screenDataAuthoritative);
    const rankSnap = toRankUiSnapshot(await loadRankState());
    setAnalytics(all);
    setReclaimedSnapshot(focusSnap);
    setMomentsCount(moments);
    setRankUi(rankSnap);
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
                style={[styles.scroll, { backgroundColor: HOME_CANVAS_BG }]}
                contentContainerStyle={[
                  homeStyles.column,
                  {
                    flexGrow: 1,
                    backgroundColor: HOME_CANVAS_BG,
                    paddingTop: insets.top + 18,
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
                    tintColor={HOME_PRIMARY}
                    {...(Platform.OS === 'android'
                      ? {
                          colors: [HOME_PRIMARY],
                          progressBackgroundColor: HOME_CANVAS_BG,
                        }
                      : {})}
                  />
                }
              >
                <Animated.View style={{ opacity: homeSegTop }}>
                  <HomeTopSection
                    homeDateLine={homeDateLine}
                    onOpenJournal={openJournal}
                    onOpenSettings={onOpenSettings}
                    rankUi={rankUi}
                    onOpenRank={onOpenRank}
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
                  <HomeInsight insight={dangerInsight} refreshDelightNonce={refreshDelightNonce} />
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
                <Text style={styles.journalBackSerif}>Back</Text>
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
    backgroundColor: HOME_CANVAS_BG,
  },
  fill: {
    flex: 1,
  },
  modeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  scroll: {
    flex: 1,
    backgroundColor: HOME_CANVAS_BG,
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
