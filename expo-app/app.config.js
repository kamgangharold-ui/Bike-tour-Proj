// Dynamic config — reads environment variables at build/prebuild time.
// app.json is kept as a static fallback; this file takes precedence.
module.exports = {
  expo: {
    name: 'Bike Tour Guide',
    slug: 'bike-tour-guide',
    version: '1.0.0',
    scheme: 'biketourguide',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    android: {
      package: 'com.biketourguide.app',
      config: {
        googleMaps: {
          // Read at build time from .env (never hardcoded)
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
        },
      },
    },
    ios: {
      bundleIdentifier: 'com.biketourguide.app',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Used to alert you when near a landmark or cycling restriction.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Tracks your location in the background for hands-free landmark alerts.',
        UIBackgroundModes: ['location', 'fetch'],
      },
    },
    plugins: [
      'expo-router',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Used to alert you near landmarks while riding.',
        },
      ],
      ['expo-notifications', { sounds: [] }],
    ],
    web: { bundler: 'metro' },
    experiments: { typedRoutes: true },
  },
};
