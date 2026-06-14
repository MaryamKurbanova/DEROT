import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  isIosDeviceActivityAvailable,
  isIosScreenTimeApproved,
  loadIosDeviceActivity,
  syncScreenTimeToHome,
  tryEnsureDerotScreenTimeTracking,
} from '../lib/derotIosScreenTime';
import { loadHomeSyncedTodayMinutes } from '../lib/screenTimeHomeSync';
import { formatScreenTimeDisplay } from '../lib/screenTimeDisplay';
import { spacing, unrot, unrotFonts } from '../theme';

const FG = unrot.ink;
const GREY = unrot.muted;

type Props = {
  onChanged: () => void;
  embedded?: boolean;
};

/** Settings: approve Screen Time once, sync today's total to home. No app picker. */
export function IosScreenTimePanel({ onChanged, embedded }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedMinutes, setLastSyncedMinutes] = useState<number | null>(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const da = loadIosDeviceActivity();
  const available = isIosDeviceActivityAvailable();
  const approved = isIosScreenTimeApproved();

  useEffect(() => {
    void loadHomeSyncedTodayMinutes().then((minutes) => {
      if (minutes > 0) setLastSyncedMinutes(minutes);
    });
  }, []);

  const onAuthorize = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      if (!da) throw new Error('Screen Time is not available in this build.');
      await da.requestAuthorization('individual');
      await tryEnsureDerotScreenTimeTracking();
      onChangedRef.current();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authorization failed');
    } finally {
      setBusy(false);
    }
  }, [da]);

  const onSync = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const minutes = await syncScreenTimeToHome();
      setLastSyncedMinutes(minutes);
      onChangedRef.current();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  }, []);

  if (!available) {
    return (
      <View style={[styles.wrap, embedded && styles.wrapEmbedded]}>
        <Text style={styles.body}>
          Screen Time requires a native iOS build. Open UNROT from your installed dev client.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, embedded && styles.wrapEmbedded]}>
      <Text style={styles.body}>
        Tracks all apps and categories for today. Tap sync to update your home screen.
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
      ) : (
        <>
          <Pressable
            onPress={() => void onSync()}
            disabled={busy}
            style={({ pressed }) => [styles.syncBtn, pressed && { opacity: 0.85 }, busy && styles.btnDisabled]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.syncBtnText}>Sync Screen Time to home</Text>
            )}
          </Pressable>

          {lastSyncedMinutes != null && lastSyncedMinutes >= 1 ? (
            <Text style={styles.hint}>
              Synced {formatScreenTimeDisplay(lastSyncedMinutes)} to home · tap sync again to refresh.
            </Text>
          ) : (
            <Text style={styles.hint}>
              {busy
                ? 'Reading today\u2019s Screen Time\u2026'
                : 'Tap sync once — home shows today\u2019s total after.'}
            </Text>
          )}
        </>
      )}

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
  body: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 13,
    lineHeight: 20,
    color: GREY,
    marginBottom: spacing.md,
  },
  btn: {
    paddingVertical: spacing.md,
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
  syncBtn: {
    backgroundColor: unrot.ink,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  syncBtnText: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 15,
    lineHeight: 22,
    color: '#fff',
  },
  hint: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    lineHeight: 18,
    color: GREY,
  },
  err: {
    marginTop: spacing.sm,
    fontFamily: unrotFonts.interRegular,
    fontSize: 12,
    lineHeight: 18,
    color: '#C44',
  },
});
