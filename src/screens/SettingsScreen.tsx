import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MonitoredAppIcon } from '../components/MonitoredAppIcon';
import {
  getPassDurationMinutes,
  PASS_DURATION_MINUTES_DEFAULT,
  PASS_DURATION_MINUTES_MAX,
  PASS_DURATION_MINUTES_MIN,
  setPassDurationMinutes,
} from '../lib/accessPass';
import { DISTRACTION_APPS } from '../lib/distractionApps';
import { getMonitoredAppIds, setAppMonitored } from '../lib/monitoredApps';
import { unrot, unrotFonts } from '../theme';

const G = unrot.gutter;
const ROW_GAP = 24;

type Props = {
  tabBarInset: number;
  onGoBack: () => void;
  onReplayOnboarding?: () => void;
};

export function SettingsScreen({ tabBarInset, onGoBack, onReplayOnboarding }: Props) {
  const insets = useSafeAreaInsets();
  const [monitored, setMonitored] = useState<Set<string>>(new Set());
  const [logEveryMinutes, setLogEveryMinutes] = useState(PASS_DURATION_MINUTES_DEFAULT);

  const refresh = useCallback(async () => {
    const ids = await getMonitoredAppIds();
    setMonitored(new Set(ids));
  }, []);

  const refreshPassMinutes = useCallback(async () => {
    const m = await getPassDurationMinutes();
    setLogEveryMinutes(m);
  }, []);

  useEffect(() => {
    void refresh();
    void refreshPassMinutes();
  }, [refresh, refreshPassMinutes]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void refresh();
        void refreshPassMinutes();
      }
    });
    return () => sub.remove();
  }, [refresh, refreshPassMinutes]);

  const toggleApp = async (appId: string, on: boolean) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setAppMonitored(appId, on);
    setMonitored((prev) => {
      const next = new Set(prev);
      if (on) next.add(appId);
      else next.delete(appId);
      return next;
    });
  };

  return (
    <View style={[styles.root, { paddingBottom: tabBarInset }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, paddingHorizontal: G }]}>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onGoBack();
          }}
          hitSlop={12}
          style={styles.backHit}
        >
          <Text style={styles.backSerif}>back</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: G,
            paddingBottom: Math.max(insets.bottom, G) + 32,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Settings</Text>

        {onReplayOnboarding ? (
          <>
            <Text style={[styles.sectionTitle, styles.sectionTitleTight]}>Setup</Text>
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onReplayOnboarding();
              }}
              style={styles.onboardingRow}
              accessibilityRole="button"
              accessibilityLabel="Walk through setup again"
            >
              <Text style={styles.onboardingRowTitle}>Walk through setup again</Text>
              <Text style={styles.onboardingRowHint}>Replay the intro and baseline questions.</Text>
            </Pressable>
          </>
        ) : null}

        <Text
          style={[
            styles.sectionTitle,
            onReplayOnboarding ? styles.sectionTitleSpaced : styles.sectionTitleTight,
          ]}
        >
          Reclaimed time
        </Text>
        <Text style={styles.logCadenceBody}>
          After you log, monitored apps stay open for this long before the log returns.
        </Text>
        <View style={styles.sliderBlock}>
          <Slider
            style={styles.sliderTrack}
            minimumValue={PASS_DURATION_MINUTES_MIN}
            maximumValue={PASS_DURATION_MINUTES_MAX}
            step={1}
            value={logEveryMinutes}
            onValueChange={setLogEveryMinutes}
            onSlidingComplete={(v) => {
              void Haptics.selectionAsync();
              void setPassDurationMinutes(v);
            }}
            minimumTrackTintColor={unrot.ink}
            maximumTrackTintColor={unrot.choiceMuted}
            thumbTintColor={Platform.OS === 'android' ? unrot.ink : undefined}
          />
          <Text style={styles.sliderValue}>{logEveryMinutes} min</Text>
        </View>

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Monitored apps</Text>

        {DISTRACTION_APPS.map((app) => {
          const on = monitored.has(app.id);
          return (
            <View key={app.id} style={styles.appRow} accessibilityRole="none">
              <View style={styles.appIconWrap}>
                <MonitoredAppIcon appId={app.id} size={36} muted={!on} />
              </View>
              <View style={styles.appCopy}>
                <Text style={styles.appName}>{app.label}</Text>
              </View>
              <View style={styles.switchWrap}>
                <Switch
                  value={on}
                  onValueChange={(v) => void toggleApp(app.id, v)}
                  accessibilityLabel={app.label}
                  trackColor={{ false: unrot.choiceMuted, true: unrot.ink }}
                  thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                  ios_backgroundColor={unrot.choiceMuted}
                />
              </View>
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
  header: {
    width: '100%',
    paddingBottom: 8,
  },
  backHit: {
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  backSerif: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 17,
    letterSpacing: 0.15,
    color: unrot.ink,
  },
  scroll: {
    flex: 1,
    backgroundColor: unrot.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },
  screenTitle: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 42,
    lineHeight: 48,
    color: unrot.ink,
    marginBottom: 36,
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 15,
    lineHeight: 22,
    color: unrot.muted,
    marginBottom: 8,
  },
  sectionTitleTight: {
    marginBottom: 8,
  },
  logCadenceBody: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 14,
    lineHeight: 22,
    color: unrot.muted,
    marginBottom: 16,
  },
  sectionTitleSpaced: {
    marginTop: 36,
    marginBottom: 22,
  },
  sliderBlock: {
    marginBottom: 8,
  },
  sliderTrack: {
    width: '100%',
    height: 40,
  },
  sliderValue: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 20,
    lineHeight: 28,
    color: unrot.ink,
    marginTop: 4,
    letterSpacing: -0.2,
  },
  onboardingRow: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    marginBottom: 8,
  },
  onboardingRowTitle: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 16,
    lineHeight: 24,
    color: unrot.ink,
    letterSpacing: -0.15,
  },
  onboardingRowHint: {
    marginTop: 4,
    fontFamily: unrotFonts.heroSerif,
    fontSize: 13,
    lineHeight: 19,
    color: unrot.muted,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ROW_GAP,
  },
  appIconWrap: {
    width: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  appCopy: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  appName: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 16,
    lineHeight: 24,
    color: unrot.ink,
    letterSpacing: -0.15,
  },
  switchWrap: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
