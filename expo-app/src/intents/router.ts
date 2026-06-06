// ─── Voice command router (hybrid) ────────────────────────────────────────────
// 1) A per-locale keyword fast-path matches explicit commands instantly (no
//    network). 2) Anything it doesn't match goes to Claude, which is multilingual
//    and returns {intent, params, spoken_reply}. The app executes the intent via
//    the MapScreen-provided executors and speaks a confirmation. For "answer",
//    Claude's grounded spoken_reply is used directly.

import type { AppLocale } from '../utils/locale';
import { callAnthropic } from '../utils/anthropic';
import { phrases } from './phrases';

export type CommandIntent =
  | { kind: 'navigate'; query: string }
  | { kind: 'reroute' }
  | { kind: 'skip_stop' }
  | { kind: 'find_parking' }
  | { kind: 'status' }
  | { kind: 'where_am_i' }
  | { kind: 'repeat' }
  | { kind: 'mute' }
  | { kind: 'unmute' }
  | { kind: 'slower' }
  | { kind: 'louder' }
  | { kind: 'end_ride' }
  | { kind: 'answer'; text: string };

// Executors are wired by MapScreen (it owns the map, route, store). Each returns
// the spoken confirmation (so it reflects real success, e.g. "I couldn't find X").
export interface CommandContext {
  locale: AppLocale;
  systemContext: () => string; // buildBikAISystemPrompt(landmarks) — live grounding
  navigate: (query: string) => Promise<string>;
  reroute: () => Promise<string> | string;
  skipStop: () => string;
  findParking: () => Promise<string>;
  status: () => string;
  whereAmI: () => Promise<string> | string;
  repeat: () => string;
  setMuted: (muted: boolean) => string;
  slower: () => string;
  louder: () => string;
  endRide: () => Promise<string> | string;
}

// ── Per-locale keyword tables ───────────────────────────────────────────────────
interface LocalPatterns {
  navigate: string[]; // prefix; text after the phrase = destination
  find_parking: string[];
  skip_stop: string[];
  status: string[];
  where_am_i: string[];
  repeat: string[];
  mute: string[];
  unmute: string[];
  slower: string[];
  louder: string[];
  end_ride: string[];
  reroute: string[];
}

