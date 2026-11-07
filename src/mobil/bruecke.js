/**
 * Brücke der Handy-Fassung: stellt window.postwerk im Browser bereit – dieselben Aufrufe und
 * dieselbe Antwortform ({ ok, daten, fehler }) wie am Rechner (src/main/preload.js), soweit
 * die Handy-Fassung sie braucht. So arbeiten kern.js, entwurf.js, satz.js und darstellung.js
 * unverändert.
 *
 * Daten:
 *   daten/vorlagen.json  mitgelieferte Vorlagen (ohne Beispielfotos), gebaut mit werkzeuge/mobil-bauen.js
 *   daten/medien.json    Grafiken der Vorlagen, Logos und Badges als data:-Adressen { name: daten }
 *   daten/baukasten.json Baukasten wie am Rechner, dazu „passend“ (Symbolgrafik → Farbvariante)
 *   daten/symbole/…      Symbolbibliothek je Farbvariante und Füllung, erst bei Bedarf geladen
 *   IndexedDB            Entwürfe, am Handy geänderte Vorlagen, eigene Fotos, Einstellungen (speicher.js)
 *
 * Muss vor kern.js geladen werden (kern.js liest window.postwerk beim Laden): erst
 * `await bruecke.bereit()`, dann die Oberfläche importieren.
 */
import * as speicher from './speicher.js';
import { markensetAufbauen } from '../gemeinsam/markenset.js';

const DATEN = new URL('daten/', document.baseURI);
const DESIGNSET = new URL('../gemeinsam/designset/', import.meta.url);

const ok = (daten) => ({ ok: true, daten });
const fehler = (e) => ({ ok: false, fehler: (e && e.message) || String(e) });
const sicher = (fn) => async (...a) => { try { return ok(await fn(...a)); } catch (e) { return fehler(e); } };
const tief = (o) => JSON.parse(JSON.stringify(o));
const neueId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const stand = { mitgeliefert: new Map(), medien: new Map(), fotos: new Map(), markenset: null, baukasten: null, symbolPaket: new Map(), pakete: new Map() };

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

/** Mitgelieferte Vorlagen, Grafiken, Markenset und eigene Fotos laden. */
export async function bereit() {
  const [vorlagen, medien, baukasten, tokens, mass, symbole] = await Promise.all([
    json(new URL('vorlagen.json', DATEN)), json(new URL('medien.json', DATEN)), json(new URL('baukasten.json', DATEN)),
    json(new URL('tokens.json', DESIGNSET)), json(new URL('massvorgaben.json', DESIGNSET)), json(new URL('symbole-index.json', DESIGNSET)),
  ]);
  for (const v of vorlagen) stand.mitgeliefert.set(v.id, v);
  for (const [n, d] of Object.entries(medien)) stand.medien.set(n, d);
  stand.baukasten = baukasten;
  for (const [schluessel, m] of Object.entries(baukasten.symbole.dateien)) stand.symbolPaket.set(m, schluessel.split('|').slice(0, 2).join('-'));
  stand.markenset = markensetAufbauen(tokens, mass, symbole);
  await fotosAufraeumen();
  for (const name of await speicher.schluessel('fotos')) {
    const f = await speicher.holen('fotos', name);
    stand.fotos.set(name, URL.createObjectURL(new Blob([f.daten], { type: f.typ })));
  }
  window.postwerk = postwerk;
  return postwerk;
}

/** Eigene Fotos, die kein Entwurf mehr nutzt, entfernen (Speicherplatz am Handy). */
async function fotosAufraeumen() {
  const genutzt = new Set();
  for (const e of await speicher.alle('entwuerfe')) {
    JSON.stringify(e, (k, w) => { if (k === 'medium' && typeof w === 'string') genutzt.add(w); return w; });
  }
  for (const name of await speicher.schluessel('fotos')) if (!genutzt.has(name)) await speicher.entfernen('fotos', name);
}

/** Symbolpaket (z. B. „07-mit“) laden; seine Grafiken stehen danach über medienUrl bereit. */
function symbolPaket(paket) {
  if (!stand.pakete.has(paket)) {
    const laden = json(new URL(`symbole/${paket}.json`, DATEN)).then((inhalt) => {
      for (const [n, svg] of Object.entries(inhalt)) stand.medien.set(n, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    });
    laden.catch(() => stand.pakete.delete(paket)); // beim nächsten Mal neu versuchen
    stand.pakete.set(paket, laden);
  }
  return stand.pakete.get(paket);
}

/** Symbolgrafiken, die Entwürfe oder Vorlagen nutzen, vor dem Zeichnen laden. */
async function medienSichern(daten) {
  const pakete = new Set();
  JSON.stringify(daten, (k, w) => {
    if (k === 'medium' && typeof w === 'string' && !stand.medien.has(w) && stand.symbolPaket.has(w)) pakete.add(stand.symbolPaket.get(w));
    return w;
  });
  await Promise.all([...pakete].map(symbolPaket));
  return daten;
}

/** Adresse eines Mediums: eigenes Foto (Blob) oder mitgelieferte Grafik. */
function medienUrl(name) {
  if (!name) return '';
  return stand.fotos.get(name) || stand.medien.get(name) || '';
}

/** Name eines Fotos wie am Rechner: Prüfsumme des Inhalts (20 Zeichen) + Endung. */
async function fotoSpeichern(blob, endung) {
  const summe = new Uint8Array(await crypto.subtle.digest('SHA-1', await blob.arrayBuffer()));
  const name = [...summe].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 20) + '.' + endung;
  if (!stand.fotos.has(name)) {
    // Als Bytes + Typ, nicht als Blob: WebKit lehnt Blobs in IndexedDB teils ab (gemessen:
    // „BlobURLs are not yet supported“), ArrayBuffer geht überall.
    await speicher.setzen('fotos', name, { typ: blob.type || 'image/jpeg', daten: await blob.arrayBuffer() });
    stand.fotos.set(name, URL.createObjectURL(blob));
  }
  return name;
}

