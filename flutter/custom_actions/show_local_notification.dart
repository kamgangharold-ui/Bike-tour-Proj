// FlutterFlow Custom Action: showLocalNotification
// Required packages: flutter_local_notifications
// Parameters (define in FF Custom Action editor):
//   title        → String
//   body         → String
//   isHighPriority → Boolean

import 'package:flutter_local_notifications/flutter_local_notifications.dart';

final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
bool _ready = false;

Future<void> showLocalNotification(
  String title,
  String body,
  bool isHighPriority,
) async {
  if (!_ready) {
    await _plugin.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );
    _ready = true;
  }

  await _plugin.show(
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
        category:
            isHighPriority ? AndroidNotificationCategory.alarm : null,
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
