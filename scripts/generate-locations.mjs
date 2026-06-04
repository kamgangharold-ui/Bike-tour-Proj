// Generate REAL Barcelona cycling locations with Claude and write them to Firestore.
// Designed to run UNATTENDED on GitHub-hosted runners. Reads ONLY process.env +
// network (Firestore Admin SDK + Anthropic) — never any local file or local creds.

import admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';

// ─── CONFIG (env + defaults; works in CI and locally) ────────────────────────
const CITY = process.env.CITY || 'barcelona';
const COUNT = clampInt(process.env.COUNT, 3, 1, 10);
const AUTOPUBLISH = String(process.env.AUTOPUBLISH).toLowerCase() === 'true';
const MAX_TOTAL = clampInt(process.env.MAX_TOTAL, 250, 1, 100000);
const DRY_RUN = String(process.env.DRY_RUN).toLowerCase() === 'true'; // test: validate + log, never write
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

// Barcelona bounding box for coordinate validation.
const BOUNDS = { latMin: 41.30, latMax: 41.47, lonMin: 2.05, lonMax: 2.25 };
const CATEGORIES = ['landmark', 'dismount_zone', 'parking', 'hazard', 'viewpoint'];
const ALERT_TYPES = ['dismount', 'speed_limit', 'no_cycling', 'fine_warning'];
const PRIORITIES = ['low', 'medium', 'high'];
const FAQ_CATEGORIES = ['access', 'parking', 'rules', 'logistics', 'history', 'safety', 'tickets'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

function clampInt(v, def, min, max) {
  const n = parseInt(v ?? '', 10);
  return Number.isNaN(n) ? def : Math.max(min, Math.min(max, n));
}
function fail(msg, err) {
  console.error(`\n❌ ${msg}${err ? `: ${err.message || err}` : ''}`);
  process.exit(1);
}
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// ─── Init Admin SDK + Anthropic from env ONLY ────────────────────────────────
if (!process.env.FIREBASE_SERVICE_ACCOUNT) fail('FIREBASE_SERVICE_ACCOUNT env var is not set');
if (!process.env.ANTHROPIC_API_KEY) fail('ANTHROPIC_API_KEY env var is not set');

let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
  fail('FIREBASE_SERVICE_ACCOUNT is not valid JSON', e);
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Tool schema forces Claude to return strict, valid JSON ──────────────────
const LOCATION_TOOL = {
  name: 'submit_locations',
  description: 'Submit the list of new, real, verifiable cycling locations.',
  input_schema: {
    type: 'object',
    properties: {
      locations: {
        type: 'array',
        description: `Up to ${COUNT} genuinely real, verifiable places. Return FEWER (or an empty array) rather than inventing any.`,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            slug: { type: 'string', description: 'url-safe, lowercase, hyphenated, unique' },
            category: { type: 'string', enum: CATEGORIES },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            geofence_radius_metres: { type: 'number', description: '40 for most POIs; 80-100 for dismount/no-cycling zones' },
            short_description: { type: 'string', description: 'max ~160 chars (shown in a notification)' },
            long_description: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            regulatory_alert: {
              type: 'object',
              description: 'Include ONLY when a real cycling restriction genuinely applies here. OMIT this field otherwise. Never invent fine amounts.',
              properties: {
                alert_type: { type: 'string', enum: ALERT_TYPES },
                message: { type: 'string' },
                fine_eur: { type: 'number', description: '0 if there is no specific monetary fine' },
                priority: { type: 'string', enum: PRIORITIES },
              },
              required: ['alert_type', 'message', 'fine_eur', 'priority'],
            },
            quiz: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
                correct_option_index: { type: 'integer', minimum: 0, maximum: 3 },
                explanation: { type: 'string' },
                difficulty: { type: 'string', enum: DIFFICULTIES },
                points_reward: { type: 'integer' },
              },
              required: ['question', 'options', 'correct_option_index', 'explanation', 'difficulty', 'points_reward'],
            },
            faqs: {
              type: 'array',
              minItems: 3,
              maxItems: 3,
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  answer: { type: 'string' },
                  category: { type: 'string', enum: FAQ_CATEGORIES },
                },
                required: ['question', 'answer', 'category'],
              },
            },
          },
          required: ['name', 'slug', 'category', 'latitude', 'longitude', 'geofence_radius_metres', 'short_description', 'quiz', 'faqs'],
        },
      },
    },
    required: ['locations'],
  },
};

