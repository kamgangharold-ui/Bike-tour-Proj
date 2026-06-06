module.exports = {
  expo: {
    owner: 'hari237',
    name: 'Bike Tour Guide',
    slug: 'bike-tour-guide',
    version: '1.0.0',
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
      permissions: ['RECORD_AUDIO', 'VIBRATE'],
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
        UIBackgroundModes: ['location', 'fetch'],
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
