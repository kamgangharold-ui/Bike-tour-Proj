import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../state/app_state.dart';
import '../theme/app_theme.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Profile'),
        backgroundColor: AppTheme.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await FirebaseAuth.instance.signOut();
              if (context.mounted) {
                Navigator.pushReplacementNamed(context, '/auth');
              }
            },
          ),
        ],
      ),
      body: user == null
          ? const Center(
              child: Text('Not signed in', style: TextStyle(color: Colors.grey)))
          : _ProfileBody(user: user),
    );
  }
}

// Replace with your real Stripe payment link from the Stripe Dashboard.
const _stripeCheckoutUrl = 'https://buy.stripe.com/YOUR_PAYMENT_LINK';

class _ProfileBody extends StatelessWidget {
  const _ProfileBody({required this.user});
  final User user;

  Future<void> _openStripeCheckout(BuildContext context) async {
    final uri = Uri.parse(_stripeCheckoutUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Could not open payment page'),
        backgroundColor: AppTheme.surface,
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isSubscribed = context.watch<AppState>().isSubscribed;

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .snapshots(),
      builder: (context, snap) {
        final data = snap.data?.data() ?? {};
        final points = (data['total_points'] as int?) ?? 0;
        final visited =
            List<String>.from((data['visited_location_slugs'] as List?) ?? []);
        final subStatus =
            (data['subscription_status'] as String?) ?? 'free';

        // Sync isSubscribed to AppState
        WidgetsBinding.instance.addPostFrameCallback((_) {
          context.read<AppState>().setSubscribed(subStatus == 'active');
        });

        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // Avatar + name
            Center(
              child: Column(children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: AppTheme.accent.withOpacity(0.15),
                  child: const Icon(Icons.person,
                      color: AppTheme.accent, size: 40),
                ),
                const SizedBox(height: 12),
                Text(
                  user.isAnonymous
                      ? 'Guest Cyclist'
                      : (user.displayName ?? user.email ?? 'Cyclist'),
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 6),
                _SubscriptionChip(status: subStatus),
              ]),
            ),
            const SizedBox(height: 28),

            // Stats row
            Row(children: [
              Expanded(
                  child: _StatCard(
                      value: '$points',
                      label: 'Points',
                      icon: Icons.emoji_events,
                      color: AppTheme.accent)),
              const SizedBox(width: 12),
              Expanded(
                  child: _StatCard(
                      value: '${visited.length}',
                      label: 'Landmarks\nVisited',
                      icon: Icons.place,
                      color: const Color(0xFF1565C0))),
            ]),
            const SizedBox(height: 24),

            // Visited slugs list
            if (visited.isNotEmpty) ...[
              const Text('Visited landmarks',
                  style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 14)),
              const SizedBox(height: 8),
              ...visited.map((slug) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(children: [
                      const Icon(Icons.check_circle,
                          size: 16, color: AppTheme.accent),
                      const SizedBox(width: 8),
                      Text(
                        slug
                            .split('-')
                            .map((w) => w.isEmpty
                                ? ''
                                : '${w[0].toUpperCase()}${w.substring(1)}')
                            .join(' '),
                        style: const TextStyle(
                            color: Colors.white70, fontSize: 14),
                      ),
                    ]),
                  )),
            ],

            const SizedBox(height: 28),
            if (!isSubscribed)
              ElevatedButton.icon(
                onPressed: () => _openStripeCheckout(context),
                icon: const Icon(Icons.star),
                label: const Text('Upgrade to Premium'),
              ),
          ],
        );
      },
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard(
      {required this.value,
      required this.label,
      required this.icon,
      required this.color});
  final String value;
  final String label;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: AppTheme.card, borderRadius: BorderRadius.circular(12)),
      child: Column(children: [
        Icon(icon, color: color, size: 28),
        const SizedBox(height: 8),
        Text(value,
            style: TextStyle(
                color: color,
                fontSize: 24,
                fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text(label,
            textAlign: TextAlign.center,
            style: const TextStyle(
                color: Colors.grey, fontSize: 12, height: 1.3)),
      ]),
    );
  }
}

class _SubscriptionChip extends StatelessWidget {
  const _SubscriptionChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final isPremium = status == 'active';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: isPremium
            ? AppTheme.accent.withOpacity(0.15)
            : Colors.grey.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: isPremium ? AppTheme.accent : Colors.grey, width: 1),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(isPremium ? Icons.star : Icons.star_border,
            size: 14,
            color: isPremium ? AppTheme.accent : Colors.grey),
        const SizedBox(width: 4),
        Text(
          isPremium ? 'Premium' : 'Free Plan',
          style: TextStyle(
              color: isPremium ? AppTheme.accent : Colors.grey,
              fontSize: 12,
              fontWeight: FontWeight.w600),
        ),
      ]),
    );
  }
}
