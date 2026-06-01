// FlutterFlow Custom Action: filterParkingByDistance
// Required packages: (none beyond dart:core)
// Parameters (define in FF Custom Action editor):
//   stationsJson   → String  (JSON array from GetBiciboxStations or GetBiciparkStations)
//   userLatitude   → Double
//   userLongitude  → Double
//   radiusMetres   → Double  (recommended: 500 for "nearby parking" panel)
// Returns: String  (JSON array, sorted by distance ASC, each record gains distanceMetres)

import 'dart:convert';
import 'dart:math';

Future<String> filterParkingByDistance(
  String stationsJson,
  double userLatitude,
  double userLongitude,
  double radiusMetres,
) async {
  List<dynamic> stations;
  try {
    stations = (jsonDecode(stationsJson) as List<dynamic>?) ?? [];
  } catch (_) {
    return '[]';
  }

  final results = <Map<String, dynamic>>[];

  for (final raw in stations) {
    final station = raw as Map<String, dynamic>;

    // Open Data BCN returns coordinates as strings in LATITUD / LONGITUD fields
    final lat = double.tryParse((station['LATITUD'] as String?) ?? '');
    final lng = double.tryParse((station['LONGITUD'] as String?) ?? '');
    if (lat == null || lng == null) continue;

    final distM = _haversineMetres(userLatitude, userLongitude, lat, lng);
    if (distM > radiusMetres) continue;

    results.add({
      ...station,
      'distanceMetres': distM.round(),
    });
  }

  results.sort((a, b) =>
      (a['distanceMetres'] as int).compareTo(b['distanceMetres'] as int));

  return jsonEncode(results);
}

double _haversineMetres(
    double lat1, double lon1, double lat2, double lon2) {
  const earthRadius = 6371000.0;
  final dLat = _rad(lat2 - lat1);
  final dLon = _rad(lon2 - lon1);
  final a = sin(dLat / 2) * sin(dLat / 2) +
      cos(_rad(lat1)) * cos(_rad(lat2)) * sin(dLon / 2) * sin(dLon / 2);
  return earthRadius * 2 * atan2(sqrt(a), sqrt(1 - a));
}

double _rad(double deg) => deg * pi / 180;
