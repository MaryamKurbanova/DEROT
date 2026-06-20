import * as Haptics from 'expo-haptics';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ReflectiveLogSurface,
  type ReflectiveLogPurpose,
} from '../components/ReflectiveLogSurface';

export type FocusWallPurpose = ReflectiveLogPurpose;

type Props = {
  visible: boolean;
  purpose: FocusWallPurpose;
  targetAppId: string;
  targetLabel: string;
  onClose: () => void;
  interceptPreamble?: string;
  onInterceptPassGranted?: (untilMs: number) => void;
  onLogSaved?: () => void;
  onFlowAbandoned?: () => void;
  /** Fired only when the user taps Exit (not Continue, not OS back). */
  onExitPress?: () => void | Promise<unknown>;
  passDurationMinutes: number;
};

export function FocusWallScreen({
  visible,
  purpose,
  targetAppId,
  targetLabel: _targetLabel,
  onClose,
  interceptPreamble,
  onInterceptPassGranted,
  onLogSaved,
  onFlowAbandoned,
  onExitPress,
  passDurationMinutes: _passDurationMinutes,
}: Props) {
  const insets = useSafeAreaInsets();
  const savedRef = useRef(false);

  useLayoutEffect(() => {
    if (visible) {
      savedRef.current = false;
    }
  }, [visible]);

  const dismissWithoutSave = useCallback(() => {
    if (savedRef.current) return;
    onFlowAbandoned?.();
    onClose();
  }, [onClose, onFlowAbandoned]);

  const exitReflectiveLog = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void (async () => {
      await onExitPress?.();
      dismissWithoutSave();
    })();
  }, [dismissWithoutSave, onExitPress]);

  const handleComplete = useCallback(() => {
    savedRef.current = true;
    onClose();
  }, [onClose]);

  const handleLogSaved = useCallback(() => {
    savedRef.current = true;
    onLogSaved?.();
  }, [onLogSaved]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      transparent={false}
      onRequestClose={dismissWithoutSave}
      onDismiss={() => {
        if (!savedRef.current) {
          onFlowAbandoned?.();
          onClose();
        }
      }}
    >
      <StatusBar style="dark" />
      <ReflectiveLogSurface
        purpose={purpose}
        targetAppId={targetAppId}
        interceptPreamble={interceptPreamble}
        onInterceptPassGranted={onInterceptPassGranted}
        onLogSaved={handleLogSaved}
        onComplete={handleComplete}
        showExit
        onExit={exitReflectiveLog}
        topInset={insets.top}
        bottomInset={insets.bottom}
      />
    </Modal>
  );
}
