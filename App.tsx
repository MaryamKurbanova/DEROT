import {
  Nunito_300Light,
  Nunito_400Regular,
  Nunito_600SemiBold,
  useFonts,
} from '@expo-google-fonts/nunito';
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
import {
  getOnboardingComplete,
  resetOnboardingForDev,
} from './src/lib/onboardingStorage';
import { MainShell } from './src/screens/MainShell';
import { OnboardingFlow } from './src/screens/OnboardingFlow';
import { monolith, shell } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const [fontsLoaded] = useFonts({
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
      const done = await getOnboardingComplete();
      setShowOnboarding(!done);
      setBootReady(true);
      await SplashScreen.hideAsync();
    })();
  }, [fontsLoaded]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const { subscribeDerotUsageRecompute, recomputeDerotUsageTotals } =
      require('./src/lib/derotIosScreenTime') as typeof import('./src/lib/derotIosScreenTime');
    recomputeDerotUsageTotals();
    const sub = subscribeDerotUsageRecompute();
    return () => sub.remove();
  }, []);

  if (!fontsLoaded || !bootReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={monolith.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        {showOnboarding ? (
          <>
            <StatusBar style="light" />
            <OnboardingFlow
              onDone={() => {
                setShowOnboarding(false);
              }}
            />
          </>
        ) : (
          <MainShell
            onReplayOnboarding={async () => {
              await resetOnboardingForDev();
              setShowOnboarding(true);
            }}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: shell.bg },
  boot: {
    flex: 1,
    backgroundColor: shell.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
