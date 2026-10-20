import { describe, it, expect } from 'vitest';
import { qrSvg } from './qr.js';

describe('qrSvg', () => {
  const url = `https://farm.example.com/s/${'a'.repeat(64)}`;

  it('makes a scalable SVG picture', () => {
    const svg = qrSvg(url);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('</svg>');
  });

  it('makes the same picture for the same text, and a different one for different text', () => {
    expect(qrSvg(url)).toBe(qrSvg(url));
    expect(qrSvg(url)).not.toBe(qrSvg(`${url}b`));
  });

  it('draws something (not a blank square)', () => {
    expect(qrSvg(url).match(/<path/g)?.length ?? 0).toBeGreaterThan(0);
  });

  it('does not put the text itself in the picture’s markup', () => {
    expect(qrSvg(url)).not.toContain('farm.example.com');
  });
});
