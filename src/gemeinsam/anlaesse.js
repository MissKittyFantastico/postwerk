/**
 * Anlässe für die Übersicht: Themen → Kacheln → Varianten.
 * Zuordnung freigegeben am 19.10.2026 (21 Kacheln, damals 897 mitgelieferte Vorlagen). Seit dem
 * 07.11.2026 werden 825 mitgeliefert; Kacheln ohne Vorlagen blendet die Übersicht aus, die Muster
 * bleiben für Kopien in vorhandenen Installationen.
 *
 * Grundlage ist das Feld „anlass“ einer Vorlage. Der Teil nach dem ersten „ · “
 * (Seite eines Karussells) zählt nicht; eine Endung „ Story“ ist die Story-Fassung.
 */

const roh = (anlass) => String(anlass || '').split(' · ')[0].trim();

/**
 * Kacheln mit Erkennungsmuster (auf den Anlass ohne Seitenangabe) und Variante.
 * variante(m) bekommt das Ergebnis von muster.exec.
 */
export const THEMEN = [
  {
    name: 'Vermittlung',
    kacheln: [
      { name: 'Katze sucht ein Zuhause', muster: /^Katze sucht ein Zuhause \((hell|dunkel)\)$/, variante: (m) => m[1] },
      { name: 'Katzen-Duo sucht ein Zuhause', muster: /^Katzen-Duo sucht ein Zuhause \((hell|dunkel)\)$/, variante: (m) => m[1] },
      { name: 'Vermittlungs-Karussells', muster: /^Vermittlung (.+) \((Creme|Navy)\)$/, variante: (m) => `${m[1]} · ${m[2]}` },
      { name: 'Tier sucht ein Zuhause', muster: /^Tier sucht ein Zuhause$/ },
      { name: 'Infopost Adoption', muster: /^Infopost Adoption$/ },
    ],
  },
  {
    name: 'Spenden & Notfälle',
    kacheln: [
      { name: 'Spendenaufruf', muster: /^Spendenaufruf(?: (Creme|Mint) ([A-C]))?$/, variante: (m) => (m[1] ? `${m[1]} ${m[2]}` : 'klassisch') },
      { name: 'Notfall', muster: /^Notfall$/ },
      { name: 'Notfälle Spanien', muster: /^Notfälle Spanien( Story)?$/, variante: (m) => (m[1] ? 'Story' : 'Feed') },
      { name: 'Notfälle Erinnerungs-Stories', muster: /^Notfälle Erinnerungs-Stories$/ },
    ],
  },
  {
    name: 'Pflegestelle & Patenschaft',
    kacheln: [
      { name: 'Pflegestelle', muster: /^Pflegestelle(?: gesucht ([AB]))?$/, variante: (m) => (m[1] ? 'gesucht ' + m[1] : 'klassisch') },
      { name: 'Patenschaft', muster: /^Patenschaft$/ },
    ],
  },
  {
    name: 'Termine, Aktuelles & Info',
    kacheln: [
      { name: 'Termin', muster: /^Termin$/ },
      { name: 'Aktuelles', muster: /^Aktuelles$/ },
      { name: 'Info', muster: /^Info$/ },
      { name: 'Ankündigung Neuer Look', muster: /^Ankündigung Neuer Look( Story)?$/, variante: (m) => (m[1] ? 'Story' : 'Feed') },
      { name: 'Welttierschutztag', muster: /^Welttierschutztag$/ },
    ],
  },
  {
    name: 'Rückblick & Happy End',
    kacheln: [
      { name: 'Rückblick vermittelte Katzen', muster: /^Rückblick vermittelte Katzen$/ },
      { name: 'Happy End', muster: /^Happy End$/ },
      { name: 'Erfolgsgeschichte', muster: /^Erfolgsgeschichte$/ },
    ],
  },
  { name: 'Gedenken', kacheln: [{ name: 'Regenbogenbrücke', muster: /^Regenbogenbr(ü|ue)cke$/ }] },
  { name: 'Ratgeber', kacheln: [{ name: 'Ratgeber', muster: /^Ratgeber$/ }] },
];

export const WEITERE = 'Weitere Anlässe';
const EIGENE = 'Eigene Vorlagen';

/**
 * Einordnung einer Vorlage: { thema, kachel, variante }.
 * Unbekannter Anlass → eigene Kachel unter „Weitere Anlässe“; ohne Anlass → „Eigene Vorlagen“.
 */
export function einordnen(vorlage) {
  const a = roh(vorlage.anlass);
  if (!a) return { thema: WEITERE, kachel: EIGENE, variante: '' };
  for (const t of THEMEN) {
    for (const k of t.kacheln) {
      const m = k.muster.exec(a);
      if (m) return { thema: t.name, kachel: k.name, variante: k.variante ? k.variante(m) : '' };
    }
  }
  return { thema: WEITERE, kachel: a, variante: '' };
}
