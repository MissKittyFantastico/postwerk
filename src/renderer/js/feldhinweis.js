/**
 * Hinweis unter einem Textfeld: Zeilen, zu lang, mehr Zeilen oder Zeichen als vorgesehen,
 * verkleinert. Gemeinsam für das Studio am Rechner und die Handy-Fassung.
 * @param l     Textebene
 * @param t     Messung des gesetzten Textes (darstellung.textMessen)
 * @param text  eingegebener Text
 * @returns {{ satz: string, art: 'mute'|'gefahr'|'signal' }}
 */
export function feldHinweis(l, t, text) {
  const max = (l.layout && l.layout.lines) || 0;
  let art = 'mute';
  let satz = `${t.zeilen} ${t.zeilen === 1 ? 'Zeile' : 'Zeilen'}` + (max ? ` von ${max}` : '');
  if (t.zuBreit) {
    satz = 'Zu lang: Der Text ist breiter als sein Rahmen. Bitte kürzen.';
    art = 'gefahr';
  } else if (max && t.zeilen > max) {
    satz = `${t.zeilen} Zeilen – die Vorlage ist auf ${max} ausgelegt.`;
    art = 'signal';
  } else if (l.maxChars && text.length > l.maxChars) {
    satz = `${text.length} von ${l.maxChars} Zeichen – auf so viel ist das Feld ausgelegt.`;
    art = 'signal';
  } else if (t.groesse && l.font && t.groesse < l.font.size) {
    satz = `Verkleinert auf ${t.groesse} px · ` + satz;
    art = 'signal';
  }
  return { satz, art };
}
