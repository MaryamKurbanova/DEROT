import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MonitoredAppIcon } from '../components/MonitoredAppIcon';
import { DISTRACTION_APPS } from '../lib/distractionApps';
import { getMonitoredAppIds, setAppMonitored } from '../lib/monitoredApps';
import { unrot, unrotFonts } from '../theme';

const G = unrot.gutter;
const ROW_GAP = 32;

type Props = {
  tabBarInset: number;
  onGoBack: () => void;
};

export function SettingsScreen({ tabBarInset, onGoBack }: Props) {
  const insets = useSafeAreaInsets();
  const [monitored, setMonitored] = useState<Set<string>>(new Set());

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

        <Text style={[styles.sectionTitle, styles.sectionTitleTight]}>Monitored apps</Text>

        {DISTRACTION_APPS.map((app) => {
          const on = monitored.has(app.id);
          return (
            <Pressable
              key={app.id}
              onPress={() => void toggleApp(app.id, !on)}
              style={({ pressed }) => [styles.appRow, pressed && { opacity: 0.55 }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${app.label}, ${on ? 'monitored' : 'not monitored'}`}
            >
              <View style={styles.appIconWrap}>
                <MonitoredAppIcon appId={app.id} size={36} muted={!on} />
              </View>
              <View style={styles.appCopy}>
                <Text style={styles.appName}>{app.label}</Text>
              </View>
              <Text style={[styles.appToggle, !on && styles.appToggleOff]}>{on ? 'On' : 'Off'}</Text>
            </Pressable>
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
    marginBottom: 22,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ROW_GAP,
  },
  appIconWrap: {
    width: 44,
    alignItems: 'center',
    marginRight: 14,
  },
  appCopy: {
    flex: 1,
    minWidth: 0,
  },
  appName: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 16,
    lineHeight: 24,
    color: unrot.ink,
    letterSpacing: -0.15,
  },
  appToggle: {
    fontFamily: unrotFonts.interBold,
    fontSize: 12,
    lineHeight: 24,
    color: unrot.ink,
    marginLeft: 8,
  },
  appToggleOff: {
    fontFamily: unrotFonts.interRegular,
    color: unrot.narrativeMuted,
  },
});
