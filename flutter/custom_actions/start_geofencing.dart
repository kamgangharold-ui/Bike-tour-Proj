// FlutterFlow Custom Action: startGeofencing
// Required packages: radar_flutter, flutter_local_notifications
// Call from: App State > onAppLaunch, after initializeRadar completes

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:radar_flutter/radar_flutter.dart';

final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
bool _pluginReady = false;

Future<void> startGeofencing() async {
  await _ensurePluginReady();
  Radar.onEvents(_onGeofenceEvent);
  // RESPONSIVE: polls every ~30 s while moving, ~2.5 min while stationary
  await Radar.startTrackingResponsive();
}

Future<void> _ensurePluginReady() async {
  if (_pluginReady) return;
  await _plugin.initialize(
    const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(),
    ),
  );
  final android = _plugin
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
  await android?.createNotificationChannel(const AndroidNotificationChannel(
    'bike_tour_geofence',
    'Landmark Alerts',
    description: 'Fires when you enter a landmark area',
    importance: Importance.high,
  ));
  await android?.createNotificationChannel(const AndroidNotificationChannel(
    'bike_tour_regulatory',
    'Regulatory Alerts',
    description: 'Cycling-law warnings (dismount zones, fines)',
    importance: Importance.max,
  ));
  _pluginReady = true;
}

Future<void> _onGeofenceEvent(Map<dynamic, dynamic> result) async {
  final events = (result['events'] as List<dynamic>?) ?? [];
  for (final raw in events) {
    final event = raw as Map<dynamic, dynamic>;
    if (event['type'] != 'user.entered_geofence') continue;

    final geo = (event['geofence'] as Map<dynamic, dynamic>?) ?? {};
    final slug = (geo['tag'] as String?) ?? '';
    final body =
        (geo['description'] as String?) ?? 'You are near a landmark.';
    final meta = (geo['metadata'] as Map<dynamic, dynamic>?) ?? {};
    final category = (meta['category'] as String?) ?? 'landmark';

    // dismount_zone and hazard categories → full-screen regulatory alert
    final bool isRegulatory =
        category == 'dismount_zone' || category == 'hazard';

    final String title = slug
        .split('-')
        .map((w) =>
            w.isEmpty ? '' : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');

    await _plugin.show(
      slug.hashCode & 0x7FFFFFFF,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          isRegulatory ? 'bike_tour_regulatory' : 'bike_tour_geofence',
          isRegulatory ? 'Regulatory Alerts' : 'Landmark Alerts',
          importance: isRegulatory ? Importance.max : Importance.high,
          priority: isRegulatory ? Priority.max : Priority.high,
          // Full-screen intent surfaces over lock screen for dismount zones
          fullScreenIntent: isRegulatory,
          category: isRegulatory ? AndroidNotificationCategory.alarm : null,
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentSound: true,
          interruptionLevel: isRegulatory
              ? InterruptionLevel.timeSensitive
              : InterruptionLevel.active,
        ),
      ),
    );
  }
}
