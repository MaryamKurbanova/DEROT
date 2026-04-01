import { Linking, Platform } from 'react-native';

/**
 * Opens Android’s usage-access screen so the user can grant access to this app.
 * Falls back to app settings if the deep link is unsupported.
 */
export async function androidRequestUsageStatsPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Linking.sendIntent('android.settings.USAGE_ACCESS_SETTINGS');
  } catch {
    try {
      await Linking.openURL('android.settings.USAGE_ACCESS_SETTINGS');
    } catch {
      await Linking.openSettings();
    }
  }
}
