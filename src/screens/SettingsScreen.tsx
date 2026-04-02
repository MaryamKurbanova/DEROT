import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IosScreenTimePanel } from '../components/IosScreenTimePanel';
import { SomaticBreathing } from '../components/SomaticBreathing';
import { DISTRACTION_APPS } from '../lib/distractionApps';
import { getMonitoredAppIds, setAppMonitored } from '../lib/monitoredApps';
import { androidRequestUsageStatsPermission } from '../lib/androidRotUsage';
import { fontFamilies, spacing } from '../theme';

const BG = '#000000';
const FG = '#FFFFFF';
const GREY = '#888888';
const TRACK = 2;

const BREATH_SESSION_SECONDS = 30;

function formatBreathClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

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
  const [breathingOpen, setBreathingOpen] = useState(false);
  const [breathSessionKey, setBreathSessionKey] = useState(0);
  const [breathSecondsLeft, setBreathSecondsLeft] = useState(BREATH_SESSION_SECONDS);

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
    if (!breathingOpen) return;
    const id = setInterval(() => {
      setBreathSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [breathingOpen, breathSessionKey]);

  useEffect(() => {
    if (!breathingOpen || breathSecondsLeft > 0) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBreathingOpen(false);
  }, [breathingOpen, breathSecondsLeft]);

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
        {DISTRACTION_APPS.map((app) => (
          <View key={app.id} style={styles.row}>
            <Text style={styles.rowLabel}>{app.label}</Text>
            <Switch
              value={monitored.has(app.id)}
              onValueChange={(v) => void toggleApp(app.id, v)}
              trackColor={{ false: '#333', true: '#555' }}
              thumbColor={monitored.has(app.id) ? FG : GREY}
            />
          </View>
        ))}

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

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>› BREATHING</Text>
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            setBreathSecondsLeft(BREATH_SESSION_SECONDS);
            setBreathSessionKey((k) => k + 1);
            setBreathingOpen(true);
          }}
          style={({ pressed }) => [
            styles.ghostBtn,
            styles.ghostBtnCentered,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.ghostBtnText, styles.ghostBtnTextCentered]}>BREATHING TOOL</Text>
        </Pressable>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>› REFLECTIVE_LOG</Text>
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

      <Modal
        visible={breathingOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setBreathingOpen(false)}
      >
        <View
          style={[
            styles.breathModal,
            { paddingTop: insets.top + spacing.sm, paddingBottom: tabBarInset },
          ]}
        >
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              setBreathingOpen(false);
            }}
            hitSlop={12}
            style={({ pressed }) => [styles.breathCloseBtn, pressed && { opacity: 0.55 }]}
          >
            <Text style={styles.backText}>← CLOSE</Text>
          </Pressable>
          <Text style={styles.breathTimerTop} accessibilityRole="timer">
            {formatBreathClock(breathSecondsLeft)}
          </Text>
          <View style={styles.breathCenter}>
            <SomaticBreathing
              key={breathSessionKey}
              variant="zen"
              outerDiameter={300}
            />
          </View>
        </View>
      </Modal>
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
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    color: GREY,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  sectionSpacer: {
    marginTop: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dotted',
  },
  rowLabel: {
    flex: 1,
    paddingRight: spacing.md,
    fontFamily: fontFamilies.mono,
    fontSize: 13,
    color: FG,
    letterSpacing: 0.5,
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
    borderColor: FG,
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
    borderColor: 'rgba(255,255,255,0.35)',
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
  ghostBtn: {
    borderWidth: 1,
    borderColor: FG,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    backgroundColor: 'transparent',
    marginBottom: spacing.md,
  },
  ghostBtnCentered: {
    alignItems: 'center',
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
    letterSpacing: TRACK,
    flexShrink: 1,
  },
  ghostBtnTextCentered: {
    textAlign: 'center',
    width: '100%',
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
  breathModal: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: spacing.lg,
  },
  breathCloseBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  breathTimerTop: {
    fontFamily: fontFamilies.monoSemi,
    fontSize: 26,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
    color: 'rgba(255, 255, 255, 0.92)',
    letterSpacing: 1,
    textAlign: 'center',
    width: '100%',
    marginBottom: 80,
    marginTop: spacing.lg,
  },
  breathCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
});
