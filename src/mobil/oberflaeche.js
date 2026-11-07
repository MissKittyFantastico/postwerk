/**
 * Oberfläche der Handy-Fassung: Vorlagen finden, Entwurf füllen (Texte, Fotos mit Ausschnitt),
 * Format, Fotostil und Seite wechseln, Layout per Finger ändern, Symbole und Elemente aus dem
 * Baukasten einfügen, austauschen und löschen, Bild sichern und teilen.
 *
 * Die Logik stammt aus den Modulen der Anwendung – hier steht nur die Bedienung für Finger:
 *   satz.js (Fassungen, Seiten, Übertragen), entwurf.js (Sichern, Widerrufen), darstellung.js,
 *   ausschnitt.js (Bildausschnitt), einrasten.js, anordnen.js (Ziehen, Größe), feldhinweis.js,
 *   anlaesse.js (Kacheln), baukasten.js (Elemente der Bibliothek), bildausgabe.js (Bild im Browser).
 */
import { starten } from './start.js';
import { schriftenEinrichten } from './schriften.js';
import { bildErzeugen } from './bildausgabe.js';
import { THEMEN, einordnen } from '../gemeinsam/anlaesse.js';
import { FORMATE, formatSchluessel } from '../gemeinsam/formate.js';
import { istFotofeld, istGrafik } from '../gemeinsam/ebenen.js';
import { ausschnittVerschieben, ausschnittAnwenden } from '../renderer/js/ausschnitt.js';
import { fanglinien, einrasten } from '../renderer/js/einrasten.js';
import { feldHinweis } from '../renderer/js/feldhinweis.js';
import { vergleichen, bewerten } from './vergleich.js';

let K; let E; let S; let D; let A; let B; // kern, entwurf, satz, darstellung, anordnen, baukasten
const $ = (s, w = document) => w.querySelector(s);
/** Kinder setzen; leere Einträge (null, false) entfallen statt als Text „null“ zu erscheinen. */
const setzen = (ziel, ...kinder) => ziel.replaceChildren(...kinder.flat().filter((k) => k != null && k !== false));
const pw = () => window.postwerk;
const FANG_FINGER = 10; // Bildschirmpixel, ab denen eine Kante einrastet (Finger: etwas großzügiger als die Maus)
const FOTO_MAX = 2400; // längste Kante eigener Fotos in Pixeln (Ausgabe 1080 breit)
const kurzFormat = { ig_portrait: '4:5', story: 'Story', ig_raster: '3:4', quadrat: '1:1', fb_quer: 'Facebook' };

const ansicht = { bereich: 'vorlagen', kachel: null, variante: '' };

/* ------------------------------------------------------------------ */
/* Kopf, Navigation                                                     */
/* ------------------------------------------------------------------ */

function kopf({ titel, unter = '', zurueck = null, verlauf = false }) {
  setzen($('#titel'), K.el('span', { text: titel }), unter ? K.el('small', { text: unter }) : null);
  const z = $('#zurueck');
  z.hidden = !zurueck;
  z.onclick = zurueck;
  $('#widerrufen').hidden = !verlauf;
  $('#wiederholen').hidden = !verlauf;
  if (!verlauf) K.speicherstatus('', '');
  verlaufKnoepfe();
}

function verlaufKnoepfe() {
  $('#widerrufen').disabled = !E.kannWiderrufen();
  $('#wiederholen').disabled = !E.kannWiederholen();
}

function zeigen(bereich) {
  ansicht.bereich = bereich;
  for (const b of document.querySelectorAll('#navigation button')) b.setAttribute('aria-current', String(b.dataset.ziel === bereich));
  $('#navigation').hidden = bereich === 'studio';
  $('#ansicht').scrollTop = 0;
  if (bereich === 'vorlagen') vorlagenZeichnen();
  else if (bereich === 'entwuerfe') entwuerfeZeichnen();
  else if (bereich === 'info') infoZeichnen();
  else if (bereich === 'studio') studioZeichnen();
}

/* ------------------------------------------------------------------ */
/* Miniaturen (live gesetzt, erst wenn sichtbar)                       */
/* ------------------------------------------------------------------ */

const beobachter = new IntersectionObserver((eintraege) => {
  for (const x of eintraege) {
    if (!x.isIntersecting) continue;
    beobachter.unobserve(x.target);
    x.target.zeichnen();
  }
}, { rootMargin: '400px' });

function miniatur(vorlage, inhalt, breite) {
  const s = breite / vorlage.width;
  const rahmen = K.el('div', { class: 'miniatur', style: `width:${breite}px;height:${Math.round(vorlage.height * s)}px` });
  rahmen.zeichnen = () => {
    const ziel = K.el('div', { style: `width:${vorlage.width}px;height:${vorlage.height}px;transform:scale(${s})` });
    rahmen.append(ziel);
    D.aufbauen(ziel, vorlage, inhalt || {}, { medienUrl: K.medienUrl, platzhalter: true });
  };
  beobachter.observe(rahmen);
  return rahmen;
}

/* ------------------------------------------------------------------ */
/* Vorlagen: Anlässe → Designs                                         */
/* ------------------------------------------------------------------ */

const seiteVon = (v) => (v.karussell && v.karussell.seite) || 1;
const STILE = ['Vollbild', 'Mittel', 'Blur-Fill'];

/** Ein Design je Satz (alle Formate, Fotostile, Seiten); gezeigt wird Seite 1, 4:5, Vollbild. */
function designs() {
  const saetze = new Map();
  for (const v of K.zustand.vorlagen) {
    if (v.archiviert) continue;
    const k = S.satzSchluessel(v);
    if (!saetze.has(k)) saetze.set(k, []);
    saetze.get(k).push(v);
  }
  const rang = (v) => (formatSchluessel(v) === 'ig_portrait' ? 0 : 1000) + seiteVon(v) * 10 + STILE.indexOf(v.fotostil);
  return [...saetze.values()].map((liste) => {
    const vertreter = liste.slice().sort((a, b) => rang(a) - rang(b))[0];
    return { liste, vertreter, einordnung: einordnen(vertreter), seiten: new Set(liste.map(seiteVon)).size, formate: [...new Set(liste.map(formatSchluessel))] };
  });
}

const designName = (v) => String(v.name || v.id).split(' · ').filter((t) => !STILE.includes(t)).join(' · ');

function designKarte(d) {
  const unter = [d.formate.map((f) => kurzFormat[f] || f).join(' · '), d.seiten > 1 ? `${d.seiten} Seiten` : ''].filter(Boolean).join(' · ');
  return K.el('button', { class: 'karte', onclick: () => neuerEntwurf(d.vertreter) }, [
    K.el('div', { class: 'bild' }, [miniatur(d.vertreter, {}, 130)]),
    K.el('b', { text: designName(d.vertreter) }),
    K.el('small', { text: unter }),
  ]);
}

