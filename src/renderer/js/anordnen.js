/**
 * Mehrere Ebenen anordnen: verschieben, ausrichten, verteilen, gruppieren.
 *
 *  - Eine Gruppe ist ein gemeinsames Feld „verbund“ der Ebenen (nicht „gruppe“ – das
 *    verbindet die Foto-Ebenen eines Fotos). Auf der Leinwand wird eine Gruppe als Ganzes
 *    gewählt und bewegt; über die Ebenenliste lässt sich eine einzelne Ebene wählen.
 *  - Ausrichten und Verteilen behandeln jede Gruppe als eine Einheit, damit ihr innerer
 *    Aufbau erhalten bleibt. Gesperrte Einheiten bleiben stehen, zählen aber für die Hülle.
 */
import { neueId } from './kern.js';

/** Ebene samt Beschnitt verschieben. */
export function verschieben(l, dx, dy) {
  if (!dx && !dy) return;
  l.box = Object.assign({}, l.box, { x: l.box.x + dx, y: l.box.y + dy });
  if (l.clip) l.clip = Object.assign({}, l.clip, { x: l.clip.x + dx, y: l.clip.y + dy });
}

/**
 * Box über eine Ecke ('nw', 'ne', 'sw', 'se') um dx, dy vergrößern oder verkleinern;
 * mindestens 16 px. Liefert eine neue Box (nicht gerundet).
 */
export function groesseAendern(box, ecke, dx, dy) {
  const b = Object.assign({}, box);
  if (ecke.includes('w')) { b.x = box.x + dx; b.w = Math.max(16, box.w - dx); }
  if (ecke.includes('e')) b.w = Math.max(16, box.w + dx);
  if (ecke.includes('n')) { b.y = box.y + dy; b.h = Math.max(16, box.h - dy); }
  if (ecke.includes('s')) b.h = Math.max(16, box.h + dy);
  return b;
}

/** Neue Box setzen (gerundet); ein Beschnitt folgt Lage und Größe der Box. */
export function boxSetzen(l, b, startBox, startClip) {
  l.box = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) };
  if (startClip) {
    const vx = l.box.x - startBox.x;
    const vy = l.box.y - startBox.y;
    l.clip = { x: startClip.x + vx, y: startClip.y + vy, w: startClip.w + (l.box.w - startBox.w), h: startClip.h + (l.box.h - startBox.h) };
  }
}

/** Umgebendes Rechteck mehrerer Boxen. */
export function huelle(boxen) {
  const x = Math.min(...boxen.map((b) => b.x));
  const y = Math.min(...boxen.map((b) => b.y));
  return { x, y, w: Math.max(...boxen.map((b) => b.x + b.w)) - x, h: Math.max(...boxen.map((b) => b.y + b.h)) - y };
}

/** Ebenen zu Einheiten zusammenfassen: je Gruppe eine, sonst je Ebene. */
export function einheiten(ebenen) {
  const m = new Map();
  for (const l of ebenen) {
    const k = l.verbund || l.id;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(l);
  }
  return [...m.values()].map((teile) => ({ teile, box: huelle(teile.map((l) => l.box)), gesperrt: teile.some((l) => l.gesperrt) }));
}

/**
 * Einheiten an der gemeinsamen Hülle ausrichten.
 * art: 'links' | 'mitte' | 'rechts' (waagrecht), 'oben' | 'mittig' | 'unten' (senkrecht).
 */
export function ausrichten(ebenen, art) {
  const es = einheiten(ebenen);
  const h = huelle(es.map((e) => e.box));
  for (const e of es) {
    if (e.gesperrt) continue;
    const b = e.box;
    const ziel = {
      links: [h.x - b.x, 0],
      mitte: [h.x + h.w / 2 - (b.x + b.w / 2), 0],
      rechts: [h.x + h.w - (b.x + b.w), 0],
      oben: [0, h.y - b.y],
      mittig: [0, h.y + h.h / 2 - (b.y + b.h / 2)],
      unten: [0, h.y + h.h - (b.y + b.h)],
    }[art];
    for (const l of e.teile) verschieben(l, Math.round(ziel[0]), Math.round(ziel[1]));
  }
}

/** Einheiten mit gleichen Abständen verteilen (achse 'x' oder 'y'); äußere bleiben stehen. */
export function verteilen(ebenen, achse) {
  const [pos, mass] = achse === 'x' ? ['x', 'w'] : ['y', 'h'];
  const es = einheiten(ebenen).sort((a, b) => a.box[pos] - b.box[pos]);
  if (es.length < 3) return;
  const erste = es[0].box;
  const letzte = es[es.length - 1].box;
  const belegt = es.reduce((s, e) => s + e.box[mass], 0);
  const luecke = (letzte[pos] + letzte[mass] - erste[pos] - belegt) / (es.length - 1);
  let p = erste[pos];
  for (const e of es) {
    if (!e.gesperrt) {
      const d = Math.round(p - e.box[pos]);
      for (const l of e.teile) verschieben(l, achse === 'x' ? d : 0, achse === 'y' ? d : 0);
    }
    p += e.box[mass] + luecke;
  }
}

/** Ebenen zu einer Gruppe verbinden; liefert die Kennung der Gruppe. */
export function gruppieren(ebenen) {
  const id = neueId('v');
  for (const l of ebenen) l.verbund = id;
  return id;
}

/** Gruppierung der Ebenen aufheben. */
export function gruppeAufheben(ebenen) {
  for (const l of ebenen) delete l.verbund;
}
