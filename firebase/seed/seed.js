const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ─── SETUP ────────────────────────────────────────────────────────────────────
const keyPath = path.resolve(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('\n❌  ERROR: serviceAccountKey.json not found in firebase/seed/');
  console.error('    Download it from: Firebase Console → Project Settings → Service accounts → Generate new private key');
  console.error('    Then place the file at: firebase/seed/serviceAccountKey.json\n');
  process.exit(1);
}

const serviceAccount = require(keyPath);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ─── HELPER ───────────────────────────────────────────────────────────────────
const ts = admin.firestore.FieldValue.serverTimestamp();
const geo = (lat, lng) => new admin.firestore.GeoPoint(lat, lng);

async function seed(collectionName, docs, useSlugAsId = false) {
  console.log(`\n📦  Seeding "${collectionName}"...`);
  const col = db.collection(collectionName);
  for (const doc of docs) {
    const { _id, ...data } = doc;
    const ref = _id ? col.doc(_id) : col.doc();
    await ref.set({ ...data, created_at: ts, updated_at: ts });
    console.log(`   ✅  ${_id || ref.id} — ${data.name || data.question || data.slug || ''}`);
  }
}

// ─── DATA ─────────────────────────────────────────────────────────────────────

const locations = [
  {
    name: 'Sagrada Família',
    slug: 'sagrada-familia',
    category: 'landmark',
    coordinates: geo(41.4036, 2.1744),
    geofence_radius_metres: 40,
    short_description: "Gaudí's unfinished masterpiece — the most visited monument in Spain.",
    long_description: 'Construction began in 1882. Gaudí took over in 1883 and dedicated his life to it until his death in 1926. Anticipated completion: 2026.',
    audio_url: '',
    image_urls: [],
    getyourguide_affiliate_url: '',
    regulatory_alert: null,
    tags: ['gaudí', 'architecture', 'modernisme', 'must-see'],
    is_active: true,
  },
  {
    name: 'Park Güell',
    slug: 'park-guell',
    category: 'landmark',
    coordinates: geo(41.4145, 2.1527),
    geofence_radius_metres: 40,
    short_description: "Gaudí's hilltop park with sweeping views over Barcelona.",
    long_description: 'Originally designed as a residential estate, donated to the city in 1922. The monumental zone requires a timed entry ticket.',
    audio_url: '',
    image_urls: [],
    getyourguide_affiliate_url: '',
    regulatory_alert: {
      alert_type: 'no_cycling',
      message: 'Bicycles are not allowed inside the monumental zone. Use Bicipark racks at the entrance.',
      fine_eur: 0,
      priority: 'medium',
    },
    tags: ['gaudí', 'park', 'views', 'monumental'],
    is_active: true,
  },
  {
    name: 'Gothic Quarter (Barri Gòtic)',
    slug: 'gothic-quarter',
    category: 'dismount_zone',
    coordinates: geo(41.3829, 2.1767),
    geofence_radius_metres: 100,
    short_description: 'Medieval streets — dismount zone. Cycling prohibited. Fine: €500.',
    long_description: 'The Barri Gòtic is a pedestrian-priority zone with extremely narrow medieval streets. Cycling is prohibited. You must dismount and walk your bike.',
    audio_url: '',
    image_urls: [],
    getyourguide_affiliate_url: '',
    regulatory_alert: {
      alert_type: 'dismount',
      message: 'DISMOUNT ZONE — You have entered the Gothic Quarter. Cycling is prohibited here. Fine: €500. Please walk your bike.',
      fine_eur: 500,
      priority: 'high',
    },
    tags: ['dismount', 'historic', 'pedestrian', 'warning'],
    is_active: true,
  },
  {
    name: 'Camp Nou',
    slug: 'camp-nou',
    category: 'landmark',
    coordinates: geo(41.3809, 2.1228),
    geofence_radius_metres: 40,
    short_description: 'Home of FC Barcelona — the largest stadium in Europe.',
    long_description: 'Camp Nou holds over 99,000 fans. The stadium experience tour lets you walk through the tunnel and sit in the directors box.',
    audio_url: '',
    image_urls: [],
    getyourguide_affiliate_url: '',
    regulatory_alert: null,
    tags: ['football', 'sports', 'fcb', 'stadium'],
    is_active: true,
  },
  {
    name: 'La Barceloneta Beach',
    slug: 'barceloneta',
    category: 'landmark',
    coordinates: geo(41.3780, 2.1898),
    geofence_radius_metres: 40,
    short_description: 'Barcelona\'s most famous urban beach — 1.1 km of golden sand.',
    long_description: 'Built for the 1992 Olympics, Barceloneta is the city\'s most accessible beach. Cycling on the promenade is restricted to designated lanes.',
    audio_url: '',
    image_urls: [],
    getyourguide_affiliate_url: '',
    regulatory_alert: {
      alert_type: 'speed_limit',
      message: 'Beach promenade speed limit: 10 km/h. Use the dedicated bike lane only.',
      fine_eur: 0,
      priority: 'medium',
    },
    tags: ['beach', 'seafront', 'olympic', 'promenade'],
    is_active: true,
  },
  {
    name: 'Palau de la Música Catalana',
    slug: 'palau-musica',
    category: 'landmark',
    coordinates: geo(41.3875, 2.1752),
    geofence_radius_metres: 40,
    short_description: 'A UNESCO World Heritage concert hall — the jewel of Catalan Modernisme.',
    long_description: 'Designed by Lluís Domènech i Montaner and built between 1905 and 1908. The stained-glass skylight is considered the finest in the world.',
    audio_url: '',
    image_urls: [],
    getyourguide_affiliate_url: '',
    regulatory_alert: null,
    tags: ['modernisme', 'music', 'UNESCO', 'architecture'],
    is_active: true,
  },
  {
    name: 'Casa Batlló',
    slug: 'casa-batllo',
    category: 'landmark',
    coordinates: geo(41.3916, 2.1649),
    geofence_radius_metres: 40,
    short_description: 'Gaudí\'s "House of Bones" on Passeig de Gràcia.',
    long_description: 'Redesigned by Gaudí between 1904 and 1906. The facade resembles a dragon\'s back with mosaic tiles. One of six UNESCO Gaudí sites in Barcelona.',
    audio_url: '',
    image_urls: [],
    getyourguide_affiliate_url: '',
    regulatory_alert: null,
    tags: ['gaudí', 'architecture', 'modernisme', 'dragon'],
    is_active: true,
  },
  {
    name: 'La Rambla',
    slug: 'la-rambla',
    category: 'dismount_zone',
    coordinates: geo(41.3810, 2.1735),
    geofence_radius_metres: 80,
    short_description: 'Famous pedestrian boulevard — cycling prohibited on the central walkway.',
    long_description: 'La Rambla is a 1.2 km pedestrian boulevard from Plaça de Catalunya to the port. Cycling is only allowed in marked bike lanes on either side, not on the central walkway.',
    audio_url: '',
    image_urls: [],
    getyourguide_affiliate_url: '',
    regulatory_alert: {
      alert_type: 'no_cycling',
      message: 'La Rambla central walkway — cycling prohibited. Use the bike lanes on the side roads (La Rambla parallel streets).',
      fine_eur: 500,
      priority: 'high',
    },
    tags: ['rambla', 'pedestrian', 'warning', 'tourist'],
    is_active: true,
  },
];

