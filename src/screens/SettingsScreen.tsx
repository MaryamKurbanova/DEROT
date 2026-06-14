import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { IosScreenTimePanel } from '../components/IosScreenTimePanel';
import { MonitoredAppIcon } from '../components/MonitoredAppIcon';
import { SocialEntertainmentLinkSheet } from '../components/SocialEntertainmentLinkSheet';
import {
  getPassDurationMinutes,
  PASS_DURATION_MINUTES_DEFAULT,
  PASS_DURATION_MINUTES_MAX,
  PASS_DURATION_MINUTES_MIN,
  setPassDurationMinutes,
} from '../lib/accessPass';
import { DISTRACTION_APPS } from '../lib/distractionApps';
import { ensureMonitoredPassRelockState } from '../lib/monitoredPassExpiry';
import { getSocialLockEnabled, setSocialLockEnabled } from '../lib/monitoredApps';
import {
  ensureScreenTimeApprovedForLock,
  isSocialLockSelectionLinked,
  syncMonitoredAppShields,
} from '../lib/monitoredAppShield';
import { loadIosDeviceActivity } from '../lib/derotIosScreenTime';
import {
  getNightQuietHoursEnabled,
  setNightQuietHoursEnabled,
  startNightQuietSchedule,
  stopNightQuietSchedule,
} from '../lib/nightQuietHoursLock';
import { unrot, unrotFonts } from '../theme';

const G = unrot.gutter;

type Props = {
  tabBarInset: number;
  onGoBack: () => void;
  onReplayOnboarding?: () => void;
  onScreenTimeChanged?: () => void;
};

