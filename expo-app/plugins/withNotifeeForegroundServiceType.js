// Local Expo config plugin: declare @notifee/react-native's ForegroundService with
// android:foregroundServiceType="location" so Android 14+ (targetSdk 34+) accepts
// starting it. notifee autolinks its own <service> via manifest merge; we add the
// same service node to the main manifest with tools:replace so our typed version
// wins the merge. Paired with FOREGROUND_SERVICE + FOREGROUND_SERVICE_LOCATION
// permissions (declared in app.config.js android.permissions).

const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const SERVICE_NAME = 'app.notifee.core.ForegroundService';
const SERVICE_TYPE = 'location';

module.exports = function withNotifeeForegroundServiceType(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    // Ensure the tools namespace exists so tools:replace is valid.
    manifest.manifest.$ = manifest.manifest.$ || {};
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    app.service = app.service || [];

    let service = app.service.find((s) => s.$ && s.$['android:name'] === SERVICE_NAME);
    if (!service) {
      service = { $: { 'android:name': SERVICE_NAME } };
      app.service.push(service);
    }
    service.$['android:foregroundServiceType'] = SERVICE_TYPE;
    // Override notifee's merged declaration rather than conflicting with it.
    service.$['tools:replace'] = 'android:foregroundServiceType';
    return cfg;
  });
};
