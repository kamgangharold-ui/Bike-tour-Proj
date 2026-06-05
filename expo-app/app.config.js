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
      // Standalone APK: fingerprint runtimeVersion so an OTA whose native footprint
      // differs from an installed APK is never served to it (the launch-crash guard).
      // iOS (Expo Go) keeps the top-level sdkVersion policy below.
      runtimeVersion: { policy: 'fingerprint' },
      permissions: ['RECORD_AUDIO'],
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
    // `fingerprint` in the `android` block above so a native-footprint mismatch
    // is skipped, not crashed. (Was a global `sdkVersion` — the crash cause.)
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
