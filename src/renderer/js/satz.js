/**
 * Satz eines Entwurfs: alle Fassungen eines Designs (Format × Fotostil) und bei Karussells
 * alle Seiten. Ein Entwurf füllt den ganzen Satz (Entscheidung vom 20.10.2026):
 *
 *  - Inhalte gelten je Seite (seiten[n] = { texte, fotos }); Format- und Fotostil-Wechsel
 *    behalten sie. Haben Fassungen andere Ebenen-Kennungen (z. B. Facebook ↔ Story der
 *    klassischen Anlässe), werden die Inhalte über die Rolle (slot) übertragen.
 *  - Karussell: Eine Eingabe wird auf alle Seiten übertragen, deren Feld denselben
 *    Standardtext trägt und noch denselben Wert hat (z. B. der Tiername). Fotos ebenso über
 *    dasselbe Beispielfoto. Einzelne Felder lassen sich davon lösen („nur hier“).
 *  - Layoutänderungen gelten je Fassung (layouts[vorlagenId]).
 *
 * Darstellung, Prüfung, Export und Veröffentlichen arbeiten weiter mit (vorlage, inhalt)
 * der gewählten Fassung und Seite.
 */
import { zustand, tief } from './kern.js';
import { formatSchluessel } from '../../gemeinsam/formate.js';
import { istFotofeld } from '../../gemeinsam/ebenen.js';

const PRAEFIX = /^(instagram-feed-portrait|instagram-story|instagram-feed|facebook)--/;

/** Schlüssel des Satzes: Karussell-Gruppe oder Design ohne Plattform und Fotostil. */
export function satzSchluessel(v) {
  if (v.karussell && v.gruppe) return 'k:' + v.gruppe.replace(/^kachel-/, '');
  return 'd:' + v.id.replace(PRAEFIX, '').replace(/^kachel-/, '').replace(/--(vollbild|mittel|blur-fill)$/, '');
}

const seiteVon = (v) => (v.karussell && v.karussell.seite) || 1;

/** Alle Vorlagen des Satzes (aktuelle Bibliothek, ohne Archiv) mit Seite, Format und Fotostil. */
export function mitglieder(e) {
  const k = e.satz.schluessel;
  return zustand.vorlagen
    .filter((v) => satzSchluessel(v) === k && (!v.archiviert || v.id === e.vorlageId))
    .map((v) => ({ id: v.id, seite: seiteVon(v), formatKey: formatSchluessel(v), fotostil: v.fotostil || '', vorlage: v }));
}

/** Auswahlmöglichkeiten im Satz. */
export function achsen(e) {
  const m = mitglieder(e);
  const ordne = (a) => [...new Set(a)].sort();
  return {
    formate: ordne(m.map((x) => x.formatKey)),
    fotostile: ['Vollbild', 'Mittel', 'Blur-Fill'].filter((s) => m.some((x) => x.fotostil === s)),
    seiten: ordne(m.map((x) => x.seite)).sort((a, b) => a - b),
    anzahl: m.length,
  };
}

/** Aktuelle Wahl des Entwurfs. */
export function wahl(e) {
  return { seite: e.seite, formatKey: formatSchluessel(e.vorlage), fotostil: e.vorlage.fotostil || '' };
}

/** Mitglied zu einer Wahl; fehlt die genaue Kombination, das nächstliegende (gleiche Seite und Format). */
export function finden(e, w) {
  const m = mitglieder(e);
  return m.find((x) => x.seite === w.seite && x.formatKey === w.formatKey && x.fotostil === w.fotostil)
    || m.find((x) => x.seite === w.seite && x.formatKey === w.formatKey)
    || m.find((x) => x.seite === w.seite)
    || null;
}

