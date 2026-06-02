import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import '../actions/filter_parking_by_distance.dart';
import '../actions/get_current_location.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';

class ParkingPage extends StatefulWidget {
  const ParkingPage({super.key});

  @override
  State<ParkingPage> createState() => _ParkingPageState();
}

class _ParkingPageState extends State<ParkingPage> {
  static const _biciboxResourceId = 'bicicletes_estacions_bicibox';
  static const _biciparkResourceId = 'aparcaments-bicicletes';
  static const _baseUrl =
      'https://opendata-ajuntament.barcelona.cat/data/api/action/datastore_search';
  static const _radius = 500.0;

  bool _loading = false;
  String? _error;
  List<Map<String, dynamic>> _bicibox = [];
  List<Map<String, dynamic>> _bicipark = [];

  @override
  void initState() {
    super.initState();
    _fetchParking();
  }

  Future<void> _fetchParking() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final loc = await getCurrentLocation();
      final lat = loc[0];
      final lng = loc[1];

      if (lat == 0.0 && lng == 0.0) {
        setState(() => _error = 'Location unavailable. Enable location access and retry.');
        return;
      }

      // Fetch both station types in parallel
      final results = await Future.wait([
        _fetchStations(_biciboxResourceId),
        _fetchStations(_biciparkResourceId),
      ]);

      final biciboxJson = results[0];
      final biciparkJson = results[1];

      final filteredBicibox =
          await filterParkingByDistance(biciboxJson, lat, lng, _radius);
      final filteredBicipark =
          await filterParkingByDistance(biciparkJson, lat, lng, _radius);

      // Update AppState so other pages can access the raw lists
      if (mounted) {
        context.read<AppState>()
          ..setBiciboxStations(biciboxJson)
          ..setBiciparkStations(biciparkJson);
      }

      setState(() {
        _bicibox = List<Map<String, dynamic>>.from(
            jsonDecode(filteredBicibox) as List);
        _bicipark = List<Map<String, dynamic>>.from(
            jsonDecode(filteredBicipark) as List);
      });
    } catch (e) {
      setState(() => _error = 'Could not load parking data. Check your connection.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<String> _fetchStations(String resourceId) async {
    final uri = Uri.parse('$_baseUrl?resource_id=$resourceId&limit=200');
    final res = await http.get(uri);
    if (res.statusCode != 200) return '[]';
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final records = (body['result']?['records'] as List<dynamic>?) ?? [];
    return jsonEncode(records);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Nearby Parking'),
        backgroundColor: AppTheme.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _fetchParking,
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: AppTheme.accent));
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.location_off, color: Colors.grey, size: 48),
              const SizedBox(height: 16),
              Text(_error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.grey)),
              const SizedBox(height: 16),
              ElevatedButton(
                  onPressed: _fetchParking,
                  child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    if (_bicibox.isEmpty && _bicipark.isEmpty) {
      return const Center(
          child: Text('No parking within 500 m.',
              style: TextStyle(color: Colors.grey)));
    }

    return RefreshIndicator(
      onRefresh: _fetchParking,
      color: AppTheme.accent,
      child: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          if (_bicibox.isNotEmpty) ...[
            _SectionHeader(
                label: 'Bicibox — Secure Parking',
                count: _bicibox.length,
                color: const Color(0xFF1565C0)),
            ..._bicibox.map((s) => _StationTile(station: s, isBicibox: true)),
          ],
          if (_bicipark.isNotEmpty) ...[
            _SectionHeader(
                label: 'Bicipark — Open Rack',
                count: _bicipark.length,
                color: const Color(0xFF2E7D32)),
            ..._bicipark.map((s) => _StationTile(station: s, isBicibox: false)),
          ],
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(
      {required this.label, required this.count, required this.color});
  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 18,
            decoration: BoxDecoration(
                color: color, borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(width: 10),
          Text(label,
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 14)),
          const Spacer(),
          Text('$count found',
              style: const TextStyle(color: Colors.grey, fontSize: 12)),
        ],
      ),
    );
  }
}

class _StationTile extends StatelessWidget {
  const _StationTile({required this.station, required this.isBicibox});
  final Map<String, dynamic> station;
  final bool isBicibox;

  @override
  Widget build(BuildContext context) {
    final name = (station['NOM'] as String?) ?? 'Station';
    final address = (station['ADRECA'] as String?) ?? '';
    final distance = station['distanceMetres'] as int? ?? 0;
    final spaces = (station['PLACES_TOTALS'] as String?) ?? '—';
    final color = isBicibox ? const Color(0xFF1565C0) : const Color(0xFF2E7D32);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
                color: color.withOpacity(0.15),
                borderRadius: BorderRadius.circular(8)),
            child: Icon(
                isBicibox ? Icons.lock_outlined : Icons.local_parking,
                color: color,
                size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 14)),
                if (address.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(address,
                        style: const TextStyle(
                            color: Colors.grey, fontSize: 12)),
                  ),
                const SizedBox(height: 6),
                Row(children: [
                  _Badge(
                      label: '$distance m away',
                      icon: Icons.near_me,
                      color: Colors.grey),
                  const SizedBox(width: 8),
                  _Badge(
                      label: '$spaces spaces',
                      icon: Icons.directions_bike,
                      color: color),
                ]),
                const SizedBox(height: 4),
                Text(
                  isBicibox
                      ? 'Requires PIN — check Bicibox app'
                      : 'Open rack — just lock your bike',
                  style: TextStyle(
                      color: color, fontSize: 11, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(
      {required this.label, required this.icon, required this.color});
  final String label;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 12, color: color),
      const SizedBox(width: 3),
      Text(label,
          style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.w500)),
    ]);
  }
}
