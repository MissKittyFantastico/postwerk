/**
 * Baukasten: Designelemente der mitgelieferten Bibliothek in eine Vorlage einfügen –
 * Symbole (88 × 12 Farbvarianten × mit/ohne Füllung), Logos, Badges, Textrollen der
 * Typo-Skala und wiederkehrende Bausteine aus den Vorlagen.
 */
import { el, pw, pruefe, dialog, dialogZu, neueId, medienUrl } from './kern.js';
import { aufbauen } from './darstellung.js';

let daten = null;

export async function baukastenLaden() {
  if (!daten) daten = pruefe(await pw.bibliothek.baukasten(), 'Der Baukasten konnte nicht geladen werden');
  return daten;
}

/** Helle Schrift auf dunklem Grund, dunkle auf hellem. */
function textfarbe(hintergrund) {
  const h = String(hintergrund || '#15205B').replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
  return 0.299 * r + 0.587 * g + 0.114 * b < 140 ? '#FBF3E8' : '#2A2517';
}

/** Box mittig in der Vorlage. */
function mittig(v, w, h) {
  return { x: Math.round((v.width - w) / 2), y: Math.round((v.height - h) / 2), w: Math.round(w), h: Math.round(h) };
}

/**
 * Dialog öffnen. einfuegen(ebene) legt die Ebene in der Vorlage an.
 * @param {object} v  aktuelle Vorlage
 * @param {(ebene: object) => void} einfuegen
 */
export async function baukastenOeffnen(v, einfuegen) {
  const b = await baukastenLaden();
  if (!b) return;
  const fertig = (ebene) => { dialogZu(); einfuegen(ebene); };
  const inhalt = el('div', { class: 'baukasten-inhalt' });
  const bereiche = {
    Symbole: () => symbole(b, v, fertig),
    'Logos & Badges': () => bilder(b, v, fertig),
    Textrollen: () => textrollen(b, v, fertig),
    Bausteine: () => bausteine(b, v, fertig),
  };
  const reiter = el('div', { class: 'reiter', role: 'tablist' });
  const zeige = (name) => {
    for (const k of reiter.children) k.setAttribute('aria-selected', String(k.textContent === name));
    inhalt.replaceChildren(bereiche[name]());
  };
  for (const name of Object.keys(bereiche)) reiter.append(el('button', { class: 'knopf klein', role: 'tab', text: name, onclick: () => zeige(name) }));
  dialog({ titel: 'Baukasten', unter: 'Designelemente aus dem Designset einfügen. Sie lassen sich danach wie jede Ebene verschieben, skalieren und bearbeiten.', breite: '920px', rumpf: el('div', {}, [reiter, inhalt]), knoepfe: [{ text: 'Schließen' }] });
  zeige('Symbole');
}

function symbole(b, v, fertig) {
  const s = b.symbole;
  const variante = el('select', { 'aria-label': 'Farbvariante' }, s.varianten.map((x) => el('option', { value: x.nr, text: `${x.nr} · ${x.name}` })));
  const fuellung = el('select', { 'aria-label': 'Füllung' }, [el('option', { value: 'mit', text: 'mit Füllung' }), el('option', { value: 'ohne', text: 'ohne Füllung' })]);
  const kategorie = el('select', { 'aria-label': 'Kategorie' }, [el('option', { value: '', text: 'Alle Kategorien' }), ...s.kategorien.map((k) => el('option', { value: k.name, text: k.name }))]);
  const suche = el('input', { type: 'text', placeholder: 'Bedeutung suchen, z. B. verschmust', 'aria-label': 'Symbole durchsuchen' });
  const raster = el('div', { class: 'baukasten-raster' });
  const zeichnen = () => {
    const w = suche.value;
    raster.replaceChildren();
    for (const k of s.kategorien) {
      if (kategorie.value && k.name !== kategorie.value) continue;
      for (const sym of k.symbole) {
        if (!symbolTrifft(sym, w)) continue;
        const medium = s.dateien[`${variante.value}|${fuellung.value}|${sym.id}`];
        if (!medium) continue;
        raster.append(el('button', {
          class: 'baukasten-teil', title: `${sym.id}: ${sym.bedeutung.join(', ')} (${k.name})`,
          onclick: () => fertig(symbolEbene(v, s, sym, variante.value, fuellung.value)),
        }, [el('img', { src: medienUrl(medium), alt: sym.id, loading: 'lazy' }), el('small', { text: sym.bedeutung[0] || sym.id })]));
      }
    }
    if (!raster.children.length) raster.append(el('p', { class: 'mikro', text: 'Kein Symbol gefunden.' }));
  };
  for (const e of [variante, fuellung, kategorie]) e.addEventListener('change', zeichnen);
  suche.addEventListener('input', zeichnen);
  zeichnen();
  return el('div', {}, [el('div', { class: 'reihe baukasten-filter' }, [variante, fuellung, kategorie, suche]), raster]);
}

function bilder(b, v, fertig) {
  const teil = (x, titel) => el('button', {
    class: 'baukasten-teil breit', title: titel,
    onclick: () => fertig(bildEbene(v, x, titel)),
  }, [el('img', { src: medienUrl(x.medium), alt: titel, loading: 'lazy' }), el('small', { text: titel })]);
  return el('div', {}, [
    el('h4', { class: 'mikro', text: 'Logos' }),
    el('div', { class: 'baukasten-raster' }, b.logos.map((x) => teil(x, logoTitel(x)))),
    el('h4', { class: 'mikro', text: 'Badges' }),
    el('div', { class: 'baukasten-raster' }, b.badges.map((x) => teil(x, badgeTitel(x)))),
  ]);
}

