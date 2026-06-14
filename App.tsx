import {
  Inter_300Light,
  Inter_400Regular,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  Nunito_300Light,
  Nunito_400Regular,
  Nunito_600SemiBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
} from '@expo-google-fonts/playfair-display';
import {
  RobotoMono_400Regular,
  RobotoMono_500Medium,
  RobotoMono_600SemiBold,
  RobotoMono_700Bold,
} from '@expo-google-fonts/roboto-mono';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { getOnboardingComplete } from './src/lib/onboardingStorage';
import { unrot } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    Inter_300Light,
    Inter_400Regular,
    Inter_700Bold,
    Nunito_300Light,
    Nunito_400Regular,
    Nunito_600SemiBold,
    RobotoMono_400Regular,
    RobotoMono_500Medium,
    RobotoMono_600SemiBold,
    RobotoMono_700Bold,
  });
  const [bootReady, setBootReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    if (!fontsLoaded) return;
    void (async () => {
      try {
        const done = await getOnboardingComplete();
        setShowOnboarding(!done);
      } catch (e) {
        console.warn('getOnboardingComplete', e);
        setShowOnboarding(true);
      } finally {
        setBootReady(true);
        await SplashScreen.hideAsync().catch(() => undefined);
      }
    })();
  }, [fontsLoaded]);

  /** Screen Time native APIs throw "runtime not ready" if called during first paint. */
  useEffect(() => {
    if (Platform.OS !== 'ios' || !bootReady || showOnboarding) return;
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    void (async () => {
      const waits = [0, 400, 1000, 2500];
      for (const ms of waits) {
        if (ms > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, ms));
        }
        if (cancelled) return;
        try {
          const {
            loadIosDeviceActivity,
            recomputeDerotUsageTotals,
            setScreenTimeRuntimeReady,
            subscribeDerotUsageRecompute,
          } = require('./src/lib/derotIosScreenTime') as typeof import('./src/lib/derotIosScreenTime');
          setScreenTimeRuntimeReady(true);
          const da = loadIosDeviceActivity();
          if (!da?.isAvailable()) continue;
          recomputeDerotUsageTotals();
          sub = subscribeDerotUsageRecompute();
          const { syncNightQuietIfEnabled } =
            require('./src/lib/nightQuietHoursLock') as typeof import('./src/lib/nightQuietHoursLock');
          void syncNightQuietIfEnabled();
          const { syncMonitoredAppShields } =
            require('./src/lib/monitoredAppShield') as typeof import('./src/lib/monitoredAppShield');
          void syncMonitoredAppShields();
          return;
        } catch (e) {
          console.warn('iosScreenTimeBoot', e);
        }
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [bootReady, showOnboarding]);

  if (!fontsLoaded || !bootReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={unrot.ink} size="large" />
      </View>
    );
  }

  const mainShellModule =
    (require('./src/screens/MainShell') as Partial<typeof import('./src/screens/MainShell')> | undefined) ?? {};
  const onboardingModule =
    (require('./src/screens/OnboardingFlow') as Partial<typeof import('./src/screens/OnboardingFlow')> | undefined) ??
    {};
  const MainShellScreen = mainShellModule.MainShell;
  const OnboardingFlowScreen = onboardingModule.OnboardingFlow;

  if (!MainShellScreen || !OnboardingFlowScreen) {
    console.error('App screen module load failed', {
      hasMainShell: Boolean(MainShellScreen),
      hasOnboardingFlow: Boolean(OnboardingFlowScreen),
    });
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={unrot.ink} size="large" />
      </View>
    );
  }

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <View style={styles.root}>
          {showOnboarding ? (
            <>
              <StatusBar style="dark" />
              <OnboardingFlowScreen
                onDone={() => {
                  setShowOnboarding(false);
                }}
              />
            </>
          ) : (
            <MainShellScreen onReplayOnboarding={() => setShowOnboarding(true)} />
          )}
        </View>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: unrot.bg },
  boot: {
    flex: 1,
    backgroundColor: unrot.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
