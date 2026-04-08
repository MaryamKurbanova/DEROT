import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Linking, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPassDurationMinutes, shouldShowFocusWallForApp } from '../lib/accessPass';
import {
  markBreathPlusLogRitualCompleted,
  shouldRequireBreathingBeforeReflectiveLog,
} from '../lib/breathingInterceptSchedule';
import { DISTRACTION_APPS, findDistractionById, type DistractionApp } from '../lib/distractionApps';
import { getInterceptArmed } from '../lib/interceptArmed';
import {
  getPendingDistractionIdFromNative,
  subscribeDistractionLaunches,
} from '../lib/interceptBridge';
import { iosEnsureStickyMonitoring, iosStickyReportsAreAuthoritative } from '../lib/iosStickyRotUsage';
import { getMonitoredAppIds, isAppMonitored } from '../lib/monitoredApps';
import { awardReflectiveLogXp } from '../lib/rankXp';
import { incrementReclaimedOnReflectiveLogExit } from '../lib/reclaimedMoments';
import { recordFocusWallTrigger } from '../lib/rotVelocity';
import { setLastActiveAppId } from '../lib/usageStats';
import { registerInterceptWallHandler, requestInterceptWall } from '../lib/wallBridge';
import { EDITORIAL_FADE_MS, spacing, unrot } from '../theme';
import { BreathingInterceptModal } from './BreathingInterceptModal';
import { DashboardScreen } from './DashboardScreen';
import { FocusWallScreen, type FocusWallPurpose } from './FocusWallScreen';
import { RankScreen } from './RankScreen';
import { SettingsScreen } from './SettingsScreen';

function appIdFromUrl(url: string): string | null {
  const q = url.split('?')[1];
  if (!q) return null;
  const params = new URLSearchParams(q);
  return params.get('app') || params.get('id');
}

type InterceptSession =
  | null
  /** Reflective log only (10‑minute pass when done). */
  | { kind: 'reflect'; app: DistractionApp }
  /** After breathing phase: same log, then pass + 4‑hour ritual marked complete. */
  | { kind: 'reflect_after_breath'; app: DistractionApp }
  /** Breathing first; then transitions to `reflect_after_breath`. */
  | { kind: 'breath'; app: DistractionApp }
  | { kind: 'practice'; app: DistractionApp };

type MainShellProps = {
  /** Opens the full onboarding flow again (e.g. from Settings). */
  onReplayOnboarding?: () => void;
};

