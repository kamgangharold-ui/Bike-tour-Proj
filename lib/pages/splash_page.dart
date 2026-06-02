import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../actions/initialize_geofencing.dart';
import '../actions/start_geofencing.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  Future<void> _init() async {
    final appState = context.read<AppState>();

    // Wire geofencing callbacks to AppState before starting tracking
    GeofencingActions.onLandmarkEntered = ({
      required slug,
      required name,
      required description,
      required category,
      required isRegulatory,
      required regulatoryMessage,
      required regulatoryFineEur,
      required affiliateUrl,
      required audioUrl,
    }) {
      appState.onLandmarkEntered(
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
    };

    GeofencingActions.onLandmarkExited = ({required slug}) {
      appState.onLandmarkExited(slug: slug);
    };

    await initializeGeofencing();
    await startGeofencing();

    if (!mounted) return;

    final user = FirebaseAuth.instance.currentUser;
    Navigator.pushReplacementNamed(
        context, user != null ? '/map' : '/auth');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: AppTheme.accent,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.directions_bike,
                  color: Colors.black, size: 52),
            ),
            const SizedBox(height: 24),
            const Text(
              'Barcelona\nBike Tour',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  height: 1.2),
            ),
            const SizedBox(height: 40),
            const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                  strokeWidth: 2.5, color: AppTheme.accent),
            ),
          ],
        ),
      ),
    );
  }
}
