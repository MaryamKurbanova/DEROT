import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEFAULT_RANK_STATE,
  loadRankState,
  RANKS,
  toRankUiSnapshot,
  type RankUiSnapshot,
} from '../lib/rankXp';
import { unrotFonts } from '../theme';

const CANVAS = '#FFFFFF';
const INK = '#0A0A0A';
const SECONDARY = '#6B6B6B';
const LABEL = '#9A9A9A';
const BORDER = 'rgba(10, 10, 12, 0.09)';
const TRACK = 'rgba(10, 10, 12, 0.08)';
const PAD_H = 24;
const RADIUS = 20;
const CARD_GRADIENT = ['#FFFFFF', '#F6F5F4', '#EEECEA'] as const;
const CARD_LOCS = [0, 0.5, 1] as const;

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },
  android: { elevation: 4 },
  default: {},
});

const tileShadow = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
  },
  android: { elevation: 3 },
  default: {},
});

type Props = {
  tabBarInset: number;
  onGoBack: () => void;
};

function progressBarWidthPct(progress01: number): number {
  if (progress01 <= 0) return 0;
  return Math.max(2.2, Math.min(100, Math.round(progress01 * 1000) / 10));
}

export function RankScreen({ tabBarInset, onGoBack }: Props) {
  const insets = useSafeAreaInsets();
  const [snap, setSnap] = useState<RankUiSnapshot>(() => toRankUiSnapshot(DEFAULT_RANK_STATE));
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setSnap(toRankUiSnapshot(await loadRankState()));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const { rank, nextRank, progress01, xp, streak, todayXp, xpForNextLevel } = snap;
  const pctTier = nextRank ? Math.round(progress01 * 100) : 100;

  const streakCaption =
    streak <= 0 ? 'log to begin' : streak === 1 ? '1 day · nice start' : `${streak} days · keep it going`;

  return (
    <View style={[styles.root, { paddingBottom: tabBarInset }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingHorizontal: PAD_H,
          paddingBottom: Math.max(insets.bottom, 28) + 32,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={INK}
            {...(Platform.OS === 'android'
              ? { colors: [INK], progressBackgroundColor: CANVAS }
              : {})}
          />
        }
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onGoBack();
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        <Text style={styles.eyebrow}>RANK</Text>

        <View style={styles.heroShell}>
          <LinearGradient
            colors={[...CARD_GRADIENT]}
            locations={[...CARD_LOCS]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradientPad}
          >
            <View style={styles.heroIdentityCopy}>
              <Text style={styles.rankDisplay}>{rank.title}</Text>
              <Text style={styles.levelLine}>Level {rank.level}</Text>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.progressHeaderRow}>
              <Text style={styles.heroCardKicker}>Toward next tier</Text>
              {nextRank != null ? (
                <Text style={styles.pctChip}>{pctTier}%</Text>
              ) : (
                <Text style={styles.pctChip}>MAX</Text>
              )}
            </View>

            <Text style={styles.heroCardTarget}>
              {nextRank ? `${nextRank.title} · ${nextRank.minXp.toLocaleString()} XP` : 'Peak rank'}
            </Text>

            {nextRank != null && xpForNextLevel > 0 ? (
              <Text style={styles.xpToGo}>
                {xpForNextLevel.toLocaleString()} XP to go
              </Text>
            ) : null}

            <View style={styles.track}>
              <View style={[styles.fill, { width: `${progressBarWidthPct(progress01)}%` }]} />
            </View>

            {nextRank == null ? (
              <Text style={styles.barMetaSecondary}>
                You have reached the highest tier. Keep logging to grow your score.
              </Text>
            ) : null}
          </LinearGradient>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statTileShell}>
            <LinearGradient
              colors={[...CARD_GRADIENT]}
              locations={[...CARD_LOCS]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statTileInner}
            >
              <Text style={styles.statLabel}>Streak</Text>
              <Text style={styles.statValue}>{streak}</Text>
              <Text style={styles.statCaption}>{streakCaption}</Text>
            </LinearGradient>
          </View>
          <View style={styles.statTileShell}>
            <LinearGradient
              colors={[...CARD_GRADIENT]}
              locations={[...CARD_LOCS]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statTileInner}
            >
              <Text style={styles.statLabel}>Total XP</Text>
              <Text style={styles.statValue}>{xp.toLocaleString()}</Text>
              <Text style={styles.statCaption}>all time</Text>
            </LinearGradient>
          </View>
          <View style={styles.statTileShell}>
            <LinearGradient
              colors={[...CARD_GRADIENT]}
              locations={[...CARD_LOCS]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statTileInner}
            >
              <Text style={styles.statLabel}>Today</Text>
              <Text style={styles.statValue}>+{todayXp}</Text>
              <Text style={styles.statCaption}>earned XP</Text>
            </LinearGradient>
          </View>
        </View>

        <View style={styles.tipShell}>
          <LinearGradient
            colors={[...CARD_GRADIENT]}
            locations={[...CARD_LOCS]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tipInner}
          >
            <Text style={styles.tipKicker}>How you earn XP</Text>
            <Text style={styles.tipBody}>
              Reflective logs and strong screen-time days add the most. Pull down to refresh after a session.
            </Text>
          </LinearGradient>
        </View>

        <Text style={styles.listHeading}>All ranks</Text>
        <View style={styles.rankListCard}>
          {RANKS.map((r, index) => {
            const earned = xp >= r.minXp;
            const locked = !earned;
            const current = r.level === rank.level;
            const last = index === RANKS.length - 1;
            return (
              <View
                key={r.level}
                style={[
                  styles.rankListRow,
                  !last && styles.rankListRowDivider,
                  current && styles.rankListRowCurrent,
                ]}
              >
                <View style={styles.rankRowRankCol}>
                  <Text style={styles.rankRowIndex}>{String(r.level).padStart(2, '0')}</Text>
                </View>
                <View style={styles.rankRowLeft}>
                  <Text
                    style={[
                      styles.rankRowTitle,
                      locked && !current && styles.textLocked,
                    ]}
                  >
                    {r.title}
                  </Text>
                  <Text
                    style={[
                      styles.rankRowXp,
                      locked && !current && styles.textLocked,
                    ]}
                  >
                    {r.minXp.toLocaleString()} XP floor
                  </Text>
                </View>
                <View style={styles.rankRowRight}>
                  {current ? (
                    <View style={styles.currentPill}>
                      <Text style={styles.currentPillText}>Current</Text>
                    </View>
                  ) : null}
                  {earned && !current ? (
                    <View style={styles.earnedWrap}>
                      <Text style={styles.earnedMark}>✓</Text>
                      <Text style={styles.earnedLabel}>Earned</Text>
                    </View>
                  ) : null}
                  {locked && !current ? <Text style={styles.lockLabel}>Locked</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CANVAS,
  },
  scroll: {
    flex: 1,
    backgroundColor: CANVAS,
  },
  headerRow: {
    marginBottom: 22,
  },
  backText: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    letterSpacing: 0.35,
    color: SECONDARY,
  },
  eyebrow: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 9,
    letterSpacing: 2.4,
    color: LABEL,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  heroShell: {
    alignSelf: 'stretch',
    borderRadius: RADIUS,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
    ...cardShadow,
  },
  heroGradientPad: {
    paddingHorizontal: 22,
    paddingVertical: 22,
  },
  heroIdentityCopy: {
    alignSelf: 'stretch',
  },
  rankDisplay: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 32,
    lineHeight: 38,
    color: INK,
    letterSpacing: -0.45,
    marginBottom: 6,
  },
  levelLine: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: SECONDARY,
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(10, 10, 12, 0.1)',
    marginTop: 20,
    marginBottom: 18,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heroCardKicker: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 9,
    letterSpacing: 2.2,
    color: LABEL,
    textTransform: 'uppercase',
  },
  pctChip: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: INK,
    opacity: 0.55,
    fontVariant: ['tabular-nums'],
  },
  heroCardTarget: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 16,
    lineHeight: 22,
    color: INK,
    marginBottom: 6,
  },
  xpToGo: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 18,
    color: SECONDARY,
    marginBottom: 12,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: TRACK,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: INK,
  },
  barMetaSecondary: {
    marginTop: 12,
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    lineHeight: 17,
    color: SECONDARY,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    alignSelf: 'stretch',
  },
  statTileShell: {
    flex: 1,
    minWidth: 0,
    borderRadius: RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
    ...tileShadow,
  },
  statTileInner: {
    flex: 1,
    alignSelf: 'stretch',
    paddingVertical: 16,
    paddingHorizontal: 10,
    minHeight: 100,
  },
  statLabel: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 8,
    letterSpacing: 1.4,
    color: LABEL,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statValue: {
    fontFamily: unrotFonts.interLight,
    fontSize: 21,
    lineHeight: 26,
    color: INK,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
  },
  statCaption: {
    marginTop: 6,
    fontFamily: unrotFonts.interRegular,
    fontSize: 10,
    lineHeight: 14,
    color: LABEL,
  },
  tipShell: {
    alignSelf: 'stretch',
    borderRadius: RADIUS,
    overflow: 'hidden',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: BORDER,
    ...tileShadow,
  },
  tipInner: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  tipKicker: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 8,
    letterSpacing: 1.6,
    color: LABEL,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  tipBody: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 20,
    color: SECONDARY,
  },
  listHeading: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 9,
    letterSpacing: 2.4,
    color: LABEL,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  rankListCard: {
    alignSelf: 'stretch',
    borderRadius: RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CANVAS,
    ...tileShadow,
  },
  rankListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: CANVAS,
  },
  rankListRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(10, 10, 12, 0.08)',
  },
  rankListRowCurrent: {
    backgroundColor: '#FAFAFA',
    borderLeftWidth: 3,
    borderLeftColor: INK,
    paddingLeft: 9,
  },
  rankRowRankCol: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  rankRowIndex: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 10,
    color: LABEL,
    fontVariant: ['tabular-nums'],
    opacity: 0.85,
  },
  rankRowLeft: {
    flex: 1,
    minWidth: 0,
  },
  rankRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: 8,
  },
  rankRowTitle: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 16,
    lineHeight: 22,
    color: INK,
    marginBottom: 2,
  },
  rankRowXp: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    lineHeight: 16,
    color: SECONDARY,
  },
  textLocked: {
    opacity: 0.42,
  },
  currentPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
  },
  currentPillText: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: INK,
    textTransform: 'uppercase',
  },
  earnedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  earnedMark: {
    fontSize: 12,
    color: SECONDARY,
    lineHeight: 14,
    marginTop: -1,
  },
  earnedLabel: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 8,
    letterSpacing: 1,
    color: SECONDARY,
    textTransform: 'uppercase',
  },
  lockLabel: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    color: LABEL,
  },
});
