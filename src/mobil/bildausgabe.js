/**
 * Bild im Browser erzeugen (Handy-Fassung). Am Rechner nimmt der Hauptprozess das fertig
 * aufgebaute Dokument als Bild auf; ein Browser kann das nicht. Hier wird dieselbe Darstellung
 * (darstellung.js) aufgebaut, als SVG mit eingebettetem HTML (foreignObject) auf eine
 * Zeichenfläche gezeichnet und als JPEG oder PNG ausgegeben. Schriften und Bilder werden dafür
 * als data:-Adressen eingebettet – ein SVG-Bild darf nichts nachladen.
 */
import { aufbauen } from '../renderer/js/darstellung.js';
import { schriftenEinrichten, schriftenEingebettet } from './schriften.js';
import { weichVorbereiten } from './weichzeichnen.js';
import { stricheErsetzen } from './striche.js';

const alsDataUrl = (blob) => new Promise((ok, fehler) => {
  const r = new FileReader();
  r.onload = () => ok(r.result);
  r.onerror = () => fehler(r.error);
  r.readAsDataURL(blob);
});

async function holen(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.blob();
}

/**
 * Bilder im Klon durch data:-Adressen ersetzen (gleiche Adresse nur einmal laden). Weichgezeichnete
 * Fotos werden vorab berechnet (weichzeichnen.js); dafür dient das Original im Dokument.
 */
async function bilderEinbetten(original, klon) {
  const cache = new Map();
  const quellen = [...original.querySelectorAll('img')];
  const ziele = [...klon.querySelectorAll('img')];
  for (let i = 0; i < ziele.length; i++) {
    if (await weichVorbereiten(quellen[i], ziele[i])) continue;
    const src = ziele[i].getAttribute('src');
    if (!src || src.startsWith('data:')) continue;
    if (!cache.has(src)) cache.set(src, holen(src).then(alsDataUrl));
    ziele[i].setAttribute('src', await cache.get(src));
  }
}

const XHTML = 'http://www.w3.org/1999/xhtml';

/**
 * Vorlage mit Inhalt als Bild ausgeben.
 * @param {{ vorlage, inhalt, medienUrl, mindestschrift?, format?: 'jpeg'|'png', qualitaet?: number }} a
 * @returns {Promise<{ blob: Blob, breite: number, hoehe: number, aufbau }>}
 */
export async function bildErzeugen({ vorlage, inhalt = {}, medienUrl, mindestschrift = 26, format = 'jpeg', qualitaet = 0.93, platzhalter = true }) {
  const W = vorlage.width;
  const H = vorlage.height;
  await schriftenEinrichten();
  const buehne = document.createElement('div');
  buehne.style.cssText = `position:fixed;left:-${W + 4000}px;top:0;width:${W}px;height:${H}px;overflow:hidden;`;
  document.body.append(buehne);
  try {
    const aufbau = aufbauen(buehne, vorlage, inhalt, { medienUrl, platzhalter, beispielfotos: false, mindestschrift });
    await aufbau.fertig;
    // Nach dem Aufbau (Einpassen, mitwachsende Schilder) den fertigen Stand übernehmen
    const klon = aufbau.wurzel.cloneNode(true);
    await bilderEinbetten(aufbau.wurzel, klon);
    // Gestrichelte Rahmen selbst zeichnen (striche.js); Listen vor dem Einfügen der SVGs bilden
    const alle = [...aufbau.wurzel.querySelectorAll('div')];
    const kopien = [...klon.querySelectorAll('div')];
    alle.forEach((e, i) => stricheErsetzen(e, kopien[i]));
    const huelle = document.createElementNS(XHTML, 'div');
    huelle.setAttribute('style', `width:${W}px;height:${H}px;`);
    const stil = document.createElementNS(XHTML, 'style');
    stil.textContent = await schriftenEingebettet();
    huelle.append(stil, klon);
    const html = new XMLSerializer().serializeToString(huelle);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">${html}</foreignObject></svg>`;
    const bild = new Image();
    bild.decoding = 'sync';
    bild.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await bild.decode();
    const flaeche = document.createElement('canvas');
    flaeche.width = W;
    flaeche.height = H;
    const ctx = flaeche.getContext('2d');
    const zeichnen = () => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(bild, 0, 0, W, H);
    };
    // Safari (WebKit) entschlüsselt eingebettete Bilder eines SVG-Bildes erst nach dem ersten
    // Zeichnen, nach und nach; die ersten Ergebnisse sind unvollständig (gemessen: Fotos fehlen
    // bis ~0,6 s). Darum neu zeichnen, bis zwei Durchgänge gleich aussehen (höchstens ~4 s).
    const stichprobe = () => {
      const d = ctx.getImageData(0, 0, W, H).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4 * 97) s = (s * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 2147483647;
      return s;
    };
    zeichnen();
    let vorher = stichprobe();
    for (let n = 0, gleich = 0; n < 20 && gleich < 2; n++) {
      await new Promise((ok) => setTimeout(ok, 200));
      zeichnen();
      const jetzt = stichprobe();
      gleich = jetzt === vorher ? gleich + 1 : 0;
      vorher = jetzt;
    }
    const blob = await new Promise((ok, fehler) => flaeche.toBlob((b) => (b ? ok(b) : fehler(new Error('Das Bild ließ sich nicht erzeugen.'))), format === 'png' ? 'image/png' : 'image/jpeg', qualitaet));
    return { blob, breite: W, hoehe: H, aufbau };
  } finally {
    buehne.remove();
  }
}