const LOCAL: Record<AppLocale, LocalPatterns> = {
  en: {
    navigate: ['take me to', 'navigate to', 'guide me to', 'directions to', 'go to', 'route to'],
    find_parking: ['where can i park', 'find parking', 'bike parking', 'park my bike', 'parking'],
    skip_stop: ['skip', 'next stop'],
    status: ['how far', 'how long', "what's next", 'what is next', 'distance to', 'how much further'],
    where_am_i: ['where am i', "what's my location", 'my location', 'where i am'],
    repeat: ['repeat', 'say again', 'say that again'],
    mute: ['mute', 'be quiet', 'stop talking', 'silence'],
    unmute: ['unmute', 'talk again', 'voice on'],
    slower: ['slower', 'speak slower', 'slow down'],
    louder: ['louder', 'speak up', 'volume up'],
    end_ride: ['end ride', 'end the ride', 'stop the ride', 'stop riding', 'finish ride', 'finish the ride'],
    reroute: ['reroute', 'recalculate', 'new route'],
  },
  es: {
    navigate: ['llévame a', 'llevame a', 'guíame a', 'guiame a', 'navega a', 'cómo llego a', 'como llego a', 'ir a', 'ruta a', 'vamos a'],
    find_parking: ['dónde aparco', 'donde aparco', 'aparcamiento', 'aparcar', 'dónde dejo la bici', 'donde dejo la bici'],
    skip_stop: ['salta', 'siguiente parada', 'omitir'],
    status: ['cuánto falta', 'cuanto falta', 'qué sigue', 'que sigue', 'distancia', 'cuánto queda', 'cuanto queda'],
    where_am_i: ['dónde estoy', 'donde estoy', 'mi ubicación', 'mi ubicacion', 'dónde me encuentro', 'donde me encuentro'],
    repeat: ['repite', 'repetir', 'otra vez'],
    mute: ['silencio', 'cállate', 'callate', 'sin voz'],
    unmute: ['activa la voz', 'habla', 'con voz'],
    slower: ['más despacio', 'mas despacio', 'habla despacio'],
    louder: ['más alto', 'mas alto', 'sube el volumen'],
    end_ride: ['termina la ruta', 'termina el paseo', 'para la ruta', 'finaliza la ruta', 'terminar ruta'],
    reroute: ['recalcula', 'recalcular', 'nueva ruta'],
  },
  ca: {
    navigate: ["porta'm a", "guia'm a", 'porta a', 'navega a', 'com arribo a', 'anar a', 'ruta a', 'vés a', 'ves a'],
    find_parking: ['on aparco', 'aparcament', 'aparcar', 'on deixo la bici'],
    skip_stop: ['salta', 'següent parada', 'seguent parada', 'ometre'],
    status: ['quant falta', 'què ve ara', 'que ve ara', 'distància', 'distancia', 'quant queda'],
    where_am_i: ['on soc', 'on sóc', 'on em trobo', 'la meva ubicació', 'la meva ubicacio'],
    repeat: ['repeteix', 'repetir', 'una altra vegada'],
    mute: ['silenci', 'calla', 'sense veu'],
    unmute: ['activa la veu', 'parla', 'amb veu'],
    slower: ['més a poc a poc', 'mes a poc a poc', 'parla a poc a poc'],
    louder: ['més alt', 'mes alt', 'puja el volum'],
    end_ride: ['acaba la ruta', 'atura la ruta', 'finalitza la ruta', 'acabar ruta'],
    reroute: ['recalcula', 'recalcular', 'nova ruta'],
  },
  fr: {
    navigate: ['emmène-moi à', 'emmene moi à', "emmène-moi au", 'guide-moi vers', 'guide moi vers', 'va à', 'aller à', 'itinéraire vers', 'route vers', "amène-moi à"],
    find_parking: ['où me garer', 'ou me garer', 'stationnement', 'garer mon vélo', 'parking vélo', 'parking'],
    skip_stop: ['passer', 'arrêt suivant', 'arret suivant', 'sauter'],
    status: ['combien de temps', 'à quelle distance', 'a quelle distance', 'quelle est la suite', 'distance', 'encore loin'],
    where_am_i: ['où suis-je', 'ou suis je', 'où je suis', 'ma position', 'je suis où', 'je suis ou'],
    repeat: ['répète', 'repete', 'répéter', 'encore'],
    mute: ['silence', 'tais-toi', 'tais toi', 'sans voix'],
    unmute: ['active la voix', 'parle', 'avec voix'],
    slower: ['plus lentement', 'parle moins vite', 'ralentis'],
    louder: ['plus fort', 'monte le volume'],
    end_ride: ["termine la balade", 'arrête la balade', 'arrete la balade', "termine l'itinéraire", 'finir la balade'],
    reroute: ['recalcule', 'recalculer', 'nouvel itinéraire'],
  },
  de: {
    navigate: ['bring mich zur', 'bring mich zu', 'führe mich zu', 'fuhre mich zu', 'navigiere zu', 'fahr zur', 'fahr zu', 'fahr nach', 'route nach'],
    find_parking: ['wo kann ich parken', 'fahrradparkplatz', 'parken', 'parkplatz', 'rad abstellen'],
    skip_stop: ['überspringen', 'uberspringen', 'nächster halt', 'nachster halt'],
    status: ['wie weit', 'wie lange', 'was kommt als nächstes', 'was kommt als nachstes', 'entfernung'],
    where_am_i: ['wo bin ich', 'mein standort', 'wo befinde ich mich'],
    repeat: ['wiederhole', 'wiederholen', 'nochmal'],
    mute: ['ruhe', 'sei still', 'stumm'],
    unmute: ['stimme an', 'sprich', 'mit stimme'],
    slower: ['langsamer', 'sprich langsamer'],
    louder: ['lauter', 'lautstärke hoch', 'lautstarke hoch'],
    end_ride: ['fahrt beenden', 'tour beenden', 'fahrt stoppen', 'beende die fahrt'],
    reroute: ['neu berechnen', 'neue route'],
  },
  it: {
    navigate: ['portami a', 'portami al', 'guidami a', 'guidami verso', 'naviga verso', 'vai a', 'andare a', 'percorso per', 'rotta per'],
    find_parking: ['dove posso parcheggiare', 'parcheggio', 'parcheggiare', 'dove lascio la bici'],
    skip_stop: ['salta', 'prossima tappa', 'ometti'],
    status: ['quanto manca', 'quanto dista', 'cosa viene dopo', 'distanza'],
    where_am_i: ['dove sono', 'la mia posizione', 'dove mi trovo'],
    repeat: ['ripeti', 'ripetere', 'di nuovo'],
    mute: ['silenzio', 'stai zitto', 'senza voce'],
    unmute: ['attiva la voce', 'parla', 'con voce'],
    slower: ['più lentamente', 'piu lentamente', 'parla piano'],
    louder: ['più forte', 'piu forte', 'alza il volume'],
    end_ride: ['termina il giro', 'ferma il giro', "termina il percorso", 'finire il giro'],
    reroute: ['ricalcola', 'ricalcolare', 'nuovo percorso'],
  },
};