async function generate(existingSlugs) {
  const cap = CITY.charAt(0).toUpperCase() + CITY.slice(1);
  const system =
    `You generate REAL, verifiable cycling-relevant points of interest in ${cap}, Spain, for a bike tour-guide app.\n` +
    `STRICT RULES:\n` +
    `- ONLY genuinely real, verifiable, well-known places with ACCURATE real-world coordinates.\n` +
    `- Do NOT output any place whose slug appears in the "already exists" list.\n` +
    `- Return UP TO ${COUNT} places, but it is CORRECT and EXPECTED to return FEWER — even an empty list — once you run out of genuinely new real places. NEVER invent, approximate, guess, or pad with fake/generic places to reach the number.\n` +
    `- Coordinates must be the real latitude/longitude of the place, inside Barcelona.\n` +
    `- Add "regulatory_alert" ONLY when a real cycling restriction genuinely applies (e.g. a true dismount or no-cycling zone). OMIT it otherwise. NEVER fabricate fine amounts.\n` +
    `- For each place include one accurate 4-option quiz and exactly three FAQs a cyclist would really ask.`;
  const user =
    `Generate up to ${COUNT} new ${CITY} cycling locations now.\n\n` +
    `Already exists — DO NOT repeat these slugs:\n${existingSlugs.length ? existingSlugs.join(', ') : '(none yet)'}`;

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: Math.min(16000, 2000 + COUNT * 2200),
    system,
    tools: [LOCATION_TOOL],
    tool_choice: { type: 'tool', name: 'submit_locations' },
    messages: [{ role: 'user', content: user }],
  });
  const toolUse = resp.content.find((b) => b.type === 'tool_use');
  if (!toolUse) throw new Error('Claude did not return a submit_locations tool call');
  const locations = toolUse.input && toolUse.input.locations;
  return Array.isArray(locations) ? locations : [];
}

