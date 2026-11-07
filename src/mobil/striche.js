/**
 * Gestrichelte Rahmen für die Bildausgabe im Browser selbst zeichnen.
 *
 * Browser verteilen die Striche eines Rahmens (border-style: dashed) verschieden. Die Anwendung
 * (Chromium) zeichnet – gemessen mit tests/mobil/striche.js:
 *  - Strichbreite t = Rahmenbreite auf ganze Pixel abgerundet (mindestens 1),
 *  - Strichlänge 2·t (ab t ≥ 3; darunter 3·t), Lücke t (darunter 2·t), gleichmäßig verteilt, so
 *    dass jede Seite mit einem ganzen Strich beginnt und endet (Blink: SelectBestDashGap),
 *  - jede Seite einzeln über die volle Länge, Strichmitte t/2 innerhalb der Kante,
 *  - mit Eckenrundung einen geschlossenen Weg entlang der Rahmenmitte.
 * Hier wird das als SVG über das Element gelegt; der eigene Rahmen wird durchsichtig (die
 * Abmessungen bleiben gleich). Safari zeichnet so dasselbe Bild wie die Anwendung.
 */
const SVG = 'http://www.w3.org/2000/svg';
const SEITEN = ['Top', 'Right', 'Bottom', 'Left'];
let zaehler = 0;

function muster(t) {
  return t >= 3 ? { strich: 2 * t, luecke: t } : { strich: 3 * t, luecke: 2 * t };
}

/** Lücke, mit der die Striche die Länge genau füllen (Blink SelectBestDashGap). */
function besteLuecke(laenge, strich, luecke, geschlossen) {
  const verfuegbar = geschlossen ? laenge : laenge + luecke;
  const wenig = Math.floor(verfuegbar / (strich + luecke));
  const viel = wenig + 1;
  const lWenig = (laenge - wenig * strich) / (geschlossen ? wenig : wenig - 1);
  const lViel = (laenge - viel * strich) / (geschlossen ? viel : viel - 1);
  return lViel <= 0 || Math.abs(lWenig - luecke) < Math.abs(lViel - luecke) ? lWenig : lViel;
}

const breite = (w) => (w > 0 ? Math.max(1, Math.floor(w + 1e-6)) : 0);

function linie(svg, x1, y1, x2, y2, t, farbe) {
  const laenge = Math.hypot(x2 - x1, y2 - y1);
  const { strich, luecke } = muster(t);
  const l = document.createElementNS(SVG, 'line');
  for (const [k, v] of Object.entries({ x1, y1, x2, y2, stroke: farbe, 'stroke-width': t })) l.setAttribute(k, v);
  // Zu kurz für zwei Striche: durchgezogen (wie Blink)
  if (laenge > strich * 2) l.setAttribute('stroke-dasharray', `${strich} ${besteLuecke(laenge, strich, luecke, false)}`);
  svg.append(l);
}

/**
 * Hat das Element (Original im Dokument) einen gestrichelten Rahmen, bekommt sein Gegenstück im
 * Klon einen durchsichtigen Rahmen und die Striche als SVG darüber.
 */
