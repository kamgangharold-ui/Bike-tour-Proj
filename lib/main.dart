import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'firebase_options.dart';
import 'pages/auth_page.dart';
import 'pages/landmark_detail_page.dart';
import 'pages/map_page.dart';
import 'pages/splash_page.dart';
import 'state/app_state.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(const BikeTourApp());
}

class BikeTourApp extends StatelessWidget {
  const BikeTourApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AppState(),
      child: MaterialApp(
        title: 'Barcelona Bike Tour',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark,
        initialRoute: '/',
        routes: {
          '/': (_) => const SplashPage(),
          '/auth': (_) => const AuthPage(),
          '/map': (_) => const MapPage(),
          '/landmark-detail': (_) => const LandmarkDetailPage(),
        },
      ),
    );
  }
}