export function SettingsScreen({ tabBarInset, onGoBack, onReplayOnboarding, onScreenTimeChanged }: Props) {
  const insets = useSafeAreaInsets();
  const [socialLockOn, setSocialLockOn] = useState(false);
  const [appsLinked, setAppsLinked] = useState(false);
  const [linkSheetVisible, setLinkSheetVisible] = useState(false);
  const [logEveryMinutes, setLogEveryMinutes] = useState(PASS_DURATION_MINUTES_DEFAULT);
  const [nightQuietOn, setNightQuietOn] = useState(false);
  const [nightQuietBusy, setNightQuietBusy] = useState(false);
  const [, setScreenTimeUiTick] = useState(0);

  const refresh = useCallback(async () => {
    setSocialLockOn(await getSocialLockEnabled());
    setAppsLinked(isSocialLockSelectionLinked());
  }, []);

  const refreshPassMinutes = useCallback(async () => {
    setLogEveryMinutes(await getPassDurationMinutes());
  }, []);

  useEffect(() => {
    void refresh();
    void refreshPassMinutes();
    void getNightQuietHoursEnabled().then(setNightQuietOn);
  }, [refresh, refreshPassMinutes]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void refresh();
        void refreshPassMinutes();
        void (async () => {
          await ensureMonitoredPassRelockState();
          await syncMonitoredAppShields();
        })();
      }
    });
    return () => sub.remove();
  }, [refresh, refreshPassMinutes]);

  const bumpScreenTimeUi = useCallback(() => {
    setScreenTimeUiTick((t) => t + 1);
    void refresh();
    void syncMonitoredAppShields();
    onScreenTimeChanged?.();
  }, [onScreenTimeChanged, refresh]);

  const onNightQuietSwitch = useCallback(async (on: boolean) => {
    if (Platform.OS !== 'ios') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNightQuietBusy(true);
    try {
      if (on) {
        const da = loadIosDeviceActivity();
        if (!da?.isAvailable()) {
          Alert.alert('Lock 8 PM – 8 AM', 'Screen Time is not available in this build.');
          return;
        }
        const { AuthorizationStatus, getAuthorizationStatus, requestAuthorization } = da;
        if (getAuthorizationStatus() !== AuthorizationStatus.approved) {
          await requestAuthorization('individual');
        }
        if (getAuthorizationStatus() !== AuthorizationStatus.approved) {
          Alert.alert(
            'Screen Time required',
            'Allow Screen Time access when iOS asks, then turn night lock on again.',
          );
          return;
        }
        await startNightQuietSchedule();
        await setNightQuietHoursEnabled(true);
        setNightQuietOn(true);
      } else {
        stopNightQuietSchedule();
        await setNightQuietHoursEnabled(false);
        setNightQuietOn(false);
      }
    } catch (e) {
      Alert.alert('Lock 8 PM – 8 AM', e instanceof Error ? e.message : String(e));
    } finally {
      setNightQuietBusy(false);
    }
  }, []);

  const onSocialLockSwitch = async (on: boolean) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (on && Platform.OS === 'ios') {
      const approved = await ensureScreenTimeApprovedForLock();
      if (!approved) {
        Alert.alert(
          'Screen Time required',
          'Approve Screen Time access above, then turn social lock on again.',
        );
        return;
      }
    }

    await setSocialLockEnabled(on);
    setSocialLockOn(on);

    if (Platform.OS !== 'ios') return;

    if (!on) {
      await syncMonitoredAppShields();
      return;
    }

    if (!isSocialLockSelectionLinked()) {
      setLinkSheetVisible(true);
      return;
    }

    await syncMonitoredAppShields();
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
          <Text style={styles.backSerif}>Back</Text>
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
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onReplayOnboarding();
            }}
            style={[styles.onboardingRow, styles.blockAfterScreenTitle]}
            accessibilityRole="button"
            accessibilityLabel="Replay onboarding"
          >
            <Text style={styles.onboardingRowTitle}>Walk through intro again</Text>
          </Pressable>
        ) : null}

        <View
          style={[
            styles.sliderBlock,
            onReplayOnboarding ? styles.blockAfterOnboarding : styles.blockAfterScreenTitle,
          ]}
        >
          <Text style={styles.sliderCaption}>
            After you complete your log, all locked apps stay unlocked for this long — then they
            lock again.
          </Text>
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

        {Platform.OS === 'ios' ? (
          <View style={styles.screenTimeBlock}>
            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>iPhone screen time</Text>
            <IosScreenTimePanel embedded onChanged={bumpScreenTimeUi} />
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Monitored apps</Text>

        <View style={styles.iconRow}>
          {DISTRACTION_APPS.map((app) => (
            <MonitoredAppIcon key={app.id} appId={app.id} size={36} muted={!socialLockOn} />
          ))}
        </View>

        <View style={styles.masterSwitchRow} accessibilityRole="none">
          <View style={styles.appCopy}>
            <Text style={styles.appName}>Lock social & entertainment apps</Text>
            <Text style={styles.onboardingRowHint}>
              {Platform.OS === 'ios'
                ? 'TikTok, Instagram, YouTube, Snapchat, Facebook — locked until you complete your log in UNROT.'
                : 'Available on iPhone with Screen Time.'}
            </Text>
          </View>
          <View style={styles.switchWrap}>
            <Switch
              value={socialLockOn}
              onValueChange={(v) => void onSocialLockSwitch(v)}
              disabled={Platform.OS !== 'ios'}
              accessibilityLabel="Lock social and entertainment apps"
              trackColor={{ false: unrot.choiceMuted, true: unrot.ink }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              ios_backgroundColor={unrot.choiceMuted}
            />
          </View>
        </View>

        {Platform.OS === 'ios' && socialLockOn && !appsLinked ? (
          <Pressable
            onPress={() => setLinkSheetVisible(true)}
            style={styles.chooseAppsRow}
            accessibilityRole="button"
          >
            <Text style={styles.chooseAppsText}>Choose apps to lock</Text>
          </Pressable>
        ) : null}

        <View style={styles.nightSwitchRow} accessibilityRole="none">
          <View style={styles.appCopy}>
            <Text style={styles.appName}>Lock 8 PM – 8 AM</Text>
            <Text style={styles.onboardingRowHint}>
              {Platform.OS === 'ios'
                ? 'Requires Screen Time approval in the section above.'
                : 'Available on iPhone with Screen Time.'}
            </Text>
          </View>
          <View style={styles.switchWrap}>
            <Switch
              value={nightQuietOn}
              onValueChange={(v) => void onNightQuietSwitch(v)}
              disabled={nightQuietBusy || Platform.OS !== 'ios'}
              accessibilityLabel="Lock apps from 8 PM to 8 AM"
              trackColor={{ false: unrot.choiceMuted, true: unrot.ink }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              ios_backgroundColor={unrot.choiceMuted}
            />
          </View>
        </View>
      </ScrollView>

      <SocialEntertainmentLinkSheet
        visible={linkSheetVisible}
        onDismiss={(cancelled) => {
          setLinkSheetVisible(false);
          void (async () => {
            if (cancelled) {
              await setSocialLockEnabled(false);
              setSocialLockOn(false);
            } else {
              await syncMonitoredAppShields();
            }
            await refresh();
          })();
        }}
        onLinked={() => {
          void refresh();
        }}
      />
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
  blockAfterScreenTitle: {
    marginTop: 8,
  },
  blockAfterOnboarding: {
    marginTop: 28,
  },
  sectionTitleSpaced: {
    marginTop: 36,
    marginBottom: 22,
  },
  iconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  masterSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  chooseAppsRow: {
    paddingVertical: 10,
    marginBottom: 8,
  },
  chooseAppsText: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: unrot.ink,
    textDecorationLine: 'underline',
  },
  sliderBlock: {
    marginBottom: 8,
  },
  sliderCaption: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 14,
    lineHeight: 22,
    color: unrot.muted,
    marginBottom: 16,
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
  screenTimeBlock: {
    marginBottom: 8,
  },
  nightSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 36,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(17, 17, 17, 0.12)',
  },
});
