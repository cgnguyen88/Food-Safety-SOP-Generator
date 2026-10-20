import { describe, it, expect } from 'vitest';
import { SHARED_TEXT } from './sharedText.js';

const shape = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) => (value && typeof value === 'object' ? shape(value, `${prefix}${key}.`) : [`${prefix}${key}:${typeof value}`])).sort();

describe('shared text', () => {
  it('has the same keys, with the same kinds of values, in English and Spanish', () => {
    expect(shape(SHARED_TEXT.es)).toEqual(shape(SHARED_TEXT.en));
  });

  it('has no empty strings', () => {
    for (const lang of ['en', 'es']) {
      const walk = (o, path) => Object.entries(o).forEach(([k, v]) => (typeof v === 'object' ? walk(v, `${path}.${k}`) : typeof v === 'string' && expect(v.trim(), `${lang}.${path}.${k}`).not.toBe('')));
      walk(SHARED_TEXT[lang], lang);
    }
  });

  it('thanks the person by name in both languages', () => {
    expect(SHARED_TEXT.en.page.sign.thanks('Ana')).toContain('Ana');
    expect(SHARED_TEXT.es.page.sign.thanks('Ana')).toContain('Ana');
  });

  it('speaks to the reader as tú in Spanish', () => {
    const strings = [];
    const walk = (o) => Object.values(o).forEach((v) => (typeof v === 'object' ? walk(v) : typeof v === 'function' ? strings.push(v('Ana')) : strings.push(v)));
    walk(SHARED_TEXT.es);
    expect(strings.filter((text) => /\b(usted|ustedes|su supervisor|Pídale|Revise|Escriba|Marque)\b/.test(text))).toEqual([]);
  });
});
