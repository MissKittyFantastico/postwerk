/**
 * Markenset: bereitet tokens.json, massvorgaben.json und symbole-index.json des
 * Designsets für Postwerk auf. Einzige Stelle, an der Markenwerte gelesen werden –
 * Farbauswahl, Schriftauswahl, Markenregel-Prüfung und Hilfslinien greifen hierauf zu.
 *
 * Die Rohdateien liegen unverändert unter gemeinsam/designset/ und werden beim
 * Einlesen eines neueren Designsets im Datenordner ersetzt.
 */

/**
 * Prüfregeln, die nicht in den Token-Dateien stehen, sondern in
 * 09_werkzeuge/_check.js und 08_regeln/Gestaltungsregeln. Wortlaut der
 * Spendendaten zeichengenau aus den Gestaltungsregeln übernommen.
 */
const REGELN = {
  quelle: '09_werkzeuge/_check.js, 08_regeln/Gestaltungsregeln (Stand 18.10.2026)',
  /** Textstellen, die nicht umbrochen werden dürfen (Muster aus _check.js). */
  geschuetzt: [
    { name: 'E-Mail-Adresse', muster: '[\\w.-]+@[\\w.-]+\\.\\w+' },
    { name: 'PayPal-Link', muster: 'paypal\\.me\\/\\w+' },
    { name: 'IBAN', muster: 'DE\\d{2}( \\d{4}){4} \\d{2}' },
    { name: 'BIC', muster: 'GENODEF1DCA' },
    { name: 'Datum', muster: '\\d{1,2}\\.\\d{1,2}\\.(\\d{4})?' },
    { name: 'Handle', muster: '@animal_help_espania' },
    { name: 'Uhrzeit', muster: '\\d+[–-]\\d+ Uhr' },
    { name: 'Betrag', muster: '\\d[\\d.]* €' },
  ],
  iban: 'DE44 7009 1500 0000 9280 11',
  bic: 'GENODEF1DCA',
  verboten: [{ muster: 'Sparkasse', meldung: 'Sparkassen-Konto vorerst nicht verwenden (Gestaltungsregeln, Spendenaufruf)' }],
  /** Trennzeichen, die allein in der letzten Zeile erlaubt sind (aus _check.js). */
  einzelwortErlaubt: '^[—–\\-•·/]+$',
};

export function markensetAufbauen(tokens, mass, symbolIndex) {
  const farben = [];
  const gesehen = new Set();
  const gruppe = (name, obj) => {
    for (const [k, v] of Object.entries(obj || {})) {
      if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) continue;
      const hex = v.toUpperCase();
      if (gesehen.has(hex)) continue;
      gesehen.add(hex);
      farben.push({ name: k, hex, gruppe: name });
    }
  };
  gruppe('Marke', tokens.farben && tokens.farben.marke);
  gruppe('Kachelhintergrund', tokens.farben && tokens.farben.kachelHintergruende);
  gruppe('Symbolpalette', tokens.farben && tokens.farben.symbolPalette);

  const s = tokens.schriften || {};
  const schriften = ['display', 'text', 'mono']
    .filter((k) => s[k])
    .map((k) => ({
      rolle: k,
      family: s[k].family,
      gewichte: (s[k].gewichte || []).slice(),
      kursiv: (s[k].kursiv || []).slice(),
      einsatz: s[k].einsatz || '',
    }));

  const story = (mass.formate && mass.formate['instagram-story']) || {};
  return {
    stand: tokens.stand || mass.stand || '',
    farben,
    schriften,
    schriftenErlaubt: (s.erlaubt || schriften.map((x) => x.family)).slice(),
    textrollen: (tokens.typoSkala_haeufigste || []).slice(),
    radien: (tokens.radien || []).slice(),
    schatten: Object.assign({}, tokens.schatten),
    overlays: Object.assign({}, tokens.farben && tokens.farben.overlays),
    mindestschrift: (mass.mindestwerte && mass.mindestwerte.schriftgroesse) || 26,
    pruefgrenzeSchrift: (mass.mindestwerte && mass.mindestwerte.schriftgroessePruefgrenze) || 25,
    storyZone: Object.assign({ oben: 0, unten: 0 }, story.sicherheitszone),
    raster: Object.assign({}, mass.raster),
    handle: (mass.handle && mass.handle.text) || '',
    fotoStile: Object.assign({}, mass.fotoStile),
    symbolVarianten: ((symbolIndex && symbolIndex.varianten) || []).slice(),
    symbole: ((symbolIndex && symbolIndex.symbole) || []).slice(),
    regeln: REGELN,
  };
}

/** Ist die Farbe Teil des Markensets? Akzeptiert #RRGGBB und {hex, alpha}. */
export function istMarkenfarbe(markenset, farbe) {
  if (!farbe) return true;
  const hex = typeof farbe === 'object' ? farbe.hex : farbe;
  if (typeof hex !== 'string') return true;
  const h = hex.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(h)) return h === 'TRANSPARENT' || h === '#FFFFFF';
  return h === '#FFFFFF' || markenset.farben.some((f) => f.hex === h);
}

/** Ist Schrift, Stärke und Lage freigegeben? */
export function istMarkenschrift(markenset, family, weight, style) {
  const s = markenset.schriften.find((x) => x.family === family);
  if (!s) return false;
  const w = Number(weight) || 400;
  if (style === 'italic') return s.kursiv.includes(w);
  return s.gewichte.includes(w);
}
