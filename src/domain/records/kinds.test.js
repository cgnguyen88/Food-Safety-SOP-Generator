import { describe, it, expect } from 'vitest';
import {
  RECORD_KINDS, RECORD_STATUSES, RECORD_SOURCES, RESTRICTED_KINDS, KIND_FIELDS, KIND_META, KIND_GROUPS,
  requiredFieldKeys, optionLabel,
} from './kinds.js';
import { KIND_ICONS } from '../../components/records/icons.js';

describe('record vocabulary', () => {
  it('defines the food safety kinds: sanitation, field and environment, people, harvest and traceability, and notes', () => {
    expect([...RECORD_KINDS].sort()).toEqual([
      'corrective_action', 'harvest', 'illness_injury', 'note', 'packing_cooling', 'sanitation_log', 'sanitizer_label',
      'sanitizer_purchase', 'shipment', 'soil_amendment', 'training', 'visitor', 'water_test', 'weather_event', 'wildlife_check',
    ]);
  });

  it('keeps illness and injury reports restricted', () => {
    expect(RESTRICTED_KINDS).toEqual(['illness_injury']);
  });

  it('defines the review workflow statuses and the sources the channels will use', () => {
    expect(RECORD_STATUSES).toEqual(['draft', 'needs_info', 'pending_review', 'approved', 'rejected', 'voided']);
    expect(RECORD_SOURCES).toEqual(['manual', 'web_upload', 'telegram', 'whatsapp', 'email', 'import']);
  });

  it('has bilingual metadata, a known icon and a field list for every kind', () => {
    for (const kind of RECORD_KINDS) {
      expect(KIND_META[kind].label.en, kind).toBeTruthy();
      expect(KIND_META[kind].label.es, kind).toBeTruthy();
      expect(KIND_META[kind].plural.en, kind).toBeTruthy();
      expect(KIND_META[kind].plural.es, kind).toBeTruthy();
      expect(KIND_ICONS[KIND_META[kind].icon], kind).toBeTruthy();
      expect(KIND_FIELDS[kind].length, kind).toBeGreaterThan(0);
    }
  });

  it('puts every kind in exactly one menu group', () => {
    const grouped = KIND_GROUPS.flatMap((g) => g.kinds);
    expect([...grouped].sort()).toEqual([...RECORD_KINDS].sort());
    for (const g of KIND_GROUPS) expect(g.label.en && g.label.es, g.id).toBeTruthy();
  });

  it('gives every field a unique key and an English and Spanish label', () => {
    for (const kind of RECORD_KINDS) {
      const keys = KIND_FIELDS[kind].map((f) => f.key);
      expect(new Set(keys).size, `${kind} keys`).toBe(keys.length);
      for (const f of KIND_FIELDS[kind]) {
        expect(f.label.en, `${kind}.${f.key}`).toBeTruthy();
        expect(f.label.es, `${kind}.${f.key}`).toBeTruthy();
        expect(['text', 'textarea', 'number', 'select'], `${kind}.${f.key}`).toContain(f.type);
      }
    }
  });

  it('gives every select field options that each have both languages', () => {
    for (const kind of RECORD_KINDS) {
      for (const f of KIND_FIELDS[kind].filter((x) => x.type === 'select')) {
        expect(f.options.length, `${kind}.${f.key}`).toBeGreaterThan(0);
        for (const option of f.options) {
          expect(option.value).toMatch(/^[a-z_]+$/);
          expect(option.en && option.es, `${kind}.${f.key}.${option.value}`).toBeTruthy();
        }
      }
    }
  });

  it('only makes a field conditionally required on a select field of the same kind, with values it can take', () => {
    for (const kind of RECORD_KINDS) {
      for (const f of KIND_FIELDS[kind].filter((x) => x.requiredWhen)) {
        for (const [key, wanted] of Object.entries(f.requiredWhen)) {
          const on = KIND_FIELDS[kind].find((x) => x.key === key);
          expect(on?.type, `${kind}.${f.key} depends on ${key}`).toBe('select');
          for (const value of [wanted].flat()) expect(on.options.map((o) => o.value), `${kind}.${f.key}`).toContain(value);
        }
      }
    }
  });
});

describe('requiredFieldKeys', () => {
  it('returns the unconditionally required fields', () => {
    expect(requiredFieldKeys('harvest', {})).toEqual(['crop', 'field', 'quantity', 'unit']);
    expect(requiredFieldKeys('visitor', {})).toEqual(['visitor_name', 'purpose', 'hygiene_briefing']);
  });

  it('asks for the sanitizer and its concentration only when something was sanitized', () => {
    expect(requiredFieldKeys('sanitation_log', { method: 'clean_only' })).toEqual(['item', 'method']);
    expect(requiredFieldKeys('sanitation_log', { method: 'clean_sanitize' })).toEqual(['item', 'method', 'sanitizer', 'ppm']);
    expect(requiredFieldKeys('sanitation_log', { method: 'sanitize_only' })).toEqual(['item', 'method', 'sanitizer', 'ppm']);
    expect(requiredFieldKeys('sanitation_log', {})).toEqual(['item', 'method']);
  });

  it('asks what was found and where the no-harvest zone is only when there were signs of animals', () => {
    expect(requiredFieldKeys('wildlife_check', { evidence: 'no' })).toEqual(['field', 'evidence']);
    expect(requiredFieldKeys('wildlife_check', { evidence: 'yes' })).toEqual(['field', 'evidence', 'evidence_description', 'no_harvest_zone']);
  });
});

describe('optionLabel', () => {
  it('returns the localized label of an option', () => {
    expect(optionLabel('weather_event', 'event_type', 'flood', 'en')).toBe('Flood');
    expect(optionLabel('weather_event', 'event_type', 'flood', 'es')).toBe('Inundación');
  });

  it('falls back to the raw value for unknown options or fields', () => {
    expect(optionLabel('weather_event', 'event_type', 'zzz', 'en')).toBe('zzz');
    expect(optionLabel('weather_event', 'nope', 'x', 'en')).toBe('x');
  });
});
