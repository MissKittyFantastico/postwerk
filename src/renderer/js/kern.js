/** Gemeinsame Bausteine für alle Ansichten. */

export const pw = window.postwerk;

export const zustand = {
  vorlagen: [],
  einstellungen: {},
  konten: [],
  markenset: null,
  /**
   * Aktueller Entwurf im Studio (postwerk-entwurf/1):
   * { id, name, vorlageId, vorlageVersion, vorlage, inhalt:{texte,fotos}, text:{instagram,facebook},
   *   textGekoppelt, hashtags, altTexte: { [seite]: Text } }
   */
  entwurf: null,
  auswahl: null, // Ebenen-Id
  markiert: null, // Mehrfachauswahl im Layoutmodus (Ebenen-Ids), gilt nur, solange sie „auswahl“ enthält
  einzeln: false, // über die Ebenenliste gewählt: Gruppen nicht erweitern
  layoutmodus: false,
  zoom: 1,
};

export const $ = (s, w = document) => w.querySelector(s);
export const $$ = (s, w = document) => Array.from(w.querySelectorAll(s));

export function el(tag, attr = {}, kinder = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attr)) {
    if (v == null || v === false) continue;
    if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'class') n.className = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kind of [].concat(kinder)) {
    if (kind == null || kind === false) continue;
    n.append(typeof kind === 'string' ? document.createTextNode(kind) : kind);
  }
  return n;
}

export const neueId = (p = 'e') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const tief = (o) => JSON.parse(JSON.stringify(o));
/** Adresse eines Mediums. Die Handy-Fassung (src/mobil/bruecke.js) liefert eigene Adressen. */
export const medienUrl = (name) => (pw && pw.medienUrl ? pw.medienUrl(name) : name ? 'pwmedien://medien/' + encodeURIComponent(name) : '');

/* ------------------------------- Meldungen ------------------------------- */

export function meldung(titel, text = '', art = '', dauer = 5200) {
  const box = el('div', { class: 'meldung ' + art }, [el('b', { text: titel }), text ? el('span', { text }) : null]);
  $('#meldungen').append(box);
  setTimeout(() => {
    box.style.opacity = '0';
    setTimeout(() => box.remove(), 220);
  }, dauer);
  return box;
}

export const gut = (t, s) => meldung(t, s, 'gut');

/** Ergebnis der Übernahme aus Postwerk 1.0 in einem Satz (Meldung und Einstellungen). */
export function migrationsText(m) {
  if (m.fehler) return `Die Übernahme ist fehlgeschlagen: ${m.fehler}`;
  const teile = [`${m.uebernommen.length} eigene Vorlagen übernommen`];
  if (m.entfallen.length) teile.push(`${m.entfallen.length} unveränderte Standardvorlagen entfallen`);
  if ((m.mitgeliefert || []).length) teile.push(`${m.mitgeliefert.length} unveränderte Designset-Importe entfallen, weil Postwerk sie in neuerer Fassung mitliefert`);
  return `${teile.join(', ')}. Der vorherige Stand liegt unter ${m.sicherung}.`;
}
export const schlecht = (t, s) => meldung(t, s, 'schlecht', 9500);
export const warnung = (t, s) => meldung(t, s, 'warn', 7500);

/**
 * Ergebnis eines IPC-Aufrufs auswerten. Bei Fehlern wird eine Meldung gezeigt
 * und null zurückgegeben.
 */
export function pruefe(ergebnis, fehlerTitel = 'Das hat nicht funktioniert') {
  if (ergebnis && ergebnis.ok) return ergebnis.daten;
  schlecht(fehlerTitel, (ergebnis && ergebnis.fehler) || 'Unbekannter Fehler.');
  return null;
}

/* ------------------------------- Fortschritt ----------------------------- */

const AUFGABEN = { einlesen: 'Vorlagen werden eingelesen', pruefung: 'Prüflauf', export: 'Bilder werden exportiert', beitrag: 'Beitrag wird vorbereitet' };

export function fortschrittZeigen({ aufgabe, n, gesamt, text }) {
  const f = $('#fortschritt');
  f.hidden = false;
  f.querySelector('b').textContent = AUFGABEN[aufgabe] || 'Bitte warten';
  f.querySelector('i').style.width = Math.round((n / Math.max(1, gesamt)) * 100) + '%';
  f.querySelector('span').textContent = `${n} von ${gesamt}${text ? ' · ' + text : ''}`;
  clearTimeout(fortschrittZeigen.t);
  fortschrittZeigen.t = setTimeout(() => (f.hidden = true), n >= gesamt ? 900 : 15000);
}

