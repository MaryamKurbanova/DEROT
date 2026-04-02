import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  computeDangerZoneInsight,
  formatDangerZoneSentence,
  getAllLogsForAnalytics,
  truncateReason,
  type LogEntry,
} from '../lib/reflectiveLog';
import {
  getReclaimedFocusSnapshot,
  type ReclaimedFocusSnapshot,
} from '../lib/reclaimedFocus';
import { buildStickyCopy, type StickyCopy } from '../lib/stickyReclaimed';
import {
  formatReclaimedMathLine,
  formatReclaimedWeeklyHeadline,
  realLifeAnalogueForReclaimedMinutes,
} from '../lib/reclaimedTimeDisplay';
import { getInterceptArmed, setInterceptArmed } from '../lib/interceptArmed';
import { fontFamilies, spacing } from '../theme';
import { syncInterceptArmedToNative } from '../lib/interceptBridge';
import { DerotDeviceActivityChart } from 'derot-device-activity-chart';
import { DEROT_SELECTION_ID } from '../lib/derotIosScreenTime';

const BG = '#000000';
const FG = '#FFFFFF';
const GREY = '#888888';
const FEED_ROW = '#444444';
const TRACK = 1;
type Props = {
  statsTick: number;
  onOpenSettings: () => void;
};

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatTimeAmPm(ts: number): string {
  const d = new Date(ts);
  const hour24 = d.getHours();
  let h12 = hour24 % 12;
  if (h12 === 0) h12 = 12;
  const ampm = hour24 < 12 ? 'AM' : 'PM';
  return `${h12}:${pad2(d.getMinutes())} ${ampm}`;
}

