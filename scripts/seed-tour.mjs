// One-shot: write the Gaudí Highlights tour document to Firestore.
import admin from 'firebase-admin';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

await db.collection('tours').doc('gaudi-highlights').set({
  name: 'Gaudí Highlights',
  slug: 'gaudi-highlights',
  city_slug: 'barcelona',
  description: "Sagrada Família, Casa Milà and Park Güell — Gaudí's three essentials in one ride.",
  location_slugs: ['sagrada-familia', 'casa-mila-la-pedrera', 'park-guell'],
  distance_km: 7,
  est_minutes: 60,
  is_active: true,
  created_at: admin.firestore.FieldValue.serverTimestamp(),
  updated_at: admin.firestore.FieldValue.serverTimestamp(),
});

console.log('✅ gaudi-highlights tour written to Firestore.');
process.exit(0);