function vorlagenZeichnen() {
  const alle = designs();
  const main = $('#ansicht');
  if (!ansicht.kachel) {
    kopf({ titel: 'Vorlagen', unter: `${K.zustand.vorlagen.length} Vorlagen · ${alle.length} Designs` });
    const bloecke = [];
    for (const t of THEMEN) {
      const kacheln = t.kacheln.map((k) => ({ k, liste: alle.filter((d) => d.einordnung.kachel === k.name) })).filter((x) => x.liste.length);
      if (!kacheln.length) continue;
      bloecke.push(K.el('h2', { class: 'mikro', text: t.name }), K.el('div', { class: 'raster' }, kacheln.map(({ k, liste }) =>
        K.el('button', { class: 'karte', onclick: () => { ansicht.kachel = k.name; ansicht.variante = ''; vorlagenZeichnen(); $('#ansicht').scrollTop = 0; } }, [
          K.el('div', { class: 'bild' }, [miniatur(liste[0].vertreter, {}, 130)]),
          K.el('b', { text: k.name }),
          K.el('small', { text: `${liste.length} ${liste.length === 1 ? 'Design' : 'Designs'}` }),
        ]))));
    }
    const weitere = alle.filter((d) => !THEMEN.some((t) => t.name === d.einordnung.thema));
    if (weitere.length) bloecke.push(K.el('h2', { class: 'mikro', text: 'Weitere' }), K.el('div', { class: 'raster' }, weitere.map(designKarte)));
    setzen(main, ...bloecke);
    return;
  }
  const liste = alle.filter((d) => d.einordnung.kachel === ansicht.kachel);
  const varianten = [...new Set(liste.map((d) => d.einordnung.variante).filter(Boolean))].sort();
  const gezeigt = liste.filter((d) => !ansicht.variante || d.einordnung.variante === ansicht.variante);
  kopf({ titel: ansicht.kachel, unter: `${gezeigt.length} Designs`, zurueck: () => { ansicht.kachel = null; vorlagenZeichnen(); } });
  setzen(main, 
    varianten.length > 1 ? K.el('div', { class: 'chips' }, [['', 'Alle'], ...varianten.map((v) => [v, v])].map(([wert, text]) =>
      K.el('button', { class: 'chip', 'aria-pressed': String(ansicht.variante === wert), text, onclick: () => { ansicht.variante = wert; vorlagenZeichnen(); } }))) : null,
    K.el('div', { class: 'raster' }, gezeigt.map(designKarte)),
  );
}

/* ------------------------------------------------------------------ */
/* Entwürfe                                                            */
/* ------------------------------------------------------------------ */

async function entwuerfeZeichnen() {
  kopf({ titel: 'Entwürfe' });
  const main = $('#ansicht');
  const r = await pw().entwuerfe.liste();
  const liste = r.ok ? r.daten : [];
  if (!liste.length) {
    setzen(main, K.el('div', { class: 'leer' }, [K.el('p', { text: 'Noch keine Entwürfe.' }), K.el('p', { text: 'Unter „Vorlagen“ ein Design antippen – sobald Sie etwas ändern, wird es hier als Entwurf gesichert.' })]));
    return;
  }
  setzen(main, K.el('div', { class: 'raster' }, liste.map((e) => K.el('div', { class: 'karte' }, [
    K.el('button', { class: 'bild', style: 'border:0', onclick: () => entwurfOeffnen(e.id), 'aria-label': `${e.name} öffnen` }, [miniatur(e.vorlage, e.inhalt, 130)]),
    K.el('b', { text: e.name }),
    K.el('small', { text: K.relativ(e.updatedAt) }),
    K.el('div', { class: 'zeilen', style: 'padding:0 6px 8px' }, [
      K.el('button', { class: 'knopf klein', text: 'Öffnen', onclick: () => entwurfOeffnen(e.id) }),
      K.el('button', { class: 'knopf klein still gefahr', text: 'Löschen', onclick: () => entwurfLoeschen(e) }),
    ]),
  ]))));
}

async function entwurfLoeschen(e) {
  const wahl = await K.frage({ titel: 'Entwurf löschen?', text: `„${e.name}“ wird von diesem Handy entfernt. Die Vorlage bleibt.`, knoepfe: [{ text: 'Abbrechen', wert: null }, { text: 'Löschen', wert: true, art: 'haupt' }] });
  if (!wahl) return;
  K.pruefe(await pw().entwuerfe.loeschen(e.id), 'Löschen hat nicht funktioniert');
  entwuerfeZeichnen();
}

async function entwurfOeffnen(id) {
  const e = K.pruefe(await pw().entwuerfe.holen(id), 'Entwurf konnte nicht geladen werden');
  if (!e) return;
  studioStarten(S.vorbereiten(e));
}

function neuerEntwurf(vorlage) {
  studioStarten(E.ausVorlage(vorlage));
}

/* ------------------------------------------------------------------ */
/* Studio                                                              */
/* ------------------------------------------------------------------ */

const st = { reiter: 'texte', auswahl: null, wahl: null, letzteVariante: null, aufbau: null, skala: 1, buehne: null, inhalt: null, griffe: null, panel: null, rueck: null, zeichnenGeplant: false };

function studioStarten(e) {
  K.zustand.entwurf = e;
  E.verlaufStarten(e);
  st.reiter = 'texte';
  st.auswahl = null;
  st.wahl = null;
  st.rueck = ansicht.bereich === 'studio' ? st.rueck : ansicht.bereich;
  history.pushState({ studio: true }, '');
  zeigen('studio');
}

async function studioVerlassen() {
  if (!(await E.vorWechsel())) return false;
  K.zustand.entwurf = null;
  zeigen(st.rueck || 'vorlagen');
  return true;
}

function studioZeichnen() {
  const e = K.zustand.entwurf;
  if (!e) return zeigen('vorlagen');
  const w = S.wahl(e);
  const a = S.achsen(e);
  kopf({
    titel: designName(e.vorlage),
    unter: [FORMATE[w.formatKey] ? FORMATE[w.formatKey].label : '', w.fotostil, a.seiten.length > 1 ? `Seite ${e.seite} von ${a.seiten.length}` : ''].filter(Boolean).join(' · '),
    zurueck: () => history.back(),
    verlauf: true,
  });
  st.buehne = K.el('div', { class: 'buehne' });
  st.inhalt = K.el('div', { class: 'inhalt' });
  st.griffe = K.el('div', { class: 'griffe' });
  st.buehne.append(st.inhalt, st.griffe);
  st.buehne.addEventListener('pointerdown', buehnenZeiger);
  st.panel = K.el('div');
  const chipReihe = (werte, aktiv, text, nach) => (werte.length > 1 ? K.el('div', { class: 'chips' }, werte.map((x) =>
    K.el('button', { class: 'chip', 'aria-pressed': String(x === aktiv), text: text(x), onclick: () => wechseln(nach(x)) }))) : null);
  setzen($('#ansicht'), 
    K.el('div', { class: 'buehnenrahmen' }, [st.buehne]),
    chipReihe(a.formate, w.formatKey, (f) => kurzFormat[f] || f, (f) => ({ ...w, seite: e.seite, formatKey: f })),
    chipReihe(a.fotostile, w.fotostil, (s) => s, (s) => ({ ...w, seite: e.seite, fotostil: s })),
    chipReihe(a.seiten, e.seite, (n) => `Seite ${n}`, (n) => ({ ...w, seite: n })),
    K.el('div', { class: 'reiter', role: 'tablist' }, [['texte', 'Texte'], ['fotos', 'Fotos'], ['layout', 'Layout'], ['sichern', 'Bild']].map(([k, t]) =>
      K.el('button', { role: 'tab', 'aria-selected': String(st.reiter === k), text: t, onclick: () => { st.reiter = k; st.auswahl = null; st.wahl = null; studioZeichnen(); } }))),
    st.panel,
  );
  buehneAufbauen();
  panelZeichnen();
}

