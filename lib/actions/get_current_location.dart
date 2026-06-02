import 'package:geolocator/geolocator.dart';

// Returns [latitude, longitude]. Returns [0.0, 0.0] when unavailable —
// always check for zeros before passing to filterParkingByDistance.
Future<List<double>> getCurrentLocation() async {
  final permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied ||
      permission == LocationPermission.deniedForever) {
    return [0.0, 0.0];
  }
  try {
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
      ),
    );
    return [pos.latitude, pos.longitude];
  } catch (_) {
    return [0.0, 0.0];
  }
}
