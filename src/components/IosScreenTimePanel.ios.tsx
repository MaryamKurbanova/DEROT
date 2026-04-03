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
import { spacing, unrot, unrotFonts } from '../theme';

const FG = unrot.ink;
const GREY = unrot.muted;

type Props = {
  onChanged: () => void;
  /** Omit shouty header when nested under Settings (section title is outside). */
  embedded?: boolean;
};

/**
 * iOS: Family Controls + Device Activity — pick apps, approve Screen Time, then start monitoring
 * so reclaimed hours on the home screen use system-backed usage (not Expo Go).
 */
export function IosScreenTimePanel({ onChanged, embedded }: Props) {
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
      <View style={[styles.wrap, embedded && styles.wrapEmbedded]}>
        {embedded ? null : <Text style={styles.title}>SCREEN TIME (IPHONE)</Text>}
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
    <View style={[styles.wrap, embedded && styles.wrapEmbedded]}>
      {embedded ? null : <Text style={styles.title}>SCREEN TIME (IPHONE)</Text>}
      <Text style={styles.body}>
        Reclaimed hours use Apple’s Screen Time for the apps you choose below. Works in a{' '}
        <Text style={styles.em}>native iOS build</Text> with Family Controls — not in Expo Go.
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
            <Text style={styles.btnText}>Approve Screen Time access</Text>
          )}
        </Pressable>
      ) : null}

      {approved ? (
        <>
          <Text style={embedded ? styles.subLabelSoft : styles.subLabel}>Apps & categories</Text>
          <Text style={styles.appleNote}>
            Apple may show “No usable data available” until you pick apps, approve Screen Time, and
            tracking has run on device — that message is from Apple, not Unrot.
          </Text>
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
              <Text style={styles.btnText}>Start screen time tracking</Text>
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
  wrapEmbedded: {
    marginTop: 0,
  },
  title: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 9,
    letterSpacing: 3,
    color: FG,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 20,
    color: GREY,
    marginBottom: spacing.md,
  },
  em: {
    fontFamily: unrotFonts.interRegular,
    color: unrot.ink,
  },
  subLabel: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 9,
    letterSpacing: 3,
    color: GREY,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  subLabelSoft: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 20,
    color: unrot.ink,
    marginBottom: spacing.xs,
  },
  pickerShell: {
    minHeight: 220,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  picker: {
    flex: 1,
    minHeight: 220,
  },
  btn: {
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  btnText: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 15,
    lineHeight: 22,
    color: FG,
  },
  hint: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    lineHeight: 18,
    color: GREY,
  },
  appleNote: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 10,
    lineHeight: 15,
    color: GREY,
    marginBottom: spacing.sm,
  },
  err: {
    marginTop: spacing.sm,
    fontFamily: unrotFonts.interRegular,
    fontSize: 11,
    color: '#C44',
  },
});