function groupLogsByDate(entries: LogEntry[]): { dateKey: string; entries: LogEntry[] }[] {
  const map = new Map<string, LogEntry[]>();
  for (const e of entries) {
    const key = formatDateKey(e.timestamp);
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  const keys = [...map.keys()].sort((a, b) => b.localeCompare(a));
  return keys.map((dateKey) => ({
    dateKey,
    entries: (map.get(dateKey) ?? []).sort((a, b) => b.timestamp - a.timestamp),
  }));
}

export function DashboardScreen({ statsTick, onOpenSettings }: Props) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'home' | 'journal'>('home');
  const [armed, setArmed] = useState(true);
  const [analytics, setAnalytics] = useState<LogEntry[]>([]);
  const [sticky, setSticky] = useState<StickyCopy | null>(null);
  const [reclaimedSnapshot, setReclaimedSnapshot] =
    useState<ReclaimedFocusSnapshot | null>(null);

  const refresh = useCallback(async () => {
    const [all, armedNow, focusSnap] = await Promise.all([
      getAllLogsForAnalytics(),
      getInterceptArmed(),
      getReclaimedFocusSnapshot(),
    ]);
    setAnalytics(all);
    setArmed(armedNow);
    setReclaimedSnapshot(focusSnap);
    setSticky(buildStickyCopy(focusSnap));
  }, []);

  const journalByDate = useMemo(() => groupLogsByDate(analytics), [analytics]);

  const dangerZoneLine = useMemo(() => {
    const insight = computeDangerZoneInsight(analytics);
    return insight != null ? formatDangerZoneSentence(insight) : null;
  }, [analytics]);

  useEffect(() => {
    void refresh();
  }, [refresh, statsTick]);

  const toggleWallMaster = async () => {
    void Haptics.selectionAsync();
    const next = !armed;
    setArmed(next);
    await setInterceptArmed(next);
    await syncInterceptArmedToNative(next);
  };

  const bottomPad = Math.max(insets.bottom, 16) + spacing.md;

  const openJournal = () => {
    void Haptics.selectionAsync();
    void refresh();
    setView('journal');
  };

  const closeJournal = () => {
    void Haptics.selectionAsync();
    setView('home');
  };

  return (
    <View style={[styles.root, { paddingBottom: bottomPad }]}>
      {view === 'home' ? (
        <>
          <View
            style={[
              styles.topBar,
              styles.topBarRow,
              { paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg },
            ]}
          >
            <Pressable
              onPress={openJournal}
              hitSlop={12}
              style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.55 }]}
            >
              <Text style={styles.navBtnText}>JOURNAL</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                onOpenSettings();
              }}
              hitSlop={12}
              style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.55 }]}
            >
              <Text style={styles.navBtnText}>SETTINGS</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollInner}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.dangerZoneCard}>
              <Text style={styles.dangerZoneLabel}>MOST LIKELY TO ROT</Text>
              {dangerZoneLine != null ? (
                <Text style={styles.dangerZoneBody}>{dangerZoneLine}</Text>
              ) : (
                <Text style={styles.dangerZoneHint}>
                  Log a few reflections in your journal — we combine when you open the app with how
                  you're feeling to surface your personal danger zone.
                </Text>
              )}
            </View>

            {reclaimedSnapshot?.screenDataAuthoritative ? (
              <View style={styles.deviceReportCard}>
                <Text style={styles.deviceReportLabel}>SYSTEM USAGE CHART</Text>
                <Text style={styles.deviceReportCaption}>
                  Apple Device Activity report for your monitored selection (today, local time).
                </Text>
                <DerotDeviceActivityChart
                  familyActivitySelectionId={DEROT_SELECTION_ID}
                  style={styles.deviceReportNative}
                />
              </View>
            ) : null}

            {reclaimedSnapshot === null ? (
              <View style={styles.reclaimedCard}>
                <Text style={styles.reclaimedLabel}>RECLAIMED TIME</Text>
                <Text style={styles.reclaimedSubtle}>Loading Screen Time metrics…</Text>
              </View>
            ) : !reclaimedSnapshot.screenDataAuthoritative ? (
              <View style={styles.reclaimedCard}>
                <Text style={styles.reclaimedLabel}>RECLAIMED TIME</Text>
                <Text style={styles.reclaimedHeadline}>CONNECT IPHONE SCREEN TIME</Text>
                <Text style={styles.reclaimedBody}>
                  Reclaimed time compares the last 7 days of usage for your monitored apps (from
                  Screen Time in your native build) to the daily average you entered in onboarding.
                  Example: 4h/day baseline vs 2h/day actual → about 14 hours reclaimed this week.
                </Text>
                <Pressable
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onOpenSettings();
                  }}
                  style={({ pressed }) => [styles.reclaimedBtn, pressed && { opacity: 0.65 }]}
                >
                  <Text style={styles.reclaimedBtnText}>OPEN SETTINGS</Text>
                </Pressable>
              </View>
            ) : reclaimedSnapshot.weeklyReclaimedMinutes != null &&
              reclaimedSnapshot.weeklyReclaimedMinutes > 0 ? (
              <View style={styles.reclaimedCard}>
                <Text style={styles.reclaimedLabel}>RECLAIMED TIME</Text>
                <Text style={styles.reclaimedShout}>
                  {formatReclaimedWeeklyHeadline(reclaimedSnapshot.weeklyReclaimedMinutes)}
                </Text>
                <Text style={styles.reclaimedRealLife}>
                  {realLifeAnalogueForReclaimedMinutes(reclaimedSnapshot.weeklyReclaimedMinutes)}
                </Text>
                <Text style={styles.reclaimedMath}>
                  {formatReclaimedMathLine(reclaimedSnapshot)}
                </Text>
                {reclaimedSnapshot.isSystemOverload ? (
                  <Text style={styles.reclaimedWarn}>
                    Today’s Screen Time is above your daily baseline — your weekly reclaimed total
                    still reflects the full 7-day window.
                  </Text>
                ) : null}
                <Text style={styles.reclaimedSource}>
                  Uses iPhone Screen Time totals for monitored apps (rolling 7 days) vs your
                  onboarding baseline. Requires your native build with usage reporting enabled.
                </Text>
              </View>
            ) : (
              <View style={styles.reclaimedCard}>
                <Text style={styles.reclaimedLabel}>RECLAIMED TIME</Text>
                <Text style={styles.reclaimedHeadline}>
                  {reclaimedSnapshot.isSystemOverload
                    ? 'TODAY ABOVE BASELINE'
                    : 'AT OR ABOVE YOUR WEEKLY BASELINE'}
                </Text>
                <Text style={styles.reclaimedBody}>
                  {reclaimedSnapshot.isSystemOverload
                    ? 'Screen Time today passed your daily onboarding average. Weekly reclaimed time is zero when monitored usage meets or exceeds your 7-day baseline.'
                    : 'Monitored Screen Time this week matched or exceeded your baseline. Keep going — reclaimed hours show up when usage drops below what you said you used before.'}
                </Text>
                <Text style={styles.reclaimedMath}>{formatReclaimedMathLine(reclaimedSnapshot)}</Text>
                <Text style={styles.reclaimedSource}>
                  Formula: max(0, 7-day baseline minutes − 7-day monitored Screen Time minutes).
                </Text>
              </View>
            )}

            {sticky != null && sticky.label !== 'STICKY' ? (
              <View style={styles.stickyCard}>
                <Text style={styles.stickyLabel}>{sticky.label}</Text>
                <Text style={styles.stickyHeadline}>{sticky.headline}</Text>
                {sticky.compareLine ? (
                  <Text style={styles.stickyCompare}>{sticky.compareLine}</Text>
                ) : null}
                <Text style={styles.stickyRealLife}>{sticky.realLife}</Text>
              </View>
            ) : null}
          </ScrollView>

          <Pressable
            onPress={() => void toggleWallMaster()}
            accessibilityRole="button"
            accessibilityLabel={armed ? 'Lock active. Tap to pause.' : 'Lock paused. Tap to activate.'}
            style={({ pressed }) => [styles.shieldBar, pressed && styles.shieldBarPressed]}
          >
            <View style={styles.shieldRow}>
              <View
                style={[styles.shieldDotHalo, armed ? styles.shieldDotHaloActive : styles.shieldDotHaloStandby]}
              >
                <View style={[styles.shieldDot, armed ? styles.shieldDotActive : styles.shieldDotStandby]} />
              </View>
              <Text
                style={[styles.shieldStatusText, armed ? styles.shieldStatusActive : styles.shieldStatusStandby]}
              >
                {armed ? 'LOCK: ACTIVE' : 'LOCK: PAUSED'}
              </Text>
            </View>
          </Pressable>
        </>
      ) : (
        <>
          <View
            style={[
              styles.topBar,
              styles.topBarAlignStart,
              { paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg },
            ]}
          >
            <Pressable
              onPress={closeJournal}
              hitSlop={12}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.55 }]}
            >
              <Text style={styles.backText}>← BACK</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollInner}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.journalScreenTitle}>JOURNAL</Text>

            <View style={styles.feed}>
              {journalByDate.length === 0 ? (
                <Text style={styles.feedEmpty}>NO_ENTRIES_YET</Text>
              ) : (
                journalByDate.map((group, gIdx) => (
                  <View key={group.dateKey} style={styles.journalDay}>
                    <Text
                      style={[
                        styles.journalDateHeading,
                        gIdx === 0 && styles.journalDateHeadingFirst,
                      ]}
                    >
                      {group.dateKey}
                    </Text>
                    {group.entries.map((e, i) => (
                      <View key={`${e.timestamp}-${e.state}-${i}`} style={styles.feedRow}>
                        <Text style={styles.feedLine} numberOfLines={3}>
                          {formatTimeAmPm(e.timestamp)} | [{e.state}] |{' '}
                          {truncateReason(e.intent, 48).toUpperCase()}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  topBar: {
    paddingBottom: spacing.sm,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  topBarAlignStart: {
    alignItems: 'flex-start',
    width: '100%',
  },
  navBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  navBtnText: {
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    color: FG,
    letterSpacing: TRACK,
    opacity: 0.85,
    textTransform: 'uppercase',
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: spacing.md,
  },
  backText: {
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    color: FG,
    letterSpacing: TRACK,
    opacity: 0.85,
    textTransform: 'uppercase',
  },
  scroll: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  dangerZoneCard: {
    borderWidth: 2,
    borderColor: FG,
    padding: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dangerZoneLabel: {
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    color: GREY,
    letterSpacing: TRACK,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  dangerZoneBody: {
    fontFamily: fontFamilies.ui,
    fontSize: 16,
    lineHeight: 24,
    color: FG,
    letterSpacing: -0.2,
  },
  dangerZoneHint: {
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    lineHeight: 16,
    color: GREY,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  deviceReportCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    padding: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    minHeight: 280,
  },
  deviceReportLabel: {
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    color: GREY,
    letterSpacing: TRACK,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  deviceReportCaption: {
    fontFamily: fontFamilies.ui,
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 17,
    marginBottom: spacing.sm,
  },
  deviceReportNative: {
    width: '100%',
    minHeight: 220,
    flexGrow: 1,
  },
  reclaimedCard: {
    borderWidth: 2,
    borderColor: FG,
    padding: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  reclaimedLabel: {
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    color: GREY,
    letterSpacing: TRACK,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  reclaimedShout: {
    fontFamily: fontFamilies.monoSemi,
    fontSize: 15,
    lineHeight: 22,
    color: FG,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  reclaimedHeadline: {
    fontFamily: fontFamilies.monoSemi,
    fontSize: 14,
    lineHeight: 20,
    color: FG,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  reclaimedBody: {
    fontFamily: fontFamilies.ui,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: spacing.sm,
  },
  reclaimedRealLife: {
    fontFamily: fontFamilies.uiSemi,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.92)',
    marginBottom: spacing.md,
    letterSpacing: -0.2,
  },
  reclaimedMath: {
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    color: GREY,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    lineHeight: 15,
    marginBottom: spacing.sm,
  },
  reclaimedWarn: {
    fontFamily: fontFamilies.ui,
    fontSize: 13,
    lineHeight: 19,
    color: '#FFB020',
    marginBottom: spacing.sm,
  },
  reclaimedSource: {
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    color: GREY,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    lineHeight: 14,
    opacity: 0.85,
  },
  reclaimedSubtle: {
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    color: GREY,
    letterSpacing: TRACK,
  },
  reclaimedBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  reclaimedBtnText: {
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    color: FG,
    letterSpacing: TRACK,
    textTransform: 'uppercase',
  },
  stickyCard: {
    borderWidth: 1,
    borderColor: FG,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  stickyLabel: {
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    color: GREY,
    letterSpacing: TRACK,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  stickyHeadline: {
    fontFamily: fontFamilies.monoSemi,
    fontSize: 13,
    lineHeight: 19,
    color: FG,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  stickyCompare: {
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    color: GREY,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  stickyRealLife: {
    fontFamily: fontFamilies.ui,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.82)',
    letterSpacing: -0.1,
  },
  journalScreenTitle: {
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    color: GREY,
    letterSpacing: TRACK,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  feed: {
    gap: 0,
  },
  journalDay: {
    marginBottom: spacing.md,
  },
  journalDateHeading: {
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    color: GREY,
    letterSpacing: TRACK,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  journalDateHeadingFirst: {
    marginTop: 0,
  },
  feedEmpty: {
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    color: GREY,
    letterSpacing: TRACK,
    textTransform: 'uppercase',
  },
  feedRow: {
    backgroundColor: FEED_ROW,
    borderWidth: 1,
    borderColor: FEED_ROW,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: -1,
  },
  feedLine: {
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    lineHeight: 15,
    color: FG,
    letterSpacing: TRACK,
    textTransform: 'uppercase',
  },
  shieldBar: {
    marginHorizontal: spacing.lg,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldBarPressed: {
    opacity: 0.72,
  },
  shieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldDotHalo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shieldDotHaloActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  shieldDotHaloStandby: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  shieldDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  shieldDotActive: {
    backgroundColor: FG,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#FFFFFF',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.85,
          shadowRadius: 10,
        }
      : {}),
  },
  shieldDotStandby: {
    backgroundColor: 'rgba(136,136,136,0.85)',
  },
  shieldStatusText: {
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    letterSpacing: TRACK + 0.5,
    textTransform: 'uppercase',
  },
  shieldStatusActive: {
    color: FG,
    textShadowColor: 'rgba(255,255,255,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  shieldStatusStandby: {
    color: 'rgba(136,136,136,0.95)',
  },
});