/** Älteren oder neuen Entwurf mit den Satz-Feldern versehen. */
export function vorbereiten(e) {
  if (!e.satz) e.satz = { schluessel: satzSchluessel(e.vorlage) };
  e.satz.karussell = Boolean(e.vorlage.karussell && e.vorlage.gruppe);
  if (!e.seiten) {
    e.seite = seiteVon(e.vorlage);
    e.seiten = { [e.seite]: Object.assign({ texte: {}, fotos: {} }, e.inhalt) };
  }
  if (!e.seiten[e.seite]) e.seiten[e.seite] = { texte: {}, fotos: {} };
  e.inhalt = e.seiten[e.seite];
  e.geloest = e.geloest || [];
  e.layouts = e.layouts || {};
  return e;
}

/** Inhalt von einer Fassung auf eine andere übertragen (gleiche Kennung, sonst gleiche Rolle). */
function uebertragen(inhalt, von, nach) {
  if (!inhalt || von === nach) return inhalt;
  const rolle = (l) => l.slot || l.id;
  const ziel = new Map(nach.layers.map((l) => [l.id, l]));
  const nachRolle = new Map(nach.layers.filter((l) => l.type === 'text').map((l) => [rolle(l), l.id]));
  const texte = {};
  for (const [id, wert] of Object.entries(inhalt.texte || {})) {
    if (ziel.has(id)) { texte[id] = wert; continue; }
    const quelle = von.layers.find((l) => l.id === id);
    const neu = quelle && nachRolle.get(rolle(quelle));
    if (neu) texte[neu] = wert;
  }
  return { texte, fotos: Object.assign({}, inhalt.fotos) };
}

/** Vorlage einer Fassung: im Entwurf geändertes Layout oder Kopie aus der Bibliothek. */
export function vorlageFuer(e, mitglied) {
  if (mitglied.id === e.vorlageId) return e.vorlage;
  return e.layouts[mitglied.id] ? e.layouts[mitglied.id].vorlage : tief(mitglied.vorlage);
}

/** Inhalt einer Seite für eine bestimmte Fassung (für Export und Kontaktbogen). */
export function inhaltFuer(e, mitglied) {
  const quelle = e.seiten[mitglied.seite] || { texte: {}, fotos: {} };
  return uebertragen(quelle, e.vorlage, vorlageFuer(e, mitglied));
}

/** Zu einer anderen Fassung oder Seite wechseln. Layoutänderungen bleiben je Fassung erhalten. */
export function wechseln(e, w) {
  const ziel = finden(e, w);
  if (!ziel || ziel.id === e.vorlageId && ziel.seite === e.seite) return false;
  const alt = e.vorlage;
  if (e.layoutGeaendert) e.layouts[e.vorlageId] = { vorlage: e.vorlage, version: e.vorlageVersion };
  const gespeichert = e.layouts[ziel.id];
  e.vorlage = gespeichert ? gespeichert.vorlage : tief(ziel.vorlage);
  e.vorlageId = ziel.id;
  e.vorlageVersion = gespeichert ? gespeichert.version : ziel.vorlage.version || 1;
  e.layoutGeaendert = Boolean(gespeichert);
  if (gespeichert) delete e.layouts[ziel.id];
  if (ziel.seite === e.seite) {
    e.seiten[e.seite] = uebertragen(e.inhalt, alt, e.vorlage);
  } else {
    e.seite = ziel.seite;
    if (!e.seiten[e.seite]) e.seiten[e.seite] = { texte: {}, fotos: {} };
  }
  e.inhalt = e.seiten[e.seite];
  return true;
}

/* ------------------------------------------------------------------ */
/* Karussell: Eingaben über die Seiten übertragen                      */
/* ------------------------------------------------------------------ */

const geloest = (e, seite, id) => e.geloest.includes(`${seite}:${id}`);

/** Vorlagen der anderen Seiten in der aktuellen Fassung. */
function andereSeiten(e) {
  const w = wahl(e);
  const seiten = achsen(e).seiten.filter((s) => s !== e.seite);
  return seiten.map((s) => finden(e, { seite: s, formatKey: w.formatKey, fotostil: w.fotostil })).filter(Boolean)
    .map((m) => ({ seite: m.seite, vorlage: vorlageFuer(e, m) }));
}

