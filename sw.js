/**
 * Service Worker der Handy-Fassung: legt beim ersten Besuch alle Dateien im Zwischenspeicher
 * des Browsers ab; danach startet Postwerk auch ohne Internet.
 * STAND und DATEIEN setzt werkzeuge/mobil-bauen.js beim Bauen ein (Prüfsumme aller Dateien):
 * ändert sich etwas, lädt der Browser den neuen Stand im Hintergrund und nutzt ihn ab dem
 * nächsten Start. Entwürfe und Fotos liegen in IndexedDB und bleiben davon unberührt.
 */
const STAND = "ac2470043b6c";
const DATEIEN = ["./","daten/medien.json","daten/vorlagen.json","index.html","manifest.webmanifest","selbsttest.json","src/gemeinsam/anlaesse.js","src/gemeinsam/designset/massvorgaben.json","src/gemeinsam/designset/symbole-index.json","src/gemeinsam/designset/tokens.json","src/gemeinsam/ebenen.js","src/gemeinsam/formate.js","src/gemeinsam/markenset.js","src/mobil/bildausgabe.js","src/mobil/bruecke.js","src/mobil/oberflaeche.js","src/mobil/schriften.js","src/mobil/schriften/NunitoSans-400.ttf","src/mobil/schriften/NunitoSans-600.ttf","src/mobil/schriften/NunitoSans-700.ttf","src/mobil/schriften/NunitoSans-800.ttf","src/mobil/schriften/NunitoSans-900.ttf","src/mobil/schriften/OFL-NunitoSans.txt","src/mobil/speicher.js","src/mobil/start.js","src/mobil/striche.js","src/mobil/vergleich.js","src/mobil/weichzeichnen.js","src/renderer/css/schriften.css","src/renderer/js/anordnen.js","src/renderer/js/ausschnitt.js","src/renderer/js/darstellung.js","src/renderer/js/einrasten.js","src/renderer/js/entwurf.js","src/renderer/js/feldhinweis.js","src/renderer/js/kern.js","src/renderer/js/satz.js","src/renderer/schriften/NunitoSans-Italic-Variable.ttf","src/renderer/schriften/OFL-NunitoSans.txt","src/renderer/schriften/OFL-Poppins.txt","src/renderer/schriften/OFL-SpaceMono.txt","src/renderer/schriften/Poppins-Bold.ttf","src/renderer/schriften/Poppins-BoldItalic.ttf","src/renderer/schriften/Poppins-ExtraBold.ttf","src/renderer/schriften/Poppins-ExtraBoldItalic.ttf","src/renderer/schriften/Poppins-Medium.ttf","src/renderer/schriften/Poppins-SemiBold.ttf","src/renderer/schriften/SpaceMono-Bold.ttf","src/renderer/schriften/SpaceMono-BoldItalic.ttf","src/renderer/schriften/SpaceMono-Regular.ttf","symbol-180.png","symbol-192.png","symbol-512.png","symbol-maskable-512.png"];
const NAME = 'postwerk-' + STAND;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(NAME).then((c) => c.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((namen) => Promise.all(namen.filter((n) => n.startsWith('postwerk-') && n !== NAME).map((n) => caches.delete(n)))));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(NAME).then(async (c) => {
    // Startseite auch über „./“ und „index.html“ finden; Abfrageparameter zählen nicht
    const treffer = await c.match(e.request, { ignoreSearch: true }) || (e.request.mode === 'navigate' ? await c.match('./') : null);
    return treffer || fetch(e.request);
  }));
});
