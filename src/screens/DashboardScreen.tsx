import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
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
  formatEditorialLuxuryDangerLine,
  formatHourRangeAmPm,
  getAllLogsForAnalytics,
  type DangerZoneInsight,
  type LogEntry,
} from '../lib/reflectiveLog';
import { ScreenTimeMetricTile } from '../components/ScreenTimeMetricTile';
import {
  fetchTodayScreenTimeWithRetry,
  hasDerotActivitySelection,
  isIosScreenTimeApproved,
  readIosScreenTimeUiSnapshot,
  readIosTrackingFlags,
  setScreenTimeRuntimeReady,
  syncDerotUsageFromPhone,
  tryEnsureDerotScreenTimeTracking,
  type ScreenTimeFetchMode,
} from '../lib/derotIosScreenTime';
import { formatScreenTimeScopeLabel, readDerotSelectionMeta } from '../lib/derotSelectionMeta';
import { formatScreenTimeDisplay } from '../lib/screenTimeDisplay';
import { getHomeSyncedTodayMinutes } from '../lib/screenTimeHomeSync';
import { getReclaimedFocusSnapshot, type ReclaimedFocusSnapshot } from '../lib/reclaimedFocus';
import { getReclaimedMomentsToday } from '../lib/reclaimedMoments';
import {
  DEFAULT_RANK_STATE,
  loadRankState,
  maybeAwardDailyScreenBonus,
  toRankUiSnapshot,
  type RankUiSnapshot,
} from '../lib/rankXp';
import { HomeLogFooter } from '../components/HomeLogButton';
import { unrot, unrotFonts } from '../theme';

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
const HOME_METRIC_SCREEN_GRADIENT = HOME_CARD_GRADIENT;
const HOME_METRIC_SCREEN_GRADIENT_LOCATIONS = HOME_CARD_GRADIENT_LOCATIONS;
const HOME_METRIC_SCREEN_BORDER = HOME_CARD_BORDER;
const HOME_METRIC_MOMENTS_GRADIENT = HOME_CARD_GRADIENT;
const HOME_METRIC_MOMENTS_GRADIENT_LOCATIONS = HOME_CARD_GRADIENT_LOCATIONS;
const HOME_METRIC_MOMENTS_BORDER = HOME_CARD_BORDER;
const HOME_PURE_WHITE = '#FFFFFF';
/** Slight lift from cards */
const HOME_CANVAS_BG = '#FAFAFA';

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
/** After pull-to-refresh completes: insight pulse */
const REFRESH_INSIGHT_DIP_MS = 160;
const REFRESH_INSIGHT_RISE_MS = 220;
const REFRESH_LINE_W = 2;
const REFRESH_LINE_H_MIN = 10;
const REFRESH_LINE_H_MAX = 32;
const REFRESH_LINE_CYCLE_MS = 480;
const LOG_INNER_DISC = 72;
const HOME_TILE_LABEL_FONT_SIZE = 9;
const HOME_TILE_LABEL_LINE_HEIGHT = 12;
const RECLAIMED_COUNT_MS = 600;
const METRICS_MOMENTS_COUNT_START_DELAY_MS = 120;
const HOME_ENTRANCE_MS = 800;
const HOME_STAGGER_DUR = 720;
/** Home ↔ Journal mode cross-fade */
const MODE_CROSSFADE_MS = 440;

