/**
 * Dynamic Expo config. Set APPLE_TEAM_ID for react-native-device-activity (Family Controls).
 *
 * EAS:  eas secret:create --scope project --name APPLE_TEAM_ID --value YOUR_10_CHAR_TEAM_ID
 * Local prebuild:  APPLE_TEAM_ID=XXXXXXXXXX npx expo prebuild --platform ios
 */
module.exports = ({ config }) => {
  const teamId = process.env.APPLE_TEAM_ID || 'YOUR_APPLE_TEAM_ID';

  const plugins = (config.plugins || []).map((entry) => {
    if (!Array.isArray(entry)) return entry;
    const [name, opts] = entry;
    if (name !== 'react-native-device-activity') return entry;
    return [
      name,
      {
        ...(opts && typeof opts === 'object' ? opts : {}),
        appleTeamId: teamId,
      },
    ];
  });

  return {
    ...config,
    scheme: config.scheme ?? 'derot',
    ios: {
      ...config.ios,
      bundleIdentifier: config.ios?.bundleIdentifier ?? 'io.derot.app',
      appleTeamId: teamId,
    },
    android: {
      ...config.android,
      package: config.android?.package ?? 'io.derot.app',
    },
    plugins,
  };
};