export function MainShell({ onReplayOnboarding }: MainShellProps) {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<'dashboard' | 'settings' | 'rank'>('dashboard');
  const [interceptSession, setInterceptSession] = useState<InterceptSession>(null);
  const [statsTick, setStatsTick] = useState(0);
  const [passDurationMinutes, setPassDurationMinutes] = useState(10);
  const shellFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (screen === 'dashboard') {
      void getPassDurationMinutes().then(setPassDurationMinutes);
    }
  }, [screen]);

  useEffect(() => {
    shellFade.setValue(0);
    Animated.timing(shellFade, {
      toValue: 1,
      duration: EDITORIAL_FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [screen, shellFade]);

  const bottomInset = Math.max(insets.bottom, 16) + spacing.md;

  const dismissIntercept = useCallback(() => {
    setInterceptSession(null);
    setStatsTick((t) => t + 1);
    void getMonitoredAppIds();
  }, []);

  const considerWall = useCallback(async (appId: string) => {
    if (!(await getInterceptArmed())) return;
    const app = findDistractionById(appId);
    if (!app) return;
    if (!(await isAppMonitored(appId))) return;
    const show = await shouldShowFocusWallForApp(appId);
    if (!show) return;
    await setLastActiveAppId(appId);
    const needBreathFirst = await shouldRequireBreathingBeforeReflectiveLog();
    await recordFocusWallTrigger();
    setInterceptSession(needBreathFirst ? { kind: 'breath', app } : { kind: 'reflect', app });
  }, []);

  const onBreathingPhaseComplete = useCallback(() => {
    setInterceptSession((s) => (s?.kind === 'breath' ? { kind: 'reflect_after_breath', app: s.app } : s));
  }, []);

  useEffect(() => {
    registerInterceptWallHandler((appId) => {
      void considerWall(appId);
    });
    return () => registerInterceptWallHandler(null);
  }, [considerWall]);

  useEffect(() => {
    return subscribeDistractionLaunches((payload) => {
      requestInterceptWall(payload.distractionId);
    });
  }, []);

  const maybeOpenPendingWall = useCallback(async () => {
    const pendingId = await getPendingDistractionIdFromNative();
    if (pendingId) {
      void considerWall(pendingId);
    }
  }, [considerWall]);

  useEffect(() => {
    void maybeOpenPendingWall();
    const syncIosSticky = () => {
      if (Platform.OS !== 'ios') return;
      void (async () => {
        if (await iosStickyReportsAreAuthoritative()) {
          await iosEnsureStickyMonitoring();
          setStatsTick((t) => t + 1);
        }
      })();
    };
    syncIosSticky();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void maybeOpenPendingWall();
        syncIosSticky();
      }
    });
    return () => sub.remove();
  }, [maybeOpenPendingWall]);

  useEffect(() => {
    const route = (url: string | null) => {
      if (!url || !url.startsWith('unrot')) return;
      const id = appIdFromUrl(url);
      if (id) void considerWall(id);
    };
    void Linking.getInitialURL().then(route);
    const sub = Linking.addEventListener('url', (e) => route(e.url));
    return () => sub.remove();
  }, [considerWall]);

  const focusWallVisible =
    interceptSession?.kind === 'reflect' ||
    interceptSession?.kind === 'reflect_after_breath' ||
    interceptSession?.kind === 'practice';

  const focusWallPurpose: FocusWallPurpose =
    interceptSession?.kind === 'practice' ? 'practice' : 'intercept';
  const focusWallApp =
    interceptSession?.kind === 'reflect' ||
    interceptSession?.kind === 'reflect_after_breath' ||
    interceptSession?.kind === 'practice'
      ? interceptSession.app
      : DISTRACTION_APPS[0];

  const afterBreathLog = interceptSession?.kind === 'reflect_after_breath';

  const breathVisible = interceptSession?.kind === 'breath';

  return (
    <>
      <StatusBar style="dark" />
      <View style={[styles.root, { backgroundColor: unrot.bg }]}>
        <Animated.View style={[styles.body, { opacity: shellFade }]}>
          {screen === 'dashboard' ? (
            <DashboardScreen
              statsTick={statsTick}
              onOpenSettings={() => setScreen('settings')}
              onOpenRank={() => setScreen('rank')}
              onStartReflectiveLog={async () => {
                const ids = await getMonitoredAppIds();
                const id = ids[0] ?? DISTRACTION_APPS[0].id;
                await setLastActiveAppId(id);
                const app = findDistractionById(id) ?? DISTRACTION_APPS[0];
                setInterceptSession({ kind: 'practice', app });
              }}
            />
          ) : null}
          {screen === 'rank' ? (
            <RankScreen tabBarInset={bottomInset} onGoBack={() => setScreen('dashboard')} />
          ) : null}
          {screen === 'settings' ? (
            <SettingsScreen
              tabBarInset={bottomInset}
              onGoBack={() => setScreen('dashboard')}
              onReplayOnboarding={onReplayOnboarding}
            />
          ) : null}
        </Animated.View>

        <FocusWallScreen
          visible={focusWallVisible}
          purpose={focusWallPurpose}
          targetAppId={focusWallApp.id}
          targetLabel={focusWallApp.label}
          passDurationMinutes={passDurationMinutes}
          interceptPreamble={
            afterBreathLog
              ? 'You’ve breathed. Now complete your log — then you can open the app.'
              : undefined
          }
          onInterceptPassGranted={
            afterBreathLog ? () => void markBreathPlusLogRitualCompleted() : undefined
          }
          onLogSaved={() => {
            void (async () => {
              await awardReflectiveLogXp();
              setStatsTick((t) => t + 1);
            })();
          }}
          onExitPress={() => incrementReclaimedOnReflectiveLogExit()}
          onClose={dismissIntercept}
        />

        <BreathingInterceptModal visible={breathVisible} onBreathingPhaseComplete={onBreathingPhaseComplete} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
});
