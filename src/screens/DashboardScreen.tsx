import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlitchJournalNav, GlitchSettingsNav } from '../components/GlitchLuxuryNav';
import { VoidGlowPressable } from '../components/VoidGlowPressable';
import { VoidOverlay } from '../components/VoidOverlay';
import { findDistractionById } from '../lib/distractionApps';
import { getAllLogsForAnalytics, type LogEntry, computeDangerZoneInsight, formatDangerZoneHUDLine } from '../lib/reflectiveLog';
import { getReclaimedFocusSnapshot, type ReclaimedFocusSnapshot } from '../lib/reclaimedFocus';
import { fontFamilies, monolith, spacing } from '../theme';

const GRID_GUTTER = 32;
const SIGNAL_AMBER = '#FFB800';
const CYAN_TRACK = '#00F0FF';

type Props = {
  statsTick: number;
  onOpenSettings: () => void;
};

function voidTextGlow(pressed: boolean): TextStyle {
  return {
    textShadowColor: 'rgba(255, 255, 255, 0.65)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: pressed ? 16 : 0,
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTime24(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function journalAppLabel(e: LogEntry): string {
  if (e.appId) {
    const app = findDistractionById(e.appId);
    if (app?.label) return app.label.toUpperCase().replace(/\s+/g, '_');
  }
  return 'SESSION';
}

function startOfLocalDayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function countInstagramAttemptsToday(entries: LogEntry[]): number {
  const t0 = startOfLocalDayMs();
  return entries.filter((e) => e.appId === 'instagram' && e.timestamp >= t0).length;
}

/** Display hours for HUD: fractional when needed. */
function formatReclaimedHoursHud(minutes: number | null | undefined): string {
  if (minutes == null || minutes < 0.5) return '0';
  const h = minutes / 60;
  if (h < 10 && h % 1 !== 0) return h.toFixed(1);
  return String(Math.round(h * 10) / 10).replace(/\.0$/, '');
}

export function DashboardScreen({ statsTick, onOpenSettings }: Props) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'home' | 'journal'>('home');
  const [analytics, setAnalytics] = useState<LogEntry[]>([]);
  const [reclaimedSnapshot, setReclaimedSnapshot] =
    useState<ReclaimedFocusSnapshot | null>(null);
  const blurAnim = useRef(new Animated.Value(0)).current;
  const dangerPulse = useRef(new Animated.Value(1)).current;

  const refresh = useCallback(async () => {
    const [all, focusSnap] = await Promise.all([
      getAllLogsForAnalytics(),
      getReclaimedFocusSnapshot(),
    ]);
    setAnalytics(all);
    setReclaimedSnapshot(focusSnap);
  }, []);

  const journalSorted = useMemo(
    () => [...analytics].sort((a, b) => b.timestamp - a.timestamp),
    [analytics],
  );

  const dangerHudLine = useMemo(() => {
    const insight = computeDangerZoneInsight(analytics);
    return insight != null
      ? formatDangerZoneHUDLine(insight)
      : 'MOST LIKELY TO ROT: [INSUFFICIENT_DATA] // [--]';
  }, [analytics]);

  const instagramOpens = useMemo(() => countInstagramAttemptsToday(analytics), [analytics]);

  const addictionBaseline = useMemo(() => {
    const daily = reclaimedSnapshot?.baselineDailyMinutes ?? 120;
    return Math.max(10, Math.round(daily / 6));
  }, [reclaimedSnapshot]);

  const addictionProgress = useMemo(
    () => Math.min(1, instagramOpens / Math.max(1, addictionBaseline)),
    [instagramOpens, addictionBaseline],
  );

  const reclaimedHoursStr = useMemo(() => {
    if (reclaimedSnapshot == null) return '—';
    if (!reclaimedSnapshot.screenDataAuthoritative) return '—';
    return formatReclaimedHoursHud(reclaimedSnapshot.weeklyReclaimedMinutes);
  }, [reclaimedSnapshot]);

  useEffect(() => {
    void refresh();
  }, [refresh, statsTick]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dangerPulse, { toValue: 0.82, duration: 1500, useNativeDriver: true }),
        Animated.timing(dangerPulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dangerPulse]);

  const runBlurTransition = useCallback(
    (next: 'home' | 'journal', afterSwitch?: () => void) => {
      Animated.timing(blurAnim, { toValue: 1, duration: 140, useNativeDriver: true }).start(
        ({ finished }) => {
          if (!finished) return;
          if (next === 'journal') void refresh();
          setView(next);
          afterSwitch?.();
          Animated.timing(blurAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        },
      );
    },
    [blurAnim, refresh],
  );

  const openJournal = () => {
    runBlurTransition('journal');
  };

  const closeJournal = () => {
    runBlurTransition('home');
  };

  return (
    <View style={[styles.root, view === 'home' ? styles.rootHome : styles.rootJournal]}>
      <VoidOverlay />

      {view === 'home' ? (
        <View style={styles.hudRoot} pointerEvents="box-none">
          <Text
            style={[styles.extRefLabel, { top: insets.top + 8, right: GRID_GUTTER + 34 }]}
            pointerEvents="none"
          >
            EXT_REF // 0924-X
          </Text>

          <View
            style={[
              styles.topChrome,
              { paddingTop: insets.top + spacing.sm, paddingHorizontal: GRID_GUTTER },
            ]}
            pointerEvents="box-none"
          >
            <GlitchJournalNav onPress={openJournal} accessibilityLabel="Open journal" />
            <GlitchSettingsNav
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onOpenSettings();
              }}
              accessibilityLabel="Open settings"
            />
          </View>

          <Animated.View
            style={[styles.dangerCluster, { top: insets.top + 56, opacity: dangerPulse }]}
            pointerEvents="none"
          >
            <View style={styles.dangerFrame}>
              <View style={styles.cornerTL} />
              <View style={styles.cornerBR} />
              <Text style={styles.dangerText}>{dangerHudLine}</Text>
            </View>
          </Animated.View>

          <View
            style={[styles.coreCluster, { top: '50%', marginTop: -72 }]}
            pointerEvents="none"
          >
            <Text style={styles.coreValue}>{reclaimedHoursStr}</Text>
            <Text style={styles.coreSublabel}>RECLAIMED_EQUITY_HR</Text>
          </View>

          <View
            style={[styles.trackerCluster, { bottom: insets.bottom + 28, paddingHorizontal: GRID_GUTTER }]}
            pointerEvents="none"
          >
            <Text style={styles.trackerLabel}>[ TARGET_APP_ANALYSIS ]</Text>
            <Text style={styles.trackerMain}>{`INSTAGRAM: ${instagramOpens} ATTEMPTS TODAY`}</Text>
            <View style={styles.trackRail}>
              <View style={[styles.trackFill, { width: `${addictionProgress * 100}%` }]} />
            </View>
          </View>
        </View>
      ) : (
        <>
          <View
            style={[
              styles.topBar,
              styles.topBarAlignStart,
              { paddingTop: insets.top + spacing.sm, paddingHorizontal: GRID_GUTTER },
            ]}
          >
            <VoidGlowPressable onPress={closeJournal} accessibilityLabel="Back to home">
              {({ pressed }) => (
                <Text style={[styles.backText, voidTextGlow(pressed)]}>← BACK</Text>
              )}
            </VoidGlowPressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.journalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.journalTitle}>JOURNAL</Text>
            {journalSorted.length === 0 ? (
              <Text style={styles.feedEmpty}>NO_ENTRIES_YET</Text>
            ) : (
              journalSorted.map((e, i) => (
                <Text
                  key={`${e.timestamp}-${e.state}-${i}`}
                  style={styles.journalGhostLine}
                  selectable
                >
                  {`${formatTime24(e.timestamp)}  //  ${e.state.toUpperCase()}  //  ${journalAppLabel(e)}`}
                </Text>
              ))
            )}
          </ScrollView>
        </>
      )}

      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            zIndex: 80,
            opacity: blurAnim,
          },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)' }]} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  rootHome: {
    backgroundColor: '#000000',
  },
  rootJournal: {
    flex: 1,
    backgroundColor: '#000000',
  },
  hudRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topChrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dangerCluster: {
    position: 'absolute',
    left: GRID_GUTTER,
    right: GRID_GUTTER,
    alignItems: 'center',
    zIndex: 4,
  },
  dangerFrame: {
    position: 'relative',
    paddingVertical: 12,
    paddingHorizontal: 18,
    maxWidth: '100%',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 16,
    height: 16,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: SIGNAL_AMBER,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: SIGNAL_AMBER,
  },
  dangerText: {
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    color: SIGNAL_AMBER,
    textAlign: 'center',
    letterSpacing: 0.6,
    lineHeight: 15,
  },
  coreCluster: {
    position: 'absolute',
    left: GRID_GUTTER,
    right: GRID_GUTTER,
    alignItems: 'center',
    zIndex: 5,
  },
  coreValue: {
    fontFamily: fontFamilies.mono,
    fontSize: 82,
    lineHeight: 86,
    color: '#FFFFFF',
    fontWeight: '200',
    letterSpacing: -5,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(255,255,255,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  coreSublabel: {
    marginTop: 10,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 5,
    color: '#444444',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  trackerCluster: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 4,
  },
  trackerLabel: {
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    color: '#666666',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
    textAlign: 'center',
  },
  trackerMain: {
    fontFamily: fontFamilies.mono,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  trackRail: {
    width: '100%',
    maxWidth: 320,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: CYAN_TRACK,
  },
  extRefLabel: {
    position: 'absolute',
    zIndex: 10,
    fontFamily: fontFamilies.mono,
    fontSize: 6,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.38)',
    textTransform: 'uppercase',
  },
  topBar: {
    paddingBottom: spacing.sm,
  },
  topBarAlignStart: {
    alignItems: 'flex-start',
    width: '100%',
  },
  backText: {
    fontFamily: fontFamilies.monoBold,
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 4,
    opacity: 0.88,
    textTransform: 'uppercase',
  },
  scroll: {
    flex: 1,
  },
  journalScrollContent: {
    paddingHorizontal: GRID_GUTTER,
    paddingBottom: spacing.md,
  },
  journalTitle: {
    fontFamily: fontFamilies.mono,
    fontSize: 7,
    color: '#444444',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: 28,
    marginBottom: 12,
  },
  feedEmpty: {
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    color: monolith.muted,
    letterSpacing: 2,
  },
  journalGhostLine: {
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    color: 'rgba(255,255,255,0.62)',
    letterSpacing: 0.5,
    marginBottom: 14,
    lineHeight: 16,
  },
});
