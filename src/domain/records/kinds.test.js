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
      'sanitizer_purchase', 'shipment', 'soil_amendment', 'training', 'visitor', 'water_assessment', 'water_test', 'weather_event', 'wildlife_check',
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
      for (const f of KIND_FIELDS[kind].filter((x) => x.requiredWhen || x.requiredUnless)) {
        for (const [key, wanted] of Object.entries(f.requiredWhen ?? f.requiredUnless)) {
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

  it('asks which field only when a corrective action lifts a field hold', () => {
    expect(requiredFieldKeys('corrective_action', {})).toEqual(['problem', 'action']);
    expect(requiredFieldKeys('corrective_action', { clears_hold: 'no' })).toEqual(['problem', 'action']);
    expect(requiredFieldKeys('corrective_action', { clears_hold: 'yes' })).toEqual(['problem', 'action', 'field']);
  });
});

describe('the water assessment record', () => {
  const keys = KIND_FIELDS.water_assessment.map((f) => f.key);
  const fieldOf = (key) => KIND_FIELDS.water_assessment.find((f) => f.key === key);

  it('covers what the Produce Safety Rule says an assessment looks at: the source, the people and animals near it, how the water is applied, the crop, the weather and test results', () => {
    expect(keys).toEqual([
      'source', 'source_type', 'fields_served', 'application_method', 'days_before_harvest',
      'source_concern', 'nearby_concern', 'practice_concern', 'crop_concern', 'weather_concern', 'testing_concern',
      'conclusion', 'mitigation', 'assessed_by', 'notes',
    ]);
  });

  it('needs the source, what it is, the fields it waters, how it is applied, how each factor looks and what was decided', () => {
    const everything = [
      'source', 'source_type', 'fields_served', 'application_method',
      'source_concern', 'nearby_concern', 'practice_concern', 'crop_concern', 'weather_concern', 'testing_concern', 'conclusion',
    ];
    expect(requiredFieldKeys('water_assessment', {})).toEqual(everything);
    for (const conclusion of ['no_mitigation', 'mitigation_needed']) expect(requiredFieldKeys('water_assessment', { conclusion })).toEqual(expect.arrayContaining(everything));
  });

  it('needs nothing more than the source when the decision is that it is not used any more', () => {
    expect(requiredFieldKeys('water_assessment', { conclusion: 'retired' })).toEqual(['source', 'conclusion']);
  });

  it('asks what will be done, and by when, only when the conclusion is that measures are needed', () => {
    expect(requiredFieldKeys('water_assessment', { conclusion: 'no_mitigation' })).not.toContain('mitigation');
    expect(requiredFieldKeys('water_assessment', { conclusion: 'mitigation_needed' })).toContain('mitigation');
  });

  it('rates every factor low, some or high, and lets test results also be "none"', () => {
    for (const key of ['source_concern', 'nearby_concern', 'practice_concern', 'crop_concern', 'weather_concern']) {
      expect(fieldOf(key).options.map((o) => o.value), key).toEqual(['low', 'some', 'high']);
    }
    expect(fieldOf('testing_concern').options.map((o) => o.value)).toEqual(['low', 'some', 'high', 'none']);
  });

  it('has a short conclusion in each language for the record’s title', () => {
    expect(optionLabel('water_assessment', 'conclusion', 'mitigation_needed', 'en')).toBe('Measures needed');
    expect(optionLabel('water_assessment', 'conclusion', 'no_mitigation', 'es')).toBe('No se necesitan medidas');
    expect(optionLabel('water_assessment', 'conclusion', 'retired', 'en')).toBe('Not used any more');
    expect(optionLabel('water_assessment', 'conclusion', 'retired', 'es')).toBe('Ya no se usa');
  });

  it('is listed with the field and environment records, next to water tests', () => {
    const group = KIND_GROUPS.find((g) => g.id === 'field');
    expect(group.kinds.indexOf('water_assessment')).toBe(group.kinds.indexOf('water_test') + 1);
  });

  it('lets a flood record say which water source it may have reached, so it can be tied to that source’s assessment', () => {
    const field = KIND_FIELDS.weather_event.find((f) => f.key === 'water_source');
    expect(field.type).toBe('text');
    expect(field.required).toBeUndefined();
    expect(requiredFieldKeys('weather_event', { event_type: 'flood' })).not.toContain('water_source');
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
