// One-shot cleanup: remove DUPLICATE landmark docs and normalize every landmark
// to a deterministic doc id == slug, so the seeder + generator (both upsert by
// slug) can never create duplicates again. Also dedupes quizzes/faqs left over
// from the old (auto-id) seeder.
//
// Canonical per slug = an EXISTING slug-id doc if present (it's the permanent
// home written by seed.js/the generator), else the earliest-created doc, which
// is then copied to a slug-id doc (exact copy — no merge, so no blended/ghost
// fields). All other docs for that slug are deleted. Idempotent.
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

  for (const [slug, docs] of bySlug) {
    // Prefer an existing slug-id doc as canonical; else earliest created_at,
    // tie-broken by doc id for determinism.
    docs.sort((a, b) => {
      const t = toMillis(a.get('created_at')) - toMillis(b.get('created_at'));
      return t !== 0 ? t : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    const canonical = docs.find((d) => d.id === slug) ?? docs[0];
    const extras = docs.filter((d) => d !== canonical);
    if (canonical.id === slug && extras.length === 0) continue; // already clean

    if (canonical.id !== slug) {
      console.log(`   • ${slug}: migrate id "${canonical.id}" → "${slug}"${extras.length ? `, drop ${extras.length} dupe(s)` : ''}`);
      if (!DRY_RUN) {
        await db.collection('locations').doc(slug).set(canonical.data()); // exact copy, no merge
        await canonical.ref.delete();
      }
      migrated++;
    } else if (extras.length) {
      console.log(`   • ${slug}: keep slug doc, drop ${extras.length} duplicate(s)`);
    }
    for (const ex of extras) {
      if (ex.id === slug) continue; // never delete the canonical slug doc
      dupes++;
      if (!DRY_RUN) await ex.ref.delete();
    }
  }

  console.log(`\n   locations: ${bySlug.size} unique slugs, migrated ${migrated}, deleted ${dupes} duplicate(s).`);

  // Leftover duplicate quizzes/faqs from the old auto-id seeder: keep one per
  // (location_slug + question), prefer a deterministic-id doc.
  await dedupeByKey('quizzes', (d) => `${d.get('location_slug')}::${norm(d.get('question'))}`);
  await dedupeByKey('faqs', (d) => `${d.get('location_slug')}::${norm(d.get('question'))}`);

  console.log(`\n${DRY_RUN ? '🧪 DRY RUN — nothing written.' : '✅ Done.'}`);
}

const norm = (s) => String(s ?? '').trim().toLowerCase();

// Generic: keep one doc per key, prefer a deterministic-id doc, delete the rest.
async function dedupeByKey(collection, keyFn) {
  const snap = await db.collection(collection).get();
  const groups = new Map();
  for (const d of snap.docs) {
    const k = keyFn(d);
    if (!k || k.endsWith('::')) continue; // skip docs missing the natural key
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(d);
  }
  let removed = 0;
  for (const docs of groups.values()) {
    if (docs.length < 2) continue;
    docs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const keep = docs.find((d) => /-(sq|sf|quiz|faq)\d*$/.test(d.id)) ?? docs[0];
    for (const d of docs) {
      if (d === keep) continue;
      removed++;
      if (!DRY_RUN) await d.ref.delete();
    }
  }
  console.log(`   ${collection}: removed ${removed} duplicate(s)`);
}

main()
  .catch((e) => { console.error('\n❌  Dedupe failed:', e.message); process.exitCode = 1; })
  .finally(async () => { try { await admin.app().delete(); } catch { /* ignore */ } });
