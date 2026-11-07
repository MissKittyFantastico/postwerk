/**
 * Entwürfe: automatisches Sichern, Speicherstatus und Schutz vor Datenverlust.
 *
 *  - Ein Entwurf entsteht beim Öffnen einer Vorlage und wird ab der ersten Änderung
 *    gesichert, danach nach jeder Änderung (kurz verzögert). Texte, Fotos,
 *    Bildausschnitt und Layoutänderungen gehen damit nicht verloren.
 *  - Layoutänderungen gelten zunächst nur für den Entwurf. In die Vorlage gelangen sie
 *    erst über „In Vorlage speichern“. Solange das offen ist, fragt Postwerk beim
 *    Wechsel und beim Schließen nach.
 *  - Beim Schließen des Fensters ruft der Hauptprozess vorSchliessen() und bei Bedarf
 *    allesSpeichern() auf (siehe main.js).
 *  - Ein Entwurf füllt den ganzen Satz einer Vorlage (alle Fassungen, alle Karussellseiten),
 *    siehe satz.js. Layoutänderungen können in mehreren Fassungen offen sein.
 */
import { pw, zustand, tief, speicherstatus, textAusVorlage, frage } from './kern.js';
import * as satz from './satz.js';

const VERZOEGERUNG = 700;
let zeitgeber = null;
let ungesichert = false;
let letzterFehler = '';
let laeuft = null;
let beiLayoutGespeichert = () => {};

export function beiVorlageGespeichert(fn) {
  beiLayoutGespeichert = fn;
}

