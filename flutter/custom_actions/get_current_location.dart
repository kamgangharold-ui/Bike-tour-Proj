// FlutterFlow Custom Action: getCurrentLocation
// Required packages: geolocator
// Returns: List<double> → [latitude, longitude]
// Returns [0.0, 0.0] when location is unavailable — always guard against zeros.

import 'package:geolocator/geolocator.dart';

Future<List<double>> getCurrentLocation() async {
  try {
    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return [0.0, 0.0];
    }
    final pos = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
    return [pos.latitude, pos.longitude];
  } catch (_) {
    return [0.0, 0.0];
  }
}