function wechseln(w) {
  const e = K.zustand.entwurf;
  if (!S.wechseln(e, w)) return;
  st.auswahl = null;
  st.wahl = null;
  E.geaendert();
  studioZeichnen();
}

/** Bühne neu setzen (nach Text-, Foto-, Layout- und Fassungswechsel). */
function buehneAufbauen() {
  const e = K.zustand.entwurf;
  const v = e.vorlage;
  const breite = $('#ansicht').clientWidth;
  const s = Math.min(breite / v.width, (window.innerHeight * 0.52) / v.height);
  st.skala = s;
  Object.assign(st.buehne.style, { width: Math.round(v.width * s) + 'px', height: Math.round(v.height * s) + 'px' });
  Object.assign(st.inhalt.style, { width: v.width + 'px', height: v.height + 'px', transform: `scale(${s})` });
  st.inhalt.replaceChildren();
  st.aufbau = D.aufbauen(st.inhalt, v, e.inhalt, { medienUrl: K.medienUrl, platzhalter: true });
  griffeZeichnen();
  st.aufbau.fertig.then(() => hinweiseAktualisieren());
}

/** Neu setzen höchstens einmal je Bildschirmbild (beim Ziehen und Tippen). */
function neuZeichnen() {
  if (st.zeichnenGeplant) return;
  st.zeichnenGeplant = true;
  requestAnimationFrame(() => { st.zeichnenGeplant = false; if (K.zustand.entwurf && st.buehne) buehneAufbauen(); });
}

function griffeZeichnen(fang = null) {
  const e = K.zustand.entwurf;
  st.griffe.replaceChildren();
  const s = st.skala;
  const ebenen = gewaehlteEbenen();
  if (ebenen.length) {
    const b = A.huelle(ebenen.map((l) => l.box));
    const g = K.el('div', { class: 'griff', style: `left:${b.x * s}px;top:${b.y * s}px;width:${b.w * s}px;height:${b.h * s}px` });
    if (st.reiter === 'layout' && ebenen.length === 1 && !ebenen[0].gesperrt) g.append(K.el('i', { 'data-ecke': 'se', 'aria-label': 'Größe ändern' }));
    st.griffe.append(g);
  }
  if (fang) {
    for (const x of fang.x) st.griffe.append(K.el('div', { class: 'fangx', style: `left:${x * s}px` }));
    for (const y of fang.y) st.griffe.append(K.el('div', { class: 'fangy', style: `top:${y * s}px` }));
  }
  if (!e) return;
}

/** Ebene wählen (oder keine). Eine offene Auswahl zum Austauschen gehört zur alten Ebene und schließt. */
function auswaehlen(id) {
  st.auswahl = id;
  if (st.wahl && st.wahl.tauschen) st.wahl = null;
  griffeZeichnen();
  panelZeichnen();
}

/** Gewählte Ebenen: im Layout die Ebene samt Verbund, bei Fotos die Bildebenen der Gruppe. */
function gewaehlteEbenen() {
  const e = K.zustand.entwurf;
  if (!e || !st.auswahl) return [];
  const l = e.vorlage.layers.find((x) => x.id === st.auswahl);
  if (!l) return [];
  if (st.reiter === 'fotos') return e.vorlage.layers.filter((x) => istFotofeld(x) && (x.gruppe || x.id) === (l.gruppe || l.id));
  return l.verbund ? e.vorlage.layers.filter((x) => x.verbund === l.verbund) : [l];
}

/** Punkt auf der Bühne in Pixeln der Vorlage. */
function punkt(ev) {
  const r = st.buehne.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / st.skala, y: (ev.clientY - r.top) / st.skala };
}

/** Oberste Ebene unter dem Finger (Fotos: nur Fotofelder). */
function treffer(p, nurFotos) {
  const ebenen = K.zustand.entwurf.vorlage.layers;
  for (let i = ebenen.length - 1; i >= 0; i--) {
    const l = ebenen[i];
    if (l.versteckt || !l.box || (nurFotos && !istFotofeld(l))) continue;
    const b = l.clip || l.box;
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return l;
  }
  return null;
}

const finger = new Map();