function textrollen(b, v, fertig) {
  return el('div', { class: 'baukasten-liste' }, b.textrollen.map((r) =>
    el('button', {
      class: 'knopf', style: 'display:block;width:100%;text-align:left;padding:10px 13px;margin-bottom:6px',
      onclick: () => fertig(textrollenEbene(v, r)),
    }, [textrollenMuster(r), el('small', { style: 'color:var(--mute)', text: `${r.family} ${r.weight} · ${r.size} px` })])
  ));
}

function bausteine(b, v, fertig) {
  return el('div', {}, [...bausteinGruppen(b)].map(([name, liste]) => el('div', {}, [
    el('h4', { class: 'mikro', text: `${name} (${liste.length})` }),
    el('div', { class: 'baukasten-raster' }, liste.map((x) => el('button', {
      class: 'baukasten-teil breit', title: 'Aus: ' + x.quelle,
      onclick: () => fertig(bausteinEbene(v, x)),
    }, [bausteinVorschau(x), el('small', { text: x.quelle })]))),
  ])));
}

/* --- Ebenen aus den Teilen des Baukastens (auch für die Handy-Fassung) --- */

/** Passt das Symbol zum Suchwort (Bedeutung oder Name, Groß-/Kleinschreibung egal)? Leer: ja. */
export function symbolTrifft(sym, suchwort) {
  const w = String(suchwort || '').trim().toLowerCase();
  return !w || sym.bedeutung.some((x) => x.toLowerCase().includes(w)) || sym.id.toLowerCase().includes(w);
}

export const logoTitel = (x) => 'Logo ' + x.name;
export const badgeTitel = (x) => `Badge ${x.name} (${x.stil})`;

/** Symbol in Farbvariante (Nummer) und Füllung ('mit' | 'ohne'), mittig, 220 px breit. */
export function symbolEbene(v, s, sym, variante, fuellung) {
  const breite = 220;
  const medium = s.dateien[`${variante}|${fuellung}|${sym.id}`];
  return { type: 'image', name: `Symbol ${sym.id}`, box: mittig(v, breite, (breite * s.hoehe) / s.breite), medium, symbol: sym.id, symbolVariante: variante + '|' + fuellung, fit: 'contain', editable: false };
}

/** Logo oder Badge, mittig, halbe Pixelbreite (höchstens halbe Vorlagenbreite). */
export function bildEbene(v, x, titel) {
  const breite = Math.min(x.breite / 2, v.width * 0.5);
  return { type: 'image', name: titel, box: mittig(v, breite, (breite * x.hoehe) / x.breite), medium: x.medium, fit: 'contain', editable: false };
}

/** Textfeld in einer Rolle der Typo-Skala, ausfüllbar, Farbe passend zum Hintergrund. */
export function textrollenEbene(v, r) {
  const zeile = r.lineHeight || Math.round(r.size * 1.2);
  const rand = 70;
  const id = 'e' + neueId('');
  return {
    type: 'text', name: r.rolle, box: { x: rand, y: Math.round(v.height * 0.45), w: v.width - 2 * rand, h: Math.round(zeile * 2) }, text: r.rolle,
    font: { family: r.family, size: r.size, weight: r.weight, lineHeight: zeile, letterSpacing: r.letterSpacing || 0, style: r.style === 'italic' ? 'italic' : 'normal', transform: 'none' },
    color: textfarbe(v.hintergrund), align: 'start', layout: { lines: 2, nowrap: false, verticalAlign: 'top', padding: { t: 0, r: 0, b: 0, l: 0 } }, editable: true, autoFit: false, slot: id, id,
  };
}

/** Name der Rolle in ihrer Schrift (verkleinert) – Muster in der Auswahl. */
export function textrollenMuster(r) {
  return el('b', { style: `display:block;font-family:"${r.family}";font-weight:${r.weight};font-size:${Math.min(r.size, 34) * 0.62}px`, text: r.rolle });
}

/** Baustein als neue, ausfüllbare Ebene mittig in der Vorlage. */
export function bausteinEbene(v, x) {
  const e = JSON.parse(JSON.stringify(x.ebene));
  e.box = mittig(v, e.box.w, e.box.h);
  e.id = 'e' + neueId('');
  e.slot = e.id;
  e.editable = true;
  return e;
}

/** Bausteine nach Namen gruppiert (Map Name → Liste). */
export function bausteinGruppen(b) {
  const gruppen = new Map();
  for (const x of b.bausteine) {
    if (!gruppen.has(x.name)) gruppen.set(x.name, []);
    gruppen.get(x.name).push(x);
  }
  return gruppen;
}

/** Verkleinerte Vorschau eines Bausteins (höchstens 240 × 90 px). */
export function bausteinVorschau(x) {
  const l = x.ebene;
  const skala = Math.min(1, 240 / l.box.w, 90 / l.box.h);
  const rahmen = el('div', { class: 'baustein-buehne', style: `width:${Math.round(l.box.w * skala)}px;height:${Math.round(l.box.h * skala)}px` });
  const innen = el('div', { style: `transform:scale(${skala});transform-origin:0 0;width:${l.box.w}px;height:${l.box.h}px` });
  rahmen.append(innen);
  aufbauen(innen, { width: l.box.w, height: l.box.h, hintergrund: 'transparent', layers: [l] }, {}, { medienUrl, platzhalter: false, beispielfotos: false });
  return rahmen;
}
