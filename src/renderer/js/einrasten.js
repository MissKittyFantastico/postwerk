/**
 * Einrasten beim Ziehen im Layoutmodus: Kanten und Mitten einer Box rasten an
 * Fanglinien ein – Leinwandrand und -mitte, Rasterränder des Designsets
 * (massvorgaben.json › raster), Story-Sicherheitszone sowie Kanten und Mitten der
 * übrigen sichtbaren Ebenen. Getroffene Linien werden als Ausrichtungshilfe angezeigt.
 */

import { formatSchluessel } from '../../gemeinsam/formate.js';

/** Abstand in Bildschirmpixeln, ab dem eine Kante einrastet. */
export const FANGABSTAND = 6;

/**
 * Fanglinien einer Vorlage. `ohne`: Kennungen der gerade bewegten Ebenen.
 * Liefert { x: [{ wert, art }], y: [...] }.
 */
export function fanglinien(v, markenset, ohne = []) {
  const r = (markenset && markenset.raster) || {};
  const x = [
    { wert: 0, art: 'leinwand' }, { wert: v.width / 2, art: 'mitte' }, { wert: v.width, art: 'leinwand' },
  ];
  const y = [
    { wert: 0, art: 'leinwand' }, { wert: v.height / 2, art: 'mitte' }, { wert: v.height, art: 'leinwand' },
  ];
  if (r.randLinks) x.push({ wert: r.randLinks, art: 'raster' });
  if (r.randLinksHeadline) x.push({ wert: r.randLinksHeadline, art: 'raster' });
  if (r.randRechts) x.push({ wert: v.width - r.randRechts, art: 'raster' });
  if (r.kopfzeileOben) y.push({ wert: r.kopfzeileOben, art: 'raster' });
  if (r.handleUnten) y.push({ wert: v.height - r.handleUnten, art: 'raster' });
  const zone = markenset && markenset.storyZone;
  if (zone && formatSchluessel(v) === 'story' && !v.kachelbereich) {
    if (zone.oben) y.push({ wert: zone.oben, art: 'raster' });
    if (zone.unten) y.push({ wert: v.height - zone.unten, art: 'raster' });
  }
  for (const l of v.layers) {
    if (l.versteckt || ohne.includes(l.id) || !l.box) continue;
    const b = l.box;
    x.push({ wert: b.x, art: 'ebene' }, { wert: b.x + b.w / 2, art: 'ebene' }, { wert: b.x + b.w, art: 'ebene' });
    y.push({ wert: b.y, art: 'ebene' }, { wert: b.y + b.h / 2, art: 'ebene' }, { wert: b.y + b.h, art: 'ebene' });
  }
  return { x, y };
}

/** Nächste Fanglinie zu einer der Kanten (innerhalb der Schwelle) – { versatz, wert } oder null. */
function naechste(kanten, linien, schwelle) {
  let best = null;
  for (const k of kanten) {
    for (const l of linien) {
      const d = l.wert - k;
      if (Math.abs(d) <= schwelle && (!best || Math.abs(d) < Math.abs(best.versatz))) best = { versatz: d, wert: l.wert };
    }
  }
  return best;
}

/**
 * Box einrasten. `ecke`: null beim Verschieben (Kanten und Mitte rasten), sonst die gezogene
 * Ecke ('nw', 'se' …) – dann rasten nur die bewegten Kanten. `schwelle` in Leinwandpixeln.
 * Liefert { box, linien: { x: [werte], y: [werte] } } mit den getroffenen Linien.
 */
export function einrasten(box, linien, schwelle, ecke = null) {
  const b = Object.assign({}, box);
  const treffer = { x: [], y: [] };
  for (const achse of ['x', 'y']) {
    const pos = achse === 'x' ? 'x' : 'y';
    const mass = achse === 'x' ? 'w' : 'h';
    const [anfang, ende] = achse === 'x' ? ['w', 'e'] : ['n', 's'];
    let kanten;
    if (!ecke) kanten = [b[pos], b[pos] + b[mass] / 2, b[pos] + b[mass]];
    else if (ecke.includes(anfang)) kanten = [b[pos]];
    else if (ecke.includes(ende)) kanten = [b[pos] + b[mass]];
    else continue;
    const t = naechste(kanten, linien[achse], schwelle);
    if (!t) continue;
    if (!ecke) b[pos] += t.versatz;
    else if (ecke.includes(anfang)) { b[pos] += t.versatz; b[mass] -= t.versatz; }
    else b[mass] += t.versatz;
  }
  // Als Hilfslinien: alle Fanglinien, auf denen eine Kante oder Mitte der Box jetzt liegt.
  for (const [achse, pos, mass] of [['x', 'x', 'w'], ['y', 'y', 'h']]) {
    const kanten = [b[pos], b[pos] + b[mass] / 2, b[pos] + b[mass]];
    treffer[achse] = [...new Set(linien[achse].filter((l) => kanten.some((k) => Math.abs(k - l.wert) < 0.5)).map((l) => l.wert))];
  }
  return { box: b, linien: treffer };
}