function entwurfKurz(e) {
  return { id: e.id, name: e.name, vorlageId: e.vorlageId, vorlageName: e.vorlage && e.vorlage.name, updatedAt: e.updatedAt, createdAt: e.createdAt, vorlage: e.vorlage, inhalt: e.inhalt };
}

const postwerk = {
  mobil: true,
  medienUrl,
  marke: { lesen: sicher(async () => stand.markenset) },
  vorlagen: {
    /** Mitgelieferte Vorlagen, am Handy geänderte überdecken sie. */
    liste: sicher(async () => {
      const eigen = new Map((await speicher.alle('vorlagen')).map((v) => [v.id, v]));
      const liste = [...stand.mitgeliefert.values()].map((v) => tief(eigen.get(v.id) || v));
      for (const [id, v] of eigen) if (!stand.mitgeliefert.has(id)) liste.push(tief(v));
      return medienSichern(liste);
    }),
    speichern: sicher(async (vorlage, grund) => {
      if (!vorlage || !vorlage.name) throw new Error('Die Vorlage braucht einen Namen.');
      const v = tief(vorlage);
      if (!v.id) v.id = neueId('vl');
      const alt = (await speicher.holen('vorlagen', v.id)) || stand.mitgeliefert.get(v.id);
      v.version = alt ? Math.max(Number(v.version) || 1, (Number(alt.version) || 1) + 1) : Number(v.version) || 1;
      v.aenderungsgrund = grund || 'Geändert';
      v.updatedAt = new Date().toISOString();
      if (!v.createdAt) v.createdAt = v.updatedAt;
      return speicher.setzen('vorlagen', v.id, v);
    }),
    /** Am Handy geänderte Vorlage wieder auf die mitgelieferte zurücksetzen. */
    originalZuruecksetzen: sicher(async (id) => {
      await speicher.entfernen('vorlagen', id);
      return tief(stand.mitgeliefert.get(id) || null);
    }),
  },
  entwuerfe: {
    liste: sicher(async () => medienSichern((await speicher.alle('entwuerfe')).map(entwurfKurz).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))))),
    holen: sicher(async (id) => medienSichern((await speicher.holen('entwuerfe', id)) || null)),
    speichern: sicher(async (entwurf) => {
      const e = tief(entwurf);
      if (!e.id) e.id = neueId('ent');
      e.format = 'postwerk-entwurf/1';
      e.updatedAt = new Date().toISOString();
      if (!e.createdAt) e.createdAt = e.updatedAt;
      await speicher.setzen('entwuerfe', e.id, e);
      return { id: e.id, updatedAt: e.updatedAt, createdAt: e.createdAt };
    }),
    /** Ohne Rückfrage – die fragt die Oberfläche der Handy-Fassung selbst. */
    loeschen: sicher(async (id) => {
      await speicher.entfernen('entwuerfe', id);
      return { geloescht: id };
    }),
  },
  bibliothek: {
    /** Baukasten wie am Rechner (pw.bibliothek.baukasten), dazu „passend“. */
    baukasten: sicher(async () => stand.baukasten),
    /** Symbole einer Farbvariante und Füllung laden (Nummer wie „07“, 'mit' | 'ohne'). */
    symbole: sicher(async (nr, fuellung) => { await symbolPaket(`${nr}-${fuellung}`); return true; }),
  },
  medien: {
    /** Foto übernehmen (Blob oder ArrayBuffer). Rückgabe wie am Rechner: { name, medium }. */
    ausDaten: sicher(async ({ daten, endung, name }) => {
      const blob = daten instanceof Blob ? daten : new Blob([daten], { type: endung === 'png' ? 'image/png' : 'image/jpeg' });
      return { name: name || '', medium: await fotoSpeichern(blob, endung || 'jpg') };
    }),
  },
  einstellungen: {
    lesen: sicher(async () => (await speicher.holen('einstellungen', 'alle')) || {}),
    schreiben: sicher(async (werte) => {
      const neu = Object.assign((await speicher.holen('einstellungen', 'alle')) || {}, werte);
      await speicher.setzen('einstellungen', 'alle', neu);
      return neu;
    }),
  },
  ereignisse: { beiMenue: () => {}, beiFortschritt: () => {} },
};
