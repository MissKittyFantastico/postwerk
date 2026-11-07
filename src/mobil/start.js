/**
 * Start der Handy-Fassung: erst die Brücke (window.postwerk), dann die Module der Anwendung,
 * die window.postwerk beim Laden lesen (kern.js und alles, was es nutzt).
 * Rückgabe: die geladenen Module für die Oberfläche.
 */
import { bereit } from './bruecke.js';

export async function starten() {
  await bereit();
  const [kern, entwurf, satz, darstellung] = await Promise.all([
    import('../renderer/js/kern.js'),
    import('../renderer/js/entwurf.js'),
    import('../renderer/js/satz.js'),
    import('../renderer/js/darstellung.js'),
  ]);
  const r = await window.postwerk.vorlagen.liste();
  kern.zustand.vorlagen = r.ok ? r.daten : [];
  const m = await window.postwerk.marke.lesen();
  kern.zustand.markenset = m.ok ? m.daten : null;
  return { kern, entwurf, satz, darstellung };
}
