import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/landmark_card.dart';
import 'parking_page.dart';
import 'profile_page.dart';

class MapPage extends StatefulWidget {
  const MapPage({super.key});

  @override
  State<MapPage> createState() => _MapPageState();
}

class _MapPageState extends State<MapPage> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _tab,
        children: const [
          _MapTab(),
          ParkingPage(),
          ProfilePage(),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _tab,
        onTap: (i) => setState(() => _tab = i),
        items: const [
          BottomNavigationBarItem(
              icon: Icon(Icons.map_outlined),
              activeIcon: Icon(Icons.map),
              label: 'Map'),
          BottomNavigationBarItem(
              icon: Icon(Icons.local_parking_outlined),
              activeIcon: Icon(Icons.local_parking),
              label: 'Parking'),
          BottomNavigationBarItem(
              icon: Icon(Icons.person_outline),
              activeIcon: Icon(Icons.person),
              label: 'Profile'),
        ],
      ),
    );
  }
}

// ─── Map tab ────────────────────────────────────────────────────────────────

class _MapTab extends StatefulWidget {
  const _MapTab();

  @override
  State<_MapTab> createState() => _MapTabState();
}

class _MapTabState extends State<_MapTab> {
  final _mapController = MapController();
  List<Map<String, dynamic>> _locations = [];
  LatLng? _userPos;

  static const _barcelona = LatLng(41.3851, 2.1734);

  static const _categoryColors = {
    'landmark': Color(0xFF1565C0),
    'dismount_zone': Color(0xFFB71C1C),
    'parking': Color(0xFF2E7D32),
    'hazard': Color(0xFFE65100),
    'viewpoint': Color(0xFF4A148C),
  };

  @override
  void initState() {
    super.initState();
    _loadLocations();
    _trackUser();
  }

  Future<void> _loadLocations() async {
    final snap = await FirebaseFirestore.instance
        .collection('locations')
        .where('is_active', isEqualTo: true)
        .get();
    if (!mounted) return;
    setState(() {
      _locations =
          snap.docs.map((d) => {'_id': d.id, ...d.data()}).toList();
    });
  }

  void _trackUser() {
    Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10,
      ),
    ).listen((pos) {
      if (!mounted) return;
      setState(() => _userPos = LatLng(pos.latitude, pos.longitude));
    });
  }

  List<Marker> _buildMarkers() {
    final markers = <Marker>[];

    for (final loc in _locations) {
      final gp = loc['coordinates'] as GeoPoint?;
      if (gp == null) continue;
      final cat = (loc['category'] as String?) ?? 'landmark';
      final color = _categoryColors[cat] ?? const Color(0xFF1565C0);
      final name = (loc['name'] as String?) ?? '';

      markers.add(Marker(
        point: LatLng(gp.latitude, gp.longitude),
        width: 36,
        height: 36,
        child: GestureDetector(
          onTap: () => _showMarkerTooltip(name, cat),
          child: Container(
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2),
              boxShadow: [
                BoxShadow(
                    color: color.withOpacity(0.4),
                    blurRadius: 6,
                    offset: const Offset(0, 2))
              ],
            ),
            child: Icon(_categoryIcon(cat), color: Colors.white, size: 18),
          ),
        ),
      ));
    }

    if (_userPos != null) {
      markers.add(Marker(
        point: _userPos!,
        width: 20,
        height: 20,
        child: Container(
          decoration: BoxDecoration(
            color: Colors.blue,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: [
              BoxShadow(
                  color: Colors.blue.withOpacity(0.4),
                  blurRadius: 8,
                  spreadRadius: 2)
            ],
          ),
        ),
      ));
    }

    return markers;
  }

  IconData _categoryIcon(String cat) {
    switch (cat) {
      case 'dismount_zone':
        return Icons.warning_amber_rounded;
      case 'parking':
        return Icons.local_parking;
      case 'hazard':
        return Icons.report_problem_outlined;
      case 'viewpoint':
        return Icons.landscape;
      default:
        return Icons.place;
    }
  }

  void _showMarkerTooltip(String name, String cat) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(name),
      duration: const Duration(seconds: 2),
      backgroundColor: AppTheme.surface,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppState>(
      builder: (context, appState, _) {
        return Stack(
          children: [
            FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: _userPos ?? _barcelona,
                initialZoom: 14.0,
              ),
              children: [
                TileLayer(
                  urlTemplate:
                      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.biketourguide.app',
                  maxZoom: 19,
                ),
                MarkerLayer(markers: _buildMarkers()),
              ],
            ),

            // Re-center button
            Positioned(
              bottom: appState.hasActiveLandmark ? 300 : 24,
              right: 16,
              child: FloatingActionButton.small(
                backgroundColor: AppTheme.surface,
                foregroundColor: Colors.white,
                onPressed: () {
                  if (_userPos != null) {
                    _mapController.move(_userPos!, 15);
                  }
                },
                child: const Icon(Icons.my_location),
              ),
            ),

            // Landmark bottom sheet
            if (appState.hasActiveLandmark)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: _LandmarkSheet(appState: appState),
              ),
          ],
        );
      },
    );
  }
}