export function stricheErsetzen(original, klon) {
  const cs = getComputedStyle(original);
  const st = original.style;
  const gestrichelt = SEITEN.filter((s) => cs[`border${s}Style`] === 'dashed');
  if (!gestrichelt.length) return false;
  // Angegebene Breiten (nicht die vom Browser schon gerundeten) – die Regel rundet selbst
  const angabe = SEITEN.map((s) => parseFloat(st[`border${s}Width`]) || 0);
  const t = angabe.map(breite);
  const W = parseFloat(st.width);
  const H = parseFloat(st.height);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('style', `position:absolute;left:-${parseFloat(cs.borderLeftWidth) || 0}px;top:-${parseFloat(cs.borderTopWidth) || 0}px;overflow:visible;pointer-events:none;`);
  const radius = parseFloat(cs.borderTopLeftRadius) || 0;
  const gleich = gestrichelt.length === 4 && t.every((x) => x === t[0]) && SEITEN.every((s) => cs[`border${s}Color`] === cs.borderTopColor);

  if (radius > 0 && gleich) {
    // Geschlossener Weg entlang der Rahmenmitte, Beginn oben links nach der Rundung
    const h = t[0] / 2;
    const r = Math.max(0, Math.min(radius - h, (W - t[0]) / 2, (H - t[0]) / 2));
    const x0 = h, y0 = h, x1 = W - h, y1 = H - h;
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', `M ${x0 + r} ${y0} H ${x1 - r} A ${r} ${r} 0 0 1 ${x1} ${y0 + r} V ${y1 - r} A ${r} ${r} 0 0 1 ${x1 - r} ${y1} H ${x0 + r} A ${r} ${r} 0 0 1 ${x0} ${y1 - r} V ${y0 + r} A ${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`);
    const umfang = 2 * (x1 - x0 - 2 * r) + 2 * (y1 - y0 - 2 * r) + 2 * Math.PI * r;
    const { strich, luecke } = muster(t[0]);
    for (const [k, v] of Object.entries({ fill: 'none', stroke: cs.borderTopColor, 'stroke-width': t[0], 'stroke-dasharray': `${strich} ${besteLuecke(umfang, strich, luecke, true)}` })) p.setAttribute(k, v);
    svg.append(p);
  } else {
    if (radius > 0) return false; // gemischte Rahmen mit Rundung: Browser zeichnen lassen
    // Halbdurchsichtige Farbe: jede Seite endet an der Diagonale ihrer Ecken (Gehrung), sonst
    // deckten sich die Striche zweier Seiten in der Ecke doppelt. Bei deckender Farbe ohne
    // Gehrung – deren geglättete Schnittkante hinterließe eine helle Naht in der Ecke.
    const deckend = (f) => !/rgba|hsla|transparent/.test(f) || /,\s*1\)$/.test(f);
    const [tT, tR, tB, tL] = t;
    const gehrung = {
      Top: [[0, 0], [W, 0], [W - tR, tT], [tL, tT]],
      Right: [[W, 0], [W, H], [W - tR, H - tB], [W - tR, tT]],
      Bottom: [[W, H], [0, H], [tL, H - tB], [W - tR, H - tB]],
      Left: [[0, H], [0, 0], [tL, tT], [tL, H - tB]],
    };
    for (const s of gestrichelt) {
      const i = SEITEN.indexOf(s);
      const d = t[i];
      if (!d) continue;
      const farbe = cs[`border${s}Color`];
      if (deckend(farbe)) {
        if (s === 'Top') linie(svg, 0, d / 2, W, d / 2, d, farbe);
        if (s === 'Bottom') linie(svg, 0, H - d / 2, W, H - d / 2, d, farbe);
        if (s === 'Left') linie(svg, d / 2, 0, d / 2, H, d, farbe);
        if (s === 'Right') linie(svg, W - d / 2, 0, W - d / 2, H, d, farbe);
        continue;
      }
      const id = `pw-gehrung-${++zaehler}`;
      const clip = document.createElementNS(SVG, 'clipPath');
      clip.setAttribute('id', id);
      const poly = document.createElementNS(SVG, 'polygon');
      poly.setAttribute('points', gehrung[s].map((p) => p.join(',')).join(' '));
      clip.append(poly);
      const g = document.createElementNS(SVG, 'g');
      g.setAttribute('clip-path', `url(#${id})`);
      svg.append(clip, g);
      if (s === 'Top') linie(g, 0, d / 2, W, d / 2, d, farbe);
      if (s === 'Bottom') linie(g, 0, H - d / 2, W, H - d / 2, d, farbe);
      if (s === 'Left') linie(g, d / 2, 0, d / 2, H, d, farbe);
      if (s === 'Right') linie(g, W - d / 2, 0, W - d / 2, H, d, farbe);
    }
  }
  for (const s of gestrichelt) klon.style[`border${s}Color`] = 'transparent';
  klon.append(svg);
  return true;
}
