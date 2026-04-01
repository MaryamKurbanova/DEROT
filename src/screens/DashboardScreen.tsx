import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  computePrimaryTrigger,
  getAllLogsForAnalytics,
  truncateReason,
  type LogEntry,
} from '../lib/reflectiveLog';
import { getReclaimedFocusSnapshot } from '../lib/reclaimedFocus';
import { buildStickyCopy, type StickyCopy } from '../lib/stickyReclaimed';
import { getInterceptArmed, setInterceptArmed } from '../lib/interceptArmed';
import { fontFamilies, spacing } from '../theme';
import { syncInterceptArmedToNative } from '../lib/interceptBridge';

const BG = '#000000';
const FG = '#FFFFFF';
const GREY = '#888888';
const FEED_ROW = '#444444';
const TRACK = 1;
const PAUSED_OPACITY = 0.3;

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
  const timeOpacity = useRef(new Animated.Value(1)).current;

  const refresh = useCallback(async () => {
    const [all, armedNow, focusSnap] = await Promise.all([
      getAllLogsForAnalytics(),
      getInterceptArmed(),
      getReclaimedFocusSnapshot(),
    ]);
    setAnalytics(all);
    setArmed(armedNow);
    setSticky(buildStickyCopy(focusSnap));
  }, []);

  const journalByDate = useMemo(() => groupLogsByDate(analytics), [analytics]);

  useEffect(() => {
    void refresh();
  }, [refresh, statsTick]);

  useEffect(() => {
    Animated.timing(timeOpacity, {
      toValue: armed ? 1 : PAUSED_OPACITY,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [armed, timeOpacity]);

  const primary = computePrimaryTrigger(analytics);
  const primaryLabel = primary ?? 'UNKNOWN';
  const lastLogPair =
    analytics[0] != null
      ? `${analytics[0].state} · ${analytics[0].intent}`.toUpperCase()
      : '—';

  const insightReportBody =
    analytics.length === 0
      ? 'INSUFFICIENT DATA FOR PATTERN ANALYSIS.'
      : `YOU ARE MOST VULNERABLE TO ROT WHEN ${primaryLabel}.`;

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
            <View style={styles.stickyCard}>
              <Text style={styles.stickyLabel}>{sticky?.label ?? 'STICKY'}</Text>
              <Text style={styles.stickyHeadline}>{sticky?.headline ?? '—'}</Text>
              {sticky?.compareLine ? (
                <Text style={styles.stickyCompare}>{sticky.compareLine}</Text>
              ) : null}
              <Text style={styles.stickyRealLife}>{sticky?.realLife ?? ''}</Text>
              {sticky?.showConnectHint ? (
                <Pressable
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onOpenSettings();
                  }}
                  style={({ pressed }) => [styles.stickyLinkBtn, pressed && { opacity: 0.65 }]}
                >
                  <Text style={styles.stickyLinkBtnText}>
                    {sticky?.connectButtonLabel ?? 'OPEN SETTINGS · SCREEN TIME'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.insightCard}>
              <Text style={styles.insightText}>REPORT:</Text>
              <Text style={[styles.insightText, styles.insightReportBody]}>{insightReportBody}</Text>
              <Text style={[styles.insightText, styles.insightGap]}>
                LATEST LOG ENTRY: {lastLogPair}
              </Text>
            </View>
          </ScrollView>

          <Animated.View style={{ opacity: timeOpacity }}>
            <Pressable
              onPress={() => void toggleWallMaster()}
              style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.ghostBtnText}>{armed ? 'ACTIVE' : 'PAUSED'}</Text>
            </Pressable>
          </Animated.View>
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
  stickyLinkBtn: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  stickyLinkBtnText: {
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    color: FG,
    letterSpacing: TRACK,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  insightCard: {
    borderWidth: 1,
    borderColor: FG,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  insightText: {
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    lineHeight: 16,
    color: FG,
    letterSpacing: TRACK,
    textTransform: 'uppercase',
  },
  insightReportBody: {
    marginTop: spacing.xs,
  },
  insightGap: {
    marginTop: spacing.sm,
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
  ghostBtn: {
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: FG,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  ghostBtnText: {
    fontFamily: fontFamilies.mono,
    fontSize: 12,
    color: FG,
    letterSpacing: TRACK,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