/** Textfelder anderer Seiten mit demselben Standardtext, die noch synchron sind. */
function textPartner(e, l, wert) {
  if (!e.satz.karussell || !l.text) return [];
  const treffer = [];
  for (const s of andereSeiten(e)) {
    const inhalt = e.seiten[s.seite] || { texte: {} };
    for (const x of s.vorlage.layers) {
      if (x.type !== 'text' || x.editable === false || x.text !== l.text || geloest(e, s.seite, x.id)) continue;
      const jetzt = inhalt.texte && inhalt.texte[x.id] != null ? inhalt.texte[x.id] : x.text;
      if (jetzt === wert) treffer.push({ seite: s.seite, id: x.id });
    }
  }
  return treffer;
}

/** Seiten, auf die eine Eingabe in diesem Feld mit übertragen wird (für die Anzeige). */
export function textVerknuepft(e, l) {
  if (geloest(e, e.seite, l.id)) return { geloest: true, seiten: [] };
  const wert = e.inhalt.texte[l.id] != null ? e.inhalt.texte[l.id] : l.text || '';
  return { geloest: false, seiten: [...new Set(textPartner(e, l, wert).map((t) => t.seite))] };
}

/** Text setzen; im Karussell auf synchrone Felder anderer Seiten übertragen. */
export function textSetzen(e, l, wert) {
  const vorher = e.inhalt.texte[l.id] != null ? e.inhalt.texte[l.id] : l.text || '';
  const partner = geloest(e, e.seite, l.id) ? [] : textPartner(e, l, vorher);
  e.inhalt.texte[l.id] = wert;
  for (const p of partner) {
    if (!e.seiten[p.seite]) e.seiten[p.seite] = { texte: {}, fotos: {} };
    e.seiten[p.seite].texte[p.id] = wert;
  }
  return partner.length;
}

/** Feld von der Übertragung lösen oder wieder verbinden. */
export function loesen(e, l, an) {
  const k = `${e.seite}:${l.id}`;
  e.geloest = e.geloest.filter((x) => x !== k);
  if (an) e.geloest.push(k);
}

/** Beispielfoto einer Fotogruppe (Erkennungsmerkmal für dasselbe Tier auf anderen Seiten). */
function beispielVon(vorlage, gruppe) {
  const l = vorlage.layers.find((x) => istFotofeld(x) && (x.gruppe || x.id) === gruppe);
  return l && l.beispiel;
}

/** Foto setzen; im Karussell auf Gruppen anderer Seiten mit demselben Beispielfoto übertragen, die noch leer oder synchron sind. */
export function fotoSetzen(e, gruppe, foto) {
  const vorher = e.inhalt.fotos[gruppe] && e.inhalt.fotos[gruppe].medium;
  e.inhalt.fotos[gruppe] = foto;
  const b = beispielVon(e.vorlage, gruppe);
  if (!e.satz.karussell || !b || geloest(e, e.seite, gruppe)) return 0;
  let n = 0;
  for (const s of andereSeiten(e)) {
    const gruppen = [...new Set(s.vorlage.layers.filter((x) => istFotofeld(x) && x.beispiel === b).map((x) => x.gruppe || x.id))];
    for (const g of gruppen) {
      if (geloest(e, s.seite, g)) continue;
      if (!e.seiten[s.seite]) e.seiten[s.seite] = { texte: {}, fotos: {} };
      const dort = e.seiten[s.seite].fotos[g];
      if (dort && dort.medium !== vorher) continue;
      e.seiten[s.seite].fotos[g] = { medium: foto.medium, name: foto.name, position: null, zoom: 1 };
      n++;
    }
  }
  return n;
}

/** Fassungen mit Layoutänderungen, die nur im Entwurf stehen (außer der aktuellen). */
export function weitereLayouts(e) {
  return Object.entries(e.layouts || {}).map(([id, x]) => ({ id, name: x.vorlage.name }));
}
