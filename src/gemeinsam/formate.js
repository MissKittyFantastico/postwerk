/**
 * Formate und Plattform-Grenzwerte. Einzige Quelle für Hauptprozess und Oberfläche.
 *
 * Hauptformate des AHE-Designsets sind Feed 4:5 und Story 9:16 (massvorgaben.json).
 * Die übrigen Formate bleiben für eigene Vorlagen wählbar („Weitere Formate“,
 * Entscheidung 4 vom 19.10.2026).
 */
export const FORMATE = {
  ig_portrait: {
    label: 'Feed Hochformat 4:5',
    kurz: '4:5',
    w: 1080,
    h: 1350,
    haupt: true,
    plattformen: ['instagram', 'facebook'],
    hinweis: 'Hauptformat des Designsets für Feed und Karussell.',
    rasterSchnitt: 3 / 4,
  },
  story: {
    label: 'Story 9:16',
    kurz: '9:16',
    w: 1080,
    h: 1920,
    haupt: true,
    plattformen: ['instagram', 'facebook'],
    hinweis: 'Vollbild. Oben und unten je 285 px Sicherheitszone (massvorgaben.json).',
    rasterSchnitt: null,
  },
  ig_raster: {
    label: 'Feed Hochformat 3:4',
    kurz: '3:4',
    w: 1080,
    h: 1440,
    haupt: false,
    plattformen: ['instagram', 'facebook'],
    hinweis: 'Füllt die Profilvorschau ohne Anschnitt. Über die Instagram-Schnittstelle nicht sicher veröffentlichbar.',
    rasterSchnitt: null,
  },
  quadrat: {
    label: 'Quadrat 1:1',
    kurz: '1:1',
    w: 1080,
    h: 1080,
    haupt: false,
    plattformen: ['instagram', 'facebook'],
    hinweis: 'Im Profilraster seitlich auf 3:4 beschnitten.',
    rasterSchnitt: 3 / 4,
  },
  fb_quer: {
    label: 'Facebook Querformat 1,91:1',
    kurz: '1,91:1',
    w: 1200,
    h: 630,
    haupt: false,
    plattformen: ['facebook'],
    hinweis: 'Für Linkvorschauen und Titelmotive.',
    rasterSchnitt: null,
  },
};

/**
 * Grenzwerte je Plattform. Instagram erlaubt seit Dezember 2025 höchstens
 * 5 Hashtags je Beitrag, Hashtags im ersten Kommentar zählen mit
 * (Entscheidung 7 vom 19.10.2026).
 */
export const PLATTFORMEN = {
  instagram: {
    label: 'Instagram',
    textMax: 2200,
    hashtagMax: 5,
    kurz: 'IG',
    kannEinplanen: false,
    hinweis: 'Nur Business- oder Creator-Konten. Instagram nimmt ausschließlich JPEG an.',
  },
  facebook: {
    label: 'Facebook-Seite',
    textMax: 63206,
    hashtagMax: 30,
    kurz: 'FB',
    kannEinplanen: true,
    hinweis: 'Nur Seiten. Persönliche Profile lassen sich per Schnittstelle nicht bespielen.',
  },
};

export const ANLAESSE = [
  'Veranstaltung',
  'Mitteilung',
  'Rückblick',
  'Statement',
  'Mitgliedersuche',
  'Glückwunsch',
  'Danke',
  'Sonstiges',
];

export const FOTOSTILE = ['Vollbild', 'Mittel', 'Blur-Fill'];

/** Formatschlüssel einer Vorlage, notfalls über die Maße ermittelt. */
export function formatSchluessel(vorlage) {
  if (vorlage.formatKey && FORMATE[vorlage.formatKey]) return vorlage.formatKey;
  return formatNachMass(vorlage.width, vorlage.height) || 'ig_portrait';
}

function formatNachMass(w, h) {
  const treffer = Object.entries(FORMATE).find(([, f]) => f.w === w && f.h === h);
  return treffer ? treffer[0] : null;
}
