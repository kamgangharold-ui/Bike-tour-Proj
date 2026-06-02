import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'initialize_geofencing.dart' show notificationPlugin;

Future<void> showLocalNotification(
  String title,
  String body,
  bool isHighPriority,
) async {
  await notificationPlugin.show(
    title.hashCode & 0x7FFFFFFF,
    title,
    body,
    NotificationDetails(
      android: AndroidNotificationDetails(
        isHighPriority ? 'bike_tour_regulatory' : 'bike_tour_geofence',
        isHighPriority ? 'Regulatory Alerts' : 'Landmark Alerts',
        importance: isHighPriority ? Importance.max : Importance.high,
        priority: isHighPriority ? Priority.max : Priority.high,
        fullScreenIntent: isHighPriority,
        category: isHighPriority ? AndroidNotificationCategory.alarm : null,
      ),
      iOS: DarwinNotificationDetails(
        presentAlert: true,
        presentSound: true,
        interruptionLevel: isHighPriority
            ? InterruptionLevel.timeSensitive
            : InterruptionLevel.active,
      ),
    ),
  );
}
