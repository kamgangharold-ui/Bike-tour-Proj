// FlutterFlow Custom Action: initializeRadar
// Required packages: radar_flutter
// Call from: main.dart initialState or App State > onAppLaunch (before startGeofencing)

import 'package:radar_flutter/radar_flutter.dart';

Future<void> initializeRadar() async {
  // Set this via FlutterFlow > Settings > Environment Variables > FF_RADAR_PUBLISHABLE_KEY
  const String radarKey = 'YOUR_RADAR_PUBLISHABLE_KEY';

  await Radar.initialize(radarKey);

  // Two-step permission flow required on iOS: foreground first, then background
  await Radar.requestPermissions(background: false);
  await Radar.requestPermissions(background: true);
}
