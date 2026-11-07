/**
 * Zwei Bilder gleicher Größe pixelweise vergleichen (RGBA-Daten): mittlere Abweichung je Pixel
 * und Farbkanal (0–255) und Anteil grober Pixel (mehr als 32 Stufen). Gemeinsam für den
 * Selbsttest am Handy und tests/mobil/treue.js.
 */
export function vergleichen(a, b, breite, hoehe) {
  let summe = 0;
  let grob = 0;
  for (let i = 0; i < breite * hoehe; i++) {
    const o = i * 4;
    const d = (Math.abs(a[o] - b[o]) + Math.abs(a[o + 1] - b[o + 1]) + Math.abs(a[o + 2] - b[o + 2])) / 3;
    summe += d;
    if (d > 32) grob++;
  }
  return { mittel: +(summe / (breite * hoehe)).toFixed(2), grobProzent: +((grob / (breite * hoehe)) * 100).toFixed(2) };
}

/**
 * Bewertung für den Selbsttest. Grenzen aus den Messungen (PRUEFNACHWEISE Abschnitt 13):
 * Chromium 0,2–0,6, WebKit 1,2–2,6 bei Vorlagen mit Fotos; Unterschiede dort nur in
 * Kantenglättung und Bildverkleinerung.
 */
export function bewerten({ mittel, grobProzent }) {
  if (mittel <= 3 && grobProzent <= 2) return 'gleich';
  if (mittel <= 6 && grobProzent <= 5) return 'leicht';
  return 'abweichend';
}
