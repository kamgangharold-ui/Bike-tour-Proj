// FlutterFlow Custom Action: startGeofencing
// Custom geofencing engine — replaces Radar.io SDK entirely.
// Required packages: geolocator, flutter_local_notifications, cloud_firestore
//
// How it works:
//   1. Loads all active landmark locations from Firestore on startup.
//   2. Subscribes to a GPS position stream (updates every 10 m of movement).
//   3. For each position, runs Haversine distance check against every landmark.
//   4. ENTRY  → distance < radius                → fires notification + callback
//   5. EXIT   → distance > radius + 15 m buffer  → fires exit callback
//   The 15 m hysteresis buffer prevents notification spam when a rider
//   oscillates near the boundary of a geofence.

import 'dart:async';
import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:geolocator/geolocator.dart';

// ── Public callback hooks (wired by registerGeofencingCallback.dart) ─────────

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

// ── Internal geofence zone model ─────────────────────────────────────────────

class _Zone {
  final String slug;
  final String name;
  final String description;
  final String category;
  final double lat;
  final double lng;
  final double radiusMetres;
  final Map<String, dynamic>? regulatoryAlert;
  final String affiliateUrl;
  final String audioUrl;
  bool isInside = false;
  DateTime? lastHighPriorityAlert;

  _Zone({
    required this.slug,
    required this.name,
    required this.description,
    required this.category,
    required this.lat,
    required this.lng,
    required this.radiusMetres,
    this.regulatoryAlert,
    this.affiliateUrl = '',
    this.audioUrl = '',
  });
}

// ── Module-level state ────────────────────────────────────────────────────────

final _plugin = FlutterLocalNotificationsPlugin();
StreamSubscription<Position>? _positionStream;
List<_Zone> _zones = [];

// ── Entry point called from FlutterFlow ──────────────────────────────────────

Future<void> startGeofencing() async {
  await _loadZonesFromFirestore();
  _startPositionStream();
}

// ── Load landmark geofences from Firestore ────────────────────────────────────

Future<void> _loadZonesFromFirestore() async {
  final snapshot = await FirebaseFirestore.instance
      .collection('locations')
      .where('is_active', isEqualTo: true)
      .get();

  _zones = snapshot.docs.map((doc) {
    final d = doc.data();
    final geoPoint = d['coordinates'] as GeoPoint?;
    return _Zone(
      slug: (d['slug'] as String?) ?? doc.id,
      name: (d['name'] as String?) ?? '',
      description: (d['short_description'] as String?) ?? '',
      category: (d['category'] as String?) ?? 'landmark',
      lat: geoPoint?.latitude ?? 0,
      lng: geoPoint?.longitude ?? 0,
      radiusMetres: ((d['geofence_radius_metres'] as num?) ?? 40).toDouble(),
      regulatoryAlert: d['regulatory_alert'] as Map<String, dynamic>?,
      affiliateUrl: (d['getyourguide_affiliate_url'] as String?) ?? '',
      audioUrl: (d['audio_url'] as String?) ?? '',
    );
  }).where((z) => z.lat != 0 && z.lng != 0).toList();
}

// ── GPS position stream ───────────────────────────────────────────────────────

void _startPositionStream() {
  _positionStream?.cancel();
  _positionStream = Geolocator.getPositionStream(
    locationSettings: const LocationSettings(
      // BALANCED: good accuracy without draining battery on every metre
      accuracy: LocationAccuracy.high,
      distanceFilter: 10, // Only fire callback when device moves ≥ 10 m
    ),
  ).listen(_onPosition, onError: (_) {});
}

// ── Per-position geofence evaluation ─────────────────────────────────────────

Future<void> _onPosition(Position pos) async {
  for (final zone in _zones) {
    final dist = _haversineMetres(pos.latitude, pos.longitude, zone.lat, zone.lng);
    final insideNow = dist <= zone.radiusMetres;
    // Add 15 m exit buffer to avoid oscillation at boundary
    final outsideNow = dist > zone.radiusMetres + 15;

    if (insideNow && !zone.isInside) {
      // ── ENTRY ──────────────────────────────────────────────────────────────
      zone.isInside = true;
      await _fireNotification(zone);
      GeofencingActions.onLandmarkEntered?.call(
        slug: zone.slug,
        name: zone.name,
        description: zone.description,
        category: zone.category,
        isRegulatory: zone.regulatoryAlert != null,
        regulatoryMessage:
            (zone.regulatoryAlert?['message'] as String?) ?? '',
        regulatoryFineEur:
            ((zone.regulatoryAlert?['fine_eur'] as num?) ?? 0).toDouble(),
        affiliateUrl: zone.affiliateUrl,
        audioUrl: zone.audioUrl,
      );
    } else if (outsideNow && zone.isInside) {
      // ── EXIT ───────────────────────────────────────────────────────────────
      zone.isInside = false;
      GeofencingActions.onLandmarkExited?.call(slug: zone.slug);
    }
  }
}

// ── Notification dispatcher ───────────────────────────────────────────────────

Future<void> _fireNotification(_Zone zone) async {
  final isRegulatory = zone.regulatoryAlert != null;
  final priority = (zone.regulatoryAlert?['priority'] as String?) ?? 'low';
  final isHigh = priority == 'high';
  final isMedium = priority == 'medium';

  // Suppress repeat high-priority alerts within 10 minutes
  if (isHigh) {
    final last = zone.lastHighPriorityAlert;
    if (last != null && DateTime.now().difference(last).inMinutes < 10) return;
    zone.lastHighPriorityAlert = DateTime.now();
  }

  final body = isRegulatory
      ? (zone.regulatoryAlert?['message'] as String? ?? zone.description)
      : zone.description;

  await _plugin.show(
    zone.slug.hashCode & 0x7FFFFFFF,
    zone.name,
    body,
    NotificationDetails(
      android: AndroidNotificationDetails(
        isRegulatory ? 'bike_tour_regulatory' : 'bike_tour_geofence',
        isRegulatory ? 'Regulatory Alerts' : 'Landmark Alerts',
        importance: isHigh
            ? Importance.max
            : (isMedium ? Importance.high : Importance.defaultImportance),
        priority: isHigh
            ? Priority.max
            : (isMedium ? Priority.high : Priority.defaultPriority),
        fullScreenIntent: isHigh,
        category: isHigh ? AndroidNotificationCategory.alarm : null,
      ),
      iOS: DarwinNotificationDetails(
        presentAlert: true,
        presentSound: isRegulatory,
        interruptionLevel: isHigh
            ? InterruptionLevel.timeSensitive
            : InterruptionLevel.active,
      ),
    ),
  );
}

// ── Haversine distance formula ────────────────────────────────────────────────

double _haversineMetres(double lat1, double lon1, double lat2, double lon2) {
  const r = 6371000.0;
  final dLat = _rad(lat2 - lat1);
  final dLon = _rad(lon2 - lon1);
  final a = sin(dLat / 2) * sin(dLat / 2) +
      cos(_rad(lat1)) * cos(_rad(lat2)) * sin(dLon / 2) * sin(dLon / 2);
  return r * 2 * atan2(sqrt(a), sqrt(1 - a));
}

double _rad(double deg) => deg * pi / 180;
