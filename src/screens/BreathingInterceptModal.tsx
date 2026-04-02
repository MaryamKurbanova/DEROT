import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SomaticBreathing } from '../components/SomaticBreathing';
import { fontFamilies, spacing } from '../theme';

const BG = '#000000';
const FG = '#FFFFFF';
const GREY = '#888888';
const TRACK = 2;

const BREATH_SESSION_SECONDS = 30;

function formatBreathClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

type Props = {
  visible: boolean;
  /** After the timer ends: no pass yet — host shows the reflective log next. */
  onBreathingPhaseComplete: () => void;
};

export function BreathingInterceptModal({ visible, onBreathingPhaseComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [sessionKey, setSessionKey] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(BREATH_SESSION_SECONDS);
  const completionStarted = useRef(false);

  useEffect(() => {
    if (!visible) return;
    completionStarted.current = false;
    setSecondsLeft(BREATH_SESSION_SECONDS);
    setSessionKey((k) => k + 1);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [visible, sessionKey]);

  useEffect(() => {
    if (!visible || secondsLeft > 0) return;
    if (completionStarted.current) return;
    completionStarted.current = true;
    void (async () => {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        /* still advance */
      } finally {
        onBreathingPhaseComplete();
      }
    })();
  }, [visible, secondsLeft, onBreathingPhaseComplete]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        /* no pass without finishing — ignore hardware back where possible */
      }}
    >
      <View style={[styles.root, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.whisper}>Every few hours, breathe first.</Text>
        <Text style={styles.title}>Stay with this for {BREATH_SESSION_SECONDS} seconds</Text>
        <Text style={styles.sub}>
          Next you’ll complete your reflective log — then your apps unlock for the usual window.
        </Text>
        <Text style={styles.timer} accessibilityRole="timer">
          {formatBreathClock(secondsLeft)}
        </Text>
        <View style={styles.center}>
          <SomaticBreathing key={sessionKey} variant="zen" outerDiameter={280} />
        </View>
        <View style={styles.hintWrap}>
          <Text style={styles.hint}>Timer runs down automatically — then the log appears.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: spacing.lg,
  },
  whisper: {
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    color: GREY,
    letterSpacing: TRACK,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fontFamilies.uiSemi,
    fontSize: 18,
    color: FG,
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  sub: {
    fontFamily: fontFamilies.ui,
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  timer: {
    fontFamily: fontFamilies.monoSemi,
    fontSize: 28,
    color: FG,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintWrap: {
    paddingVertical: spacing.md,
  },
  hint: {
    fontFamily: fontFamilies.ui,
    fontSize: 12,
    color: GREY,
    textAlign: 'center',
  },
});