/** Finger auf der Bühne: Foto verschieben/zoomen (Reiter Fotos) oder Ebene ziehen (Reiter Layout). */
function buehnenZeiger(ev) {
  if (st.reiter !== 'fotos' && st.reiter !== 'layout') return;
  ev.preventDefault();
  finger.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  st.buehne.setPointerCapture(ev.pointerId);
  if (finger.size > 1) return; // zweiter Finger: wird im laufenden Ziehen als Zoom ausgewertet
  const e = K.zustand.entwurf;
  const p = punkt(ev);
  const ecke = ev.target.dataset && ev.target.dataset.ecke;
  let l = ecke ? e.vorlage.layers.find((x) => x.id === st.auswahl) : treffer(p, st.reiter === 'fotos');
  if (!l) { auswaehlen(null); return aufraeumen(); }
  if (st.auswahl !== l.id && !ecke) auswaehlen(l.id);
  const start = { mx: ev.clientX, my: ev.clientY };
  let bewegt = false;
  let bewegen;

  if (st.reiter === 'fotos') {
    const gruppe = l.gruppe || l.id;
    const foto = e.inhalt.fotos[gruppe];
    const img = foto && st.aufbau.elemente.get(l.id) && st.aufbau.elemente.get(l.id).querySelector('img');
    if (!foto || !img || !img.naturalWidth) return aufraeumen();
    const pos0 = (foto.position || l.position || [50, 50]).slice();
    const zoom0 = foto.zoom || 1;
    let abstand0 = null;
    bewegen = () => {
      const f = [...finger.values()];
      if (f.length > 1) {
        const d = Math.hypot(f[0].x - f[1].x, f[0].y - f[1].y);
        if (abstand0 == null) abstand0 = d / zoom0;
        foto.zoom = +Math.min(4, Math.max(1, d / abstand0)).toFixed(3);
      } else {
        foto.position = ausschnittVerschieben(l, img, foto, pos0, (f[0].x - start.mx) / st.skala, (f[0].y - start.my) / st.skala);
      }
      bewegt = true;
      ausschnittAnwenden(e.vorlage, st.aufbau.elemente, foto, gruppe);
    };
  } else {
    l = e.vorlage.layers.find((x) => x.id === l.id);
    const teile = gewaehlteEbenen();
    if (teile.some((x) => x.gesperrt)) { K.meldung('Ebene ist gesperrt', 'Gesperrte Ebenen lassen sich nicht verschieben.'); return aufraeumen(); }
    const anfang = new Map(teile.map((x) => [x.id, { box: { ...x.box }, clip: x.clip ? { ...x.clip } : null }]));
    const huelle0 = A.huelle(teile.map((x) => x.box));
    const linien = fanglinien(e.vorlage, K.zustand.markenset, teile.map((x) => x.id));
    const schwelle = FANG_FINGER / st.skala;
    bewegen = () => {
      const f = finger.get(ev.pointerId) || [...finger.values()][0];
      const dx = (f.x - start.mx) / st.skala;
      const dy = (f.y - start.my) / st.skala;
      let r;
      if (ecke) {
        const a = anfang.get(l.id);
        r = einrasten(A.groesseAendern(a.box, ecke, dx, dy), linien, schwelle, ecke);
        A.boxSetzen(l, r.box, a.box, a.clip);
      } else {
        r = einrasten({ ...huelle0, x: huelle0.x + dx, y: huelle0.y + dy }, linien, schwelle);
        for (const x of teile) {
          const a = anfang.get(x.id);
          x.box = a.box;
          if (a.clip) x.clip = a.clip;
          A.verschieben(x, Math.round(r.box.x - huelle0.x), Math.round(r.box.y - huelle0.y));
        }
      }
      bewegt = true;
      neuZeichnen();
      requestAnimationFrame(() => griffeZeichnen(r.linien));
    };
  }

  const zug = (e2) => {
    if (!finger.has(e2.pointerId)) return;
    finger.set(e2.pointerId, { x: e2.clientX, y: e2.clientY });
    bewegen();
  };
  const ende = (e2) => {
    finger.delete(e2.pointerId);
    if (finger.size) return;
    st.buehne.removeEventListener('pointermove', zug);
    st.buehne.removeEventListener('pointerup', ende);
    st.buehne.removeEventListener('pointercancel', ende);
    if (bewegt) {
      E.geaendert({ layout: st.reiter === 'layout' });
      griffeZeichnen();
      panelZeichnen();
    }
  };
  st.buehne.addEventListener('pointermove', zug);
  st.buehne.addEventListener('pointerup', ende);
  st.buehne.addEventListener('pointercancel', ende);
  function aufraeumen() { finger.clear(); }
}

/* ------------------------------ Bereiche ------------------------------ */

const hinweisFelder = new Map();

function panelZeichnen() {
  hinweisFelder.clear();
  const p = { texte: textePanel, fotos: fotosPanel, layout: layoutPanel, sichern: sichernPanel }[st.reiter]();
  setzen(st.panel, p);
}

function textePanel() {
  const e = K.zustand.entwurf;
  const felder = e.vorlage.layers.filter((l) => l.type === 'text' && l.editable !== false && !l.versteckt);
  if (!felder.length) return K.el('p', { class: 'hinweis', text: 'Diese Seite hat keine Textfelder.' });
  return felder.map((l) => {
    const wert = D.textFuer(l, e.inhalt);
    const einzeilig = l.layout && l.layout.nowrap;
    const eingabe = K.el(einzeilig ? 'input' : 'textarea', einzeilig ? { type: 'text', value: wert } : { rows: Math.min(6, Math.max(2, wert.split('\n').length)) });
    if (!einzeilig) eingabe.value = wert;
    const notiz = K.el('div', { class: 'warn' });
    hinweisFelder.set(l.id, notiz);
    const verknuepft = S.textVerknuepft(e, l);
    eingabe.addEventListener('input', () => {
      S.textSetzen(e, l, eingabe.value);
      E.geaendert();
      neuZeichnen();
    });
    return K.el('label', { class: 'feld' }, [
      K.el('span', { class: 'name' }, [K.el('span', { text: l.name || l.id }), verknuepft.seiten.length ? K.el('span', { text: `auch Seite ${verknuepft.seiten.join(', ')}` }) : null]),
      eingabe,
      notiz,
    ]);
  });
}

function hinweiseAktualisieren() {
  const e = K.zustand.entwurf;
  if (!e || !st.aufbau) return;
  for (const [id, notiz] of hinweisFelder) {
    const l = e.vorlage.layers.find((x) => x.id === id);
    const knoten = st.aufbau.elemente.get(id);
    if (!l || !knoten) continue;
    const { satz, art } = feldHinweis(l, D.textMessen(knoten), D.textFuer(l, e.inhalt));
    notiz.textContent = satz;
    notiz.style.color = `var(--${art === 'mute' ? 'dim' : art})`;
  }
}

/** Fotogruppen der aktuellen Seite: je Gruppe die erste Bildebene. */
function fotogruppen(v) {
  const m = new Map();
  for (const l of v.layers) if (istFotofeld(l) && !m.has(l.gruppe || l.id)) m.set(l.gruppe || l.id, l);
  return [...m.entries()];
}

function fotosPanel() {
  const e = K.zustand.entwurf;
  const gruppen = fotogruppen(e.vorlage);
  if (!gruppen.length) return K.el('p', { class: 'hinweis', text: 'Diese Seite hat keine Fotofelder.' });
  const teile = [K.el('p', { class: 'hinweis', text: 'Foto antippen, dann auf der Vorschau mit einem Finger den Ausschnitt verschieben und mit zwei Fingern vergrößern.' })];
  for (const [gruppe, l] of gruppen) {
    const foto = e.inhalt.fotos[gruppe];
    const datei = K.el('input', { type: 'file', accept: 'image/*', hidden: true });
    datei.addEventListener('change', () => datei.files[0] && fotoUebernehmen(gruppe, datei.files[0]));
    const zoom = K.el('input', { type: 'range', min: '1', max: '4', step: '0.01', value: String((foto && foto.zoom) || 1), 'aria-label': 'Ausschnitt vergrößern' });
    zoom.addEventListener('input', () => {
      foto.zoom = parseFloat(zoom.value);
      ausschnittAnwenden(e.vorlage, st.aufbau.elemente, foto, gruppe);
    });
    zoom.addEventListener('change', () => E.geaendert());
    teile.push(K.el('div', { class: 'fotofeld', style: st.auswahl && fotogruppeVon(st.auswahl) === gruppe ? 'border-color:var(--akzent)' : '' }, [
      K.el('div', { class: 'vorschau', style: foto ? `background-image:url("${K.medienUrl(foto.medium)}")` : '' }),
      K.el('div', { class: 'rechts' }, [
        K.el('b', { text: l.name || 'Foto' }),
        K.el('div', { class: 'zeile' }, [
          datei,
          K.el('button', { class: 'knopf klein ' + (foto ? '' : 'haupt'), text: foto ? 'Anderes Foto' : 'Foto wählen', onclick: () => datei.click() }),
          foto ? K.el('button', { class: 'knopf klein still', text: 'Ausschnitt', onclick: () => { st.auswahl = l.id; griffeZeichnen(); panelZeichnen(); } }) : null,
          foto ? K.el('button', { class: 'knopf klein still', text: 'Zurücksetzen', onclick: () => { foto.position = null; foto.zoom = 1; E.geaendert(); buehneAufbauen(); panelZeichnen(); } }) : null,
          foto ? K.el('button', { class: 'knopf klein still gefahr', text: 'Entfernen', onclick: () => { delete e.inhalt.fotos[gruppe]; E.geaendert(); buehneAufbauen(); panelZeichnen(); } }) : null,
        ]),
        foto ? K.el('label', { class: 'feld', style: 'margin:8px 0 0' }, [K.el('span', { class: 'name', text: 'Vergrößern' }), zoom]) : null,
      ]),
    ]));
  }
  return teile;
}

