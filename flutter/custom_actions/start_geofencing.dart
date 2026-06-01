// FlutterFlow Custom Action: startGeofencing
// Required packages: radar_flutter, flutter_local_notifications, cloud_firestore
// Call from: App State > onAppLaunch, after initializeRadar completes

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:radar_flutter/radar_flutter.dart';

// Register this in FlutterFlow's MyApp initState to push geofence data into
// FFAppState without a direct import of generated FlutterFlow code.
// See docs/flutterflow_setup.md — "Step 3: Register the state callback".
abstract class GeofencingActions {
  static void Function({
    required String slug,
    required String name,
    required String description,
    required String category,
    required bool isRegulatory,
    required String regulatoryMessage,
    required double regulatoryFineEur,
    required String affiliateUrl,
    required String audioUrl,
  })? onLandmarkEntered;
}

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
    if (slug.isEmpty) continue;

    // Fetch full landmark record — Radar only carries the tag + metadata snapshot
    final query = await FirebaseFirestore.instance
        .collection('locations')
        .where('slug', isEqualTo: slug)
        .where('is_active', isEqualTo: true)
        .limit(1)
        .get();

    if (query.docs.isEmpty) continue;
    final d = query.docs.first.data();

    final name = (d['name'] as String?) ?? slug;
    final description = (d['short_description'] as String?) ?? '';
    final category = (d['category'] as String?) ?? 'landmark';
    final regAlert = d['regulatory_alert'] as Map<String, dynamic>?;
    final isRegulatory =
        regAlert != null && (category == 'dismount_zone' || category == 'hazard');
    final regulatoryMessage = (regAlert?['message'] as String?) ?? '';
    final regulatoryFineEur = ((regAlert?['fine_eur'] as num?) ?? 0).toDouble();
    final affiliateUrl = (d['getyourguide_affiliate_url'] as String?) ?? '';
    final audioUrl = (d['audio_url'] as String?) ?? '';

    await _plugin.show(
      slug.hashCode & 0x7FFFFFFF,
      name,
      description,
      NotificationDetails(
        android: AndroidNotificationDetails(
          isRegulatory ? 'bike_tour_regulatory' : 'bike_tour_geofence',
          isRegulatory ? 'Regulatory Alerts' : 'Landmark Alerts',
          importance: isRegulatory ? Importance.max : Importance.high,
          priority: isRegulatory ? Priority.max : Priority.high,
          // Surfaces over lock screen for dismount zones — fine is €500
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

    GeofencingActions.onLandmarkEntered?.call(
      slug: slug,
      name: name,
      description: description,
      category: category,
      isRegulatory: isRegulatory,
      regulatoryMessage: regulatoryMessage,
      regulatoryFineEur: regulatoryFineEur,
      affiliateUrl: affiliateUrl,
      audioUrl: audioUrl,
    );
  }
}
