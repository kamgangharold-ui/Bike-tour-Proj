// FlutterFlow Custom Action: initializeGeofencing
// Replaces initializeRadar — no Radar.io account needed.
// Required packages: geolocator, flutter_local_notifications
//
// Call this once on app launch, before startGeofencing().

import 'package:geolocator/geolocator.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

Future<void> initializeGeofencing() async {
  // ── 1. Location permissions ───────────────────────────────────────────────
  bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
  if (!serviceEnabled) return; // Device GPS is off — nothing we can do

  LocationPermission permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied) return;
  }
  // Request "always" permission for background tracking
  if (permission == LocationPermission.whileInUse) {
    await Geolocator.requestPermission(); // iOS: prompts upgrade to Always
  }

  // ── 2. Notification channels ──────────────────────────────────────────────
  final plugin = FlutterLocalNotificationsPlugin();
  await plugin.initialize(
    const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: true,
        requestSoundPermission: true,
        requestBadgePermission: true,
      ),
    ),
  );

  final android =
      plugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();

  // Standard landmark alerts (high priority banner)
  await android?.createNotificationChannel(const AndroidNotificationChannel(
    'bike_tour_geofence',
    'Landmark Alerts',
    description: 'Fires when you enter a landmark area',
    importance: Importance.high,
  ));

  // Regulatory alerts — dismount zones, fine warnings (max priority)
  await android?.createNotificationChannel(const AndroidNotificationChannel(
    'bike_tour_regulatory',
    'Regulatory Alerts',
    description: 'Cycling-law warnings: dismount zones, fine zones',
    importance: Importance.max,
  ));
}
