module.exports = {
  expo: {
    owner: 'haroldou',
    name: 'Bike Tour Guide',
    slug: 'bike-tour-guide',
    version: '1.0.0',
    scheme: 'biketourguide',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    platforms: ['ios', 'android'],
    android: {
      package: 'com.biketourguide.app',
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
      url: 'https://u.expo.dev/1b99c3e7-2c7d-43bc-80f8-5b5bef6401d5',
    },
    runtimeVersion: {
      policy: 'sdkVersion',
    },
    experiments: { typedRoutes: true },
    extra: {
      eas: {
        projectId: '1b99c3e7-2c7d-43bc-80f8-5b5bef6401d5',
      },
    },
  },
};