function uhrzeit() {
  return new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/** Neuen Entwurf aus einer Vorlage anlegen (noch nicht gespeichert). */
export function ausVorlage(vorlage) {
  const kopie = tief(vorlage);
  const inhalt = { texte: {}, fotos: {} };
  const datum = new Date().toLocaleDateString('de-DE');
  return satz.vorbereiten({
    format: 'postwerk-entwurf/1',
    id: null,
    name: `${vorlage.name} · ${datum}`,
    vorlageId: vorlage.id,
    vorlageVersion: vorlage.version || 1,
    vorlage: kopie,
    inhalt,
    text: {
      instagram: textAusVorlage(kopie.standardText, kopie, inhalt),
      facebook: textAusVorlage(kopie.standardText, kopie, inhalt),
    },
    textGekoppelt: true,
    hashtags: (kopie.hashtags || []).slice(),
    altTexte: {},
    layoutGeaendert: false,
  });
}

/** Fassungen mit Layoutänderungen nur im Entwurf: die aktuelle und weitere des Satzes. */
function offeneLayouts(e) {
  return (e.layoutGeaendert ? [{ id: e.vorlageId, name: e.vorlage.name }] : []).concat(satz.weitereLayouts(e));
}

/* ------------------------------------------------------------------ */
/* Widerrufen / Wiederholen                                            */
/* ------------------------------------------------------------------ */

/**
 * Verlauf je geöffnetem Entwurf: jeder Stand ist eine Momentaufnahme (Inhalte aller Seiten,
 * Layout aller Fassungen, Beitragstexte). Rasch aufeinanderfolgende Änderungen – etwa
 * Tippen – werden zu einem Schritt zusammengefasst.
 */
const VERLAUF_MAX = 100;
const ZUSAMMENFASSEN = 400;
const verlauf = { zurueck: [], vor: [], stand: null, merken: null };
let beiVerlauf = () => {};

/** Rückruf, wenn sich der Verlauf ändert oder ein Stand wiederhergestellt wurde. */
export function beiVerlaufGeaendert(fn) {
  beiVerlauf = fn;
}

const OHNE = new Set(['id', 'updatedAt', 'createdAt', 'format', 'inhalt']);
/** Momentaufnahme ohne Verwaltungsfelder (nur oberste Ebene; Ebenen behalten ihre Kennungen). */
function standVon(e) {
  const k = {};
  for (const [a, b] of Object.entries(e)) if (!OHNE.has(a)) k[a] = b;
  return JSON.stringify(k);
}

/** Verlauf für einen frisch geöffneten Entwurf beginnen. */
export function verlaufStarten(e) {
  clearTimeout(verlauf.merken);
  verlauf.zurueck = [];
  verlauf.vor = [];
  verlauf.stand = e ? standVon(e) : null;
  beiVerlauf({ wiederhergestellt: false });
}

function merken() {
  clearTimeout(verlauf.merken);
  const e = zustand.entwurf;
  if (!e || verlauf.stand == null) return;
  const neu = standVon(e);
  if (neu === verlauf.stand) return;
  verlauf.zurueck.push(verlauf.stand);
  if (verlauf.zurueck.length > VERLAUF_MAX) verlauf.zurueck.shift();
  verlauf.vor = [];
  verlauf.stand = neu;
  beiVerlauf({ wiederhergestellt: false });
}

function anwenden(stand) {
  const e = zustand.entwurf;
  const alt = { id: e.id, updatedAt: e.updatedAt, createdAt: e.createdAt, format: e.format };
  for (const k of Object.keys(e)) delete e[k];
  Object.assign(e, JSON.parse(stand), alt);
  e.inhalt = e.seiten[e.seite];
  ungesichert = true;
  speicherstatus('offen', 'Ungespeicherte Änderungen');
  clearTimeout(zeitgeber);
  zeitgeber = setTimeout(() => jetztSpeichern(), VERZOEGERUNG);
  beiVerlauf({ wiederhergestellt: true });
}

export const kannWiderrufen = () => verlauf.zurueck.length > 0 || Boolean(verlauf.merken && zustand.entwurf && standVon(zustand.entwurf) !== verlauf.stand);
export const kannWiederholen = () => verlauf.vor.length > 0;

/** Letzten Schritt zurücknehmen. Liefert false, wenn es nichts zu widerrufen gibt. */
export function widerrufen() {
  if (!zustand.entwurf) return false;
  merken();
  if (!verlauf.zurueck.length) return false;
  verlauf.vor.push(verlauf.stand);
  verlauf.stand = verlauf.zurueck.pop();
  anwenden(verlauf.stand);
  return true;
}

/** Zurückgenommenen Schritt wiederholen. */
export function wiederholen() {
  if (!zustand.entwurf) return false;
  merken();
  if (!verlauf.vor.length) return false;
  verlauf.zurueck.push(verlauf.stand);
  verlauf.stand = verlauf.vor.pop();
  anwenden(verlauf.stand);
  return true;
}

/** Eine Änderung am offenen Entwurf melden. */
export function geaendert({ layout = false } = {}) {
  const e = zustand.entwurf;
  if (!e) return;
  if (layout) e.layoutGeaendert = true;
  ungesichert = true;
  speicherstatus('offen', 'Ungespeicherte Änderungen');
  clearTimeout(zeitgeber);
  zeitgeber = setTimeout(() => jetztSpeichern(), VERZOEGERUNG);
  clearTimeout(verlauf.merken);
  verlauf.merken = setTimeout(merken, ZUSAMMENFASSEN);
}

/** Entwurf sofort speichern. Liefert true bei Erfolg. */
export async function jetztSpeichern() {
  clearTimeout(zeitgeber);
  if (laeuft) await laeuft;
  const e = zustand.entwurf;
  if (!e || !ungesichert) return true;
  ungesichert = false;
  speicherstatus('speichert', 'Speichert …');
  laeuft = pw.entwuerfe.speichern(e);
  const r = await laeuft;
  laeuft = null;
  if (r && r.ok) {
    if (zustand.entwurf === e) {
      e.id = r.daten.id;
      e.updatedAt = r.daten.updatedAt;
      e.createdAt = r.daten.createdAt;
    }
    letzterFehler = '';
    if (!ungesichert) speicherstatus('gespeichert', 'Entwurf gespeichert ' + uhrzeit());
    return true;
  }
  ungesichert = true;
  letzterFehler = (r && r.fehler) || 'Unbekannter Fehler';
  speicherstatus('fehler', 'Nicht gespeichert');
  zeitgeber = setTimeout(() => jetztSpeichern(), 5000);
  return false;
}

/** Layoutänderungen weiterer Fassungen in ihre Vorlagen übernehmen. */
async function weitereSpeichern(e) {
  for (const { id } of satz.weitereLayouts(e)) {
    const v = tief(e.layouts[id].vorlage);
    v.id = id;
    const r = await pw.vorlagen.speichern(v, 'Layout im Studio geändert');
    if (!r || !r.ok) return r ? r.fehler : 'Unbekannter Fehler';
    delete e.layouts[id];
  }
  return true;
}

/** Layout des Entwurfs in die Vorlage übernehmen (neue Fassung, alte bleibt unter „Versionen“). */
export async function inVorlageSpeichern() {
  const e = zustand.entwurf;
  if (!e) return false;
  const weitere = await weitereSpeichern(e);
  if (weitere !== true) {
    speicherstatus('fehler', 'Vorlage nicht gespeichert');
    return weitere;
  }
  if (!e.layoutGeaendert) {
    ungesichert = true;
    await jetztSpeichern();
    return true;
  }
  const v = tief(e.vorlage);
  v.id = e.vorlageId;
  const r = await pw.vorlagen.speichern(v, 'Layout im Studio geändert');
  if (!r || !r.ok) {
    speicherstatus('fehler', 'Vorlage nicht gespeichert');
    return r ? r.fehler : 'Unbekannter Fehler';
  }
  e.layoutGeaendert = false;
  e.vorlageVersion = r.daten.version;
  e.vorlage.version = r.daten.version;
  e.vorlage.miniatur = r.daten.miniatur;
  ungesichert = true;
  await jetztSpeichern();
  beiLayoutGespeichert(r.daten);
  return true;
}

/**
 * Vor dem Wechsel zu einem anderen Entwurf: sichern und bei offenen
 * Layoutänderungen nachfragen. Liefert false, wenn abgebrochen wurde.
 */
export async function vorWechsel() {
  const e = zustand.entwurf;
  if (!e) return true;
  await jetztSpeichern();
  const offen = offeneLayouts(e);
  if (!offen.length) return true;
  const wahl = await frage({
    titel: 'Layout in die Vorlage übernehmen?',
    text: `Das Layout von ${offen.map((x) => `„${x.name}“`).join(', ')} wurde geändert. Die Änderungen sind im Entwurf gesichert, die Vorlage selbst ist noch unverändert.`,
    knoepfe: [
      { text: 'Abbrechen', wert: null },
      { text: 'Nur im Entwurf lassen', wert: 'entwurf' },
      { text: 'In Vorlage speichern', wert: 'vorlage', art: 'haupt' },
    ],
  });
  if (wahl === null) return false;
  if (wahl === 'vorlage') return (await inVorlageSpeichern()) === true;
  return true;
}

/** Für den Hauptprozess: offene Punkte vor dem Schließen (nach einem Sicherungsversuch). */
async function vorSchliessen() {
  const offen = [];
  const e = zustand.entwurf;
  const ok = await jetztSpeichern();
  if (!ok) offen.push(`Entwurf „${e ? e.name : ''}“ konnte nicht gespeichert werden: ${letzterFehler}`);
  for (const x of e ? offeneLayouts(e) : []) {
    offen.push(`Layoutänderungen an „${x.name}“ sind nur im Entwurf gesichert, die Vorlage selbst ist unverändert.`);
  }
  const dialogOffen = document.querySelector('#schleier.offen [data-ungesichert="true"]');
  if (dialogOffen) offen.push('Ein geöffneter Dialog enthält noch nicht gespeicherte Eingaben.');
  return offen;
}

/** Für den Hauptprozess: alles speichern. Liefert true oder eine Fehlermeldung. */
async function allesSpeichern() {
  const e = zustand.entwurf;
  if (e && offeneLayouts(e).length) {
    const r = await inVorlageSpeichern();
    if (r !== true) return 'Vorlage: ' + r;
  }
  const ok = await jetztSpeichern();
  return ok ? true : 'Entwurf: ' + letzterFehler;
}

window.__pwVorSchliessen = vorSchliessen;
window.__pwAllesSpeichern = allesSpeichern;
