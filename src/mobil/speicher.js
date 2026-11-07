/**
 * Speicher der Handy-Fassung im Browser (IndexedDB „postwerk“). Alles bleibt auf dem Gerät.
 *
 * Bereiche:
 *   entwuerfe     Entwürfe (postwerk-entwurf/1), Schlüssel id
 *   vorlagen      am Handy geänderte Vorlagen (überdecken die mitgelieferten), Schlüssel id
 *   fotos         eigene Fotos { typ, daten: ArrayBuffer }, Schlüssel name (Prüfsumme + Endung)
 *   einstellungen Einstellungen, Schlüssel name
 */
const NAME = 'postwerk';
const STAND = 1;
const BEREICHE = ['entwuerfe', 'vorlagen', 'fotos', 'einstellungen'];

let db = null;

function anfrage(r) {
  return new Promise((ok, fehler) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fehler(r.error);
  });
}

export async function oeffnen() {
  if (db) return db;
  const r = indexedDB.open(NAME, STAND);
  r.onupgradeneeded = () => {
    for (const b of BEREICHE) if (!r.result.objectStoreNames.contains(b)) r.result.createObjectStore(b);
  };
  db = await anfrage(r);
  return db;
}

async function bereich(name, art = 'readonly') {
  return (await oeffnen()).transaction(name, art).objectStore(name);
}

export async function holen(name, schluessel) {
  return anfrage((await bereich(name)).get(schluessel));
}

export async function alle(name) {
  return anfrage((await bereich(name)).getAll());
}

export async function schluessel(name) {
  return anfrage((await bereich(name)).getAllKeys());
}

export async function setzen(name, key, wert) {
  const s = await bereich(name, 'readwrite');
  await anfrage(s.put(wert, key));
  return wert;
}

export async function entfernen(name, key) {
  const s = await bereich(name, 'readwrite');
  await anfrage(s.delete(key));
}

/** Nur für Tests: Datenbank schließen (damit sie gelöscht werden kann). */
export function schliessen() {
  if (db) db.close();
  db = null;
}