const quizzes = [
  // Sagrada Família
  {
    location_slug: 'sagrada-familia',
    question: 'In what year did Gaudí die, leaving the Sagrada Família unfinished?',
    options: ['1916', '1926', '1936', '1946'],
    correct_option_index: 1,
    explanation: 'Antoni Gaudí was struck by a tram on Gran Via in 1926. He died three days later aged 73.',
    difficulty: 'medium',
    points_reward: 10,
    is_active: true,
  },
  {
    location_slug: 'sagrada-familia',
    question: 'How many towers will the Sagrada Família have when fully complete?',
    options: ['12', '16', '18', '20'],
    correct_option_index: 2,
    explanation: '18 towers total: 12 Apostles, 4 Evangelists, 1 Virgin Mary, and 1 central tower for Jesus Christ.',
    difficulty: 'hard',
    points_reward: 15,
    is_active: true,
  },
  {
    location_slug: 'sagrada-familia',
    question: 'In which year did construction of the Sagrada Família begin?',
    options: ['1872', '1882', '1892', '1902'],
    correct_option_index: 1,
    explanation: 'Construction started in 1882 under architect Francisco de Paula del Villar. Gaudí took over just one year later in 1883.',
    difficulty: 'easy',
    points_reward: 10,
    is_active: true,
  },
  {
    location_slug: 'sagrada-familia',
    question: 'The Sagrada Família is classified as which type of church?',
    options: ['Cathedral', 'Basilica', 'Chapel', 'Monastery'],
    correct_option_index: 1,
    explanation: 'Pope Benedict XVI consecrated it as a Minor Basilica in 2010, even though it is still under construction.',
    difficulty: 'hard',
    points_reward: 15,
    is_active: true,
  },
  {
    location_slug: 'sagrada-familia',
    question: 'What style is the Sagrada Família primarily built in?',
    options: ['Gothic Revival', 'Baroque', 'Catalan Modernisme', 'Art Deco'],
    correct_option_index: 2,
    explanation: 'Gaudí blended Gothic structure with Catalan Modernisme (Art Nouveau), creating a completely unique architectural style.',
    difficulty: 'medium',
    points_reward: 10,
    is_active: true,
  },
  // Park Güell
  {
    location_slug: 'park-guell',
    question: 'Park Güell was originally designed to be a…',
    options: ['Public park', 'Residential housing estate', 'Hospital', 'Monastery'],
    correct_option_index: 1,
    explanation: 'Eusebi Güell commissioned Gaudí to design a garden city of 60 housing plots. Only 2 houses were built and the project was abandoned in 1914.',
    difficulty: 'easy',
    points_reward: 10,
    is_active: true,
  },
  {
    location_slug: 'park-guell',
    question: 'Who was the patron who commissioned Park Güell?',
    options: ['Antoni Gaudí', 'Lluís Domènech', 'Eusebi Güell', 'King Alfonso XIII'],
    correct_option_index: 2,
    explanation: 'Eusebi Güell was a wealthy industrialist and Gaudí\'s most important patron. He funded several of Gaudí\'s greatest works.',
    difficulty: 'easy',
    points_reward: 10,
    is_active: true,
  },
  {
    location_slug: 'park-guell',
    question: 'In what year was Park Güell donated to the city of Barcelona?',
    options: ['1914', '1918', '1922', '1926'],
    correct_option_index: 2,
    explanation: 'After the housing estate project failed, the Güell family donated the park to Barcelona City Council in 1922.',
    difficulty: 'hard',
    points_reward: 15,
    is_active: true,
  },
  // Gothic Quarter
  {
    location_slug: 'gothic-quarter',
    question: 'What is the fine for cycling on Barcelona\'s pedestrian pavements (sidewalks)?',
    options: ['€100', '€200', '€350', '€500'],
    correct_option_index: 3,
    explanation: 'Under RDL 6/2015 Art. 65.4.c, cycling on pedestrian pavements carries a €500 fine, which can be doubled in pedestrian-priority zones.',
    difficulty: 'easy',
    points_reward: 10,
    is_active: true,
  },
  {
    location_slug: 'gothic-quarter',
    question: 'The Gothic Quarter contains the remains of a Roman city. What was it called?',
    options: ['Carthago Nova', 'Barcino', 'Emporiae', 'Caesaraugusta'],
    correct_option_index: 1,
    explanation: 'The Romans founded "Barcino" around 10 BC. Remnants of the Roman wall, temple, and aqueduct are still visible in the Gothic Quarter today.',
    difficulty: 'medium',
    points_reward: 10,
    is_active: true,
  },
  // Camp Nou
  {
    location_slug: 'camp-nou',
    question: 'What is the seating capacity of Camp Nou?',
    options: ['79,000', '89,000', '99,354', '109,000'],
    correct_option_index: 2,
    explanation: 'Camp Nou holds 99,354 spectators, making it the largest stadium in Europe and the second largest in the world.',
    difficulty: 'medium',
    points_reward: 10,
    is_active: true,
  },
  {
    location_slug: 'camp-nou',
    question: 'In what year was Camp Nou opened?',
    options: ['1947', '1957', '1967', '1977'],
    correct_option_index: 1,
    explanation: 'Camp Nou was inaugurated on September 24, 1957, with a match against Warsaw. It replaced the old Les Corts stadium.',
    difficulty: 'medium',
    points_reward: 10,
    is_active: true,
  },
  // Barceloneta
  {
    location_slug: 'barceloneta',
    question: 'Barceloneta beach was extensively renovated for which event?',
    options: ['1988 World Cup', '1992 Olympic Games', '1996 UEFA Cup Final', '2000 World Expo'],
    correct_option_index: 1,
    explanation: 'The 1992 Barcelona Olympics transformed the entire waterfront. Barceloneta was redesigned and the Vila Olímpica was built on former industrial land.',
    difficulty: 'easy',
    points_reward: 10,
    is_active: true,
  },
  // Casa Batlló
  {
    location_slug: 'casa-batllo',
    question: 'Casa Batlló is nicknamed the "House of…"',
    options: ['Bones', 'Glass', 'Dragon', 'Flowers'],
    correct_option_index: 0,
    explanation: 'Casa Batlló is nicknamed "Casa dels Ossos" (House of Bones) because the facade\'s stone pillars resemble skeletal bones.',
    difficulty: 'easy',
    points_reward: 10,
    is_active: true,
  },
  {
    location_slug: 'casa-batllo',
    question: 'In what year did Gaudí complete his renovation of Casa Batlló?',
    options: ['1900', '1906', '1912', '1918'],
    correct_option_index: 1,
    explanation: 'Gaudí\'s renovation of the existing building lasted from 1904 to 1906. It is now a UNESCO World Heritage Site.',
    difficulty: 'medium',
    points_reward: 10,
    is_active: true,
  },
  // Palau de la Música
  {
    location_slug: 'palau-musica',
    question: 'Who designed the Palau de la Música Catalana?',
    options: ['Antoni Gaudí', 'Lluís Domènech i Montaner', 'Josep Puig i Cadafalch', 'Enric Sagnier'],
    correct_option_index: 1,
    explanation: 'Lluís Domènech i Montaner designed it between 1905 and 1908. He was Gaudí\'s great rival and the other leading figure of Catalan Modernisme.',
    difficulty: 'medium',
    points_reward: 10,
    is_active: true,
  },
  {
    location_slug: 'palau-musica',
    question: 'The Palau de la Música Catalana is a UNESCO World Heritage Site since…',
    options: ['1987', '1992', '1997', '2003'],
    correct_option_index: 2,
    explanation: 'UNESCO inscribed both the Palau de la Música Catalana and the Hospital de Sant Pau as World Heritage Sites in 1997.',
    difficulty: 'hard',
    points_reward: 15,
    is_active: true,
  },
];

