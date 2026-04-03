import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { BreathingPremiumShell } from '../components/BreathingPremiumShell';
import { SomaticBreathing } from '../components/SomaticBreathing';
import { fontFamilies, spacing } from '../theme';

const GREY = 'rgba(255,255,255,0.38)';
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
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
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
      <BreathingPremiumShell
        timerText={formatBreathClock(secondsLeft)}
        bottomSlot={
          <View style={styles.bottomCopy}>
            <Text style={styles.whisper}>Every few hours, breathe first.</Text>
            <Text style={styles.title}>Stay for {BREATH_SESSION_SECONDS} seconds</Text>
            <Text style={styles.sub}>
              Then your reflective log — and your usual app window.
            </Text>
            <Text style={styles.hint}>When the timer reaches 0:00, the log opens.</Text>
          </View>
        }
      >
        <SomaticBreathing key={sessionKey} variant="zen" outerDiameter={280} />
      </BreathingPremiumShell>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bottomCopy: {
    alignItems: 'center',
  },
  whisper: {
    fontFamily: fontFamilies.uiLight,
    fontSize: 10,
    color: GREY,
    letterSpacing: TRACK,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fontFamilies.uiLight,
    fontSize: 16,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 0.2,
    marginBottom: 6,
    textAlign: 'center',
  },
  sub: {
    fontFamily: fontFamilies.uiLight,
    fontSize: 13,
    color: 'rgba(255,255,255,0.42)',
    lineHeight: 18,
    marginBottom: spacing.sm,
    textAlign: 'center',
    maxWidth: 300,
  },
  hint: {
    fontFamily: fontFamilies.uiLight,
    fontSize: 11,
    color: 'rgba(255,255,255,0.32)',
    textAlign: 'center',
  },
});
