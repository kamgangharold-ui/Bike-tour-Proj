module.exports = {
  expo: {
    owner: 'hari237',
    name: 'Bike Tour Guide',
    slug: 'bike-tour-guide',
    version: '1.3.0',
    privacy: 'public',
    scheme: 'biketourguide',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    platforms: ['ios', 'android'],
    android: {
      package: 'com.biketourguide.app',
      // Standalone APK: runtimeVersion = appVersion (e.g. "1.0.0"), DISTINCT from the
      // old crashing APK's "exposdk:54.0.0", so SDK-version OTAs are never served to
      // this build. BUMP `version` whenever native deps change so a new APK gets a
      // new runtimeVersion and old APKs aren't served incompatible OTAs. (fingerprint
      // would auto-do this but isn't reproducible Windows-dev → Linux-EAS builders,
      // which failed the "Configure expo-updates" phase.) Defensive native-module
      // imports are the crash backstop regardless.
      runtimeVersion: { policy: 'appVersion' },
      // FOREGROUND_SERVICE* power the live nav notification (notifee) in the
      // standalone APK. Harmless on the Expo Go path (Expo Go ignores app.config).
      permissions: [
        'RECORD_AUDIO',
        'VIBRATE',
        'POST_NOTIFICATIONS',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
      ],
      ...(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        ? { config: { googleMaps: { apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY } } }
        : {}),
    },
    ios: {
      bundleIdentifier: 'com.biketourguide.app',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Used to alert you when near a landmark or cycling restriction.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Tracks your location in the background for hands-free landmark alerts.',
        NSMicrophoneUsageDescription:
          'Used to let you ask questions by voice.',
        NSSpeechRecognitionUsageDescription:
          'Used to convert your voice to text for the BikAI chat.',
        UIBackgroundModes: ['location', 'fetch', 'audio'],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    plugins: [
      'expo-router',
      'expo-updates',
      'expo-localization',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Used to alert you near landmarks while riding.',
        },
      ],
      ['expo-notifications', { sounds: [] }],
      // Migrated off deprecated expo-av → expo-audio (recording + audio session).
      ['expo-audio', { microphonePermission: 'Used to let you ask questions by voice.' }],
      // Native (standalone APK) — on-device STT + the notifee foreground-service nav
      // notification. Expo Go ignores config plugins; the JS is require-guarded so it
      // never loads in Expo Go.
      [
        'expo-speech-recognition',
        {
          microphonePermission: 'Allow CycleGuide to use the microphone for voice commands.',
          speechRecognitionPermission: 'Allow CycleGuide to convert your speech to text.',
          androidSpeechServicePackages: ['com.google.android.googlequicksearchbox'],
        },
      ],
      // @notifee/react-native autolinks (no config plugin); this local plugin gives
      // its ForegroundService a foregroundServiceType so Android 14+ accepts it.
      './plugins/withNotifeeForegroundServiceType',
    ],
    updates: {
      url: 'https://u.expo.dev/486226d7-7af6-43df-ba8d-41d919f57d87',
    },
    // runtimeVersion is per-platform: iOS ships via Expo Go, which only loads
    // updates whose runtimeVersion is the SDK form (exposdk:54.0.0), so iOS uses
    // this top-level `sdkVersion`. Android (standalone APK) overrides to
    // `appVersion` in the `android` block above — a runtimeVersion distinct from
    // the old SDK-version builds, so SDK-version OTAs can't reach it. (Was a global
    // `sdkVersion`, which served every SDK-54 OTA to every SDK-54 build regardless
    // of native modules — the crash cause.)
    runtimeVersion: {
      policy: 'sdkVersion',
    },
    experiments: { typedRoutes: true },
    extra: {
      eas: {
        projectId: '486226d7-7af6-43df-ba8d-41d919f57d87',
      },
    },
  },
};
