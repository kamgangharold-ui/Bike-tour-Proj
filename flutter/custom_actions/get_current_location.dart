// FlutterFlow Custom Action: getCurrentLocation
// Required packages: radar_flutter
// Returns: List<double>  →  [latitude, longitude]
// Returns [0.0, 0.0] when location is unavailable; always check for zeros before use.

import 'package:radar_flutter/radar_flutter.dart';

Future<List<double>> getCurrentLocation() async {
  final result = await Radar.getLocation();
  final status = (result['status'] as String?) ?? '';
  if (status != 'SUCCESS') return [0.0, 0.0];

  final location = result['location'] as Map<dynamic, dynamic>?;
  if (location == null) return [0.0, 0.0];

  final lat = (location['latitude'] as num?)?.toDouble() ?? 0.0;
  final lng = (location['longitude'] as num?)?.toDouble() ?? 0.0;
  return [lat, lng];
}
