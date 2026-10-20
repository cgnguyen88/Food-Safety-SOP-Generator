import { describe, it, expect } from 'vitest';
import { KIND_FIELDS, RECORD_KINDS } from './kinds.js';
import { toCsv } from './csv.js';
import {
  REPORT_KIND_ORDER, REPORT_TEXT, buildReport, recordsToCsvRows, reviewChecks, describePeriod, reportFileName, reportStatuses,
} from './report.js';

// Approved at local noon on 2 June: the local date is 2026-06-02 wherever the tests run.
const APPROVED_AT = new Date(2026, 5, 2, 12, 0, 0).toISOString();

/** Run `fn` with the machine's time zone set to `zone`. */
function inTimeZone(zone, fn) {
  const before = process.env.TZ;
  process.env.TZ = zone;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

let counter = 0;
const rec = (kind, record_date, payload, extra = {}) =>
  ({ id: `r${++counter}`, kind, status: 'approved', record_date, payload, source: 'manual', reviewed_at: APPROVED_AT, created_at: `2026-06-01T10:00:${String(counter % 60).padStart(2, '0')}Z`, ...extra });

const farm = { id: 'f1', name: 'Palo Verde Farm', farm_code: 'PV-1234' };
const base = { farm, lang: 'en', generatedOn: '2026-10-14' };

const clean = (date, payload = {}, extra) => rec('sanitation_log', date, { item: 'Harvest bins', field: 'B2', method: 'clean_sanitize', sanitizer: 'Chlorine', ppm: 150, ...payload }, extra);

describe('REPORT_KIND_ORDER', () => {
  it('lists every record kind exactly once, so nothing can be left out of a report', () => {
    expect([...REPORT_KIND_ORDER].sort()).toEqual([...RECORD_KINDS].sort());
  });
});

describe('REPORT_TEXT', () => {
  const shape = (obj, prefix = '') =>
    Object.entries(obj).flatMap(([key, value]) => (value && typeof value === 'object' ? shape(value, `${prefix}${key}.`) : [`${prefix}${key}:${typeof value}`])).sort();

  it('has the same keys in English and Spanish', () => {
    expect(shape(REPORT_TEXT.es)).toEqual(shape(REPORT_TEXT.en));
  });

  it('has no empty strings', () => {
    const walk = (o, path) => Object.entries(o).forEach(([k, v]) => (typeof v === 'object' ? walk(v, `${path}.${k}`) : typeof v === 'string' && expect(v.trim(), path + k).not.toBe('')));
    walk(REPORT_TEXT.en, 'en');
    walk(REPORT_TEXT.es, 'es');
  });
});

describe('reportStatuses', () => {
  it('is approved only by default, and adds work in progress (never rejected or voided) when asked', () => {
    expect(reportStatuses(false)).toEqual(['approved']);
    expect(reportStatuses(true).sort()).toEqual(['approved', 'draft', 'needs_info', 'pending_review']);
  });

  it('hands out a copy, so a caller cannot change the rule', () => {
    reportStatuses(false).push('rejected');
    expect(reportStatuses(false)).toEqual(['approved']);
  });
});

describe('buildReport: what goes in', () => {
  it('makes one section per kind that has records, in inspection order, with counts', () => {
    const report = buildReport({
      ...base,
      records: [
        rec('harvest', '2026-08-01', { crop: 'Lettuce', field: 'B2', quantity: 40, unit: 'cartons' }),
        clean('2026-07-01'),
        rec('training', '2026-03-01', { topic: 'Handwashing', trainer: 'Ana', attendees: 'Crew A' }),
        clean('2026-07-15'),
      ],
    });
    expect(report.sections.map((s) => s.kind)).toEqual(['training', 'sanitation_log', 'harvest']);
    expect(report.sections.map((s) => s.count)).toEqual([1, 2, 1]);
    expect(report.total).toBe(4);
  });

  it('never includes voided or rejected records, whatever is asked', () => {
    const records = [clean('2026-07-01', {}, { status: 'voided' }), clean('2026-07-02', {}, { status: 'rejected' })];
    const report = buildReport({ ...base, includeUnapproved: true, records });
    expect(report.sections).toEqual([]);
    expect(report.total).toBe(0);
    expect(recordsToCsvRows(records, 'en', { includeUnapproved: true })).toHaveLength(1);
  });

  it('leaves out records that are not approved unless asked, even if they are handed over', () => {
    const records = [
      clean('2026-07-01'),
      clean('2026-07-02', {}, { status: 'draft' }),
      clean('2026-07-03', {}, { status: 'pending_review' }),
      clean('2026-07-04', {}, { status: 'needs_info' }),
    ];
    expect(buildReport({ ...base, records }).total).toBe(1);
    expect(buildReport({ ...base, records, includeUnapproved: true }).total).toBe(4);
  });

  it('skips records of a kind it does not know', () => {
    const report = buildReport({ ...base, records: [rec('mystery', '2026-07-01', { a: 1 }), clean('2026-07-01')] });
    expect(report.total).toBe(1);
  });

  it('puts the oldest record first and records without a date last', () => {
    const report = buildReport({
      ...base,
      includeUnapproved: true,
      records: [
        clean('2026-07-20'),
        clean(null, {}, { status: 'draft' }),
        clean('2026-07-01'),
      ],
    });
    expect(report.sections[0].rows.map((row) => row[0])).toEqual(['2026-07-01', '2026-07-20', '']);
  });

  it('orders records from the same day by when they were added', () => {
    const report = buildReport({
      ...base,
      records: [
        clean('2026-07-01', { sanitizer: 'Second' }, { created_at: '2026-07-01T11:00:00Z' }),
        clean('2026-07-01', { sanitizer: 'First' }, { created_at: '2026-07-01T09:00:00Z' }),
      ],
    });
    const product = report.sections[0].columns.findIndex((c) => c.label === 'Sanitizer used');
    expect(report.sections[0].rows.map((r) => r[product])).toEqual(['First', 'Second']);
  });

  it('does not change the records it is given', () => {
    const records = Object.freeze([Object.freeze(clean('2026-07-20')), Object.freeze(clean('2026-07-01'))]);
    expect(() => buildReport({ ...base, records })).not.toThrow();
    expect(records[0].record_date).toBe('2026-07-20');
  });
});

describe('buildReport: columns and cells', () => {
  it('shows only the columns that have something in them, always starting with the date', () => {
    const report = buildReport({ ...base, records: [clean('2026-07-01')] });
    const labels = report.sections[0].columns.map((c) => c.label);
    expect(labels).toEqual(['Date', 'Item or surface', 'Field / area', 'What was done', 'Sanitizer used', 'Concentration (ppm)', 'Approved']);
  });

  it('adds a column as soon as one record uses it', () => {
    const report = buildReport({ ...base, records: [clean('2026-07-01'), clean('2026-07-02', { performed_by: 'Ana' })] });
    expect(report.sections[0].columns.map((c) => c.label)).toContain('Done by');
    const col = report.sections[0].columns.findIndex((c) => c.label === 'Done by');
    expect(report.sections[0].rows.map((r) => r[col])).toEqual(['', 'Ana']);
  });

  it('shows choices by their name in the report language, not by their stored value', () => {
    const records = [clean('2026-07-01', { check_result: 'fail' })];
    const en = buildReport({ ...base, records });
    const es = buildReport({ ...base, lang: 'es', records });
    expect(en.sections[0].rows[0]).toContain('Cleaned, then sanitized');
    expect(en.sections[0].rows[0]).toContain('Outside the label range');
    expect(es.sections[0].rows[0]).toContain('Limpiado y luego desinfectado');
    expect(es.sections[0].rows[0]).toContain('Fuera del rango de la etiqueta');
    expect(es.sections[0].columns.map((c) => c.label)).toContain('Desinfectante usado');
    expect(es.sections[0].title).toBe('Registro de Limpieza');
  });

  it('keeps a stored value it does not recognise rather than hiding it', () => {
    const report = buildReport({ ...base, records: [clean('2026-07-01', { check_result: 'brand_new_value' })] });
    expect(report.sections[0].rows[0]).toContain('brand_new_value');
  });

  it('joins a quantity with its unit, and a temperature with its unit, in one cell', () => {
    const harvest = buildReport({ ...base, records: [rec('harvest', '2026-08-01', { crop: 'Lettuce', field: 'B2', quantity: 40, unit: 'cartons' })] });
    const labels = harvest.sections[0].columns.map((c) => c.label);
    expect(labels).not.toContain('Unit');
    expect(harvest.sections[0].rows[0][labels.indexOf('Quantity')]).toBe('40 cartons');

    const cooled = buildReport({ ...base, records: [rec('packing_cooling', '2026-08-01', { lot_code: 'GV-0801', temperature: 34, temperature_unit: 'f' })] });
    const coolLabels = cooled.sections[0].columns.map((c) => c.label);
    expect(coolLabels).not.toContain('Temperature unit');
    expect(cooled.sections[0].rows[0][coolLabels.indexOf('Product temperature')]).toBe('34 °F');
  });

  it('shows a quantity of zero rather than treating it as empty', () => {
    const report = buildReport({ ...base, records: [rec('sanitizer_purchase', '2026-08-01', { product: 'Bleach', supplier: 'Acme', quantity: 0, unit: 'gal' })] });
    const labels = report.sections[0].columns.map((c) => c.label);
    expect(report.sections[0].rows[0][labels.indexOf('Quantity')]).toBe('0 gal');
  });

  it('shows when each approved record was approved, and nothing for ones that are not', () => {
    const report = buildReport({
      ...base,
      includeUnapproved: true,
      records: [clean('2026-07-01'), clean('2026-07-02', {}, { status: 'draft', reviewed_at: null })],
    });
    const { columns, rows } = report.sections[0];
    const approved = columns.findIndex((c) => c.label === 'Approved');
    expect(rows.map((r) => r[approved])).toEqual(['2026-06-02', '']);
  });

  it('shows the approval date in the farm’s own time, not in UTC, so it is never after the report date', () => {
    const approvedLate = '2026-10-14T01:30:00.123+00:00'; // 6:30 pm on 13 October in California
    const report = inTimeZone('America/Los_Angeles', () => buildReport({ ...base, records: [clean('2026-10-13', {}, { reviewed_at: approvedLate })] }));
    const { columns, rows } = report.sections[0];
    expect(rows[0][columns.findIndex((c) => c.label === 'Approved')]).toBe('2026-10-13');
    const csv = inTimeZone('America/Los_Angeles', () => recordsToCsvRows([clean('2026-10-13', {}, { reviewed_at: approvedLate })], 'en'));
    expect(csv[1].at(-1)).toBe('2026-10-13');
  });

  it('shows the approval date as a later day for a farm east of UTC', () => {
    const approvedEvening = '2026-10-13T20:00:00Z'; // 9:00 am on 14 October in New Zealand
    const report = inTimeZone('Pacific/Auckland', () => buildReport({ ...base, records: [clean('2026-10-13', {}, { reviewed_at: approvedEvening })] }));
    const { columns, rows } = report.sections[0];
    expect(rows[0][columns.findIndex((c) => c.label === 'Approved')]).toBe('2026-10-14');
  });

  it('shows no approval date for a timestamp it cannot read', () => {
    const report = buildReport({ ...base, records: [clean('2026-07-01', {}, { reviewed_at: 'not a date' })] });
    expect(report.sections[0].columns.map((c) => c.label)).not.toContain('Approved');
  });

  it('shows a plain date as it is, without moving it a day', () => {
    const report = inTimeZone('America/Los_Angeles', () => buildReport({ ...base, records: [clean('2026-07-01', {}, { reviewed_at: '2026-06-02' })] }));
    const { columns, rows } = report.sections[0];
    expect(rows[0][columns.findIndex((c) => c.label === 'Approved')]).toBe('2026-06-02');
  });

  it('does not show an approval date for a record that was reopened after being approved', () => {
    const report = buildReport({
      ...base,
      includeUnapproved: true,
      records: [clean('2026-07-01', {}, { status: 'pending_review', reviewed_at: APPROVED_AT })],
    });
    expect(report.sections[0].columns.map((c) => c.label)).not.toContain('Approved');
  });

  it('drops the approved column when no record has an approval date', () => {
    const report = buildReport({ ...base, records: [clean('2026-07-01', {}, { reviewed_at: null })] });
    expect(report.sections[0].columns.map((c) => c.label)).not.toContain('Approved');
  });

  it('adds a status column only when records that are not approved are included', () => {
    const records = [clean('2026-07-01'), clean('2026-07-02', {}, { status: 'pending_review' })];
    expect(buildReport({ ...base, records }).sections[0].columns.map((c) => c.label)).not.toContain('Status');
    const withStatus = buildReport({ ...base, records, includeUnapproved: true }).sections[0];
    const idx = withStatus.columns.findIndex((c) => c.label === 'Status');
    expect(withStatus.rows.map((r) => r[idx])).toEqual(['Approved', 'Needs review']);
  });

  it('removes control characters from the date cell too', () => {
    const report = buildReport({ ...base, records: [clean('2026-07-01\u0000')] });
    expect(report.sections[0].rows[0][0]).toBe('2026-07-01');
  });

  it('shrinks long runs of blank lines in a note, so one record cannot take up pages', () => {
    const report = buildReport({ ...base, records: [clean('2026-07-01', { notes: `\n\n${'\n'.repeat(2000)}first\n\n\n\n\nsecond${'\n'.repeat(500)}` })] });
    const notes = report.sections[0].rows[0][report.sections[0].columns.findIndex((c) => c.label === 'Notes')];
    expect(notes).toBe('first\n\nsecond');
  });

  it('shrinks runs of blank lines in a quantity and its unit too', () => {
    const report = buildReport({ ...base, records: [rec('harvest', '2026-08-01', { crop: 'Lettuce', field: 'B2', quantity: 40, unit: 'cartons\n\n\n\n\nbox' })] });
    const { columns, rows } = report.sections[0];
    expect(rows[0][columns.findIndex((c) => c.label === 'Quantity')]).toBe('40 cartons\n\nbox');
  });

  it('loses nothing a farmer recorded: every value of every kind is somewhere in its report table', () => {
    const sample = (f) => (f.type === 'number' ? 7 : f.type === 'select' ? f.options[0].value : `value-${f.key}`);
    for (const kind of RECORD_KINDS) {
      const payload = Object.fromEntries(KIND_FIELDS[kind].map((f) => [f.key, sample(f)]));
      const { sections } = buildReport({ ...base, records: [rec(kind, '2026-07-01', payload)] });
      const text = sections[0].rows[0].join(' | ');
      for (const f of KIND_FIELDS[kind]) {
        const shown = f.type === 'select' ? f.options[0].en : String(sample(f));
        expect(text, `${kind}.${f.key}`).toContain(shown);
      }
    }
  });

  it('keeps a single line break, and a blank line between paragraphs, in a note', () => {
    const report = buildReport({ ...base, records: [clean('2026-07-01', { notes: 'one\ntwo\n\nthree' })] });
    const notes = report.sections[0].rows[0][report.sections[0].columns.findIndex((c) => c.label === 'Notes')];
    expect(notes).toBe('one\ntwo\n\nthree');
  });

  it('keeps the whole note in a spreadsheet', () => {
    const rows = recordsToCsvRows([clean('2026-07-01', { notes: 'a\n\n\n\nb' })], 'en');
    expect(rows[1][rows[0].indexOf('Notes')]).toBe('a\n\n\n\nb');
  });

  it('survives a stored value that is not text or a number', () => {
    const odd = { toString: 1 };
    const report = buildReport({ ...base, records: [clean('2026-07-01', { notes: odd, field: ['a', 'b'] })] });
    expect(report.total).toBe(1);
    expect(report.sections[0].rows[0].join('|')).toContain('{"toString":1}');
    expect(() => recordsToCsvRows([clean('2026-07-01', { notes: odd })], 'en')).not.toThrow();
  });

  it('removes control characters from every cell', () => {
    const report = buildReport({ ...base, records: [clean('2026-07-01', { notes: 'bad\u0000text\u0008here' })] });
    expect(report.sections[0].rows[0].join('|')).toContain('badtexthere');
    expect(report.sections[0].rows[0].join('|')).not.toMatch(/[\u0000-\u0008]/); // eslint-disable-line no-control-regex
  });
});

describe('buildReport: the page header', () => {
  const operation = { operationName: 'Palo Verde Produce', ownerName: 'Cuong Nguyen', foodSafetyManager: 'Ana Reyes', address: '1 Farm Rd, Davis, CA', auditor: 'PrimusGFS', fsmaStatus: 'Covered farm' };

  it('names the operation, farm, owner, food safety manager, address, auditor, FSMA status, period, date and scope', () => {
    const report = buildReport({ ...base, operation, records: [clean('2026-07-01')], period: { type: 'range', from: '2026-04-01', to: '2027-03-31' } });
    expect(Object.fromEntries(report.header.map((h) => [h.label, h.value]))).toEqual({
      Operation: 'Palo Verde Produce',
      'Farm code': 'PV-1234',
      'Owner / operator': 'Cuong Nguyen',
      'Food safety manager': 'Ana Reyes',
      Address: '1 Farm Rd, Davis, CA',
      Auditor: 'PrimusGFS',
      'FSMA status': 'Covered farm',
      Period: '2026-04-01 to 2027-03-31',
      'Report date': '2026-10-14',
      Records: 'Approved records only',
    });
  });

  it('falls back to the farm name, and leaves out whatever is not known', () => {
    const report = buildReport({ ...base, records: [clean('2026-07-01')] });
    const labels = report.header.map((h) => h.label);
    expect(report.header.find((h) => h.label === 'Operation').value).toBe('Palo Verde Farm');
    expect(labels).not.toContain('Auditor');
    expect(labels).not.toContain('Address');
    expect(labels).not.toContain('Owner / operator');
    expect(labels).not.toContain('FSMA status');
  });

  it('says so when records that are not approved are included', () => {
    const report = buildReport({ ...base, includeUnapproved: true, records: [clean('2026-07-01')] });
    expect(report.header.find((h) => h.label === 'Records').value).toBe('Includes records not yet approved');
  });

  it('uses the scope title when there is one, otherwise the standard title', () => {
    expect(buildReport({ ...base, records: [] }).title).toBe('Food Safety Records Report');
    expect(buildReport({ ...base, records: [], title: 'This season’s harvests' }).title).toBe('This season’s harvests');
    expect(buildReport({ ...base, lang: 'es', records: [] }).title).toBe('Informe de Registros de Inocuidad Alimentaria');
  });

  it('cleans the title, which is a name a manager typed', () => {
    expect(buildReport({ ...base, records: [], title: 'Sprays\u0000 \uFFFF2026' }).title).toBe('Sprays 2026');
  });

  it('cleans every header value', () => {
    const report = buildReport({ ...base, operation: { operationName: 'Farm\u0000 One' }, records: [] });
    expect(report.header.find((h) => h.label === 'Operation').value).toBe('Farm One');
  });

  it('passes on that the list was cut short', () => {
    expect(buildReport({ ...base, records: [], truncated: true }).truncated).toBe(true);
    expect(buildReport({ ...base, records: [] }).truncated).toBe(false);
  });

  it('carries the report text for the renderers', () => {
    expect(buildReport({ ...base, lang: 'es', records: [] }).text).toBe(REPORT_TEXT.es);
    expect(buildReport({ ...base, lang: 'fr', records: [] }).text).toBe(REPORT_TEXT.en);
  });
});

describe('describePeriod', () => {
  it('describes a range, one open end, and everything', () => {
    expect(describePeriod({ type: 'range', from: '2026-04-01', to: '2027-03-31' }, 'en')).toBe('2026-04-01 to 2027-03-31');
    expect(describePeriod({ type: 'range', from: '2026-04-01' }, 'en')).toBe('From 2026-04-01');
    expect(describePeriod({ type: 'range', to: '2026-04-01' }, 'en')).toBe('Up to 2026-04-01');
    expect(describePeriod({ type: 'all' }, 'en')).toBe('All dates');
    expect(describePeriod(null, 'en')).toBe('All dates');
    expect(describePeriod({ type: 'range', from: '2026-04-01', to: '2027-03-31' }, 'es')).toBe('2026-04-01 a 2027-03-31');
    expect(describePeriod({ type: 'all' }, 'es')).toBe('Todas las fechas');
  });
});

describe('recordsToCsvRows', () => {
  it('starts with a header row and writes one row per record, oldest first', () => {
    const rows = recordsToCsvRows([clean('2026-07-20'), clean('2026-07-01')], 'en');
    expect(rows[0].slice(0, 4)).toEqual(['Date', 'Item or surface', 'Field / area', 'What was done']);
    expect(rows).toHaveLength(3);
    expect(rows[1][0]).toBe('2026-07-01');
    expect(rows[2][0]).toBe('2026-07-20');
  });

  it('keeps quantity and unit in separate columns, and numbers as numbers, for spreadsheets', () => {
    const rows = recordsToCsvRows([rec('harvest', '2026-08-01', { crop: 'Lettuce', field: 'B2', quantity: 40, unit: 'cartons' })], 'en');
    const q = rows[0].indexOf('Quantity');
    expect(rows[0][q + 1]).toBe('Unit');
    expect(rows[1][q]).toBe(40);
    expect(rows[1][q + 1]).toBe('cartons');
  });

  it('leaves out the Type column when every record is the same kind, and adds it when they are mixed', () => {
    expect(recordsToCsvRows([clean('2026-07-01')], 'en')[0]).not.toContain('Type');
    const mixed = recordsToCsvRows([clean('2026-07-01'), rec('harvest', '2026-08-01', { crop: 'Lettuce', field: 'B2', quantity: 1, unit: 'cartons' })], 'en');
    expect(mixed[0][1]).toBe('Type');
    expect(mixed.slice(1).map((r) => r[1])).toEqual(['Cleaning & sanitizing', 'Harvest']);
  });

  it('puts a shared field such as Quantity in one column, even across kinds', () => {
    const rows = recordsToCsvRows([
      rec('harvest', '2026-07-01', { crop: 'Lettuce', field: 'B2', quantity: 40, unit: 'cartons' }),
      rec('shipment', '2026-07-02', { customer: 'Co-op', lot_codes: 'GV-1', quantity: 30, unit: 'cartons' }),
    ], 'en');
    expect(rows[0].filter((h) => h === 'Quantity')).toHaveLength(1);
    const q = rows[0].indexOf('Quantity');
    expect(rows[1][q]).toBe(40);
    expect(rows[2][q]).toBe(30);
  });

  it('ends with status, source and approval date, in the chosen language', () => {
    const rows = recordsToCsvRows([clean('2026-07-01', {}, { source: 'telegram' })], 'es');
    expect(rows[0].slice(-3)).toEqual(['Estado', 'Origen', 'Aprobado']);
    expect(rows[1].slice(-3)).toEqual(['Aprobado', 'Telegram', '2026-06-02']);
  });

  it('applies the same rules as the report: no voided records, no unapproved ones unless asked', () => {
    const records = [clean('2026-07-01'), clean('2026-07-02', {}, { status: 'voided' }), clean('2026-07-03', {}, { status: 'draft' })];
    expect(recordsToCsvRows(records, 'en')).toHaveLength(2);
    expect(recordsToCsvRows(records, 'en', { includeUnapproved: true })).toHaveLength(3);
    expect(recordsToCsvRows(records, 'en', { includeUnapproved: true }).map((r) => r[0])).not.toContain('2026-07-02');
  });

  it('keeps a label’s “Product name” and a purchase’s “Product” in separate columns', () => {
    const rows = recordsToCsvRows([
      rec('sanitizer_label', '2026-07-01', { product: 'Sani-Clean', approved_use: 'food_contact' }),
      rec('sanitizer_purchase', '2026-07-02', { product: 'Sani-Clean 5 gal', supplier: 'Acme' }),
    ], 'en');
    const named = rows[0].indexOf('Product name');
    const bought = rows[0].indexOf('Product');
    expect(named).toBeGreaterThan(-1);
    expect(bought).toBeGreaterThan(-1);
    expect(rows[1][named]).toBe('Sani-Clean');
    expect(rows[1][bought]).toBe('');
    expect(rows[2][named]).toBe('');
    expect(rows[2][bought]).toBe('Sani-Clean 5 gal');
  });

  it('ends with a line saying the list is cut short, when it is, so the file cannot pass for complete', () => {
    const records = [clean('2026-07-01')];
    const cut = recordsToCsvRows(records, 'en', { truncated: true });
    expect(cut).toHaveLength(3);
    expect(cut.at(-1)).toEqual([REPORT_TEXT.en.truncated]);
    expect(recordsToCsvRows(records, 'es', { truncated: true }).at(-1)).toEqual([REPORT_TEXT.es.truncated]);
    expect(recordsToCsvRows(records, 'en')).toHaveLength(2);
    expect(recordsToCsvRows(records, 'en', { truncated: false })).toHaveLength(2);
  });

  it('gives just a header when there are no records', () => {
    const rows = recordsToCsvRows([], 'en');
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe('Date');
  });

  it('gives a spreadsheet no way to run a formula that someone typed into a record', () => {
    const csv = toCsv(recordsToCsvRows([clean('2026-07-01', { notes: '=HYPERLINK("http://evil.example","click")', sanitizer: '+cmd|calc' })], 'en'), { bom: false });
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+cmd|calc");
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
  });

  it('has a column for every field of every kind (nothing recorded is lost in an export)', () => {
    const everything = RECORD_KINDS.map((kind) => rec(kind, '2026-07-01', Object.fromEntries(KIND_FIELDS[kind].map((f) => [f.key, f.type === 'number' ? 1 : f.type === 'select' ? f.options[0].value : 'x']))));
    const header = recordsToCsvRows(everything, 'en')[0];
    for (const kind of RECORD_KINDS) {
      for (const f of KIND_FIELDS[kind]) expect(header, `${kind}.${f.key}`).toContain(f.label.en);
    }
  });
});

describe('reviewChecks', () => {
  it('counts the findings an auditor will expect a corrective action for', () => {
    const checks = reviewChecks([
      clean('2026-07-01', { check_result: 'fail' }),
      clean('2026-07-02', { check_result: 'pass' }),
      rec('water_test', '2026-07-01', { source: 'Well 1', result: 'fail' }),
      rec('water_test', '2026-07-01', { source: 'Well 1', result: 'pass' }),
      rec('wildlife_check', '2026-07-01', { field: 'B2', evidence: 'yes' }),
      rec('wildlife_check', '2026-07-02', { field: 'B2', evidence: 'yes' }),
      rec('wildlife_check', '2026-07-03', { field: 'B2', evidence: 'no' }),
      rec('weather_event', '2026-07-01', { event_type: 'flood', field: 'A1', crop_contact: 'yes' }),
      rec('weather_event', '2026-07-01', { event_type: 'hail', field: 'A1', crop_contact: 'unknown' }),
    ]);
    expect(checks).toEqual([
      { code: 'sanitizer_out_of_range', count: 1 },
      { code: 'water_test_failed', count: 1 },
      { code: 'animal_signs', count: 2 },
      { code: 'crop_contact', count: 1 },
    ]);
  });

  it('reports nothing when there is nothing to check, and ignores records that are not approved or are voided', () => {
    expect(reviewChecks([])).toEqual([]);
    expect(reviewChecks([
      rec('water_test', '2026-07-01', { source: 'Well 1', result: 'fail' }, { status: 'draft' }),
      rec('water_test', '2026-07-01', { source: 'Well 1', result: 'fail' }, { status: 'voided' }),
    ])).toEqual([]);
  });
});

describe('reportFileName', () => {
  it('builds a plain, safe file name from the farm, the scope and the date', () => {
    expect(reportFileName({ farm: { name: 'Palo Verde Farm' }, scope: 'This season’s harvests', generatedOn: '2026-10-14', ext: 'csv' }))
      .toBe('food-safety-records_palo-verde-farm_this-season-s-harvests_2026-10-14.csv');
  });

  it('removes accents and anything that could act like a path', () => {
    const name = reportFileName({ farm: { name: '../../Finca Año/Nuevo\\x' }, scope: 'Cosecha', generatedOn: '2026-10-14', ext: 'docx' });
    expect(name).toBe('food-safety-records_finca-ano-nuevo-x_cosecha_2026-10-14.docx');
    expect(name).not.toMatch(/[/\\]/);
  });

  it('copes with a name that has no usable letters and with very long names', () => {
    expect(reportFileName({ farm: { name: '日本' }, generatedOn: '2026-10-14', ext: 'csv' })).toBe('food-safety-records_farm_2026-10-14.csv');
    const long = reportFileName({ farm: { name: 'a'.repeat(300) }, scope: 'b'.repeat(300), generatedOn: '2026-10-14', ext: 'csv' });
    expect(long.length).toBeLessThan(120);
  });

  it('says so in the name when the list was cut short', () => {
    expect(reportFileName({ farm: { name: 'Palo Verde Farm' }, scope: 'Sprays', generatedOn: '2026-10-14', ext: 'csv', partial: true }))
      .toBe('food-safety-records_palo-verde-farm_sprays_partial_2026-10-14.csv');
    expect(reportFileName({ farm: { name: 'Palo Verde Farm' }, scope: 'Sprays', generatedOn: '2026-10-14', ext: 'csv', partial: false }))
      .toBe('food-safety-records_palo-verde-farm_sprays_2026-10-14.csv');
  });

  it('only ever ends with a known extension', () => {
    expect(reportFileName({ farm: { name: 'F' }, generatedOn: '2026-10-14', ext: 'exe' })).toMatch(/\.csv$/);
  });
});
