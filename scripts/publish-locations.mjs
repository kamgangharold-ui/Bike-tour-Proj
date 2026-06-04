// One-shot script: set is_active:true on specific location slugs.
// Run via GitHub Actions with FIREBASE_SERVICE_ACCOUNT set.
import admin from 'firebase-admin';

const SLUGS = (process.env.SLUGS || '').split(',').map(s => s.trim()).filter(Boolean);

if (!SLUGS.length) { console.error('No SLUGS provided'); process.exit(1); }

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

for (const slug of SLUGS) {
  await db.collection('locations').doc(slug).update({ is_active: true });
  console.log(`✅ published: ${slug}`);
}
console.log(`Done. ${SLUGS.length} location(s) published.`);
process.exit(0);
