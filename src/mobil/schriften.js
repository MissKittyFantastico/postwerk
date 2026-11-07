/**
 * Schriften der Handy-Fassung. Quelle bleibt die Schriftliste der Anwendung
 * (src/renderer/css/schriften.css); hier wird nur die variable Nunito Sans (aufrecht) durch feste
 * Schnitte je freigegebener Stärke ersetzt (src/mobil/schriften, erzeugt mit
 * werkzeuge/mobil-schriften.py) – manche Browser werten die Stärke variabler Schriften nicht aus.
 *
 * Pfeil „→“ (in 54 Vorlagen, Poppins 800): Poppins enthält ihn nicht; am Rechner zeichnet ihn
 * Windows mit Arial (gemessen: Abweichung 351 gegenüber > 160.000 bei allen anderen Schriften).
 * Entscheidung 07.11.2026 „genau wie am Rechner“: Für dieses eine Zeichen verweist die
 * Schriftfamilie auf das Arial des Geräts (local(), auf dem iPhone eingebaut) – keine Datei.
 *
 * schriftenEinrichten()  – Schriften in die Seite einhängen und laden (Anzeige und Textmessung)
 * schriftenEingebettet() – dieselben Regeln mit eingebetteten Dateien (für die Bildausgabe)
 */
const CSS = new URL('../renderer/css/schriften.css', import.meta.url);
const TOKENS = new URL('../gemeinsam/designset/tokens.json', import.meta.url);
const FEST = (w) => new URL(`./schriften/NunitoSans-${w}.ttf`, import.meta.url);

let regeln = null;
const pfeile = []; // Teilschnitte nur für „→“ (Arial des Geräts)
let eingebettet = null;

async function text(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}

/** [{ familie, stil, gewicht, url }] – absolute Adressen. */
async function schriftRegeln() {
  if (regeln) return regeln;
  const css = await text(CSS);
  const tokens = JSON.parse(await text(TOKENS));
  const nunito = Object.values(tokens.schriften || {}).find((s) => s && s.family === 'Nunito Sans');
  const wert = (regel, name) => (new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(regel) || [])[1];
  regeln = [];
  for (const m of css.matchAll(/@font-face\s*{[^}]*}/g)) {
    const r = m[0];
    const familie = wert(r, 'font-family').replace(/"/g, '').trim();
    const stil = (wert(r, 'font-style') || 'normal').trim();
    const gewicht = (wert(r, 'font-weight') || '400').trim();
    const url = new URL(/url\("?([^")]+)"?\)/.exec(r)[1], CSS).href;
    if (familie === 'Nunito Sans' && stil === 'normal' && nunito) {
      for (const w of nunito.gewichte) regeln.push({ familie, stil, gewicht: String(w), url: FEST(w).href });
    } else {
      regeln.push({ familie, stil, gewicht, url });
    }
  }
  // „→“ wie am Rechner aus Arial (fett ab 600, wie die Schriftwahl von Windows)
  for (const r of regeln.filter((x) => x.familie === 'Poppins')) {
    const fett = parseInt(r.gewicht, 10) >= 600;
    const kursiv = r.stil === 'italic';
    const name = `Arial${fett ? ' Bold' : ''}${kursiv ? ' Italic' : ''}`;
    const ps = fett || kursiv ? `Arial-${fett ? 'Bold' : ''}${kursiv ? 'Italic' : ''}MT` : 'ArialMT';
    pfeile.push({ familie: r.familie, stil: r.stil, gewicht: r.gewicht, lokal: [name, ps] });
  }
  return regeln;
}

const alsCss = (liste, adresse) => liste
  .map((r) => `@font-face { font-family: "${r.familie}"; src: url("${adresse(r)}"); font-weight: ${r.gewicht}; font-style: ${r.stil}; }`)
  .concat(pfeile.map((r) => `@font-face { font-family: "${r.familie}"; src: ${r.lokal.map((n) => `local("${n}")`).join(', ')}; font-weight: ${r.gewicht}; font-style: ${r.stil}; unicode-range: U+2192; }`))
  .join('\n');

/** Schriften in die Seite einhängen und alle Schnitte laden. */
export async function schriftenEinrichten() {
  const liste = await schriftRegeln();
  if (!document.getElementById('pw-schriften')) {
    const stil = document.createElement('style');
    stil.id = 'pw-schriften';
    stil.textContent = alsCss(liste, (r) => r.url);
    document.head.append(stil);
  }
  await Promise.all(liste.map((r) => document.fonts.load(`${r.stil} ${r.gewicht.split(' ')[0]} 40px "${r.familie}"`)));
}

/** Dieselben Regeln mit den Schriftdateien als data:-Adressen (ein SVG-Bild darf nichts nachladen). */
export async function schriftenEingebettet() {
  if (eingebettet) return eingebettet;
  const liste = await schriftRegeln();
  const daten = await Promise.all(liste.map(async (r) => {
    const res = await fetch(r.url);
    if (!res.ok) throw new Error(`${r.url}: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return 'data:font/ttf;base64,' + btoa(bin);
  }));
  eingebettet = alsCss(liste, (r) => daten[liste.indexOf(r)]);
  return eingebettet;
}
