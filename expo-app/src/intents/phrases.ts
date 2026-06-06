// ─── Localized spoken confirmations ───────────────────────────────────────────
// Short, formulaic confirmations for the command executors, in the six supported
// languages. (Turn-by-turn maneuver phrasing is still English — see routing.ts.)

import type { AppLocale } from '../utils/locale';

export interface Phrases {
  routing: (name: string) => string;
  notFound: (name: string) => string;
  rerouting: string;
  noRoute: string;
  parkingFound: (name: string, dist: number) => string;
  parkingNone: string;
  parkingError: string;
  skipped: (name: string) => string;
  skipNone: string;
  muted: string;
  unmuted: string;
  slower: string;
  louderNote: string;
  ending: string;
  statusToTurn: (m: number) => string;
  statusToDest: (dist: string, dur: string) => string;
  statusNoRoute: string;
  needLocation: string;
  didntCatch: string;
  cantDo: string;
  assistantUnreachable: string;
  headingTo: (name: string, dist: string) => string;
  didYouMean: (name: string) => string;
  cancelled: string;
}

const EN: Phrases = {
  routing: (n) => `Routing to ${n}.`,
  notFound: (n) => `I couldn't find ${n}.`,
  rerouting: 'Recalculating the route.',
  noRoute: 'There is no active route.',
  parkingFound: (n, d) => `Nearest parking: ${n}, about ${d} meters away.`,
  parkingNone: 'No bike parking found nearby.',
  parkingError: "I couldn't load parking right now.",
  skipped: (n) => `Skipping to ${n}.`,
  skipNone: 'No more stops to skip.',
  muted: 'Voice muted.',
  unmuted: 'Voice on.',
  slower: 'Speaking slower.',
  louderNote: 'To change the volume, use your phone volume buttons.',
  ending: 'Ending your ride.',
  statusToTurn: (m) => `${m} meters to your next turn.`,
  statusToDest: (dist, dur) => `${dist} to your destination, about ${dur}.`,
  statusNoRoute: 'No route is active right now.',
  needLocation: 'I need your location first.',
  didntCatch: "Sorry, I didn't catch that.",
  cantDo: "Sorry, I couldn't do that.",
  assistantUnreachable: "I couldn't reach the assistant. Please try again.",
  headingTo: (n, d) => `Heading to ${n}, ${d}.`,
  didYouMean: (n) => `Did you mean ${n}?`,
  cancelled: 'Okay, cancelled.',
};

const ES: Phrases = {
  routing: (n) => `Te llevo a ${n}.`,
  notFound: (n) => `No he encontrado ${n}.`,
  rerouting: 'Recalculando la ruta.',
  noRoute: 'No hay ninguna ruta activa.',
  parkingFound: (n, d) => `Aparcamiento más cercano: ${n}, a unos ${d} metros.`,
  parkingNone: 'No hay aparcamiento de bicis cerca.',
  parkingError: 'No he podido cargar el aparcamiento ahora.',
  skipped: (n) => `Pasando a ${n}.`,
  skipNone: 'No hay más paradas.',
  muted: 'Voz silenciada.',
  unmuted: 'Voz activada.',
  slower: 'Hablaré más despacio.',
  louderNote: 'Para cambiar el volumen, usa los botones del teléfono.',
  ending: 'Finalizando tu ruta.',
  statusToTurn: (m) => `${m} metros hasta el próximo giro.`,
  statusToDest: (dist, dur) => `${dist} hasta tu destino, unos ${dur}.`,
  statusNoRoute: 'Ahora mismo no hay ninguna ruta activa.',
  needLocation: 'Primero necesito tu ubicación.',
  didntCatch: 'Perdona, no te he entendido.',
  cantDo: 'Perdona, no he podido hacerlo.',
  assistantUnreachable: 'No he podido contactar con el asistente. Inténtalo de nuevo.',
  headingTo: (n, d) => `Vamos a ${n}, ${d}.`,
  didYouMean: (n) => `¿Querías decir ${n}?`,
  cancelled: 'Vale, cancelado.',
};

const CA: Phrases = {
  routing: (n) => `Et porto a ${n}.`,
  notFound: (n) => `No he trobat ${n}.`,
  rerouting: 'Recalculant la ruta.',
  noRoute: 'No hi ha cap ruta activa.',
  parkingFound: (n, d) => `Aparcament més proper: ${n}, a uns ${d} metres.`,
  parkingNone: 'No hi ha aparcament de bici a prop.',
  parkingError: "Ara no he pogut carregar l'aparcament.",
  skipped: (n) => `Passant a ${n}.`,
  skipNone: 'No hi ha més parades.',
  muted: 'Veu silenciada.',
  unmuted: 'Veu activada.',
  slower: 'Parlaré més a poc a poc.',
  louderNote: 'Per canviar el volum, fes servir els botons del telèfon.',
  ending: 'Finalitzant la ruta.',
  statusToTurn: (m) => `${m} metres fins al pròxim gir.`,
  statusToDest: (dist, dur) => `${dist} fins al destí, uns ${dur}.`,
  statusNoRoute: 'Ara mateix no hi ha cap ruta activa.',
  needLocation: 'Primer necessito la teva ubicació.',
  didntCatch: "Perdona, no t'he entès.",
  cantDo: 'Perdona, no ho he pogut fer.',
  assistantUnreachable: "No he pogut contactar amb l'assistent. Torna-ho a provar.",
  headingTo: (n, d) => `Anem a ${n}, ${d}.`,
  didYouMean: (n) => `Volies dir ${n}?`,
  cancelled: "D'acord, cancel·lat.",
};