// ─── Bottom sheet for active landmark ───────────────────────────────────────

class _LandmarkSheet extends StatefulWidget {
  const _LandmarkSheet({required this.appState});
  final AppState appState;

  @override
  State<_LandmarkSheet> createState() => _LandmarkSheetState();
}

class _LandmarkSheetState extends State<_LandmarkSheet> {
  String? _loadedSlug;
  String _quizQuestion = '';
  List<String> _quizOptions = [];
  int _quizCorrectIndex = -1;
  String _quizExplanation = '';
  int _quizPoints = 0;
  bool _quizAlreadyCompleted = false;
  List<String> _faqQuestions = [];
  List<String> _faqAnswers = [];
  List<bool> _faqIsPremium = [];

  @override
  void didUpdateWidget(_LandmarkSheet old) {
    super.didUpdateWidget(old);
    if (widget.appState.activeLocationSlug != _loadedSlug) {
      _fetchCardData(widget.appState.activeLocationSlug);
    }
  }

  @override
  void initState() {
    super.initState();
    _fetchCardData(widget.appState.activeLocationSlug);
  }

  Future<void> _fetchCardData(String slug) async {
    _loadedSlug = slug;
    final fs = FirebaseFirestore.instance;
    final user = FirebaseAuth.instance.currentUser;

    final futures = await Future.wait([
      fs
          .collection('quizzes')
          .where('location_slug', isEqualTo: slug)
          .where('is_active', isEqualTo: true)
          .limit(1)
          .get(),
      fs
          .collection('faqs')
          .where('location_slug', isEqualTo: slug)
          .where('is_active', isEqualTo: true)
          .orderBy('sort_order')
          .limit(6)
          .get(),
      if (user != null)
        fs.collection('users').doc(user.uid).get()
      else
        Future.value(null),
    ]);

    final quizSnap = futures[0] as QuerySnapshot<Map<String, dynamic>>;
    final faqSnap = futures[1] as QuerySnapshot<Map<String, dynamic>>;
    final userDoc = futures.length > 2
        ? futures[2] as DocumentSnapshot<Map<String, dynamic>>?
        : null;

    final completedIds = List<String>.from(
        (userDoc?.data()?['completed_quiz_ids'] as List?) ?? []);

    if (!mounted) return;
    setState(() {
      _quizAlreadyCompleted = completedIds.contains(slug);
      if (quizSnap.docs.isNotEmpty) {
        final q = quizSnap.docs.first.data();
        _quizQuestion = (q['question'] as String?) ?? '';
        _quizOptions =
            List<String>.from((q['options'] as List<dynamic>?) ?? []);
        _quizCorrectIndex = (q['correct_option_index'] as int?) ?? -1;
        _quizExplanation = (q['explanation'] as String?) ?? '';
        _quizPoints = (q['points_reward'] as int?) ?? 0;
      }
      _faqQuestions = faqSnap.docs
          .map((d) => (d.data()['question'] as String?) ?? '')
          .toList();
      _faqAnswers = faqSnap.docs
          .map((d) => (d.data()['answer'] as String?) ?? '')
          .toList();
      _faqIsPremium = faqSnap.docs
          .map((d) => (d.data()['is_premium'] as bool?) ?? false)
          .toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.appState;
    return Material(
      color: Colors.transparent,
      child: SingleChildScrollView(
        child: LandmarkCard(
          landmarkName: a.activeLocationName,
          description: a.activeLocationDescription,
          category: a.activeLocationCategory,
          isRegulatory: a.activeLocationIsRegulatory,
          regulatoryMessage: a.activeLocationRegulatoryMessage,
          regulatoryFineEur: a.activeLocationRegulatoryFineEur,
          audioUrl: a.activeLocationAudioUrl,
          affiliateUrl: a.activeLocationAffiliateUrl,
          isSubscribed: a.isSubscribed,
          quizQuestion: _quizQuestion,
          quizOptions: _quizOptions,
          quizCorrectIndex: _quizCorrectIndex,
          quizExplanation: _quizExplanation,
          quizPoints: _quizPoints,
          quizAlreadyCompleted: _quizAlreadyCompleted,
          faqQuestions: _faqQuestions,
          faqAnswers: _faqAnswers,
          faqIsPremium: _faqIsPremium,
          onDismiss: () => context.read<AppState>().dismissActiveLandmark(),
          onAudioPlay: () async {
            final uri = Uri.tryParse(a.activeLocationAudioUrl);
            if (uri != null) {
              await launchUrl(uri, mode: LaunchMode.externalApplication);
            }
          },
          onQuizCorrect: (points) async {
            final user = FirebaseAuth.instance.currentUser;
            if (user == null) return;
            final slug = a.activeLocationSlug;
            setState(() => _quizAlreadyCompleted = true);
            await FirebaseFirestore.instance
                .collection('users')
                .doc(user.uid)
                .set({
              'completed_quiz_ids': FieldValue.arrayUnion([slug]),
              'total_points': FieldValue.increment(points),
              'visited_location_slugs': FieldValue.arrayUnion([slug]),
            }, SetOptions(merge: true));
          },
        ),
      ),
    );
  }
}
