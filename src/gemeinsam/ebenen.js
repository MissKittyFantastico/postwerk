/**
 * Ebenenarten – an einer Stelle für Darstellung, Studio, Veröffentlichen, Markenprüfung,
 * Prüflauf und Einlesen.
 */

/**
 * Fertige Grafik (Symbol, Pinselpfote): festes Bild der Vorlage, nicht befüllbar.
 * Fehlte die Datei beim Einlesen, bleibt die Ebene trotzdem eine Grafik (grafikFehlt =
 * Pfad aus der Quelle) – sie wird nicht zum Fotofeld.
 */
export const istGrafik = (l) => l.type === 'image' && Boolean(l.medium || l.grafikFehlt);

/** Fotofeld, das beim Befüllen ein eigenes Foto bekommt (ohne unscharfen Hintergrund). */
export const istFotofeld = (l) => l.type === 'image' && !istGrafik(l) && l.role !== 'background-blur' && l.editable !== false;
