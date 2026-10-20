import { describe, it, expect } from 'vitest';
import { fieldLabel } from './labels.js';

describe('fieldLabel', () => {
  it('names a field in the requested language', () => {
    expect(fieldLabel('sanitation_log', 'ppm', 'en', 'Date')).toBe('Concentration (ppm)');
    expect(fieldLabel('sanitation_log', 'ppm', 'es', 'Fecha')).toBe('Concentración (ppm)');
  });

  it('uses the supplied label for the date', () => {
    expect(fieldLabel('harvest', 'record_date', 'es', 'Fecha')).toBe('Fecha');
  });

  it('falls back to the key for an unknown field or kind', () => {
    expect(fieldLabel('sanitation_log', 'mystery', 'en', 'Date')).toBe('mystery');
    expect(fieldLabel('nope', 'ppm', 'en', 'Date')).toBe('ppm');
  });
});