/* ------------------------------ Speicherstatus --------------------------- */

/** Status im Kopf: 'gespeichert' | 'speichert' | 'offen' | 'fehler' | '' */
export function speicherstatus(stand, text = '') {
  const s = $('#speicherstatus');
  s.dataset.stand = stand;
  s.textContent = text;
  s.title = stand === 'fehler' ? 'Speichern fehlgeschlagen – Postwerk versucht es erneut.' : '';
}

/* -------------------------------- Dialog -------------------------------- */

let dialogSchliessen = null;

export function dialog({ titel, unter = '', rumpf, knoepfe = [], breite, beimSchliessen }) {
  const schleier = $('#schleier');
  $('#dialog-titel').textContent = titel;
  const u = $('#dialog-unter');
  u.textContent = unter;
  u.hidden = !unter;
  const r = $('#dialog-rumpf');
  r.replaceChildren();
  if (rumpf) r.append(rumpf);
  if (breite) $('#dialog').style.width = breite;

  const fuss = $('#dialog-fuss');
  fuss.replaceChildren();
  for (const k of knoepfe) {
    fuss.append(
      el('button', {
        class: 'knopf ' + (k.art || ''),
        text: k.text,
        onclick: async (ev) => {
          const b = ev.currentTarget;
          if (k.aktion) {
            b.disabled = true;
            try {
              const behalten = await k.aktion();
              if (behalten !== true) schliessen();
            } finally {
              b.disabled = false;
            }
          } else schliessen();
        },
      })
    );
  }

  schleier.classList.add('offen');
  const beiTaste = (e) => {
    if (e.key === 'Escape') schliessen();
  };
  document.addEventListener('keydown', beiTaste);

  function schliessen() {
    schleier.classList.remove('offen');
    document.removeEventListener('keydown', beiTaste);
    $('#dialog').style.width = '';
    dialogSchliessen = null;
    if (beimSchliessen) beimSchliessen();
  }
  dialogSchliessen = schliessen;
  setTimeout(() => {
    const erste = r.querySelector('input,textarea,select,button');
    if (erste) erste.focus();
  }, 40);
  return schliessen;
}

export const dialogZu = () => dialogSchliessen && dialogSchliessen();

/** Frage mit Antwortknöpfen; liefert den gewählten Wert oder null. */
export function frage({ titel, text, knoepfe }) {
  return new Promise((resolve) => {
    let gewaehlt = null;
    dialog({
      titel,
      rumpf: el('p', { style: 'margin:0;color:var(--dim);line-height:1.55', text }),
      knoepfe: knoepfe.map((k) => ({ text: k.text, art: k.art, aktion: async () => { gewaehlt = k.wert; } })),
      beimSchliessen: () => resolve(gewaehlt),
    });
  });
}

/* ------------------------------ Formatierung ---------------------------- */

export function zeitpunkt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function relativ(iso) {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  const min = Math.round(diff / 60000);
  const abs = Math.abs(min);
  if (abs < 1) return 'gerade eben';
  if (abs < 60) return min >= 0 ? `in ${abs} Min.` : `vor ${abs} Min.`;
  if (abs < 1440) return min >= 0 ? `in ${Math.round(abs / 60)} Std.` : `vor ${Math.round(abs / 60)} Std.`;
  return min >= 0 ? `in ${Math.round(abs / 1440)} Tagen` : `vor ${Math.round(abs / 1440)} Tagen`;
}

export function groesse(bytes) {
  return bytes > 1048576 ? (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.round(bytes / 1024) + ' KB';
}

/** Platzhalter wie {headline} durch Ebeneninhalte ersetzen. */
export function textAusVorlage(muster, vorlage, inhalt) {
  return String(muster || '').replace(/\{([a-zA-Z0-9_-]+)\}/g, (_t, id) => {
    const t = inhalt && inhalt.texte && inhalt.texte[id];
    if (t != null) return t;
    const l = (vorlage.layers || []).find((x) => x.id === id);
    return l && l.text ? l.text : '';
  }).trim();
}

/** Dateiname für Exporte: Datum, Name, Maße. */
export function dateinameBauen(name, vorlage) {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  const stempel = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}`;
  const rein = String(name || 'beitrag')
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 60);
  return `${stempel}_${rein}_${vorlage.width}x${vorlage.height}`;
}
