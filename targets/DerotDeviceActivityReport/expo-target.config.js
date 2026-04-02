const getAppGroupFromExpoConfig = require('react-native-device-activity/config-plugin/getAppGroupFromExpoConfig');

module.exports = (config) => ({
  type: 'device-activity-report',
  deploymentTarget: '16.0',
  entitlements: {
    'com.apple.developer.family-controls': true,
    'com.apple.security.application-groups': [getAppGroupFromExpoConfig(config)],
  },
});