const fotogruppeVon = (id) => {
  const l = K.zustand.entwurf.vorlage.layers.find((x) => x.id === id);
  return l ? l.gruppe || l.id : null;
};

/** Foto vom Handy übernehmen: aufrecht drehen, auf FOTO_MAX verkleinern, als JPEG sichern. */
async function fotoUebernehmen(gruppe, datei) {
  try {
    const blob = await fotoVorbereiten(datei);
    const r = await pw().medien.ausDaten({ daten: blob, endung: 'jpg', name: datei.name });
    if (!K.pruefe(r, 'Foto konnte nicht übernommen werden')) return;
    const e = K.zustand.entwurf;
    const weitere = S.fotoSetzen(e, gruppe, { medium: r.daten.medium, name: datei.name, position: null, zoom: 1 });
    E.geaendert();
    buehneAufbauen();
    panelZeichnen();
    if (weitere) K.gut('Foto übernommen', `Auch auf ${weitere === 1 ? 'einer weiteren Seite' : `${weitere} weiteren Seiten`} eingesetzt.`);
  } catch (err) {
    K.schlecht('Foto konnte nicht gelesen werden', String(err.message || err));
  }
}

async function fotoVorbereiten(datei) {
  let bild;
  try {
    bild = await createImageBitmap(datei, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(datei);
    bild = new Image();
    bild.src = url;
    await bild.decode();
    URL.revokeObjectURL(url);
  }
  const w = bild.width || bild.naturalWidth;
  const h = bild.height || bild.naturalHeight;
  const s = Math.min(1, FOTO_MAX / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * s);
  c.height = Math.round(h * s);
  c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
  return new Promise((ok, fehler) => c.toBlob((b) => (b ? ok(b) : fehler(new Error('Umwandeln fehlgeschlagen'))), 'image/jpeg', 0.92));
}

function layoutPanel() {
  if (st.wahl) return wahlPanel();
  const e = K.zustand.entwurf;
  const teile = [];
  const ebenen = gewaehlteEbenen();
  const auswahl = K.el('select', { class: 'knopf', style: 'width:100%' }, [K.el('option', { value: '', text: 'Ebene wählen …' }),
    ...e.vorlage.layers.slice().reverse().filter((l) => !l.versteckt).map((l) => K.el('option', { value: l.id, text: l.name || l.id, selected: l.id === st.auswahl }))]);
  auswahl.addEventListener('change', () => auswaehlen(auswahl.value || null));
  teile.push(K.el('p', { class: 'hinweis', text: 'Ebene auf der Vorschau antippen und ziehen; der runde Griff ändert die Größe. Kanten rasten an Rändern, Mitte und anderen Ebenen ein (rosa Linien). Symbole lassen sich austauschen, Elemente aus der Bibliothek einfügen.' }), auswahl);
  if (ebenen.length) {
    const b = A.huelle(ebenen.map((l) => l.box));
    let schritt = 2;
    const schieben = (dx, dy) => {
      if (ebenen.some((l) => l.gesperrt)) return K.meldung('Ebene ist gesperrt', '');
      for (const l of ebenen) A.verschieben(l, dx * schritt, dy * schritt);
      E.geaendert({ layout: true });
      buehneAufbauen();
      panelZeichnen();
    };
    const t = (text, dx, dy) => K.el('button', { class: 'knopf', text, 'aria-label': text, onclick: () => schieben(dx, dy) });
    const weite = K.el('button', { class: 'chip', 'aria-pressed': 'false', text: '20 px' });
    weite.onclick = () => { schritt = schritt === 2 ? 20 : 2; weite.setAttribute('aria-pressed', String(schritt === 20)); };
    teile.push(
      K.el('p', { style: 'color:var(--dim);font-size:13px;margin:10px 0 0', text: `x ${Math.round(b.x)} · y ${Math.round(b.y)} · ${Math.round(b.w)} × ${Math.round(b.h)} px` }),
      K.el('div', { class: 'tasten' }, [K.el('span'), t('↑', 0, -1), K.el('span'), t('←', -1, 0), weite, t('→', 1, 0), K.el('span'), t('↓', 0, 1), K.el('span')]),
    );
  }
  const gewaehlt = st.auswahl && e.vorlage.layers.find((x) => x.id === st.auswahl);
  teile.push(K.el('div', { class: 'zeilen', style: 'margin-top:12px' }, [
    K.el('button', { class: 'knopf', text: '+ Element einfügen', onclick: () => elementWahl(false) }),
    gewaehlt && istGrafik(gewaehlt) ? K.el('button', { class: 'knopf', text: 'Austauschen', onclick: () => elementWahl(true) }) : null,
    ebenen.length ? K.el('button', { class: 'knopf still gefahr', text: ebenen.length > 1 ? `${ebenen.length} Ebenen löschen` : 'Löschen', onclick: ebenenLoeschen }) : null,
  ]));
  const offen = e.layoutGeaendert || S.weitereLayouts(e).length;
  teile.push(K.el('div', { class: 'zeilen', style: 'margin-top:12px' }, [
    K.el('button', { class: 'knopf', text: 'In Vorlage speichern', disabled: !offen, onclick: async () => {
      const r = await E.inVorlageSpeichern();
      if (r === true) {
        const l = await pw().vorlagen.liste();
        if (l.ok) K.zustand.vorlagen = l.daten;
        K.gut('Vorlage gespeichert', 'Das Layout gilt jetzt für neue Entwürfe aus dieser Vorlage (nur auf diesem Handy).');
        panelZeichnen();
      } else K.schlecht('Nicht gespeichert', String(r));
    } }),
  ]));
  return teile;
}

/* ------------------------- Elemente (Baukasten) ------------------------- */

const BEREICHE = { symbole: 'Symbole', bilder: 'Logos & Badges', textrollen: 'Textrollen', bausteine: 'Bausteine' };

/**
 * Auswahl der Bibliothek öffnen: neues Element einfügen oder die gewählte Grafik austauschen.
 * Beim Austauschen eines Symbols ist seine Farbvariante vorgewählt – bei Symbolen der Vorlagen
 * die passende aus werkzeuge/symbol-passend.js (Entscheidung der Nutzerin 07.11.2026).
 */
async function elementWahl(tauschen) {
  const b = await B.baukastenLaden();
  if (!b) return;
  const e = K.zustand.entwurf;
  const l = tauschen ? e.vorlage.layers.find((x) => x.id === st.auswahl) : null;
  const [nr, fuellung] = ((l && (l.symbolVariante || b.passend[l.medium])) || st.letzteVariante || '01|mit').split('|');
  st.wahl = { b, tauschen: l ? l.id : null, bereich: l && !l.symbol ? 'bilder' : 'symbole', nr, fuellung, kategorie: '', suche: '' };
  panelZeichnen();
  $('#ansicht').scrollTop = st.panel.offsetTop - 60;
}

function wahlPanel() {
  const w = st.wahl;
  const v = K.zustand.entwurf.vorlage;
  const bereiche = w.tauschen ? ['symbole', 'bilder'] : Object.keys(BEREICHE);
  const teile = [
    K.el('div', { class: 'wahlkopf' }, [
      K.el('b', { text: w.tauschen ? 'Austauschen gegen …' : 'Element einfügen' }),
      K.el('button', { class: 'knopf klein still', text: 'Abbrechen', onclick: () => { st.wahl = null; panelZeichnen(); } }),
    ]),
    K.el('div', { class: 'chips' }, bereiche.map((k) => K.el('button', { class: 'chip', 'aria-pressed': String(w.bereich === k), text: BEREICHE[k], onclick: () => { w.bereich = k; panelZeichnen(); } }))),
  ];
  if (w.bereich === 'symbole') {
    const s = w.b.symbole;
    const raster = K.el('div', { class: 'elementraster' });
    const variante = K.el('select', { class: 'knopf', 'aria-label': 'Farbvariante' }, s.varianten.map((x) => K.el('option', { value: x.nr, text: `${x.nr} · ${x.name}`, selected: x.nr === w.nr })));
    variante.addEventListener('change', () => { w.nr = variante.value; symboleZeigen(raster); });
    const kategorie = K.el('select', { class: 'knopf', 'aria-label': 'Kategorie' }, [K.el('option', { value: '', text: 'Alle Kategorien' }), ...s.kategorien.map((k) => K.el('option', { value: k.name, text: k.name, selected: k.name === w.kategorie }))]);
    kategorie.addEventListener('change', () => { w.kategorie = kategorie.value; symboleZeigen(raster); });
    const suche = K.el('input', { type: 'search', value: w.suche, placeholder: 'Suchen, z. B. verschmust', 'aria-label': 'Symbole durchsuchen' });
    suche.addEventListener('input', () => { w.suche = suche.value; symboleZeigen(raster); });
    const fuellung = K.el('div', { class: 'chips' }, [['mit', 'mit Füllung'], ['ohne', 'ohne Füllung']].map(([k, text]) =>
      K.el('button', { class: 'chip', 'aria-pressed': String(w.fuellung === k), text, onclick: (ev) => {
        w.fuellung = k;
        for (const c of ev.currentTarget.parentNode.children) c.setAttribute('aria-pressed', String(c === ev.currentTarget));
        symboleZeigen(raster);
      } })));
    teile.push(K.el('div', { class: 'filter' }, [variante, kategorie]), fuellung, suche, raster);
    symboleZeigen(raster);
  } else if (w.bereich === 'bilder') {
    const teil = (x, titel) => K.el('button', { class: 'element', 'aria-label': titel, onclick: () => elementSetzen(B.bildEbene(v, x, titel)) }, [
      K.el('img', { src: K.medienUrl(x.medium), alt: '' }), K.el('small', { text: titel })]);
    teile.push(
      K.el('h2', { class: 'mikro', text: 'Logos' }), K.el('div', { class: 'elementraster breit' }, w.b.logos.map((x) => teil(x, B.logoTitel(x)))),
      K.el('h2', { class: 'mikro', text: 'Badges' }), K.el('div', { class: 'elementraster breit' }, w.b.badges.map((x) => teil(x, B.badgeTitel(x)))),
    );
  } else if (w.bereich === 'textrollen') {
    teile.push(K.el('p', { class: 'hinweis', text: 'Neues Textfeld in einer Schriftrolle des Designsets. Den Text danach unter „Texte“ eintragen.' }));
    for (const rolle of w.b.textrollen) {
      teile.push(K.el('button', { class: 'element zeile', onclick: () => elementSetzen(B.textrollenEbene(v, rolle)) }, [
        B.textrollenMuster(rolle), K.el('small', { text: `${rolle.family} ${rolle.weight} · ${rolle.size} px` })]));
    }
  } else {
    for (const [name, liste] of B.bausteinGruppen(w.b)) {
      teile.push(K.el('h2', { class: 'mikro', text: `${name} (${liste.length})` }), K.el('div', { class: 'elementraster eins' }, liste.map((x) =>
        K.el('button', { class: 'element', 'aria-label': `${name} aus ${x.quelle}`, onclick: () => elementSetzen(B.bausteinEbene(v, x)) }, [B.bausteinVorschau(x), K.el('small', { text: x.quelle })]))));
    }
  }
  return teile;
}

/** Symbole der gewählten Farbvariante, Füllung, Kategorie und Suche zeigen (Paket erst laden). */
async function symboleZeigen(raster) {
  const w = st.wahl;
  const stand = `${w.nr}|${w.fuellung}`;
  setzen(raster, K.el('p', { class: 'hinweis', text: 'Symbole werden geladen …' }));
  const r = await pw().bibliothek.symbole(w.nr, w.fuellung);
  if (st.wahl !== w || `${w.nr}|${w.fuellung}` !== stand) return; // inzwischen anders gewählt
  if (!K.pruefe(r, 'Die Symbole konnten nicht geladen werden')) return setzen(raster);
  const s = w.b.symbole;
  const v = K.zustand.entwurf.vorlage;
  const alt = w.tauschen && v.layers.find((x) => x.id === w.tauschen);
  const knoepfe = [];
  for (const k of s.kategorien) {
    if (w.kategorie && k.name !== w.kategorie) continue;
    for (const sym of k.symbole) {
      const medium = s.dateien[`${w.nr}|${w.fuellung}|${sym.id}`];
      if (!medium || !B.symbolTrifft(sym, w.suche)) continue;
      knoepfe.push(K.el('button', {
        class: 'element', 'aria-label': `Symbol ${sym.id}: ${sym.bedeutung.join(', ')}`, 'aria-current': String(Boolean(alt && alt.medium === medium)),
        onclick: () => elementSetzen(B.symbolEbene(v, s, sym, w.nr, w.fuellung)),
      }, [K.el('img', { src: K.medienUrl(medium), alt: '' }), K.el('small', { text: sym.bedeutung[0] || sym.id })]));
    }
  }
  setzen(raster, knoepfe.length ? knoepfe : K.el('p', { class: 'hinweis', text: 'Kein Symbol gefunden.' }));
}

/** Gewähltes Element einsetzen: die Grafik austauschen oder als neue Ebene oben einfügen. */
function elementSetzen(neu) {
  const e = K.zustand.entwurf;
  const w = st.wahl;
  const l = w.tauschen ? A.grafikTauschen(e.vorlage, w.tauschen, neu) : A.ebeneEinfuegen(e.vorlage, neu);
  st.wahl = null;
  if (!l) { K.meldung('Ebene nicht mehr vorhanden', 'Bitte die Grafik noch einmal antippen.'); return panelZeichnen(); }
  if (neu.symbolVariante) st.letzteVariante = neu.symbolVariante;
  st.auswahl = l.id;
  E.geaendert({ layout: true });
  buehneAufbauen();
  panelZeichnen();
  $('#ansicht').scrollTop = 0; // Ergebnis auf der Vorschau zeigen
  if (w.tauschen) K.gut('Ausgetauscht', 'An derselben Stelle in derselben Größe. ↶ macht es rückgängig.');
  else K.gut('Eingefügt', l.type === 'text' ? 'In der Mitte – zum Verschieben ziehen, den Text unter „Texte“ eintragen.' : 'In der Mitte – zum Verschieben auf der Vorschau ziehen.');
}

/** Gewählte Ebene (samt Gruppe) löschen; ↶ holt sie zurück. */
function ebenenLoeschen() {
  const e = K.zustand.entwurf;
  const teile = gewaehlteEbenen();
  if (teile.some((x) => x.gesperrt)) return K.meldung('Ebene ist gesperrt', 'Gesperrte Ebenen lassen sich nicht löschen.');
  A.ebenenEntfernen(e, teile.map((x) => x.id));
  st.auswahl = null;
  E.geaendert({ layout: true });
  buehneAufbauen();
  panelZeichnen();
  K.gut(teile.length > 1 ? `${teile.length} Ebenen gelöscht` : 'Gelöscht', 'Mit ↶ oben lässt es sich zurückholen.');
}

/* ------------------------------ Bild ------------------------------ */

function sichernPanel() {
  const e = K.zustand.entwurf;
  const w = S.wahl(e);
  const seiten = S.mitglieder(e).filter((m) => m.formatKey === w.formatKey && m.fotostil === w.fotostil).sort((a, b) => a.seite - b.seite);
  const fehlend = fotogruppen(e.vorlage).filter(([g]) => !e.inhalt.fotos[g]).map(([, l]) => l.name || 'Foto');
  const ausgabe = K.el('div', { class: 'ergebnis' });
  return [
    fehlend.length ? K.el('p', { class: 'hinweis', style: 'color:var(--signal)', text: `Noch ohne Foto: ${fehlend.join(', ')}. Leere Fotofelder bleiben im Bild leer.` }) : null,
    K.el('div', { class: 'zeilen' }, [
      K.el('button', { class: 'knopf haupt', text: 'Bild erzeugen', onclick: () => bilderErzeugen([seiten.find((m) => m.seite === e.seite) || { id: e.vorlageId, seite: e.seite }], ausgabe) }),
      seiten.length > 1 ? K.el('button', { class: 'knopf', text: `Alle ${seiten.length} Seiten`, onclick: () => bilderErzeugen(seiten, ausgabe) }) : null,
    ]),
    ausgabe,
  ];
}

async function bilderErzeugen(mitglieder, ausgabe) {
  const e = K.zustand.entwurf;
  await E.jetztSpeichern();
  setzen(ausgabe, K.el('p', { class: 'hinweis', text: 'Bild wird erzeugt …' }));
  const dateien = [];
  try {
    for (const m of mitglieder) {
      const vorlage = m.id === e.vorlageId ? e.vorlage : S.vorlageFuer(e, m);
      const inhalt = m.id === e.vorlageId ? e.inhalt : S.inhaltFuer(e, m);
      const r = await bildErzeugen({ vorlage, inhalt, medienUrl: K.medienUrl, platzhalter: false });
      const name = K.dateinameBauen(e.name, vorlage) + (mitglieder.length > 1 ? `_seite-${m.seite}` : '') + '.jpg';
      dateien.push(new File([r.blob], name, { type: 'image/jpeg' }));
    }
  } catch (err) {
    setzen(ausgabe, K.el('p', { class: 'hinweis', style: 'color:var(--gefahr)', text: 'Das Bild ließ sich nicht erzeugen: ' + (err.message || err) }));
    return;
  }
  const urls = dateien.map((d) => URL.createObjectURL(d));
  const teilen = navigator.canShare && navigator.canShare({ files: dateien });
  setzen(ausgabe, 
    K.el('div', { class: 'zeilen' }, [
      teilen ? K.el('button', { class: 'knopf haupt', text: 'Teilen / In Fotos sichern', onclick: async () => {
        try { await navigator.share({ files: dateien }); } catch (err) { if (err.name !== 'AbortError') K.schlecht('Teilen ging nicht', String(err.message || err)); }
      } }) : null,
      ...dateien.map((d, i) => K.el('a', { class: 'knopf', href: urls[i], download: d.name, text: dateien.length > 1 ? `Seite ${i + 1} laden` : 'Herunterladen', style: 'display:inline-flex;align-items:center;text-decoration:none' })),
    ]),
    ...urls.map((u) => K.el('img', { src: u, alt: 'Erzeugtes Bild' })),
  );
}

/* ------------------------------------------------------------------ */
/* Info                                                                */
/* ------------------------------------------------------------------ */

async function infoZeichnen() {
  kopf({ titel: 'Info' });
  let platz = '';
  if (navigator.storage && navigator.storage.estimate) {
    const s = await navigator.storage.estimate();
    platz = `${K.groesse(s.usage || 0)} belegt`;
  }
  const dauerhaft = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
  setzen($('#ansicht'), 
    K.el('h2', { class: 'mikro', text: 'Postwerk für das Handy' }),
    K.el('p', { class: 'hinweis', text: 'Vorlagen des Vereins ausfüllen, Fotos einsetzen und das fertige Bild sichern oder teilen. Entwürfe und Fotos bleiben nur auf diesem Handy – nichts wird hochgeladen.' }),
    K.el('h2', { class: 'mikro', text: 'Als App auf den Home-Bildschirm' }),
    K.el('p', { class: 'hinweis', text: 'iPhone: in Safari unten auf „Teilen“ tippen, dann „Zum Home-Bildschirm“. Android: im Chrome-Menü „App installieren“ oder „Zum Startbildschirm hinzufügen“. Danach startet Postwerk wie eine App und funktioniert auch ohne Internet.' }),
    K.el('h2', { class: 'mikro', text: 'Speicher' }),
    K.el('p', { class: 'hinweis', text: `${K.zustand.vorlagen.length} Vorlagen · ${platz}${dauerhaft ? ' · dauerhaft gesichert' : ''}` }),
    K.el('h2', { class: 'mikro', text: 'Selbsttest' }),
    K.el('p', { class: 'hinweis', text: 'Prüft, ob dieses Handy die Vorlagen genauso zeichnet wie Postwerk am Rechner: drei Vorlagen werden hier erzeugt und Pixel für Pixel mit Bildern vom Rechner verglichen.' }),
    K.el('button', { class: 'knopf haupt', text: 'Selbsttest starten', onclick: (ev) => selbsttest(ev.currentTarget) }),
    K.el('div', { id: 'selbsttest' }),
  );
}

/** Bild (data:/blob:-Adresse) als RGBA-Daten in Vorlagengröße. */
async function pixel(url, breite, hoehe) {
  const i = new Image();
  i.src = url;
  await i.decode();
  const c = document.createElement('canvas');
  c.width = breite;
  c.height = hoehe;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(i, 0, 0, breite, hoehe);
  return x.getImageData(0, 0, breite, hoehe).data;
}

/** Selbsttest: Muster am Gerät erzeugen und mit den Referenzbildern vom Rechner vergleichen. */
async function selbsttest(knopf) {
  const ziel = $('#selbsttest');
  knopf.disabled = true;
  setzen(ziel, K.el('p', { class: 'hinweis', text: 'Läuft …' }));
  const bericht = { geraet: navigator.userAgent, bildschirm: `${screen.width}×${screen.height} @${devicePixelRatio}`, muster: [], pfeil: {} };
  try {
    const { muster } = await (await fetch('selbsttest.json')).json();
    const zeilen = [];
    for (const m of muster) {
      const v = K.zustand.vorlagen.find((x) => x.id === m.id);
      if (!v) { zeilen.push(K.el('p', { class: 'hinweis', text: `${m.name}: Vorlage fehlt` })); continue; }
      const t0 = performance.now();
      const r = await bildErzeugen({ vorlage: v, inhalt: {}, medienUrl: K.medienUrl, platzhalter: false });
      const url = URL.createObjectURL(r.blob);
      const ergebnis = vergleichen(await pixel(m.bild, v.width, v.height), await pixel(url, v.width, v.height), v.width, v.height);
      const urteil = bewerten(ergebnis);
      bericht.muster.push({ id: m.id, ...ergebnis, urteil, ms: Math.round(performance.now() - t0) });
      zeilen.push(K.el('div', { class: 'fotofeld', style: 'align-items:flex-start' }, [
        K.el('div', { style: 'display:flex;gap:4px' }, [K.el('img', { src: m.bild, alt: 'Rechner', style: 'width:56px;border-radius:4px' }), K.el('img', { src: url, alt: 'Handy', style: 'width:56px;border-radius:4px' })]),
        K.el('div', { class: 'rechts' }, [
          K.el('b', { text: { gleich: '✓ stimmt überein', leicht: '≈ kleine Unterschiede', abweichend: '✗ weicht ab' }[urteil], style: `color:var(--${urteil === 'gleich' ? 'ok' : urteil === 'leicht' ? 'signal' : 'gefahr'})` }),
          K.el('div', { style: 'font-size:13px;color:var(--dim)', text: `${designName(v)} – prüft ${m.prueft}` }),
          K.el('div', { style: 'font-size:12px;color:var(--mute)', text: `Abweichung ${String(ergebnis.mittel).replace('.', ',')} · grob ${String(ergebnis.grobProzent).replace('.', ',')} %` }),
        ]),
      ]));
      setzen(ziel, zeilen);
    }
    // Pfeil „→“: Teilschnitte aus dem Arial des Geräts geladen?
    for (const f of document.fonts) {
      if (f.unicodeRange !== 'U+2192') continue;
      try { await f.load(); } catch { /* Status zählt */ }
      bericht.pfeil[`${f.weight} ${f.style}`] = f.status;
    }
    const fett = bericht.pfeil['800 normal'];
    zeilen.push(K.el('p', { class: 'hinweis', text: fett === 'loaded' ? '✓ Pfeil „→“ wird wie am Rechner mit Arial gezeichnet.' : '≈ Arial für den Pfeil „→“ ist auf diesem Gerät nicht vorhanden – er wird mit der Schrift des Geräts gezeichnet.' }));
    zeilen.push(K.el('button', { class: 'knopf', text: 'Ergebnis kopieren', onclick: async () => {
      try { await navigator.clipboard.writeText(JSON.stringify(bericht, null, 1)); K.gut('Kopiert', 'Das Ergebnis kann jetzt z. B. in eine Nachricht eingefügt werden.'); } catch { K.schlecht('Kopieren ging nicht', ''); }
    } }));
    setzen(ziel, zeilen);
  } catch (err) {
    setzen(ziel, K.el('p', { class: 'hinweis', style: 'color:var(--gefahr)', text: 'Selbsttest fehlgeschlagen: ' + (err.message || err) }));
  }
  window.selbsttestBericht = bericht;
  knopf.disabled = false;
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

async function los() {
  try {
    const m = await starten();
    K = m.kern; E = m.entwurf; S = m.satz; D = m.darstellung;
    A = await import('../renderer/js/anordnen.js');
    B = await import('../renderer/js/baukasten.js');
    await schriftenEinrichten();
    E.beiVerlaufGeaendert(({ wiederhergestellt }) => {
      verlaufKnoepfe();
      if (wiederhergestellt && ansicht.bereich === 'studio') studioZeichnen();
    });
    $('#widerrufen').onclick = () => E.widerrufen();
    $('#wiederholen').onclick = () => E.wiederholen();
    for (const b of document.querySelectorAll('#navigation button')) b.onclick = () => { if (b.dataset.ziel === 'vorlagen') ansicht.kachel = null; zeigen(b.dataset.ziel); };
    window.addEventListener('popstate', async () => {
      if (ansicht.bereich !== 'studio') return;
      if (!(await studioVerlassen())) history.pushState({ studio: true }, '');
    });
    window.addEventListener('pagehide', () => { E.jetztSpeichern(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') E.jetztSpeichern(); });
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    // Offline: Dateien im Browser ablegen (nur über https oder localhost möglich)
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    zeigen('vorlagen');
    $('#laden').hidden = true;
    window.postwerkBereit = true;
  } catch (err) {
    $('#laden-text').textContent = 'Postwerk konnte nicht starten: ' + (err.message || err);
    throw err;
  }
}

los();
