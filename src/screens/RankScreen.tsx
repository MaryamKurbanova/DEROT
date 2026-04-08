import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEFAULT_RANK_STATE,
  loadRankState,
  RANKS,
  toRankUiSnapshot,
  type RankUiSnapshot,
} from '../lib/rankXp';
import { unrot, unrotFonts } from '../theme';

const INK = '#111111';
const MUTED = '#8A8A8A';
const TRACK = '#E8E8E8';
const PAD_H = 28;
const RADIUS = 20;

type Props = {
  tabBarInset: number;
  onGoBack: () => void;
};

export function RankScreen({ tabBarInset, onGoBack }: Props) {
  const insets = useSafeAreaInsets();
  const [snap, setSnap] = useState<RankUiSnapshot>(() => toRankUiSnapshot(DEFAULT_RANK_STATE));

  const reload = useCallback(async () => {
    setSnap(toRankUiSnapshot(await loadRankState()));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const { rank, nextRank, progress01, xp, nextThresholdXp, streak, todayXp } = snap;
  const tierSpan = nextRank ? nextRank.minXp - rank.minXp : 1;
  const xpIntoTier = Math.max(0, xp - rank.minXp);

  return (
    <View style={[styles.root, { paddingBottom: tabBarInset }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: PAD_H,
          paddingBottom: Math.max(insets.bottom, 24) + 24,
        }}
        showsVerticalScrollIndicator={false}
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

        <Text style={styles.title}>Rank</Text>
        <Text style={styles.rankName}>{rank.title}</Text>
        <Text style={styles.levelLineMuted}>Level {rank.level}</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Progress to {nextRank ? nextRank.title : 'peak'}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress01 * 10000) / 100}%` }]} />
          </View>
          <Text style={styles.barMeta}>
            {nextRank
              ? `${xpIntoTier} / ${tierSpan} XP this tier · ${xp} / ${nextThresholdXp} toward ${nextRank.title}`
              : `${xp} XP · max rank`}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Streak</Text>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statCaption}>days logged</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Total XP</Text>
            <Text style={styles.statValue}>{xp}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Today</Text>
            <Text style={styles.statValue}>+{todayXp}</Text>
            <Text style={styles.statCaption}>XP</Text>
          </View>
        </View>

        <Text style={styles.listHeading}>All ranks</Text>
        {RANKS.map((r) => {
          const locked = xp < r.minXp;
          const current = r.level === rank.level;
          return (
            <View
              key={r.level}
              style={[
                styles.rankRow,
                current && styles.rankRowCurrent,
                locked && styles.rankRowLocked,
              ]}
            >
              <View style={styles.rankRowLeft}>
                <Text style={[styles.rankRowTitle, locked && styles.textMuted]}>{r.title}</Text>
                <Text style={[styles.rankRowXp, locked && styles.textMuted]}>{r.minXp} XP</Text>
              </View>
              {current ? <Text style={styles.rankPill}>Current</Text> : null}
              {locked ? <Text style={styles.lockLabel}>Locked</Text> : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: unrot.bg,
  },
  scroll: {
    flex: 1,
  },
  headerRow: {
    marginBottom: 20,
  },
  backText: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 15,
    letterSpacing: 0.1,
    color: INK,
    opacity: 0.72,
  },
  title: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 10,
    letterSpacing: 2,
    color: MUTED,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  rankName: {
    fontFamily: unrotFonts.interLight,
    fontSize: 32,
    lineHeight: 38,
    color: INK,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  levelLineMuted: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 15,
    lineHeight: 22,
    color: MUTED,
    marginBottom: 22,
  },
  card: {
    backgroundColor: '#F7F7F7',
    borderRadius: RADIUS,
    padding: 20,
    marginBottom: 20,
  },
  cardLabel: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    color: MUTED,
    marginBottom: 10,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: TRACK,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: INK,
  },
  barMeta: {
    marginTop: 10,
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 18,
    color: INK,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  statTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(17, 17, 17, 0.08)',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  statLabel: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: MUTED,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  statValue: {
    fontFamily: unrotFonts.interLight,
    fontSize: 22,
    lineHeight: 28,
    color: INK,
    fontVariant: ['tabular-nums'],
  },
  statCaption: {
    marginTop: 4,
    fontFamily: unrotFonts.interRegular,
    fontSize: 11,
    color: MUTED,
  },
  listHeading: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 10,
    letterSpacing: 2,
    color: MUTED,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17, 17, 17, 0.06)',
    marginBottom: 8,
  },
  rankRowCurrent: {
    borderColor: INK,
    borderWidth: 1.5,
    backgroundColor: '#FAFAFA',
  },
  rankRowLocked: {
    opacity: 0.45,
  },
  rankRowLeft: {
    flex: 1,
    minWidth: 0,
  },
  rankRowTitle: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 16,
    color: INK,
    marginBottom: 2,
  },
  rankRowXp: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    color: MUTED,
  },
  textMuted: {
    color: MUTED,
  },
  rankPill: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: INK,
    textTransform: 'uppercase',
    marginLeft: 8,
  },
  lockLabel: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    color: MUTED,
    marginLeft: 8,
  },
});
