import { describe, it, expect } from 'vitest';
import { buildPosterHtml } from './posterHtml.js';

const input = { lang: 'en', farmName: 'Green Valley Farm', sopTitle: 'Handwashing', svg: '<svg viewBox="0 0 10 10"></svg>', headline: 'Scan to read', hint: 'Then sign that you read it.' };

describe('buildPosterHtml', () => {
  it('is a complete page with the farm, the SOP, the QR picture and the words', () => {
    const html = buildPosterHtml(input);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    for (const text of ['Green Valley Farm', 'Handwashing', '<svg viewBox="0 0 10 10"></svg>', 'Scan to read', 'Then sign that you read it.']) expect(html).toContain(text);
    expect(html).toContain('lang="en"');
  });

  it('escapes everything a person typed, so a farm or SOP name cannot add markup or script to the poster', () => {
    const html = buildPosterHtml({ ...input, farmName: '<img src=x onerror=alert(1)>', sopTitle: '"><script>alert(2)</script>', headline: "<b>'hi'</b>", hint: '&<>' });
    expect(html).not.toMatch(/<img src=x|<script>|<b>/);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&amp;&lt;&gt;');
  });

  it('leaves out the farm line when the farm has no name', () => {
    expect(buildPosterHtml({ ...input, farmName: '' })).not.toContain('class="farm"');
  });

  it('marks the language', () => {
    expect(buildPosterHtml({ ...input, lang: 'es' })).toContain('lang="es"');
    expect(buildPosterHtml({ ...input, lang: 'fr' })).toContain('lang="en"');
  });
});
