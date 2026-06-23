import { Audio } from 'expo-av';

let stampSound: Audio.Sound | null = null;
let loading: Promise<void> | null = null;

/** Screen 30 only — low-volume thud when the shield badge stamps in. */
export async function playOnboardingStampThud(): Promise<void> {
  try {
    if (!loading) {
      loading = (async () => {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('../../../assets/onboarding/stamp-thud.wav'),
          { volume: 0.22, shouldPlay: false },
        );
        stampSound = sound;
      })();
    }
    await loading;
    if (!stampSound) return;
    await stampSound.setPositionAsync(0);
    await stampSound.playAsync();
  } catch {
    /* optional — dev builds without asset still work */
  }
}