const homeStyles = StyleSheet.create({
  column: {
    flexGrow: 1,
  },
  topSectionOpen: {
    marginBottom: 22,
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

function HomeMetricsBand({
  screenHrsDisplay,
  screenTimeCaption,
  momentsCount,
  animationNonce,
}: {
  screenHrsDisplay: string;
  screenTimeCaption: string;
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

  const screenTimeNeedsUnitSuffix =
    screenHrsDisplay !== '…' &&
    screenHrsDisplay !== '—' &&
    screenHrsDisplay !== '0m' &&
    !/\d+min|\d+h\b/.test(screenHrsDisplay);
  const screenA11y = `Screen time today, ${screenHrsDisplay}`;
  const momentsA11y = `Reclaimed moments today, ${momentsCount}`;
  return (
    <View style={homeStyles.metricsSplitRow}>
      <View style={homeStyles.metricTileShellScreen}>
        <ScreenTimeMetricTile
          screenHrsDisplay={screenHrsDisplay}
          screenTimeCaption={screenTimeCaption}
          screenTimeNeedsUnitSuffix={screenTimeNeedsUnitSuffix}
          screenA11y={screenA11y}
          gradientColors={HOME_METRIC_SCREEN_GRADIENT}
          gradientLocations={HOME_METRIC_SCREEN_GRADIENT_LOCATIONS}
          styles={{
            metricBoxBase: homeStyles.metricBoxBase,
            monoLabelScreenTime: homeStyles.monoLabelScreenTime,
            metricStat: homeStyles.metricStat,
            metricStatUnit: homeStyles.metricStatUnit,
            metricCaption: homeStyles.metricCaption,
          }}
        />
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

type Props = {
  statsTick: number;
  homeSyncedMinutes?: number;
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
    <View style={styles.journalEntryCard}>
      <View style={styles.journalEntryTopRow}>
        <Text style={styles.journalMoodChip}>{moodLine}</Text>
        <Text style={styles.journalTime}>{formatJournalTime(entry.timestamp)}</Text>
      </View>
      <Text style={styles.journalIntentHeadline} selectable>
        {headline}
      </Text>
      {detail ? (
        <Text style={styles.journalIntentDetail} selectable>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

export function DashboardScreen({
  statsTick,
  homeSyncedMinutes = 0,
  onOpenSettings,
  onOpenRank,
  onStartReflectiveLog,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [view, setView] = useState<'home' | 'journal'>('home');
  /** Bumps when returning to home so moments count-ups replay. */
  const [homeCountAnimNonce, setHomeCountAnimNonce] = useState(1);
  const prevViewRef = useRef(view);
  const [analytics, setAnalytics] = useState<LogEntry[]>([]);
  const [reclaimedSnapshot, setReclaimedSnapshot] = useState<ReclaimedFocusSnapshot | null>(null);
  const [momentsCount, setMomentsCount] = useState(0);
  const [rankUi, setRankUi] = useState<RankUiSnapshot>(() => toRankUiSnapshot(DEFAULT_RANK_STATE));
  const [homeRefreshing, setHomeRefreshing] = useState(false);
  const [refreshDelightNonce, setRefreshDelightNonce] = useState(0);
  const loadRunningRef = useRef(false);
  const loadQueueRef = useRef(Promise.resolve());
  const [iosScreenUi, setIosScreenUi] = useState(() => {
    const snap = readIosScreenTimeUiSnapshot();
    return {
      trackingStarted: snap.trackingStarted,
      hasSelection: snap.hasSelection,
      scopeLabel:
        Platform.OS === 'ios'
          ? formatScreenTimeScopeLabel(readDerotSelectionMeta())
          : 'Today',
    };
  });

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

  const homeShellOpacity = useRef(new Animated.Value(1)).current;
  const homeShellY = useRef(new Animated.Value(0)).current;
  const homeSegTop = useRef(new Animated.Value(1)).current;
  const homeSegMetrics = useRef(new Animated.Value(1)).current;
  const homeSegDanger = useRef(new Animated.Value(1)).current;
  const homeSegFooter = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (view !== 'home') return;
    const fromJournal = prevViewRef.current === 'journal';
    if (!fromJournal) {
      homeShellOpacity.setValue(1);
      homeShellY.setValue(0);
      homeSegTop.setValue(1);
      homeSegMetrics.setValue(1);
      homeSegDanger.setValue(1);
      homeSegFooter.setValue(1);
      return;
    }
    homeShellOpacity.setValue(0);
    homeShellY.setValue(6);
    homeSegTop.setValue(0);
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
      Animated.timing(homeSegMetrics, {
        toValue: 1,
        delay: 80,
        duration: HOME_STAGGER_DUR,
        easing: ease,
        useNativeDriver: true,
      }),
      Animated.timing(homeSegDanger, {
        toValue: 1,
        delay: 120,
        duration: HOME_STAGGER_DUR,
        easing: ease,
        useNativeDriver: true,
      }),
      Animated.timing(homeSegFooter, {
        toValue: 1,
        delay: 160,
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
    homeSegMetrics,
    homeSegDanger,
    homeSegFooter,
  ]);

  const performDashboardDataLoad = useCallback(async (screenTimeDeep: boolean, fetchMode: ScreenTimeFetchMode = 'standard') => {
    try {
      const syncedToday = Platform.OS === 'ios' ? Math.max(homeSyncedMinutes, getHomeSyncedTodayMinutes()) : 0;
      if (Platform.OS === 'ios') {
        setScreenTimeRuntimeReady(true);
        if (screenTimeDeep) {
          try {
            await tryEnsureDerotScreenTimeTracking();
          } catch {
            /* monitoring optional */
          }
        }
      } else {
        syncDerotUsageFromPhone();
      }

      const screenTimePoll =
        Platform.OS === 'ios' && screenTimeDeep
          ? fetchTodayScreenTimeWithRetry(fetchMode)
          : Promise.resolve(0);

      const [all, focusSnap, moments, polledMinutes] = await Promise.all([
        getAllLogsForAnalytics(),
        getReclaimedFocusSnapshot(),
        getReclaimedMomentsToday(),
        screenTimePoll,
      ]);

      const mergedDaily =
        Platform.OS === 'ios'
          ? syncedToday
          : Math.max(focusSnap.currentDailyUsageMinutes, polledMinutes);

      const mergedSnap: ReclaimedFocusSnapshot = {
        ...focusSnap,
        currentDailyUsageMinutes: mergedDaily,
        screenDataAuthoritative: focusSnap.screenDataAuthoritative || mergedDaily >= 1,
      };

      await maybeAwardDailyScreenBonus(
        mergedSnap.currentDailyUsageMinutes,
        mergedSnap.screenDataAuthoritative,
      );
      const rankSnap = toRankUiSnapshot(await loadRankState());
      setAnalytics(all);
      setReclaimedSnapshot(mergedSnap);
      setMomentsCount(moments);
      setRankUi(rankSnap);
    } catch (e) {
      console.warn('loadDashboardData', e);
    }
  }, [homeSyncedMinutes]);

  const loadDashboardData = useCallback(
    (screenTimeDeep: boolean, fetchMode: ScreenTimeFetchMode = 'standard') => {
      const queued = loadQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          loadRunningRef.current = true;
          try {
            await performDashboardDataLoad(screenTimeDeep, fetchMode);
          } finally {
            loadRunningRef.current = false;
          }
        });
      loadQueueRef.current = queued;
      return queued;
    },
    [performDashboardDataLoad],
  );

  /** Fast: logs, rank, moments — always runs (never skipped). */
  const refresh = useCallback(async () => {
    await loadDashboardData(false);
  }, [loadDashboardData]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const refreshUi = () => {
      try {
        setScreenTimeRuntimeReady(true);
        const flags = readIosTrackingFlags();
        setIosScreenUi({
          trackingStarted: flags.trackingStarted,
          hasSelection: hasDerotActivitySelection(),
          scopeLabel: formatScreenTimeScopeLabel(readDerotSelectionMeta()),
        });
      } catch {
        /* Screen Time bridge may not be ready on first paint */
      }
    };
    refreshUi();
    const timer = setTimeout(refreshUi, 400);
    const timer2 = setTimeout(refreshUi, 2500);
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [reclaimedSnapshot, statsTick]);

  const todayScreenMinutes = useMemo(() => {
    if (Platform.OS !== 'ios') {
      return reclaimedSnapshot?.currentDailyUsageMinutes ?? 0;
    }
    return Math.max(homeSyncedMinutes, getHomeSyncedTodayMinutes());
  }, [reclaimedSnapshot, homeSyncedMinutes, statsTick]);

  const screenTimeCaption = useMemo(() => {
    if (Platform.OS === 'ios' && todayScreenMinutes < 1) return 'Sync in Settings';
    if (todayScreenMinutes >= 1) return iosScreenUi.scopeLabel;
    return 'Sync in Settings';
  }, [iosScreenUi.scopeLabel, todayScreenMinutes]);

  const screenHrsDisplay = useMemo(() => {
    if (Platform.OS === 'ios' && todayScreenMinutes < 1) return '—';
    if (todayScreenMinutes >= 1) return formatScreenTimeDisplay(todayScreenMinutes);
    return '—';
  }, [todayScreenMinutes]);

  const onHomeRefresh = useCallback(async () => {
    setHomeRefreshing(true);
    try {
      await refresh();
      setRefreshDelightNonce((n) => n + 1);
    } finally {
      setHomeRefreshing(false);
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

  useEffect(() => {
    if (view !== 'home') return;
    void refresh();
  }, [view, statsTick, refresh]);

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

  const homeDateLine = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const journalSummaryLine = useMemo(() => {
    const count = journalSorted.length;
    if (count === 0) return 'No entries yet';
    if (count === 1) return '1 entry';
    return `${count} entries`;
  }, [journalSorted.length]);

  const journalTodayCount = useMemo(() => {
    const today = dayKey(Date.now());
    return journalSorted.filter((e) => dayKey(e.timestamp) === today).length;
  }, [journalSorted]);

  const journalWeekCount = useMemo(() => {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return journalSorted.filter((e) => e.timestamp >= since).length;
  }, [journalSorted]);

  const journalDayCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of journalSorted) {
      const k = dayKey(e.timestamp);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [journalSorted]);

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
          <View style={[styles.journalDayHeaderRow, i > 0 && styles.journalDayHeadingSpaced]}>
            <Text style={styles.journalDayHeading} accessibilityRole="header">
              {formatJournalDayHeading(e.timestamp)}
            </Text>
            <Text style={styles.journalDayCount}>
              {`${journalDayCounts.get(dk) ?? 0} ${(journalDayCounts.get(dk) ?? 0) === 1 ? 'entry' : 'entries'}`}
            </Text>
          </View>
        ) : null}
        <JournalEntryRow entry={e} />
      </Fragment>
    );
  });

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

                <Animated.View style={{ opacity: homeSegMetrics }}>
                  <HomeMetricsBand
                    screenHrsDisplay={screenHrsDisplay}
                    screenTimeCaption={screenTimeCaption}
                    momentsCount={momentsCount}
                    animationNonce={homeCountAnimNonce}
                  />
                </Animated.View>

                <Animated.View style={{ opacity: homeSegDanger }}>
                  <HomeInsight insight={dangerInsight} refreshDelightNonce={refreshDelightNonce} />
                </Animated.View>

                <Animated.View style={{ opacity: homeSegFooter }}>
                  <HomeLogFooter
                    loggedToday={loggedToday}
                    onPress={onStartReflectiveLog}
                    minHeight={logAnchorMinHeight}
                  />
                </Animated.View>
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
            style={[styles.scroll, { backgroundColor: HOME_CANVAS_BG }]}
            contentContainerStyle={[
              styles.journalScroll,
              {
                backgroundColor: HOME_CANVAS_BG,
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
            <Text style={styles.journalSubline}>{journalSummaryLine}</Text>
            <View style={styles.journalStatsRow}>
              <View style={styles.journalStatChip}>
                <Text style={styles.journalStatLabel}>Today</Text>
                <Text style={styles.journalStatValue}>{journalTodayCount}</Text>
              </View>
              <View style={styles.journalStatChip}>
                <Text style={styles.journalStatLabel}>This week</Text>
                <Text style={styles.journalStatValue}>{journalWeekCount}</Text>
              </View>
              <View style={styles.journalStatChip}>
                <Text style={styles.journalStatLabel}>Total</Text>
                <Text style={styles.journalStatValue}>{journalSorted.length}</Text>
              </View>
            </View>
            {journalSorted.length === 0 ? (
              <View style={styles.journalEmptyCard}>
                <Text style={styles.journalEmpty}>Nothing logged yet. Hold LOG on home to add one.</Text>
              </View>
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
  /** Same type as home `homeDate` (today line under Back) */
  journalContextDate: {
    fontFamily: unrotFonts.heroSerifItalic,
    fontSize: 16,
    lineHeight: 24,
    color: HOME_PRIMARY,
    marginBottom: 20,
    letterSpacing: 0.08,
    opacity: 0.72,
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
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  journalSubline: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    lineHeight: 18,
    color: HOME_LABEL,
    marginBottom: 24,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  journalStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
  },
  journalStatChip: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(10, 10, 12, 0.08)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  journalStatLabel: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 1.1,
    color: HOME_LABEL,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  journalStatValue: {
    fontFamily: unrotFonts.interLight,
    fontSize: 18,
    lineHeight: 22,
    color: HOME_PRIMARY,
    fontVariant: ['tabular-nums'],
  },
  journalDayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  journalDayHeading: {
    fontFamily: unrotFonts.heroSerifItalic,
    fontSize: 16,
    lineHeight: 24,
    color: HOME_PRIMARY,
    letterSpacing: 0.08,
    opacity: 0.72,
  },
  journalDayCount: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 11,
    lineHeight: 16,
    color: HOME_LABEL,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  journalDayHeadingSpaced: {
    marginTop: 32,
  },
  journalEmpty: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 14,
    lineHeight: 22,
    color: unrot.muted,
  },
  journalEmptyCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(10, 10, 12, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  journalEntryCard: {
    marginBottom: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(10, 10, 12, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  journalEntryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 10,
  },
  journalMoodChip: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    lineHeight: 18,
    color: HOME_SECONDARY,
  },
  journalTime: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    lineHeight: 18,
    color: HOME_SECONDARY,
    fontVariant: ['tabular-nums'],
  },
  journalIntentHeadline: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 16,
    lineHeight: 23,
    color: unrot.ink,
    letterSpacing: -0.14,
  },
  journalIntentDetail: {
    marginTop: 8,
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 20,
    color: unrot.muted,
  },
});
