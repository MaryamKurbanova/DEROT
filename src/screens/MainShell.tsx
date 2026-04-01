import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shouldShowFocusWallForApp } from '../lib/accessPass';
import { DISTRACTION_APPS, findDistractionById, type DistractionApp } from '../lib/distractionApps';
import { getInterceptArmed } from '../lib/interceptArmed';
import {
  getPendingDistractionIdFromNative,
  subscribeDistractionLaunches,
} from '../lib/interceptBridge';
import { iosEnsureStickyMonitoring, iosStickyReportsAreAuthoritative } from '../lib/iosStickyRotUsage';
import { getMonitoredAppIds, isAppMonitored } from '../lib/monitoredApps';
import { setLastActiveAppId } from '../lib/usageStats';
import { registerInterceptWallHandler, requestInterceptWall } from '../lib/wallBridge';
import { spacing } from '../theme';
import { DashboardScreen } from './DashboardScreen';
import { FocusWallScreen, type FocusWallPurpose } from './FocusWallScreen';
import { SettingsScreen } from './SettingsScreen';

function appIdFromUrl(url: string): string | null {
  const q = url.split('?')[1];
  if (!q) return null;
  const params = new URLSearchParams(q);
  return params.get('app') || params.get('id');
}

type Props = {
  onReplayOnboarding?: () => void | Promise<void>;
};

export function MainShell({ onReplayOnboarding }: Props) {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<'dashboard' | 'settings'>('dashboard');
  const [wallOpen, setWallOpen] = useState(false);
  const [wallPurpose, setWallPurpose] = useState<FocusWallPurpose>('intercept');
  const [targetApp, setTargetApp] = useState<DistractionApp>(DISTRACTION_APPS[0]);
  const [statsTick, setStatsTick] = useState(0);

  const bottomInset = Math.max(insets.bottom, 16) + spacing.md;

  const considerWall = useCallback(async (appId: string) => {
    if (!(await getInterceptArmed())) return;
    const app = findDistractionById(appId);
    if (!app) return;
    if (!(await isAppMonitored(appId))) return;
    const show = await shouldShowFocusWallForApp(appId);
    if (!show) return;
    await setLastActiveAppId(appId);
    setTargetApp(app);
    setWallPurpose('intercept');
    setWallOpen(true);
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

  const refreshMonitoredAfterWall = useCallback(async () => {
    await getMonitoredAppIds();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <View style={[styles.root, { backgroundColor: '#000000' }]}>
        <View style={styles.body}>
          {screen === 'dashboard' ? (
            <DashboardScreen statsTick={statsTick} onOpenSettings={() => setScreen('settings')} />
          ) : null}
          {screen === 'settings' ? (
            <SettingsScreen
              tabBarInset={bottomInset}
              onGoBack={() => setScreen('dashboard')}
              onReplayOnboarding={onReplayOnboarding}
              onBreathingTool={async () => {
                const ids = await getMonitoredAppIds();
                const id = ids[0] ?? DISTRACTION_APPS[0].id;
                await setLastActiveAppId(id);
                const app = findDistractionById(id) ?? DISTRACTION_APPS[0];
                setTargetApp(app);
                setWallPurpose('practice');
                setWallOpen(true);
              }}
            />
          ) : null}
        </View>

        <FocusWallScreen
          visible={wallOpen}
          purpose={wallPurpose}
          targetAppId={targetApp.id}
          targetLabel={targetApp.label}
          onClose={() => {
            setWallOpen(false);
            setStatsTick((t) => t + 1);
            void refreshMonitoredAfterWall();
          }}
        />
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