const faqs = [
  // Sagrada Família
  {
    location_slug: 'sagrada-familia',
    question: 'Can I lock my bike at the Sagrada Família?',
    answer: 'Yes. There are Bicipark open racks on Avinguda de Gaudí (east side) and Carrer de Provença (north side). Do not lock to railings or barriers — wardens issue removal notices.',
    category: 'parking',
    sort_order: 10,
    is_premium: false,
    is_active: true,
  },
  {
    location_slug: 'sagrada-familia',
    question: 'Do I need to book tickets in advance?',
    answer: 'Yes — strongly recommended. Same-day tickets are almost never available. Book via the official Sagrada Família website or GetYourGuide for skip-the-line access.',
    category: 'tickets',
    sort_order: 20,
    is_premium: false,
    is_active: true,
  },
  {
    location_slug: 'sagrada-familia',
    question: 'How long does a visit to the Sagrada Família take?',
    answer: 'Allow 1.5 to 2 hours for a self-guided visit. Add 30 minutes if you take a tower lift (book separately). Audio guides are included in most ticket types.',
    category: 'logistics',
    sort_order: 30,
    is_premium: false,
    is_active: true,
  },
  {
    location_slug: 'sagrada-familia',
    question: 'Is there a secure Bicibox near the Sagrada Família?',
    answer: 'The nearest Bicibox (locked indoor station) is at Avinguda Diagonal, about 800 m away. For a quick visit, use the Bicipark open racks on Avinguda de Gaudí instead.',
    category: 'parking',
    sort_order: 40,
    is_premium: true,
    is_active: true,
  },
  // Park Güell
  {
    location_slug: 'park-guell',
    question: 'Can I bring my bicycle inside Park Güell?',
    answer: 'No. Bicycles are prohibited inside the ticketed monumental zone. Lock up at the designated Bicipark racks on Carrer d\'Olot before the entrance gates.',
    category: 'parking',
    sort_order: 10,
    is_premium: false,
    is_active: true,
  },
  {
    location_slug: 'park-guell',
    question: 'Is there a free zone in Park Güell?',
    answer: 'Yes. Only the central monumental zone (Dragon Staircase, Hypostyle Hall, main terrace) requires a ticket. The surrounding park and forest paths are free and open 24/7.',
    category: 'access',
    sort_order: 20,
    is_premium: false,
    is_active: true,
  },
  {
    location_slug: 'park-guell',
    question: 'How steep is the ride up to Park Güell?',
    answer: 'Very steep — the climb via Carrer de Larrard gains about 100 m elevation in under 1 km (roughly 10–15% gradient). Most cyclists will walk their bike up. The park escalators are pedestrian-only.',
    category: 'safety',
    sort_order: 30,
    is_premium: false,
    is_active: true,
  },
  // Gothic Quarter
  {
    location_slug: 'gothic-quarter',
    question: 'Why can\'t I cycle through the Gothic Quarter?',
    answer: 'The Barri Gòtic is a pedestrian-priority zone. Barcelona\'s traffic ordinance prohibits cycling in these streets. The fine is €500. You must dismount and walk your bike.',
    category: 'rules',
    sort_order: 10,
    is_premium: false,
    is_active: true,
  },
  {
    location_slug: 'gothic-quarter',
    question: 'Where can I park near the Gothic Quarter?',
    answer: 'Use the Bicibox station on Plaça de Catalunya (24/7, free, requires PIN from the Bicibox app) or Bicipark racks near La Rambla entrance.',
    category: 'parking',
    sort_order: 20,
    is_premium: false,
    is_active: true,
  },
  {
    location_slug: 'gothic-quarter',
    question: 'Which streets near the Gothic Quarter have bike lanes?',
    answer: 'Via Laietana has a protected two-way bike lane running north–south just east of the Gothic Quarter. Carrer de la Princesa leads east toward El Born. Avoid La Rambla — use parallel Carrer Nou de la Rambla instead.',
    category: 'safety',
    sort_order: 30,
    is_premium: false,
    is_active: true,
  },
  // Camp Nou
  {
    location_slug: 'camp-nou',
    question: 'Can I cycle to Camp Nou on match day?',
    answer: 'Yes, but road closures apply on match day within 500 m of the stadium. Arrive via Avinguda de Joan XXIII bike lane. Lock up at the Bicipark racks outside Gate 9 — these fill up fast, arrive early.',
    category: 'access',
    sort_order: 10,
    is_premium: false,
    is_active: true,
  },
  // Barceloneta
  {
    location_slug: 'barceloneta',
    question: 'Can I cycle on the Barceloneta beachfront promenade?',
    answer: 'Only in the designated bike lane marked with blue paint. Cycling on the pedestrian walkway is prohibited and carries a €500 fine. The speed limit in the bike lane is 10 km/h.',
    category: 'rules',
    sort_order: 10,
    is_premium: false,
    is_active: true,
  },
  {
    location_slug: 'barceloneta',
    question: 'Where can I rent a bike near Barceloneta?',
    answer: 'Several rental shops are on Carrer de la Marina. Bicing (Barcelona\'s public bike share) has docking stations at Passeig Marítim and Plaça del Mar. You need a Bicing subscription or day pass via the app.',
    category: 'logistics',
    sort_order: 20,
    is_premium: false,
    is_active: true,
  },
  // La Rambla
  {
    location_slug: 'la-rambla',
    question: 'Can I cycle along La Rambla?',
    answer: 'No — cycling on La Rambla\'s central pedestrian walkway is prohibited (€500 fine). Use the bike lanes on Carrer Nou de la Rambla (parallel, one block west) or Via Laietana (one block east).',
    category: 'rules',
    sort_order: 10,
    is_premium: false,
    is_active: true,
  },
];