const FR: Phrases = {
  routing: (n) => `Itinéraire vers ${n}.`,
  notFound: (n) => `Je n'ai pas trouvé ${n}.`,
  rerouting: "Recalcul de l'itinéraire.",
  noRoute: "Aucun itinéraire actif.",
  parkingFound: (n, d) => `Parking le plus proche : ${n}, à environ ${d} mètres.`,
  parkingNone: 'Aucun parking vélo à proximité.',
  parkingError: "Je n'ai pas pu charger le parking pour le moment.",
  skipped: (n) => `Passage à ${n}.`,
  skipNone: "Plus d'arrêts à passer.",
  muted: 'Voix coupée.',
  unmuted: 'Voix activée.',
  slower: 'Je parlerai plus lentement.',
  louderNote: 'Pour le volume, utilisez les boutons du téléphone.',
  ending: 'Fin de votre balade.',
  statusToTurn: (m) => `${m} mètres avant le prochain virage.`,
  statusToDest: (dist, dur) => `${dist} jusqu'à destination, environ ${dur}.`,
  statusNoRoute: "Aucun itinéraire actif pour le moment.",
  needLocation: "J'ai d'abord besoin de votre position.",
  didntCatch: "Désolé, je n'ai pas compris.",
  cantDo: "Désolé, je n'ai pas pu faire ça.",
  assistantUnreachable: "Je n'ai pas pu joindre l'assistant. Réessayez.",
  headingTo: (n, d) => `Direction ${n}, ${d}.`,
  didYouMean: (n) => `Vouliez-vous dire ${n} ?`,
  cancelled: "D'accord, annulé.",
};

const DE: Phrases = {
  routing: (n) => `Route nach ${n}.`,
  notFound: (n) => `Ich konnte ${n} nicht finden.`,
  rerouting: 'Route wird neu berechnet.',
  noRoute: 'Keine aktive Route.',
  parkingFound: (n, d) => `Nächster Stellplatz: ${n}, etwa ${d} Meter entfernt.`,
  parkingNone: 'Kein Fahrrad-Stellplatz in der Nähe.',
  parkingError: 'Stellplätze konnten gerade nicht geladen werden.',
  skipped: (n) => `Weiter zu ${n}.`,
  skipNone: 'Keine weiteren Stopps.',
  muted: 'Stimme stumm.',
  unmuted: 'Stimme an.',
  slower: 'Ich spreche langsamer.',
  louderNote: 'Für die Lautstärke nutze die Telefontasten.',
  ending: 'Fahrt wird beendet.',
  statusToTurn: (m) => `${m} Meter bis zum nächsten Abbiegen.`,
  statusToDest: (dist, dur) => `${dist} bis zum Ziel, etwa ${dur}.`,
  statusNoRoute: 'Momentan keine aktive Route.',
  needLocation: 'Ich brauche zuerst deinen Standort.',
  didntCatch: 'Entschuldige, das habe ich nicht verstanden.',
  cantDo: 'Entschuldige, das konnte ich nicht tun.',
  assistantUnreachable: 'Ich konnte den Assistenten nicht erreichen. Versuch es erneut.',
  headingTo: (n, d) => `Auf dem Weg nach ${n}, ${d}.`,
  didYouMean: (n) => `Meintest du ${n}?`,
  cancelled: 'Okay, abgebrochen.',
};

const IT: Phrases = {
  routing: (n) => `Ti porto a ${n}.`,
  notFound: (n) => `Non ho trovato ${n}.`,
  rerouting: 'Ricalcolo del percorso.',
  noRoute: 'Nessun percorso attivo.',
  parkingFound: (n, d) => `Parcheggio più vicino: ${n}, a circa ${d} metri.`,
  parkingNone: 'Nessun parcheggio bici nelle vicinanze.',
  parkingError: 'Non sono riuscito a caricare i parcheggi.',
  skipped: (n) => `Vado a ${n}.`,
  skipNone: 'Nessun altra tappa.',
  muted: 'Voce disattivata.',
  unmuted: 'Voce attiva.',
  slower: 'Parlerò più lentamente.',
  louderNote: 'Per il volume, usa i tasti del telefono.',
  ending: 'Sto terminando il giro.',
  statusToTurn: (m) => `${m} metri alla prossima svolta.`,
  statusToDest: (dist, dur) => `${dist} alla destinazione, circa ${dur}.`,
  statusNoRoute: 'Al momento nessun percorso attivo.',
  needLocation: 'Mi serve prima la tua posizione.',
  didntCatch: 'Scusa, non ho capito.',
  cantDo: 'Scusa, non sono riuscito a farlo.',
  assistantUnreachable: "Non sono riuscito a contattare l'assistente. Riprova.",
  headingTo: (n, d) => `Andiamo a ${n}, ${d}.`,
  didYouMean: (n) => `Intendevi ${n}?`,
  cancelled: 'Va bene, annullato.',
};

const TABLE: Record<AppLocale, Phrases> = { en: EN, es: ES, ca: CA, fr: FR, de: DE, it: IT };

export function phrases(locale: AppLocale): Phrases {
  return TABLE[locale] ?? EN;
}
