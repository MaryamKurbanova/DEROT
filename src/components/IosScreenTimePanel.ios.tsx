import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AuthorizationStatus,
  DeviceActivitySelectionViewPersisted,
  getAuthorizationStatus,
  isAvailable,
  requestAuthorization,
} from 'react-native-device-activity';
import {
  DEROT_SELECTION_ID,
  recomputeDerotUsageTotals,
  startDerotScreenTimeTracking,
} from '../lib/derotIosScreenTime';
import { fontFamilies, spacing } from '../theme';

const FG = '#FFFFFF';
const GREY = '#888888';

type Props = {
  onChanged: () => void;
};

/**
 * iOS: Family Controls + Device Activity — pick apps, approve Screen Time, then start monitoring
 * so reclaimed hours on the home screen use system-backed usage (not Expo Go).
 */
export function IosScreenTimePanel({ onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    recomputeDerotUsageTotals();
    onChanged();
  }, [onChanged]);

  const onAuthorize = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await requestAuthorization('individual');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authorization failed');
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const onStartTracking = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      void Haptics.selectionAsync();
      await startDerotScreenTimeTracking();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start tracking');
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  if (!isAvailable()) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>SCREEN TIME (IPHONE)</Text>
        <Text style={styles.body}>
          Native Screen Time APIs are not linked. Run{' '}
          <Text style={styles.em}>npx expo prebuild --platform ios</Text> with the
          react-native-device-activity plugin configured (Apple Team ID + App Group), then open the
          project in Xcode.
        </Text>
      </View>
    );
  }

  const status = getAuthorizationStatus();
  const approved = status === AuthorizationStatus.approved;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>SCREEN TIME (IPHONE)</Text>
      <Text style={styles.body}>
        Reclaimed hours on the home screen use Apple’s Screen Time / Device Activity for the apps you
        choose below. This only works in a <Text style={styles.em}>development or production native build</Text>{' '}
        with Family Controls — not in Expo Go.
      </Text>

      {!approved ? (
        <Pressable
          onPress={() => void onAuthorize()}
          disabled={busy}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.72 }, busy && styles.btnDisabled]}
        >
          {busy ? (
            <ActivityIndicator color={FG} />
          ) : (
            <Text style={styles.btnText}>APPROVE SCREEN TIME ACCESS</Text>
          )}
        </Pressable>
      ) : null}

      {approved ? (
        <>
          <Text style={styles.subLabel}>Apps & categories to measure</Text>
          <View style={styles.pickerShell}>
            <DeviceActivitySelectionViewPersisted
              familyActivitySelectionId={DEROT_SELECTION_ID}
              style={styles.picker}
              onSelectionChange={() => refresh()}
            />
          </View>

          <Pressable
            onPress={() => void onStartTracking()}
            disabled={busy}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.72 }, busy && styles.btnDisabled]}
          >
            {busy ? (
              <ActivityIndicator color={FG} />
            ) : (
              <Text style={styles.btnText}>START SCREEN TIME TRACKING</Text>
            )}
          </Pressable>
          <Text style={styles.hint}>
            Starts Device Activity monitoring with minute thresholds. After you use tracked apps, the
            home screen can show reclaimed time. Pull to refresh or reopen the app if numbers lag.
          </Text>
        </>
      ) : null}

      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fontFamilies.monoSemi,
    fontSize: 11,
    letterSpacing: 1.2,
    color: FG,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fontFamilies.ui,
    fontSize: 13,
    color: GREY,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  em: {
    fontFamily: fontFamilies.uiSemi,
    color: 'rgba(255,255,255,0.88)',
  },
  subLabel: {
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: GREY,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  pickerShell: {
    minHeight: 220,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  picker: {
    flex: 1,
    minHeight: 220,
  },
  btn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  btnText: {
    fontFamily: fontFamilies.monoSemi,
    fontSize: 11,
    letterSpacing: 2,
    color: FG,
  },
  hint: {
    fontFamily: fontFamilies.ui,
    fontSize: 12,
    color: GREY,
    lineHeight: 17,
  },
  err: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.ui,
    fontSize: 13,
    color: '#FF6B6B',
  },
});
