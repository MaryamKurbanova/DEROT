import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IosScreenTimePanel } from '../components/IosScreenTimePanel';
import { MonitoredAppIcon } from '../components/MonitoredAppIcon';
import { DISTRACTION_APPS } from '../lib/distractionApps';
import { getMonitoredAppIds, setAppMonitored } from '../lib/monitoredApps';
import { androidRequestUsageStatsPermission } from '../lib/androidRotUsage';
import { fontFamilies, monolith, spacing, typeScale } from '../theme';

const BG = monolith.surface;
const FG = monolith.primary;
const GREY = monolith.muted;
const TRACK = 4;

type Props = {
  tabBarInset: number;
  onGoBack: () => void;
  onReplayOnboarding?: () => void | Promise<void>;
  onBreathingTool: () => void | Promise<void>;
};

export function SettingsScreen({
  tabBarInset,
  onGoBack,
  onReplayOnboarding,
  onBreathingTool,
}: Props) {
  const insets = useSafeAreaInsets();
  const [monitored, setMonitored] = useState<Set<string>>(new Set());

  const readyDotOpacity = useRef(new Animated.Value(0.5)).current;

  const refresh = useCallback(async () => {
    const ids = await getMonitoredAppIds();
    setMonitored(new Set(ids));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(readyDotOpacity, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(readyDotOpacity, {
          toValue: 0.5,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [readyDotOpacity]);

  const toggleApp = async (appId: string, on: boolean) => {
    void Haptics.selectionAsync();
    await setAppMonitored(appId, on);
    setMonitored((prev) => {
      const next = new Set(prev);
      if (on) next.add(appId);
      else next.delete(appId);
      return next;
    });
  };

  const topPad = insets.top + spacing.sm;

  return (
    <View style={[styles.root, { paddingBottom: tabBarInset }]}>
      <View style={[styles.topBar, { paddingTop: topPad }]}>
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            onGoBack();
          }}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.55 }]}
        >
          <Text style={styles.backText}>← BACK</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>MONITORED_APPS</Text>
        <View style={styles.appGrid}>
          {DISTRACTION_APPS.map((app) => {
            const on = monitored.has(app.id);
            return (
              <Pressable
                key={app.id}
                onPress={() => void toggleApp(app.id, !on)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${app.label}, ${on ? 'monitored' : 'not monitored'}. Tap to toggle.`}
                android_ripple={
                  Platform.OS === 'android' ? { color: 'rgba(255,255,255,0.12)' } : undefined
                }
                style={({ pressed }) => [
                  styles.appTile,
                  on && styles.appTileMonitored,
                  on && Platform.OS === 'android' && styles.appTileMonitoredAndroid,
                  pressed && styles.appTilePressed,
                ]}
              >
                {on ? <View style={styles.appTileMonitorDot} pointerEvents="none" /> : null}
                <View style={styles.appTileInner}>
                  <View style={styles.appTileIconWrap}>
                    <MonitoredAppIcon appId={app.id} size={50} muted={!on} />
                  </View>
                  <Text
                    style={[styles.appTileLabel, !on && styles.appTileLabelMuted]}
                    numberOfLines={2}
                  >
                    {app.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>SCREEN_TIME</Text>
        {Platform.OS === 'ios' ? (
          <IosScreenTimePanel onChanged={() => void refresh()} />
        ) : null}
        {Platform.OS === 'android' ? (
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              void androidRequestUsageStatsPermission();
            }}
            style={({ pressed }) => [styles.screenTimeBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.screenTimeBtnText}>ALLOW USAGE ACCESS</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            void Linking.openSettings();
          }}
          style={({ pressed }) => [styles.screenTimeBtnSecondary, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.screenTimeBtnSecondaryText}>
            {Platform.OS === 'android'
              ? 'OTHER APP SETTINGS (NOT USAGE)'
              : 'UNROT IN SYSTEM SETTINGS'}
          </Text>
        </Pressable>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>FOCUS_RESET</Text>
        <Text style={styles.caption}>
          After logging, you get <Text style={styles.captionEm}>10 minutes</Text> of access. Then log
          pops up when you click on the app again.
        </Text>

        <Text style={[styles.sectionSpacer, styles.toolSectionLabel]}>› REFLECTIVE_LOG</Text>
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            void onBreathingTool();
          }}
          style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.ghostBtnRow}>
            <Text style={styles.ghostBtnText}>REFLECTIVE LOG</Text>
            <View style={styles.readyCluster}>
              <Animated.View style={[styles.readyDot, { opacity: readyDotOpacity }]} />
              <Text style={styles.readyLabel}>[ READY ]</Text>
            </View>
          </View>
        </Pressable>

        {onReplayOnboarding ? (
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              void onReplayOnboarding();
            }}
            style={({ pressed }) => [styles.subtleBtn, pressed && { opacity: 0.65 }]}
          >
            <Text style={styles.subtleBtnText}>Replay onboarding</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  topBar: {
    width: '100%',
    alignItems: 'flex-start',
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
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
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    ...typeScale.label,
    marginBottom: spacing.sm,
  },
  sectionSpacer: {
    marginTop: spacing.xl,
  },
  /** Softer subheads above breathing / reflective (matches older settings). */
  toolSectionLabel: {
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    color: GREY,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  appGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  appTile: {
    width: '31%',
    maxWidth: '33%',
    flexGrow: 0,
    flexShrink: 0,
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    paddingHorizontal: 8,
    paddingVertical: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  appTileMonitored: {
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.55)',
    backgroundColor: 'rgba(255,184,0,0.09)',
  },
  appTileMonitoredAndroid: {
    elevation: 5,
  },
  appTilePressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  appTileMonitorDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: monolith.signalAmber,
    zIndex: 1,
  },
  appTileInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  appTileIconWrap: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  appTileLabel: {
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    lineHeight: 12,
    color: FG,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    width: '100%',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  appTileLabelMuted: {
    color: GREY,
    opacity: 0.85,
  },
  caption: {
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    color: GREY,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  captionEm: {
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    color: FG,
    letterSpacing: 0.5,
  },
  screenTimeBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  screenTimeBtnText: {
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    color: FG,
    letterSpacing: TRACK,
    textTransform: 'uppercase',
  },
  screenTimeBtnSecondary: {
    borderWidth: 1,
    borderColor: monolith.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  screenTimeBtnSecondaryText: {
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    color: GREY,
    letterSpacing: TRACK,
    textTransform: 'uppercase',
  },
  /** Breathing + reflective log — classic full-outline buttons (pre–industrial luxury). */
  ghostBtn: {
    borderWidth: 1,
    borderColor: FG,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    backgroundColor: 'transparent',
    marginBottom: spacing.md,
  },
  ghostBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  ghostBtnText: {
    fontFamily: fontFamilies.mono,
    fontSize: 12,
    color: FG,
    letterSpacing: 2,
    flexShrink: 1,
  },
  readyCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  readyDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: FG,
  },
  readyLabel: {
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    color: FG,
    letterSpacing: 1,
    opacity: 0.9,
    marginLeft: 8,
  },
  subtleBtn: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  subtleBtnText: {
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    color: GREY,
    textDecorationLine: 'underline',
  },
});
