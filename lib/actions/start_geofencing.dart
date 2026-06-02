import 'dart:async';
import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:geolocator/geolocator.dart';

import 'initialize_geofencing.dart' show notificationPlugin;

// Wire both callbacks in SplashPage.initState() to call AppState methods.
// See lib/pages/splash_page.dart for the registration snippet.
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

StreamSubscription<Position>? _positionSub;
List<Map<String, dynamic>> _locations = [];
final Set<String> _insideZones = {};
final Map<String, DateTime> _lastRegulatoryAlert = {};
const Duration _regulatoryCooldown = Duration(minutes: 10);

Future<void> startGeofencing() async {
  // Load all active locations once; Firestore cache keeps this fast after first run
  final snap = await FirebaseFirestore.instance
      .collection('locations')
      .where('is_active', isEqualTo: true)
      .get();
  _locations = snap.docs.map((d) => {'_id': d.id, ...d.data()}).toList();

  _positionSub?.cancel();
  _positionSub = Geolocator.getPositionStream(
    locationSettings: AndroidSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 5, // receive update every 5 m of movement
      foregroundNotificationConfig: const ForegroundNotificationConfig(
        notificationTitle: 'Bike Tour Active',
        notificationText: 'Tracking your route for landmark alerts',
        enableWakeLock: true,
      ),
    ),
  ).listen(_onPosition);
}

void _onPosition(Position pos) {
  for (final loc in _locations) {
    final slug = (loc['slug'] as String?) ?? '';
    if (slug.isEmpty) continue;

    final geopoint = loc['coordinates'] as GeoPoint?;
    if (geopoint == null) continue;

    final radius =
        ((loc['geofence_radius_metres'] as num?) ?? 40).toDouble();
    final dist =
        _metres(pos.latitude, pos.longitude, geopoint.latitude, geopoint.longitude);

    if (dist <= radius && !_insideZones.contains(slug)) {
      _insideZones.add(slug);
      _onEnter(loc);
    } else if (dist > radius + 20 && _insideZones.contains(slug)) {
      // 20 m hysteresis prevents oscillation at the boundary
      _insideZones.remove(slug);
      GeofencingActions.onLandmarkExited?.call(slug: slug);
    }
  }
}

void _onEnter(Map<String, dynamic> loc) {
  final slug = (loc['slug'] as String?) ?? '';
  final name = (loc['name'] as String?) ?? slug;
  final description = (loc['short_description'] as String?) ?? '';
  final category = (loc['category'] as String?) ?? 'landmark';
  final regAlert = loc['regulatory_alert'] as Map<String, dynamic>?;
  final isRegulatory = regAlert != null;
  final regulatoryPriority = (regAlert?['priority'] as String?) ?? 'low';
  final regulatoryMessage = (regAlert?['message'] as String?) ?? '';
  final regulatoryFineEur =
      ((regAlert?['fine_eur'] as num?) ?? 0).toDouble();
  final affiliateUrl = (loc['getyourguide_affiliate_url'] as String?) ?? '';
  final audioUrl = (loc['audio_url'] as String?) ?? '';

  _fireNotification(
    slug: slug,
    title: name,
    body: isRegulatory ? regulatoryMessage : description,
    isRegulatory: isRegulatory,
    priority: regulatoryPriority,
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

Future<void> _fireNotification({
  required String slug,
  required String title,
  required String body,
  required bool isRegulatory,
  required String priority,
}) async {
  if (isRegulatory) {
    final last = _lastRegulatoryAlert[slug];
    if (last != null && DateTime.now().difference(last) < _regulatoryCooldown) {
      return;
    }
    _lastRegulatoryAlert[slug] = DateTime.now();
  }

  final isHigh = priority == 'high';
  final isMedium = priority == 'medium';

  await notificationPlugin.show(
    slug.hashCode & 0x7FFFFFFF,
    title,
    body,
    NotificationDetails(
      android: AndroidNotificationDetails(
        isRegulatory ? 'bike_tour_regulatory' : 'bike_tour_geofence',
        isRegulatory ? 'Regulatory Alerts' : 'Landmark Alerts',
        importance:
            isHigh ? Importance.max : (isMedium ? Importance.high : Importance.defaultImportance),
        priority:
            isHigh ? Priority.max : (isMedium ? Priority.high : Priority.defaultPriority),
        fullScreenIntent: isHigh,
        category: isHigh ? AndroidNotificationCategory.alarm : null,
      ),
      iOS: DarwinNotificationDetails(
        presentAlert: true,
        presentSound: isRegulatory,
        interruptionLevel:
            isHigh ? InterruptionLevel.timeSensitive : InterruptionLevel.active,
      ),
    ),
  );
}

double _metres(double lat1, double lon1, double lat2, double lon2) {
  const r = 6371000.0;
  final dLat = _rad(lat2 - lat1);
  final dLon = _rad(lon2 - lon1);
  final a = sin(dLat / 2) * sin(dLat / 2) +
      cos(_rad(lat1)) * cos(_rad(lat2)) * sin(dLon / 2) * sin(dLon / 2);
  return r * 2 * atan2(sqrt(a), sqrt(1 - a));
}

double _rad(double deg) => deg * pi / 180;
