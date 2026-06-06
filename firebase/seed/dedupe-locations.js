// One-shot cleanup: remove DUPLICATE landmark docs and normalize every landmark
// to a deterministic doc id == slug, so the seeder + generator (both upsert by
// slug) can never create duplicates again.
//
// For each slug it keeps the EARLIEST doc (by created_at), rewrites it to a
// doc whose id is the slug, and deletes all other docs for that slug (including
// the original auto-id one). Idempotent — safe to run more than once.
//
// Run:  cd firebase/seed && node dedupe-locations.js
// Needs firebase/seed/serviceAccountKey.json (same as seed.js). DRY_RUN=true to
// preview without writing:  DRY_RUN=true node dedupe-locations.js

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const DRY_RUN = String(process.env.DRY_RUN).toLowerCase() === 'true';

const keyPath = path.resolve(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('\n❌  serviceAccountKey.json not found in firebase/seed/. See seed.js header.\n');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
const db = admin.firestore();

function toMillis(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'number') return v;
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
}

async function main() {
  console.log(`\n🧹  Dedupe locations${DRY_RUN ? ' (DRY RUN — no writes)' : ''}`);
  const snap = await db.collection('locations').get();
  console.log(`   ${snap.size} location docs total`);

  // Group docs by slug (skip docs with no slug — leave them untouched).
  const bySlug = new Map();
  for (const doc of snap.docs) {
    const slug = doc.get('slug');
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(doc);
  }

  let dupes = 0;
  let migrated = 0;
  let normalized = 0;

  for (const [slug, docs] of bySlug) {
    // Canonical = earliest created_at (fallback: first in the list).
    docs.sort((a, b) => toMillis(a.get('created_at')) - toMillis(b.get('created_at')));
    const canonical = docs[0];
    const extras = docs.slice(1);

    const needsMigration = canonical.id !== slug;
    if (!needsMigration && extras.length === 0) continue; // already clean

    if (needsMigration) {
      console.log(`   • ${slug}: migrate id "${canonical.id}" → "${slug}"${extras.length ? `, drop ${extras.length} dupe(s)` : ''}`);
      if (!DRY_RUN) {
        await db.collection('locations').doc(slug).set(canonical.data(), { merge: true });
        await canonical.ref.delete(); // remove the old auto-id doc
      }
      migrated++;
    } else if (extras.length) {
      console.log(`   • ${slug}: drop ${extras.length} duplicate(s)`);
    }
    normalized++;
    for (const ex of extras) {
      dupes++;
      if (!DRY_RUN && ex.id !== slug) await ex.ref.delete();
    }
  }

  console.log(
    `\n${DRY_RUN ? '🧪 DRY RUN — nothing written.' : '✅ Done.'} ` +
    `${bySlug.size} unique slugs, normalized ${normalized}, migrated ${migrated}, deleted ${dupes} duplicate doc(s).`,
  );
}

main()
  .catch((e) => { console.error('\n❌  Dedupe failed:', e.message); process.exitCode = 1; })
  .finally(async () => { try { await admin.app().delete(); } catch { /* ignore */ } });
