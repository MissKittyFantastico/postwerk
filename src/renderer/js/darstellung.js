/**
 * Darstellungs-Engine.
 *
 * Baut eine Vorlage als HTML/CSS auf – mit denselben Mitteln, mit denen die
 * Original-Designs im Browser entstanden sind. Vorschau im Studio, Bild-Export,
 * Prüflauf und Markenregel-Prüfung verwenden ausschließlich diese Datei. Was auf
 * der Bühne steht, steht deshalb auch in der Datei.
 *
 * Datenmodell (postwerk-vorlage/2, Feldnamen aus Schema ahe-social-template/1.3):
 *   vorlage = { width, height, hintergrund, kachelbereich?, layers: [ebene …] }
 *   ebene   = { id, type: 'text'|'image'|'shape', box:{x,y,w,h}, drehung, opacity, versteckt, … }
 *   inhalt  = { texte: { [ebenenId]: Text }, fotos: { [gruppe]: { medium, position:[x,y], zoom } } }
 */

import { istGrafik } from '../../gemeinsam/ebenen.js';

const ART_VERT = { center: 'center', middle: 'center', top: 'flex-start', start: 'flex-start', bottom: 'flex-end', end: 'flex-end' };

/** Farbe aus Vorlage in CSS: '#RRGGBB' oder { hex, alpha }. */
function cssFarbe(c) {
  if (!c) return 'transparent';
  if (typeof c === 'string') return c;
  const n = parseInt(String(c.hex).slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${c.alpha == null ? 1 : c.alpha})`;
}

function rahmenCss(b) {
  if (!b) return '';
  if (b.widths) {
    return `border-style:${b.style || 'solid'};border-color:${cssFarbe(b.color)};border-width:${b.widths.map((x) => x + 'px').join(' ')};`;
  }
  return `border:${b.width}px ${b.style || 'solid'} ${cssFarbe(b.color)};`;
}

const boxCss = (b) => `position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;box-sizing:border-box;`;
/** Drehung um die eigene Mitte oder um einen gemeinsamen Drehpunkt (Gruppendrehung). */
const drehCss = (l, k = l.box) => {
  if (!l.drehung) return '';
  const p = l.drehpunkt;
  return `transform:rotate(${l.drehung}deg);transform-origin:${p ? `${p.x - k.x}px ${p.y - k.y}px` : 'center'};`;
};
const deckCss = (l) => (l.opacity != null && l.opacity !== 1 ? `opacity:${l.opacity};` : '');

/** Position als CSS-Wert: [x, y] in Prozent oder bereits als Zeichenfolge. */
export function positionCss(p) {
  if (!p) return '50% 50%';
  if (Array.isArray(p)) return `${p[0]}% ${p[1]}%`;
  return String(p);
}

/** Welches Foto zeigt eine Bildebene? */
export function fotoFuer(l, inhalt, opt) {
  if (istGrafik(l)) return l.medium ? { medium: l.medium, fest: true } : null;
  const g = (inhalt && inhalt.fotos && inhalt.fotos[l.gruppe || l.id]) || null;
  if (g && g.medium) return { medium: g.medium, position: g.position, zoom: g.zoom || 1 };
  if (opt.beispielfotos && l.beispiel) return { medium: l.beispiel, beispiel: true };
  return null;
}

/** Text einer Ebene: Inhalt des Entwurfs vor Standardtext der Vorlage. */
export function textFuer(l, inhalt) {
  const t = inhalt && inhalt.texte && inhalt.texte[l.id];
  return t != null ? String(t) : String(l.text || '');
}

function textEbene(l, inhalt) {
  const f = l.font || {};
  const lay = l.layout || {};
  const p = lay.padding || {};
  const e = document.createElement('div');
  e.style.cssText =
    boxCss(l.box) + deckCss(l) +
    `display:flex;flex-direction:column;justify-content:${ART_VERT[lay.verticalAlign] || 'center'};` +
    `padding:${p.t || 0}px ${p.r || 0}px ${p.b || 0}px ${p.l || 0}px;` +
    `background-color:${cssFarbe(l.background)};` + (l.gradient ? `background-image:${l.gradient};` : '') +
    rahmenCss(l.border) +
    (l.borderRadius ? `border-radius:${l.borderRadius}px;` : '') +
    (l.boxShadow ? `box-shadow:${l.boxShadow};` : '') +
    (l.backdropFilter ? `backdrop-filter:${l.backdropFilter};` : '') +
    (l.textShadow ? `text-shadow:${l.textShadow};` : '') +
    drehCss(l);
  const t = document.createElement('div');
  t.className = 'pw-text';
  t.textContent = textFuer(l, inhalt);
  t.style.cssText = textStil(l, f.size);
  // Das Messskript des Designsets rundet Breiten auf ganze Pixel; die echte Zeilenbreite
  // lag bis zu 0,5 px darüber. Ausgleich, damit knapp passende Zeilen wie im Original umbrechen.
  if (!lay.nowrap) t.style.marginRight = '-0.5px';
  e.append(t);
  return e;
}

function textStil(l, groesse) {
  const f = l.font || {};
  const lay = l.layout || {};
  const align = l.align === 'right' || l.align === 'end' ? 'right' : l.align === 'center' ? 'center' : 'left';
  const lh = f.lineHeight === 'normal' || f.lineHeight == null ? 'normal' : f.lineHeight + 'px';
  return (
    `font-family:"${f.family || 'Nunito Sans'}",sans-serif;font-size:${groesse}px;font-weight:${f.weight || 400};` +
    `font-style:${f.style || 'normal'};line-height:${lh};letter-spacing:${f.letterSpacing || 0}px;` +
    `text-transform:${f.transform || 'none'};color:${cssFarbe(l.color)};text-align:${align};` +
    `white-space:${lay.nowrap ? 'pre' : 'pre-wrap'};overflow-wrap:normal;word-break:normal;` +
    // Die Original-Designs setzen umbrechende Texte mit text-wrap:pretty (1.419 Stellen,
    // fehlt in den JSON-Dateien). Vermeidet zugleich Einzelwörter in der letzten Zeile.
    (lay.nowrap ? '' : `text-wrap-style:${lay.textWrap || 'pretty'};`)
  );
}

function bildEbene(l, inhalt, opt, warten) {
  const k = l.clip || l.box;
  const w = document.createElement('div');
  w.style.cssText =
    boxCss(k) + deckCss(l) + 'overflow:hidden;' +
    (l.borderRadius && !l.clip ? `border-radius:${l.borderRadius}px;` : '') +
    (l.form === 'ellipse' ? 'border-radius:50%;' : '') +
    drehCss(l, k);

  const foto = fotoFuer(l, inhalt, opt);
  const innen = `position:absolute;left:${l.box.x - k.x}px;top:${l.box.y - k.y}px;width:${l.box.w}px;height:${l.box.h}px;`;

  if (!foto) {
    if (!opt.platzhalter) return w;
    const ph = document.createElement('div');
    ph.className = 'pw-platzhalter';
    ph.style.cssText = innen + 'display:flex;align-items:center;justify-content:center;background:#2A2F39;' +
      'border:3px dashed #5A6272;color:#AEB4C0;font:600 30px "Nunito Sans",sans-serif;text-align:center;';
    ph.textContent = istGrafik(l) ? `Grafik fehlt: ${l.name || 'Grafik'}` : (l.name || 'Foto') + ' einsetzen';
    w.append(ph);
    return w;
  }

  const img = document.createElement('img');
  img.alt = '';
  img.draggable = false;
  img.src = opt.medienUrl(foto.medium);
  const skalen = [];
  if (l.skalierung && l.skalierung !== 1) skalen.push(`scale(${l.skalierung})`);
  const zoom = foto.zoom && foto.zoom !== 1 ? foto.zoom : 1;
  const pos = positionCss(foto.position || l.position);
  if (zoom !== 1) skalen.push(`scale(${zoom})`);
  img.style.cssText =
    innen +
    `object-fit:${l.fit || 'cover'};object-position:${pos};` +
    (l.filter ? `filter:${l.filter};` : '') +
    (skalen.length ? `transform:${skalen.join(' ')};transform-origin:${zoom !== 1 ? pos : 'center'};` : '') +
    (l.borderRadius && l.clip ? `border-radius:${l.borderRadius}px;` : '');
  // Höchstens 10 s je Bild warten; ein nicht geladenes Bild meldet die Markenprüfung.
  warten.push(Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 10000))]));
  w.append(img);
  return w;
}

function flaechenEbene(l) {
  const e = document.createElement('div');
  e.style.cssText =
    boxCss(l.box) + deckCss(l) +
    `background-color:${cssFarbe(l.fill)};` + (l.gradient ? `background-image:${l.gradient};` : '') +
    rahmenCss(l.border) +
    (l.form === 'ellipse' ? 'border-radius:50%;' : l.borderRadius ? `border-radius:${l.borderRadius}px;` : '') +
    (l.boxShadow ? `box-shadow:${l.boxShadow};` : '') +
    (l.backdropFilter ? `backdrop-filter:${l.backdropFilter};` : '') +
    drehCss(l);
  return e;
}

/**
 * Vorlage in ein Zielelement aufbauen.
 * @param {HTMLElement} ziel
 * @param {object} vorlage
 * @param {object} inhalt
 * @param {object} opt  { medienUrl(name), platzhalter, beispielfotos, mindestschrift }
 * @returns {{ wurzel: HTMLElement, elemente: Map<string, HTMLElement>, fertig: Promise<void> }}
 */
export function aufbauen(ziel, vorlage, inhalt = {}, opt = {}) {
  opt = Object.assign({ platzhalter: true, beispielfotos: false, mindestschrift: 26 }, opt);
  const wurzel = document.createElement('div');
  wurzel.className = 'pw-buehne';
  // all:initial schirmt die Gestaltung gegen die Stile der Anwendung ab.
  wurzel.style.cssText =
    `all:initial;display:block;position:relative;overflow:hidden;width:${vorlage.width}px;height:${vorlage.height}px;` +
    `background:${cssFarbe(vorlage.hintergrund || '#FFFFFF')};`;

  let traeger = wurzel;
  let versatz = { x: 0, y: 0 };
  if (vorlage.kachelbereich) {
    const t = vorlage.kachelbereich;
    traeger = document.createElement('div');
    traeger.style.cssText = boxCss(t) + 'overflow:hidden;';
    wurzel.append(traeger);
    versatz = { x: t.x, y: t.y };
  }

  const elemente = new Map();
  const warten = [];
  for (const roh of vorlage.layers || []) {
    if (roh.versteckt) continue;
    const l = versatz.x || versatz.y ? verschieben(roh, versatz) : roh;
    let e;
    if (l.type === 'text') e = textEbene(l, inhalt);
    else if (l.type === 'image') e = bildEbene(l, inhalt, opt, warten);
    else if (l.type === 'shape') e = flaechenEbene(l);
    else continue;
    e.dataset.ebene = roh.id;
    elemente.set(roh.id, e);
    traeger.append(e);
  }

  ziel.replaceChildren(wurzel);
  const fertig = (async () => {
    await Promise.all(warten);
    if (document.fonts) await document.fonts.ready;
    mitwachsen(vorlage, elemente, wurzel, vorlage.kachelbereich ? vorlage.kachelbereich.w : vorlage.width);
    einpassen(vorlage, elemente, opt.mindestschrift);
  })();
  return { wurzel, elemente, fertig };
}

function verschieben(l, v) {
  const k = Object.assign({}, l, { box: { x: l.box.x - v.x, y: l.box.y - v.y, w: l.box.w, h: l.box.h } });
  if (l.clip) k.clip = { x: l.clip.x - v.x, y: l.clip.y - v.y, w: l.clip.w, h: l.clip.h };
  if (l.drehpunkt) k.drehpunkt = { x: l.drehpunkt.x - v.x, y: l.drehpunkt.y - v.y };
  return k;
}

/**
 * Wächst die Breite der Ebene mit dem Text? Schilder und Buttons (einzeilig, mit Hintergrund,
 * ausfüllbar) tun es von sich aus; „mitwachsen“ an der Ebene schaltet es ausdrücklich an oder aus.
 */
export function waechstMit(l) {
  if (l.type !== 'text' || !l.layout || !l.layout.nowrap) return false;
  return l.mitwachsen != null ? Boolean(l.mitwachsen) : Boolean(l.background && l.editable !== false);
}

/**
 * Schilder und Buttons an einen geänderten Text anpassen: Die Breite ändert sich um den
 * gemessenen Unterschied zwischen eingegebenem und Standardtext, die Innenabstände des
 * Designs bleiben. Verankert nach der Ausrichtung (links, Mitte, rechts) und höchstens bis
 * zum Rand der Fläche. Mit dem Standardtext bleibt die Ebene unverändert (1:1).
 */
function mitwachsen(vorlage, elemente, wurzel, breite) {
  const skala = wurzel.getBoundingClientRect().width / (vorlage.width || 1) || 1;
  for (const l of vorlage.layers || []) {
    if (!waechstMit(l)) continue;
    const e = elemente.get(l.id);
    if (!e) continue;
    const t = e.firstChild;
    const text = t.textContent;
    const standard = String(l.text || '');
    if (text === standard) continue;
    // Gemessen ohne Drehung, in Pixeln der Vorlage
    const drehung = e.style.transform;
    if (drehung) e.style.transform = 'none';
    t.style.width = 'max-content';
    const neuBreit = t.getBoundingClientRect().width / skala;
    t.textContent = standard;
    const altBreit = t.getBoundingClientRect().width / skala;
    t.textContent = text;
    t.style.width = '';
    if (drehung) e.style.transform = drehung;

    const x = parseFloat(e.style.left);
    const w = parseFloat(e.style.width);
    const p = l.layout.padding || {};
    const anker = l.align === 'right' || l.align === 'end' ? 'rechts' : l.align === 'center' ? 'mitte' : 'links';
    const { links: grenzeL, rechts: grenzeR } = nachbargrenzen(e, elemente, breite);
    const platz = anker === 'links' ? grenzeR - x : anker === 'rechts' ? x + w - grenzeL : 2 * Math.min(x + w / 2 - grenzeL, grenzeR - x - w / 2);
    const neu = Math.round(Math.min(Math.max(w + neuBreit - altBreit, (p.l || 0) + (p.r || 0) + 8), Math.max(w, platz)));
    const links = anker === 'links' ? x : anker === 'rechts' ? x + w - neu : x + (w - neu) / 2;
    e.style.left = links + 'px';
    e.style.width = neu + 'px';
  }
}

/** Abstand, den ein mitwachsendes Schild höchstens zu seinem Nachbarn hält (sonst der des Designs). */
const NACHBARABSTAND = 16;

/**
 * Wie weit darf eine Ebene wachsen? Bis zum Rand der Fläche oder bis kurz vor die nächste
 * Ebene derselben Zeile, die ganz links bzw. rechts daneben liegt. Ebenen, die das Schild
 * überlappen (Hintergründe, Fotos), begrenzen nicht.
 */
function nachbargrenzen(e, elemente, breite) {
  const box = (n) => ({ x: parseFloat(n.style.left), y: parseFloat(n.style.top), w: parseFloat(n.style.width), h: parseFloat(n.style.height) });
  const s = box(e);
  let links = 0;
  let rechts = breite;
  for (const n of elemente.values()) {
    if (n === e || n.parentElement !== e.parentElement) continue;
    const b = box(n);
    if (!(b.y < s.y + s.h && b.y + b.h > s.y)) continue;
    if (b.x >= s.x + s.w) rechts = Math.min(rechts, b.x - Math.min(b.x - (s.x + s.w), NACHBARABSTAND));
    else if (b.x + b.w <= s.x) links = Math.max(links, b.x + b.w + Math.min(s.x - (b.x + b.w), NACHBARABSTAND));
  }
  return { links, rechts };
}

/**
 * Automatische Verkleinerung für Ebenen mit autoFit. Ebenen aus dem Designset
 * tragen autoFit:false und bleiben unverändert (1:1). Untergrenze ist die
 * Mindestschrift des Markensets.
 */
function einpassen(vorlage, elemente, mindestschrift) {
  for (const l of vorlage.layers || []) {
    if (l.type !== 'text' || !l.autoFit) continue;
    const e = elemente.get(l.id);
    if (!e) continue;
    const t = e.firstChild;
    let g = (l.font && l.font.size) || 40;
    const min = Math.min(g, Math.max(mindestschrift, Math.round(g * 0.45)));
    while (g > min && ueberlauf(e, t)) {
      g = Math.max(min, g - Math.max(1, Math.round(g * 0.04)));
      t.style.fontSize = g + 'px';
    }
  }
}

const zuBreit = (e, t) => t.scrollWidth > e.clientWidth - innenAbstand(e, 'x') + 1;

function ueberlauf(e, t) {
  return zuBreit(e, t) || t.scrollHeight > e.clientHeight - innenAbstand(e, 'y') + 1;
}

function innenAbstand(e, achse) {
  const s = e.style;
  return achse === 'x'
    ? (parseFloat(s.paddingLeft) || 0) + (parseFloat(s.paddingRight) || 0)
    : (parseFloat(s.paddingTop) || 0) + (parseFloat(s.paddingBottom) || 0);
}

/**
 * Textsatz im fertigen Dokument messen (nicht aus der Struktur ableiten):
 * Zeilen, tatsächliche Schriftgröße, Überlauf über den Rahmen.
 */
export function textMessen(element) {
  const t = element.firstChild;
  if (!t) return null;
  // Drehung für die Messung aufheben (wie das Messskript des Designsets): In einer
  // gedrehten Zeile liegen die Wörter sonst auf verschiedenen Höhen.
  const drehung = element.style.transform;
  if (drehung) element.style.transform = 'none';
  const r = document.createRange();
  r.selectNodeContents(t);
  const oben = new Set();
  const rects = [...r.getClientRects()].filter((x) => x.width > 0.5);
  const skala = element.getBoundingClientRect().width / (element.offsetWidth || 1) || 1;
  for (const x of rects) oben.add(Math.round(x.top / (4 * skala)));
  if (drehung) element.style.transform = drehung;
  return {
    zeilen: t.textContent.trim() ? oben.size : 0,
    groesse: parseFloat(t.style.fontSize) || 0,
    ueberlauf: ueberlauf(element, t),
    // Nur die Breite: Die Rahmen des Designsets liegen eng um die Buchstaben, die Zeilenhöhe
    // ragt oft ein paar Pixel darüber hinaus – das ist kein zu langer Text.
    zuBreit: zuBreit(element, t),
  };
}
