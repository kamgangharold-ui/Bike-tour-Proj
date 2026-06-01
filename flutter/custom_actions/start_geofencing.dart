// FlutterFlow Custom Action: startGeofencing
// Required packages: radar_flutter, flutter_local_notifications, cloud_firestore
// Call from: App State > onAppLaunch, after initializeRadar completes

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:radar_flutter/radar_flutter.dart';

// Register both callbacks in FlutterFlow's MyApp initState.
// See docs/flutterflow_setup.md §10 for the full registration snippet.
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

  static void Function({required String slug})? onLandmarkExited;
}

final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
bool _pluginReady = false;

// Tracks when a regulatory alert was last shown per slug.
// Prevents repeated full-screen interruptions when a rider oscillates
// near the boundary of a dismount zone.
final Map<String, DateTime> _lastRegulatoryAlert = {};
const Duration _regulatoryCooldown = Duration(minutes: 10);

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
    description: 'Cycling-law warnings (dismount zones, fine zones)',
    importance: Importance.max,
  ));
  _pluginReady = true;
}

Future<void> _onGeofenceEvent(Map<dynamic, dynamic> result) async {
  final events = (result['events'] as List<dynamic>?) ?? [];
  for (final raw in events) {
    final event = raw as Map<dynamic, dynamic>;
    final type = (event['type'] as String?) ?? '';
    final geo = (event['geofence'] as Map<dynamic, dynamic>?) ?? {};
    final slug = (geo['tag'] as String?) ?? '';
    if (slug.isEmpty) continue;

    // ── EXIT ────────────────────────────────────────────────────────────────
    if (type == 'user.exited_geofence') {
      GeofencingActions.onLandmarkExited?.call(slug: slug);
      continue;
    }

    if (type != 'user.entered_geofence') continue;

    // ── ENTRY ────────────────────────────────────────────────────────────────
    // Fetch full landmark record; Radar only carries tag + metadata snapshot
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

    // Any landmark with a regulatory_alert map is treated as regulatory —
    // severity is driven by priority, not category, so landmarks like
    // Park Güell (category=landmark, priority=medium) are handled correctly.
    final isRegulatory = regAlert != null;
    final regulatoryPriority = (regAlert?['priority'] as String?) ?? 'low';
    final regulatoryMessage = (regAlert?['message'] as String?) ?? '';
    final regulatoryFineEur = ((regAlert?['fine_eur'] as num?) ?? 0).toDouble();
    final affiliateUrl = (d['getyourguide_affiliate_url'] as String?) ?? '';
    final audioUrl = (d['audio_url'] as String?) ?? '';

    await _fireNotification(
      slug: slug,
      name: name,
      body: isRegulatory ? regulatoryMessage : description,
      isRegulatory: isRegulatory,
      regulatoryPriority: regulatoryPriority,
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

Future<void> _fireNotification({
  required String slug,
  required String name,
  required String body,
  required bool isRegulatory,
  required String regulatoryPriority,
}) async {
  if (isRegulatory) {
    // Suppress repeat regulatory interruptions within the cooldown window.
    // Still fires on the first entry; subsequent re-entries within 10 min
    // are silent (the UI card is still updated via onLandmarkEntered).
    final last = _lastRegulatoryAlert[slug];
    if (last != null && DateTime.now().difference(last) < _regulatoryCooldown) {
      return;
    }
    _lastRegulatoryAlert[slug] = DateTime.now();
  }

  // high   → full-screen intent + TimeSensitive (dismount zones, €500 fines)
  // medium → high-priority banner, no full-screen (no_cycling advisories)
  // low    → standard landmark priority
  final isHighPriority = regulatoryPriority == 'high';
  final isMediumPriority = regulatoryPriority == 'medium';
  final useRegulatoryChannel = isRegulatory;

  await _plugin.show(
    slug.hashCode & 0x7FFFFFFF,
    name,
    body,
    NotificationDetails(
      android: AndroidNotificationDetails(
        useRegulatoryChannel ? 'bike_tour_regulatory' : 'bike_tour_geofence',
        useRegulatoryChannel ? 'Regulatory Alerts' : 'Landmark Alerts',
        importance: isHighPriority
            ? Importance.max
            : (isMediumPriority ? Importance.high : Importance.defaultImportance),
        priority: isHighPriority
            ? Priority.max
            : (isMediumPriority ? Priority.high : Priority.defaultPriority),
        // Full-screen intent only for high-priority (Gothic Quarter €500, etc.)
        fullScreenIntent: isHighPriority,
        category: isHighPriority ? AndroidNotificationCategory.alarm : null,
      ),
      iOS: DarwinNotificationDetails(
        presentAlert: true,
        presentSound: isRegulatory,
        interruptionLevel: isHighPriority
            ? InterruptionLevel.timeSensitive
            : InterruptionLevel.active,
      ),
    ),
  );
}
