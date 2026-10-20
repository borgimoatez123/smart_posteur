const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Allows cleartext (plain HTTP) traffic on Android.
 *
 * The SmartPosture backend is reached over the local network at
 * `http://<lan-ip>:3000`, so the generated Android manifest must not block
 * unencrypted HTTP. This only affects the manifest produced by `expo prebuild`
 * / a development build; Expo Go already permits cleartext traffic.
 */
const withAndroidCleartextTraffic = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const applications = manifest.application;
    if (Array.isArray(applications)) {
      for (const application of applications) {
        application.$ = application.$ ?? {};
        application.$['android:usesCleartextTraffic'] = 'true';
      }
    }
    return config;
  });

module.exports = withAndroidCleartextTraffic;