const isLetter = (ch: string): boolean => /\p{L}/u.test(ch);

// Whole-token match: the keyword/phrase must not sit inside a larger word, so
// 'salta' doesn't fire inside 'resaltar' and German 'zu' can't fire inside 'zum'.
// Returns the index just AFTER the matched phrase, or -1.
function boundedMatchEnd(text: string, phrase: string): number {
  let from = 0;
  for (;;) {
    const i = text.indexOf(phrase, from);
    if (i < 0) return -1;
    const before = i === 0 ? ' ' : text[i - 1];
    const endIdx = i + phrase.length;
    const after = endIdx >= text.length ? ' ' : text[endIdx];
    if (!isLetter(before) && !isLetter(after)) return endIdx;
    from = i + 1;
  }
}

// Confirmation tokens for the "did you mean X?" yes/no turn. Kept UNAMBIGUOUS —
// no 'go'/'right'/'stop', which are common command words ("stop the ride") and
// would hijack the confirmation. A fresh explicit command is also checked first
// at the call site, so these only apply when nothing else matched.
const YES: Record<AppLocale, string[]> = {
  en: ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'correct'],
  es: ['sí', 'si', 'vale', 'correcto', 'claro'],
  ca: ['sí', 'si', "d'acord", 'correcte'],
  fr: ['oui', 'ouais', "d'accord", 'ok', 'correct'],
  de: ['ja', 'genau', 'ok', 'okay', 'richtig'],
  it: ['sì', 'si', 'ok', 'va bene', 'esatto', 'certo'],
};
const NO: Record<AppLocale, string[]> = {
  en: ['no', 'nope', 'cancel', 'nevermind', 'never mind'],
  es: ['no', 'cancela', 'cancelar'],
  ca: ['no', 'cancel·la', 'cancella'],
  fr: ['non', 'annule', 'annuler'],
  de: ['nein', 'abbrechen'],
  it: ['no', 'annulla'],
};

export function isAffirmative(raw: string, locale: AppLocale): boolean {
  const t = raw.trim().toLowerCase();
  return (YES[locale] ?? YES.en).some((w) => t === w || t.startsWith(w + ' '));
}
export function isNegative(raw: string, locale: AppLocale): boolean {
  const t = raw.trim().toLowerCase();
  return (NO[locale] ?? NO.en).some((w) => t === w || t.startsWith(w + ' '));
}

export function parseLocalIntent(raw: string, locale: AppLocale): CommandIntent | null {
  const rawTrimmed = raw.trim();
  const text = rawTrimmed.toLowerCase(); // same length as rawTrimmed → indices align
  const p = LOCAL[locale] ?? LOCAL.en;
  const has = (list: string[]) => list.some((k) => boundedMatchEnd(text, k) >= 0);

  // Explicit command keywords FIRST, so e.g. "go to the next stop" is skip_stop,
  // not navigate. navigate is the fall-through (it needs a destination).
  if (has(p.end_ride)) return { kind: 'end_ride' };
  if (has(p.find_parking)) return { kind: 'find_parking' };
  if (has(p.reroute)) return { kind: 'reroute' };
  if (has(p.skip_stop)) return { kind: 'skip_stop' };
  if (has(p.where_am_i)) return { kind: 'where_am_i' };
  if (has(p.status)) return { kind: 'status' };
  if (has(p.repeat)) return { kind: 'repeat' };
  if (has(p.unmute)) return { kind: 'unmute' };
  if (has(p.mute)) return { kind: 'mute' };
  if (has(p.slower)) return { kind: 'slower' };
  if (has(p.louder)) return { kind: 'louder' };

  // navigate: first phrase that matches on a token boundary with a non-empty
  // destination after it. Slice from rawTrimmed (index-aligned) to keep case.
  for (const phrase of p.navigate) {
    const end = boundedMatchEnd(text, phrase);
    if (end >= 0) {
      const query = rawTrimmed.slice(end).trim();
      if (query) return { kind: 'navigate', query };
    }
  }
  return null;
}

