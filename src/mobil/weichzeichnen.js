/**
 * Weichgezeichnete Fotos (CSS filter: blur) für die Bildausgabe im Browser vorab berechnen.
 *
 * Gemessen (tests/mobil/treue.js): WebKit (Safari) zeichnet blur() in einem SVG-Bild nur über den
 * sichtbaren Ausschnitt und dunkelt so zum Bildrand hin ab; die Anwendung (Chromium) zeichnet das
 * ganze Bildelement weich, außerhalb ist es durchsichtig (CSS-Filter, Kante „transparent“). Darum
 * wird hier genau das nachgerechnet: das Bildelement so, wie object-fit/-position es zeigen, mit
 * durchsichtigem Rand, Gauß-Weichzeichnung (drei Kastenfilter), und als fertiges Bild eingesetzt.
 * Die übrigen Filter (saturate, brightness …) wirken je Pixel und bleiben CSS.
 */

const BLUR = /blur\(\s*([\d.]+)px\s*\)/;

/** Breiten der drei Kastenfilter für eine Gaußkurve mit Standardabweichung s. */
function kaesten(s) {
  const ideal = Math.sqrt((12 * s * s) / 3 + 1);
  let wl = Math.floor(ideal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const m = Math.round((12 * s * s - 3 * wl * wl - 4 * 3 * wl - 3 * 3) / (-4 * wl - 4));
  return [0, 1, 2].map((i) => (i < m ? wl : wu));
}

/** Kastenfilter waagrecht (r = Radius) über ein Float32-Feld mit 4 Kanälen. */
function kastenWaagrecht(q, z, w, h, r) {
  const f = 1 / (r + r + 1);
  for (let y = 0; y < h; y++) {
    const zeile = y * w * 4;
    for (let c = 0; c < 4; c++) {
      let s = 0;
      for (let x = -r; x <= r; x++) if (x >= 0 && x < w) s += q[zeile + x * 4 + c];
      for (let x = 0; x < w; x++) {
        z[zeile + x * 4 + c] = s * f;
        const raus = x - r, rein = x + r + 1;
        if (raus >= 0) s -= q[zeile + raus * 4 + c];
        if (rein < w) s += q[zeile + rein * 4 + c];
      }
    }
  }
}

function kastenSenkrecht(q, z, w, h, r) {
  const f = 1 / (r + r + 1);
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 4; c++) {
      const o = x * 4 + c;
      let s = 0;
      for (let y = -r; y <= r; y++) if (y >= 0 && y < h) s += q[y * w * 4 + o];
      for (let y = 0; y < h; y++) {
        z[y * w * 4 + o] = s * f;
        const raus = y - r, rein = y + r + 1;
        if (raus >= 0) s -= q[raus * w * 4 + o];
        if (rein < h) s += q[rein * w * 4 + o];
      }
    }
  }
}

/** Gauß-Weichzeichnung (vormultipliziertes Alpha, außerhalb durchsichtig) auf ImageData. */
function gauss(bild, s) {
  const { width: w, height: h, data: d } = bild;
  let a = new Float32Array(d.length);
  let b = new Float32Array(d.length);
  for (let i = 0; i < d.length; i += 4) {
    const al = d[i + 3] / 255;
    a[i] = d[i] * al; a[i + 1] = d[i + 1] * al; a[i + 2] = d[i + 2] * al; a[i + 3] = d[i + 3];
  }
  for (const k of kaesten(s)) {
    const r = (k - 1) / 2;
    kastenWaagrecht(a, b, w, h, r);
    kastenSenkrecht(b, a, w, h, r);
  }
  for (let i = 0; i < d.length; i += 4) {
    const al = a[i + 3];
    const f = al > 0 ? 255 / al : 0;
    d[i] = a[i] * f; d[i + 1] = a[i + 1] * f; d[i + 2] = a[i + 2] * f; d[i + 3] = al;
  }
}

/** Ein Wert von object-position (Prozent, px oder Schlüsselwort) als Versatz in px. */
function versatz(wert, frei) {
  const v = String(wert).trim();
  const wort = { left: 0, top: 0, center: 50, right: 100, bottom: 100 }[v];
  if (wort != null) return (frei * wort) / 100;
  if (v.endsWith('%')) return (frei * parseFloat(v)) / 100;
  return parseFloat(v) || 0;
}

/**
 * Bildelement des fertigen Aufbaus (original, im Dokument) und sein Gegenstück im Klon: hat das
 * Original einen blur()-Filter, bekommt der Klon das vorab weichgezeichnete Bild.
 */
export async function weichVorbereiten(original, klon) {
  const cs = getComputedStyle(original);
  const m = BLUR.exec(original.style.filter || '');
  if (!m || !original.naturalWidth) return false;
  const sigma = parseFloat(m[1]);
  const bw = parseFloat(original.style.width);
  const bh = parseFloat(original.style.height);
  const iw = original.naturalWidth;
  const ih = original.naturalHeight;

  // Gezeichnetes Rechteck nach object-fit und object-position (in px des Bildelements)
  const fit = cs.objectFit;
  let sx = bw / iw, sy = bh / ih;
  if (fit === 'cover') sx = sy = Math.max(sx, sy);
  else if (fit === 'contain') sx = sy = Math.min(sx, sy);
  else if (fit === 'none') sx = sy = 1;
  else if (fit === 'scale-down') sx = sy = Math.min(1, Math.min(sx, sy));
  const dw = iw * sx, dh = ih * sy;
  const [px, py] = cs.objectPosition.split(/\s+/);
  const ox = versatz(px, bw - dw), oy = versatz(py, bh - dh);

  // Rand für die Weichzeichnung (3 σ); bei großem σ in halber Auflösung rechnen
  const rand = Math.ceil(sigma * 3) + 2;
  const f = sigma >= 16 ? 0.5 : 1;
  const W = Math.round((bw + 2 * rand) * f), H = Math.round((bh + 2 * rand) * f);
  const flaeche = document.createElement('canvas');
  flaeche.width = W;
  flaeche.height = H;
  const ctx = flaeche.getContext('2d');
  ctx.save();
  ctx.beginPath();
  ctx.rect(rand * f, rand * f, bw * f, bh * f); // Inhalt endet am Bildelement (wie im Browser)
  ctx.clip();
  ctx.drawImage(original, (rand + ox) * f, (rand + oy) * f, dw * f, dh * f);
  ctx.restore();
  const daten = ctx.getImageData(0, 0, W, H);
  gauss(daten, sigma * f);
  ctx.putImageData(daten, 0, 0);

  const [tx, ty] = cs.transformOrigin.split(/\s+/).map(parseFloat);
  klon.setAttribute('src', flaeche.toDataURL('image/png'));
  klon.style.left = parseFloat(original.style.left) - rand + 'px';
  klon.style.top = parseFloat(original.style.top) - rand + 'px';
  klon.style.width = bw + 2 * rand + 'px';
  klon.style.height = bh + 2 * rand + 'px';
  klon.style.objectFit = 'fill';
  klon.style.objectPosition = '0 0';
  klon.style.transformOrigin = `${tx + rand}px ${ty + rand}px`;
  klon.style.filter = original.style.filter.replace(BLUR, '').trim() || 'none';
  return true;
}
