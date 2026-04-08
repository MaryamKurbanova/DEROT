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
import { DEROT_SELECTION_ID, recomputeDerotUsageTotals } from '../lib/derotIosScreenTime';
import { startNightQuietSchedule } from '../lib/nightQuietHoursLock';
import { unrot, unrotFonts } from '../theme';

type Props = {
  nightEnabled: boolean;
  onSelectionChanged: () => void;
};

export function SettingsNightQuietPanel({ nightEnabled, onSelectionChanged }: Props) {
  const [busy, setBusy] = useState(false);

  const onAuthorize = useCallback(async () => {
    setBusy(true);
    try {
      await requestAuthorization('individual');
      onSelectionChanged();
    } finally {
      setBusy(false);
    }
  }, [onSelectionChanged]);

  const onPickerChange = useCallback(() => {
    void Haptics.selectionAsync();
    recomputeDerotUsageTotals();
    onSelectionChanged();
    if (nightEnabled) {
      void (async () => {
        try {
          await startNightQuietSchedule();
        } catch {
          // selection may be incomplete; parent switch state unchanged
        }
      })();
    }
  }, [nightEnabled, onSelectionChanged]);

  if (!isAvailable()) {
    return (
      <Text style={styles.note}>
        Connect a native iOS build with Family Controls to use night lock.
      </Text>
    );
  }

  const approved = getAuthorizationStatus() === AuthorizationStatus.approved;

  return (
    <View style={styles.wrap}>
      {!approved ? (
        <Pressable
          onPress={() => void onAuthorize()}
          disabled={busy}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, busy && styles.btnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Approve Screen Time access"
        >
          {busy ? (
            <ActivityIndicator color={unrot.ink} />
          ) : (
            <Text style={styles.btnText}>Approve Screen Time access</Text>
          )}
        </Pressable>
      ) : null}

      {approved ? (
        <>
          <Text style={styles.subLabel}>Apps to lock at night</Text>
          <Text style={styles.appleNote}>
            Same list as Screen Time on your home screen — include TikTok, YouTube, Instagram,
            Snapchat, and Facebook.
          </Text>
          <View style={styles.pickerShell}>
            <DeviceActivitySelectionViewPersisted
              familyActivitySelectionId={DEROT_SELECTION_ID}
              style={styles.picker}
              onSelectionChange={onPickerChange}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
    marginBottom: 8,
  },
  note: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 13,
    lineHeight: 20,
    color: unrot.muted,
    marginBottom: 8,
  },
  subLabel: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 8,
    letterSpacing: 2,
    color: unrot.muted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  appleNote: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 12,
    lineHeight: 18,
    color: unrot.muted,
    marginBottom: 10,
  },
  pickerShell: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(17, 17, 17, 0.08)',
  },
  picker: {
    height: 280,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  btn: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: unrot.ink,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginBottom: 12,
  },
  btnPressed: { opacity: 0.88 },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    fontFamily: unrotFonts.monoBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#FFFFFF',
  },
});
