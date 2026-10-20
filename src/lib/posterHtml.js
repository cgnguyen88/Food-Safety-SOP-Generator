const escape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * The page a worker's phone is pointed at: a poster with the SOP's name, a large QR code and a line of words, ready
 * to print and pin up. Everything typed by a person is escaped; the QR picture is made by this app.
 *
 * @param {{ lang: 'en' | 'es', farmName?: string, sopTitle: string, svg: string, headline: string, hint: string }} input
 * @returns {string} a complete HTML document
 */
export function buildPosterHtml({ lang, farmName, sopTitle, svg, headline, hint }) {
  return `<!doctype html>
<html lang="${lang === 'es' ? 'es' : 'en'}"><head><meta charset="utf-8"><title>${escape(sopTitle)}</title>
<style>
  @page { size: letter portrait; margin: 0.6in; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #0f172a; text-align: center; margin: 0; }
  .farm { font: 600 20pt/1.2 Arial, sans-serif; color: #475569; margin: 0 0 10pt; }
  h1 { font-size: 34pt; line-height: 1.15; margin: 0 0 18pt; }
  .qr { width: 5.4in; max-width: 100%; margin: 0 auto 16pt; }
  .qr svg { width: 100%; height: auto; display: block; }
  .hint { font: 18pt/1.35 Arial, sans-serif; margin: 0; }
</style></head>
<body>
  ${farmName ? `<p class="farm">${escape(farmName)}</p>` : ''}
  <h1>${escape(sopTitle)}</h1>
  <div class="qr">${svg}</div>
  <p class="hint"><strong>${escape(headline)}</strong><br>${escape(hint)}</p>
</body></html>`;
}
