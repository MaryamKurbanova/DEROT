import * as Haptics from 'expo-haptics';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import { EDITORIAL_FADE_MS, unrot, unrotFonts } from '../theme';

const G = unrot.gutter;

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

function moodPillPalette(stateRaw: string): { bg: string; fg: string; label: string } {
  const raw = stateRaw.trim();
  if (raw.toUpperCase() === 'REFLECTION') {
    return { bg: '#ECEAE8', fg: '#5A5856', label: 'Reflection' };
  }
  const k = raw.toLowerCase();
  const map: Record<string, { bg: string; fg: string }> = {
    calm: { bg: '#E3EDF7', fg: '#2F4A5E' },
    anxious: { bg: '#F5E1E8', fg: '#5C3845' },
    tired: { bg: '#E9E6F2', fg: '#454066' },
    lost: { bg: '#EFEAE3', fg: '#4A453C' },
    bored: { bg: '#E6EDE8', fg: '#3D5344' },
  };
  const c = map[k] ?? { bg: '#F0F0F0', fg: '#666666' };
  return { ...c, label: moodLabelDisplay(raw) };
}

function JournalEntryRow({ entry }: { entry: LogEntry }) {
  const { headline, detail } = splitIntentLines(entry.intent);
  const pill = moodPillPalette(entry.state);

  return (
    <View style={styles.journalEntry}>
      <View style={styles.journalEntryRow}>
        <Text style={styles.journalTime}>{formatJournalTime(entry.timestamp)}</Text>
        <View style={styles.journalEntryRight}>
          <Text style={styles.journalIntent}>{headline}</Text>
          {detail ? (
            <Text style={styles.journalIntentDetail} selectable>
              {detail}
            </Text>
          ) : null}
          <View style={[styles.moodPill, { backgroundColor: pill.bg }]}>
            <Text style={[styles.moodPillText, { color: pill.fg }]}>{pill.label}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function DashboardScreen({ statsTick, onOpenSettings, onStartReflectiveLog }: Props) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'home' | 'journal'>('home');
  const [analytics, setAnalytics] = useState<LogEntry[]>([]);
  const [reclaimedSnapshot, setReclaimedSnapshot] =
    useState<ReclaimedFocusSnapshot | null>(null);
  const [momentsCount, setMomentsCount] = useState(0);

  const fadeOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    fadeOpacity.setValue(0);
    Animated.timing(fadeOpacity, {
      toValue: 1,
      duration: EDITORIAL_FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [view, statsTick, fadeOpacity]);

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

  const journalSorted = useMemo(
    () => [...analytics].sort((a, b) => b.timestamp - a.timestamp),
    [analytics],
  );

  const dangerInsight = useMemo(() => computeDangerZoneInsight(analytics), [analytics]);

  const dangerZoneLine = useMemo(
    () => formatEditorialLuxuryDangerLineWithFeeling(dangerInsight),
    [dangerInsight],
  );

  const screenHrsDisplay = useMemo(() => {
    if (reclaimedSnapshot == null || !reclaimedSnapshot.screenDataAuthoritative) return '0';
    const h = reclaimedSnapshot.currentDailyUsageMinutes / 60;
    if (h < 0.05) return '0';
    return h < 10 && h % 1 !== 0 ? h.toFixed(1) : String(Math.round(h * 10) / 10).replace(/\.0$/, '');
  }, [reclaimedSnapshot]);

  const reclaimedHrsDisplay = useMemo(() => {
    if (reclaimedSnapshot == null || !reclaimedSnapshot.screenDataAuthoritative) return '0';
    const m = reclaimedSnapshot.weeklyReclaimedMinutes;
    if (m == null || m < 0.5) return '0';
    const h = m / 60;
    return h < 10 && h % 1 !== 0 ? h.toFixed(1) : String(Math.round(h * 10) / 10).replace(/\.0$/, '');
  }, [reclaimedSnapshot]);

  useEffect(() => {
    void refresh();
  }, [refresh, statsTick]);

  const openJournal = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setView('journal');
    void refresh();
  };

  const closeJournal = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setView('home');
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

  return (
    <View style={styles.root}>
      {view === 'home' ? (
        <Animated.View style={[styles.fill, { opacity: fadeOpacity }]}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.homeContent,
              {
                paddingTop: insets.top + 16,
                paddingBottom: Math.max(insets.bottom, G) + 56,
                paddingHorizontal: G,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topNav}>
              <Pressable onPress={openJournal} hitSlop={14} style={styles.navHit}>
                <Text style={styles.navSerif}>Journal</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onOpenSettings();
                }}
                hitSlop={14}
                style={styles.navHit}
              >
                <Text style={styles.navSerif}>Settings</Text>
              </Pressable>
            </View>

            <Text style={styles.homeDate}>{homeDateLine}</Text>
            <Text style={styles.homeTagline}>Reclaimed hours.</Text>

            <View style={styles.heroSection}>
              <Text style={styles.monoLabel}>HOURS_RECLAIMED</Text>
              <Text
                style={styles.heroNumber}
                adjustsFontSizeToFit
                minimumFontScale={0.38}
                numberOfLines={1}
              >
                {reclaimedHrsDisplay}
              </Text>
            </View>

            <View style={styles.metricsBand}>
              <View style={styles.metricCol}>
                <Text style={styles.monoLabelMuted}>SCREEN TIME</Text>
                <Text style={styles.metricStat}>
                  {screenHrsDisplay}
                  <Text style={styles.metricStatUnit}> hrs</Text>
                </Text>
                <Text style={styles.metricCaption}>Today</Text>
              </View>
              <View style={styles.metricGutter} />
              <View style={styles.metricCol}>
                <Text style={styles.monoLabelMuted}>MOMENTS</Text>
                <Text style={styles.metricStat}>{String(momentsCount)}</Text>
                <Text style={styles.metricCaption}>Reclaimed today</Text>
              </View>
            </View>

            <View style={styles.insightSection}>
              <Text style={styles.insightSerifTitle}>Danger zone</Text>
              <Text style={styles.dangerZoneBody}>{dangerZoneLine}</Text>
            </View>

            <View style={styles.flexSpacer} />

            <View style={styles.homeFooter}>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onStartReflectiveLog();
                }}
                style={({ pressed }) => [styles.logHit, pressed && { opacity: 0.45 }]}
                hitSlop={14}
              >
                <Text style={styles.logText}>LOG</Text>
                <Text style={styles.logHint}>Name how you feel before you scroll.</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.fill, { opacity: fadeOpacity }]}>
          <View style={[styles.journalTop, { paddingTop: insets.top + 12, paddingHorizontal: G }]}>
            <Pressable onPress={closeJournal} hitSlop={12} style={styles.navHit}>
              <Text style={styles.journalBackSerif}>back</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.journalScroll,
              {
                paddingHorizontal: G,
                paddingBottom: Math.max(insets.bottom, G) + 24,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.journalScreenTitle}>Journal</Text>
            {journalSorted.length === 0 ? (
              <Text style={styles.journalEmpty}>Nothing logged yet.</Text>
            ) : (
              journalBlocks
            )}
          </ScrollView>
        </Animated.View>
      )}
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
  scroll: {
    flex: 1,
    backgroundColor: unrot.bg,
  },
  homeContent: {
    flexGrow: 1,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  navHit: {
    paddingVertical: 6,
  },
  navSerif: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 14,
    letterSpacing: 0.15,
    color: unrot.ink,
  },
  homeDate: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 20,
    color: unrot.muted,
    marginBottom: 6,
  },
  homeTagline: {
    fontFamily: unrotFonts.heroSerifItalic,
    fontSize: 20,
    lineHeight: 28,
    color: unrot.ink,
    letterSpacing: -0.2,
    marginBottom: 36,
    opacity: 0.92,
  },
  heroSection: {
    marginBottom: 44,
  },
  monoLabel: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 8,
    letterSpacing: 4,
    color: unrot.ink,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  heroNumber: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 112,
    lineHeight: 116,
    color: unrot.ink,
    fontVariant: ['tabular-nums'],
    letterSpacing: -3,
  },
  metricsBand: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 48,
  },
  metricCol: {
    flex: 1,
    minWidth: 0,
  },
  metricGutter: {
    width: 28,
  },
  monoLabelMuted: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 8,
    letterSpacing: 3,
    color: unrot.muted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  metricStat: {
    fontFamily: unrotFonts.interLight,
    fontSize: 34,
    lineHeight: 40,
    color: unrot.ink,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  metricStatUnit: {
    fontFamily: unrotFonts.interLight,
    fontSize: 20,
    lineHeight: 40,
    color: unrot.muted,
  },
  metricCaption: {
    marginTop: 8,
    fontFamily: unrotFonts.interRegular,
    fontSize: 11,
    lineHeight: 16,
    color: unrot.narrativeMuted,
  },
  insightSection: {
    marginBottom: 8,
  },
  insightSerifTitle: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 22,
    lineHeight: 28,
    color: unrot.ink,
    letterSpacing: -0.35,
    marginBottom: 14,
  },
  dangerZoneBody: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 16,
    lineHeight: 25,
    color: unrot.ink,
    letterSpacing: -0.05,
  },
  flexSpacer: {
    flexGrow: 1,
    minHeight: 40,
  },
  homeFooter: {
    paddingTop: 8,
  },
  logHit: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  logText: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: unrot.ink,
  },
  logHint: {
    marginTop: 8,
    fontFamily: unrotFonts.interRegular,
    fontSize: 11,
    lineHeight: 16,
    color: unrot.muted,
    maxWidth: 280,
  },
  journalTop: {
    width: '100%',
    paddingBottom: 8,
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
  moodPill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  moodPillText: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