const logistics = [
  {
    _id: 'bicibox-placa-catalunya',
    type: 'bicibox',
    name: 'Bicibox — Plaça de Catalunya',
    coordinates: geo(41.3870, 2.1696),
    address: 'Plaça de Catalunya, 08002 Barcelona',
    details: {
      total_spaces: 20,
      available_spaces: 20,
      requires_pin: true,
      pin_source_url: 'https://www.bicibox.com/login',
      is_24h: true,
      price_per_hour_eur: 0,
    },
    opening_hours: '24/7',
    nearby_location_slugs: ['gothic-quarter', 'la-rambla'],
    is_active: true,
  },
  {
    _id: 'bicibox-sagrada-familia',
    type: 'bicibox',
    name: 'Bicibox — Avinguda Diagonal (near Sagrada Família)',
    coordinates: geo(41.3990, 2.1652),
    address: 'Avinguda Diagonal, 08013 Barcelona',
    details: {
      total_spaces: 16,
      available_spaces: 16,
      requires_pin: true,
      pin_source_url: 'https://www.bicibox.com/login',
      is_24h: true,
      price_per_hour_eur: 0,
    },
    opening_hours: '24/7',
    nearby_location_slugs: ['sagrada-familia', 'casa-batllo'],
    is_active: true,
  },
  {
    _id: 'bicipark-park-guell',
    type: 'bicipark',
    name: "Bicipark — Park Güell Entrance",
    coordinates: geo(41.4138, 2.1528),
    address: "Carrer d'Olot, 08024 Barcelona",
    details: {
      total_spaces: 30,
      is_open_rack: true,
      is_covered: false,
      is_24h: true,
    },
    opening_hours: '24/7',
    nearby_location_slugs: ['park-guell'],
    is_active: true,
  },
  {
    _id: 'bicipark-camp-nou',
    type: 'bicipark',
    name: 'Bicipark — Camp Nou Gate 9',
    coordinates: geo(41.3812, 2.1233),
    address: 'Carrer dAristides Maillol, 08028 Barcelona',
    details: {
      total_spaces: 40,
      is_open_rack: true,
      is_covered: false,
      is_24h: false,
    },
    opening_hours: 'Open on match days and museum hours (10:00–18:00)',
    nearby_location_slugs: ['camp-nou'],
    is_active: true,
  },
  {
    _id: 'repair-station-barceloneta',
    type: 'repair_station',
    name: 'Bike Repair Station — Barceloneta Promenade',
    coordinates: geo(41.3765, 2.1900),
    address: 'Passeig Marítim de la Barceloneta, 08003 Barcelona',
    details: {
      has_pump: true,
      has_tools: true,
      condition: 'good',
    },
    opening_hours: '24/7',
    nearby_location_slugs: ['barceloneta'],
    is_active: true,
  },
  {
    _id: 'fine-sidewalk-riding',
    type: 'fine',
    name: 'Fine: Sidewalk / Pavement Cycling',
    coordinates: geo(41.3851, 2.1734),
    address: null,
    details: {
      infraction: 'Riding a bicycle on pedestrian pavement (sidewalk)',
      fine_eur: 500,
      legal_reference: 'RDL 6/2015 Art. 65.4.c',
      notes: 'Applies city-wide. Can be doubled in pedestrian priority zones.',
    },
    opening_hours: null,
    nearby_location_slugs: [],
    is_active: true,
  },
  {
    _id: 'fine-earphones',
    type: 'fine',
    name: 'Fine: Both-Ear Headphones While Cycling',
    coordinates: geo(41.3851, 2.1734),
    address: null,
    details: {
      infraction: 'Using headphones in both ears simultaneously while cycling',
      fine_eur: 100,
      legal_reference: 'RDL 6/2015 Art. 65.4.g',
      notes: 'One ear is permitted. Blocking both ears = €100 fine.',
    },
    opening_hours: null,
    nearby_location_slugs: [],
    is_active: true,
  },
  {
    _id: 'fine-red-light',
    type: 'fine',
    name: 'Fine: Running a Red Light on a Bicycle',
    coordinates: geo(41.3851, 2.1734),
    address: null,
    details: {
      infraction: 'Crossing a red traffic light on a bicycle',
      fine_eur: 200,
      legal_reference: 'RDL 6/2015 Art. 65.5.a',
      notes: 'Applies to all cyclists on public roads.',
    },
    opening_hours: null,
    nearby_location_slugs: [],
    is_active: true,
  },
  {
    _id: 'rule-speed-limit-bike-lane',
    type: 'rule',
    name: 'Speed Limit: Bike Lanes & Shared Paths',
    coordinates: geo(41.3851, 2.1734),
    address: null,
    details: {
      rule_text: 'Maximum speed in dedicated bike lanes: 30 km/h. Shared pedestrian/cycle paths: 10 km/h.',
      applies_to_zone: 'All Barcelona municipal roads',
      legal_reference: 'Ordenança de Circulació Art. 52',
    },
    opening_hours: null,
    nearby_location_slugs: [],
    is_active: true,
  },
];

// ─── RUN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚴  Barcelona Bike Tour — Firestore Seeder');
  console.log('==========================================');
  try {
    await seed('locations', locations);
    await seed('quizzes', quizzes);
    await seed('faqs', faqs);
    await seed('logistics', logistics);
    console.log('\n✅  All done! Your Firestore database is fully seeded.');
    console.log('    Collections seeded:');
    console.log(`    • locations  → ${locations.length} documents`);
    console.log(`    • quizzes   → ${quizzes.length} documents`);
    console.log(`    • faqs      → ${faqs.length} documents`);
    console.log(`    • logistics → ${logistics.length} documents`);
  } catch (err) {
    console.error('\n❌  Seeding failed:', err.message);
  } finally {
    process.exit(0);
  }
}

main();