// ── Claude fallback ─────────────────────────────────────────────────────────────
const ROUTER_INSTRUCTIONS = (locale: AppLocale) =>
  `\n\nYou are ALSO the command parser for this hands-free cycling app. For the rider's next message, reply with ONLY strict minified JSON (no prose, no markdown, no code fence):\n` +
  `{"intent":"INTENT","params":{"query":"DEST"},"spoken_reply":"TEXT"}\n` +
  `INTENT is one of: navigate, reroute, skip_stop, find_parking, status, where_am_i, repeat, mute, unmute, slower, louder, end_ride, answer.\n` +
  `- navigate: the rider wants directions somewhere — put the place name in params.query.\n` +
  `- where_am_i: the rider asks where they are / their current location.\n` +
  `- status: route progress questions (how far / how long / what's next) — only meaningful with an active route.\n` +
  `- reroute/skip_stop/find_parking/repeat/mute/unmute/slower/louder/end_ride: app commands (params can be empty).\n` +
  `- answer: anything else (a question about surroundings, landmarks, safety, rules) — put the full helpful answer in spoken_reply using the live location context above.\n` +
  `spoken_reply must be in the user's language (locale: ${locale}), one or two short sentences.`;

interface RouterJson {
  intent: string;
  params?: { query?: string };
  spoken_reply?: string;
}

function parseRouterJson(raw: string): RouterJson | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]) as RouterJson;
    return obj && typeof obj.intent === 'string' ? obj : null;
  } catch {
    return null;
  }
}

async function execute(intent: CommandIntent, ctx: CommandContext): Promise<string> {
  switch (intent.kind) {
    case 'navigate': return ctx.navigate(intent.query);
    case 'reroute': return ctx.reroute();
    case 'skip_stop': return ctx.skipStop();
    case 'find_parking': return ctx.findParking();
    case 'status': return ctx.status();
    case 'where_am_i': return ctx.whereAmI();
    case 'repeat': return ctx.repeat();
    case 'mute': return ctx.setMuted(true);
    case 'unmute': return ctx.setMuted(false);
    case 'slower': return ctx.slower();
    case 'louder': return ctx.louder();
    case 'end_ride': return ctx.endRide();
    case 'answer': return intent.text;
  }
}

// Runs an utterance and returns the text to speak back. Never throws.
export async function runCommand(transcript: string, ctx: CommandContext): Promise<string> {
  const ph = phrases(ctx.locale);
  const local = parseLocalIntent(transcript, ctx.locale);
  if (local) return execute(local, ctx);

  // Fall back to Claude (grounded with the live BikAI context + router rules).
  try {
    const system = ctx.systemContext() + ROUTER_INSTRUCTIONS(ctx.locale);
    const raw = await callAnthropic(system, [{ role: 'user', content: transcript }], { maxTokens: 400 });
    const parsed = parseRouterJson(raw);
    if (!parsed) return raw.trim(); // not JSON → treat the whole reply as the answer (already in-locale)
    if (parsed.intent === 'answer') {
      return parsed.spoken_reply?.trim() || ph.didntCatch;
    }
    if (parsed.intent === 'navigate') {
      const query = parsed.params?.query?.trim();
      if (query) {
        const spoken = await execute({ kind: 'navigate', query }, ctx);
        return spoken || parsed.spoken_reply?.trim() || '';
      }
      return parsed.spoken_reply?.trim() || ph.cantDo;
    }
    const allowed = ['reroute', 'skip_stop', 'find_parking', 'status', 'where_am_i', 'repeat', 'mute', 'unmute', 'slower', 'louder', 'end_ride'];
    if (allowed.includes(parsed.intent)) {
      const spoken = await execute({ kind: parsed.intent } as CommandIntent, ctx);
      return spoken || parsed.spoken_reply?.trim() || '';
    }
    // Unknown intent → speak whatever Claude said, else a gentle fallback.
    return parsed.spoken_reply?.trim() || ph.cantDo;
  } catch {
    return ph.assistantUnreachable;
  }
}
