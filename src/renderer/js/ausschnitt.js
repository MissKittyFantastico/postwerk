/**
 * Bildausschnitt eines Fotos: Lage (object-position in Prozent) und Vergrößerung (zoom).
 * Gemeinsam für das Studio am Rechner (Maus) und die Handy-Fassung (Finger).
 */
import { positionCss } from './darstellung.js';
import { istGrafik } from '../../gemeinsam/ebenen.js';

/**
 * Neue Lage nach einer Verschiebung um dx, dy (Pixel der Vorlage), ausgehend von pos0.
 * Der Spielraum ergibt sich aus Rahmen, Bildgröße, Einpassung (cover/contain) und Zoom.
 * @returns {[number, number]} Prozent, auf 0–100 begrenzt, eine Nachkommastelle
 */
export function ausschnittVerschieben(l, img, foto, pos0, dx, dy) {
  const skala = l.fit === 'contain' ? Math.min(l.box.w / img.naturalWidth, l.box.h / img.naturalHeight) : Math.max(l.box.w / img.naturalWidth, l.box.h / img.naturalHeight);
  const zoom = foto.zoom || 1;
  const spielX = l.box.w - img.naturalWidth * skala * zoom;
  const spielY = l.box.h - img.naturalHeight * skala * zoom;
  const nx = Math.abs(spielX) > 0.5 ? pos0[0] + (dx / spielX) * 100 : pos0[0];
  const ny = Math.abs(spielY) > 0.5 ? pos0[1] + (dy / spielY) * 100 : pos0[1];
  return [Math.max(0, Math.min(100, +nx.toFixed(1))), Math.max(0, Math.min(100, +ny.toFixed(1)))];
}

/** Ausschnitt eines Fotos auf alle Bildebenen seiner Gruppe im aufgebauten Dokument anwenden. */
export function ausschnittAnwenden(vorlage, elemente, foto, gruppe) {
  if (!foto) return;
  for (const l of vorlage.layers) {
    if ((l.gruppe || l.id) !== gruppe || l.role === 'background-blur' || istGrafik(l)) continue;
    const img = elemente.get(l.id) && elemente.get(l.id).querySelector('img');
    if (!img) continue;
    const pos = positionCss(foto.position || l.position);
    img.style.objectPosition = pos;
    const zoom = foto.zoom || 1;
    const skalen = [l.skalierung && l.skalierung !== 1 ? `scale(${l.skalierung})` : '', zoom !== 1 ? `scale(${zoom})` : ''].filter(Boolean).join(' ');
    img.style.transform = skalen;
    img.style.transformOrigin = zoom !== 1 ? pos : 'center';
  }
}