// ─── Validation (skip + log bad items; never abort the whole run) ────────────
function validate(loc, existingSlugs, batchSlugs) {
  const errs = [];
  if (!isStr(loc.name)) errs.push('name');
  if (!isStr(loc.slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(loc.slug)) errs.push('slug-format');
  if (!CATEGORIES.includes(loc.category)) errs.push('category');
  if (!isNum(loc.latitude) || loc.latitude < BOUNDS.latMin || loc.latitude > BOUNDS.latMax) errs.push('latitude-bounds');
  if (!isNum(loc.longitude) || loc.longitude < BOUNDS.lonMin || loc.longitude > BOUNDS.lonMax) errs.push('longitude-bounds');
  if (!isNum(loc.geofence_radius_metres) || loc.geofence_radius_metres <= 0) errs.push('geofence_radius');
  if (!isStr(loc.short_description)) errs.push('short_description');
  const q = loc.quiz;
  if (!q || !isStr(q.question) || !Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(isStr)
      || !Number.isInteger(q.correct_option_index) || q.correct_option_index < 0 || q.correct_option_index > 3
      || !isStr(q.explanation) || !DIFFICULTIES.includes(q.difficulty) || !isNum(q.points_reward)) {
    errs.push('quiz');
  }
  if (!Array.isArray(loc.faqs) || loc.faqs.length !== 3
      || !loc.faqs.every((f) => f && isStr(f.question) && isStr(f.answer) && FAQ_CATEGORIES.includes(f.category))) {
    errs.push('faqs');
  }
  if (existingSlugs.has(loc.slug)) errs.push('duplicate-existing');
  if (batchSlugs.has(loc.slug)) errs.push('duplicate-in-batch');
  return errs;
}

// Keep a regulatory_alert only if it is genuinely valid; otherwise null (conservative).
function cleanAlert(ra) {
  if (!ra || typeof ra !== 'object') return null;
  if (!ALERT_TYPES.includes(ra.alert_type) || !isStr(ra.message)) return null;
  return {
    alert_type: ra.alert_type,
    message: ra.message,
    fine_eur: isNum(ra.fine_eur) ? ra.fine_eur : 0,
    priority: PRIORITIES.includes(ra.priority) ? ra.priority : 'medium',
  };
}

async function main() {
  console.log(`🚲 generate-locations | CITY=${CITY} COUNT=${COUNT} AUTOPUBLISH=${AUTOPUBLISH} MAX_TOTAL=${MAX_TOTAL} DRY_RUN=${DRY_RUN}`);

  // MAX_TOTAL cap on AI-generated docs.
  const aiCount = (await db.collection('locations').where('source', '==', 'ai-generated').count().get()).data().count;
  console.log(`   ai-generated so far: ${aiCount}`);
  if (aiCount >= MAX_TOTAL) {
    console.log(`✅ MAX_TOTAL (${MAX_TOTAL}) reached — skipping generation.`);
    return;
  }

  // All existing slugs (for dedup + the avoid-list).
  const slugSnap = await db.collection('locations').select('slug').get();
  const existingSlugs = new Set(slugSnap.docs.map((d) => d.get('slug')).filter(Boolean));
  console.log(`   existing total locations: ${existingSlugs.size}`);

  let raw;
  try {
    raw = await generate([...existingSlugs]);
  } catch (e) {
    throw new Error(`Claude generation failed: ${e?.message || e}`);
  }
  console.log(`   Claude returned ${raw.length} candidate(s)`);

  const batch = db.batch();
  const batchSlugs = new Set();
  const ts = admin.firestore.FieldValue.serverTimestamp();
  let created = 0, dup = 0, invalid = 0;

  for (const loc of raw) {
    const errs = validate(loc, existingSlugs, batchSlugs);
    if (errs.length) {
      if (errs.some((e) => e.startsWith('duplicate'))) dup++; else invalid++;
      console.log(`   ⏭️  skip "${loc.slug ?? loc.name ?? '?'}" — ${errs.join(', ')}`);
      continue;
    }
    const slug = loc.slug;
    batchSlugs.add(slug);
    const alert = cleanAlert(loc.regulatory_alert);

    batch.set(db.collection('locations').doc(slug), {
      name: loc.name,
      slug,
      category: loc.category,
      coordinates: new admin.firestore.GeoPoint(loc.latitude, loc.longitude),
      geofence_radius_metres: loc.geofence_radius_metres,
      short_description: loc.short_description,
      long_description: isStr(loc.long_description) ? loc.long_description : '',
      audio_url: '',
      image_urls: [],
      getyourguide_affiliate_url: '',
      regulatory_alert: alert,
      tags: Array.isArray(loc.tags) ? loc.tags.filter(isStr) : [],
      is_active: AUTOPUBLISH,
      source: 'ai-generated',
      generated_at: ts,
      created_at: ts,
      updated_at: ts,
    });

    const q = loc.quiz;
    batch.set(db.collection('quizzes').doc(`${slug}-quiz`), {
      location_slug: slug,
      question: q.question,
      options: q.options,
      correct_option_index: q.correct_option_index,
      explanation: q.explanation,
      difficulty: q.difficulty,
      points_reward: q.points_reward,
      is_active: true,
      source: 'ai-generated',
      generated_at: ts,
      created_at: ts,
      updated_at: ts,
    });

    loc.faqs.forEach((f, i) => {
      batch.set(db.collection('faqs').doc(`${slug}-faq-${i + 1}`), {
        location_slug: slug,
        question: f.question,
        answer: f.answer,
        category: f.category,
        sort_order: (i + 1) * 10,
        is_premium: i === 2, // faq-1 & faq-2 free, faq-3 premium
        is_active: true,
        source: 'ai-generated',
        generated_at: ts,
        created_at: ts,
        updated_at: ts,
      });
    });

    created++;
    console.log(`   ✅ ${slug} — "${loc.name}" (${loc.category})${alert ? ' ⚠️ regulatory' : ''}`);
  }

  if (created > 0 && !DRY_RUN) await batch.commit();

  console.log(
    `\n${DRY_RUN ? '🧪 DRY RUN — nothing written.' : '📦 Done.'} ` +
    `created ${created}, skipped ${dup} duplicate(s), rejected ${invalid} invalid. ` +
    `ai-generated total now ${DRY_RUN ? `${aiCount} (+${created} pending)` : aiCount + created}.` +
    (AUTOPUBLISH ? '' : ' (is_active:false — review before publishing.)'),
  );
}

main()
  .catch((e) => {
    console.error(`\n❌ ${e?.message || e}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Close the Admin SDK so the process exits cleanly (avoids an abrupt process.exit()).
    try { await admin.app().delete(); } catch { /* ignore */ }
  });
