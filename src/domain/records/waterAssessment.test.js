import { describe, it, expect } from 'vitest';
import {
  CONCERN_KEYS, assessConcerns, fieldNamesIn, floodLinks, latestWaterTest, prefillForSource, prefillFromAssessment, recentFloods, sourceHistory, sourcesServing, unregisteredWaterSources, waterCounts, waterSources,
} from './waterAssessment.js';

let n = 0;
const base = { source: 'Well 1', source_type: 'enclosed_groundwater', fields_served: 'A1, A2', application_method: 'drip' };
const calm = { source_concern: 'low', nearby_concern: 'low', practice_concern: 'low', crop_concern: 'low', weather_concern: 'low', testing_concern: 'low' };
const assessment = (payload = {}, extra = {}) => ({
  id: `a${(n += 1)}`,
  kind: 'water_assessment',
  status: 'approved',
  record_date: '2026-03-01',
  created_at: '2026-03-01T09:00:00Z',
  payload: { ...base, ...calm, conclusion: 'no_mitigation', ...payload },
  ...extra,
});
const flood = (field, extra = {}, payload = {}) => ({
  id: `f${(n += 1)}`,
  kind: 'weather_event',
  status: 'approved',
  record_date: '2026-06-10',
  created_at: '2026-06-10T15:00:00Z',
  payload: { event_type: 'flood', field, crop_contact: 'no', ...payload },
  ...extra,
});
const TODAY = '2026-07-01';

describe('assessConcerns: what the answers add up to', () => {
  it('suggests no measures when every factor is low concern', () => {
    expect(assessConcerns(calm)).toEqual({ suggestion: 'no_mitigation', high: [], some: [] });
  });

  it('suggests measures when any factor is high concern, and says which', () => {
    expect(assessConcerns({ ...calm, nearby_concern: 'high', weather_concern: 'high' })).toEqual({ suggestion: 'mitigation_needed', high: ['nearby_concern', 'weather_concern'], some: [] });
  });

  it('leaves it to the person when some factors are of some concern and none is high', () => {
    expect(assessConcerns({ ...calm, crop_concern: 'some' })).toEqual({ suggestion: 'judgment', high: [], some: ['crop_concern'] });
  });

  it('puts high ahead of some', () => {
    const result = assessConcerns({ ...calm, crop_concern: 'some', source_concern: 'high' });
    expect(result.suggestion).toBe('mitigation_needed');
    expect(result.some).toEqual(['crop_concern']);
  });

  it('does not count "no test results" as a concern', () => {
    expect(assessConcerns({ ...calm, testing_concern: 'none' }).suggestion).toBe('no_mitigation');
  });

  it('suggests nothing until every factor has been answered, or when an answer is not one it knows', () => {
    expect(assessConcerns({ ...calm, crop_concern: undefined })).toEqual({ suggestion: null, high: [], some: [] });
    expect(assessConcerns({})).toEqual({ suggestion: null, high: [], some: [] });
    expect(assessConcerns({ ...calm, crop_concern: 'extreme' }).suggestion).toBe(null);
    expect(assessConcerns(null).suggestion).toBe(null);
  });

  it('still names the high concerns while others are unanswered, so a warning can be shown early', () => {
    expect(assessConcerns({ nearby_concern: 'high' })).toEqual({ suggestion: null, high: ['nearby_concern'], some: [] });
  });

  it('looks at six factors', () => {
    expect(CONCERN_KEYS).toEqual(['source_concern', 'nearby_concern', 'practice_concern', 'crop_concern', 'weather_concern', 'testing_concern']);
  });
});

describe('waterSources: each source, its latest assessment and when it is next due', () => {
  it('is due a year after the latest assessment, and current until then', () => {
    const [source] = waterSources([assessment()], { today: TODAY });
    expect(source).toMatchObject({ name: 'Well 1', assessedOn: '2026-03-01', nextReview: '2027-03-01', status: 'current', conclusion: 'no_mitigation', fields: ['A1', 'A2'] });
    expect(source.daysLeft).toBe(243);
    expect(source.floods).toEqual([]);
  });

  it('is due soon in the month before, and overdue after', () => {
    expect(waterSources([assessment()], { today: '2027-02-10' })[0].status).toBe('due_soon');
    expect(waterSources([assessment()], { today: '2027-03-01' })[0].status).toBe('due_soon');
    expect(waterSources([assessment()], { today: '2027-03-02' })[0]).toMatchObject({ status: 'overdue', daysLeft: -1 });
  });

  it('uses the newest assessment of a source, however its name is spelled', () => {
    const older = assessment({ source: 'well 1 ', conclusion: 'mitigation_needed', mitigation: 'Seal the casing' }, { record_date: '2025-04-01', created_at: '2025-04-01T09:00:00Z' });
    const newer = assessment({ source: 'Well  1' });
    const [source] = waterSources([older, newer], { today: TODAY });
    expect(source).toMatchObject({ name: 'Well  1'.replace(/\s+/g, ' '), assessedOn: '2026-03-01', conclusion: 'no_mitigation', recordId: newer.id });
    expect(waterSources([older, newer], { today: TODAY })).toHaveLength(1);
  });

  it('keeps separate sources apart, the most urgent first', () => {
    const rows = waterSources([
      assessment({ source: 'Canal' }, { record_date: '2025-05-01', created_at: '2025-05-01T00:00:00Z' }),
      assessment({ source: 'Well 1' }),
      assessment({ source: 'Pond' }, { record_date: '2025-07-15', created_at: '2025-07-15T00:00:00Z' }),
    ], { today: TODAY });
    expect(rows.map((r) => [r.name, r.status])).toEqual([['Canal', 'overdue'], ['Pond', 'due_soon'], ['Well 1', 'current']]);
  });

  it('only counts approved assessments, dated no later than today', () => {
    const rows = waterSources([
      assessment({ source: 'Draft' }, { status: 'draft' }),
      assessment({ source: 'Waiting' }, { status: 'pending_review' }),
      assessment({ source: 'Voided' }, { status: 'voided' }),
      assessment({ source: 'Future' }, { record_date: '2026-08-01' }),
      assessment({ source: 'Counted' }),
    ], { today: TODAY });
    expect(rows.map((r) => r.name)).toEqual(['Counted']);
  });

  it('ignores records that are not assessments, and assessments with no source or no date', () => {
    const rows = waterSources([
      flood('A1'),
      assessment({ source: '' }),
      assessment({ source: undefined }),
      assessment({ source: 'No date' }, { record_date: null, created_at: undefined }),
    ], { today: TODAY });
    expect(rows).toEqual([]);
  });

  it('falls back on the day an assessment was entered when it has no date', () => {
    const [source] = waterSources([assessment({}, { record_date: null, created_at: '2026-03-05T10:00:00Z' })], { today: TODAY });
    expect(source.assessedOn).toBe('2026-03-05');
  });
});

describe('waterSources: a flood makes a source due for a new assessment', () => {
  it('flags a source when a flood hit a field it waters after it was last assessed', () => {
    const f = flood('A2');
    const [source] = waterSources([assessment(), f], { today: TODAY });
    expect(source.status).toBe('flood');
    expect(source.floods).toEqual([{ id: f.id, date: '2026-06-10', field: 'A2', reason: 'field' }]);
  });

  it('matches a field however it is spelled, and a flood that names several fields', () => {
    expect(waterSources([assessment(), flood(' a1 ')], { today: TODAY })[0].status).toBe('flood');
    expect(waterSources([assessment(), flood('B7; A2')], { today: TODAY })[0].status).toBe('flood');
    expect(waterSources([assessment(), flood('B7, C3')], { today: TODAY })[0].status).toBe('current');
  });

  it('flags a source the flood record names, even when its fields are not the ones listed', () => {
    const f = flood('B7', {}, { water_source: ' well 1' });
    const [source] = waterSources([assessment(), f], { today: TODAY });
    expect(source.status).toBe('flood');
    expect(source.floods[0].reason).toBe('named');
  });

  it('flags a flood whether or not the water reached the crop, since it can reach the water first', () => {
    expect(waterSources([assessment(), flood('A1', {}, { crop_contact: 'yes' })], { today: TODAY })[0].status).toBe('flood');
    expect(waterSources([assessment(), flood('A1', {}, { crop_contact: 'no' })], { today: TODAY })[0].status).toBe('flood');
  });

  it('does not count other weather, floods that are not approved, or floods before the assessment', () => {
    const rows = waterSources([
      assessment(),
      flood('A1', {}, { event_type: 'heavy_rain' }),
      flood('A1', { status: 'draft' }),
      flood('A1', { status: 'voided' }),
      flood('A1', { record_date: '2026-02-28', created_at: '2026-02-28T09:00:00Z' }),
      flood('A1', { record_date: '2026-07-20' }),
    ], { today: TODAY });
    expect(rows[0].status).toBe('current');
    expect(rows[0].floods).toEqual([]);
  });

  it('is cleared by a newer assessment, and comes back with a newer flood', () => {
    const again = assessment({}, { record_date: '2026-06-20', created_at: '2026-06-20T09:00:00Z' });
    expect(waterSources([assessment(), flood('A1'), again], { today: TODAY })[0].status).toBe('current');
    const later = flood('A1', { record_date: '2026-06-25', created_at: '2026-06-25T09:00:00Z' });
    const [source] = waterSources([assessment(), flood('A1'), again, later], { today: TODAY });
    expect(source.status).toBe('flood');
    expect(source.floods.map((x) => x.id)).toEqual([later.id]);
  });

  it('on the day of the flood, an assessment made after it clears it and one made before does not', () => {
    const sameDayAfter = assessment({}, { record_date: '2026-06-10', created_at: '2026-06-10T18:00:00Z' });
    const sameDayBefore = assessment({}, { record_date: '2026-06-10', created_at: '2026-06-10T08:00:00Z' });
    expect(waterSources([sameDayAfter, flood('A1')], { today: TODAY })[0].status).toBe('current');
    expect(waterSources([sameDayBefore, flood('A1')], { today: TODAY })[0].status).toBe('flood');
  });

  it('on that day, with no recording times to compare, takes the assessment to come after', () => {
    const a = assessment({}, { record_date: '2026-06-10', created_at: undefined });
    const f = flood('A1', { created_at: undefined });
    expect(waterSources([a, f], { today: TODAY })[0].status).toBe('current');
  });

  it('puts a flood ahead of a source that is merely overdue, and still says it is overdue', () => {
    const old = assessment({}, { record_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z' });
    const [source] = waterSources([old, flood('A1')], { today: TODAY });
    expect(source.status).toBe('flood');
    expect(source.daysLeft).toBeLessThan(0);
  });

  it('lists the sources with a flood first, then the rest by urgency', () => {
    const rows = waterSources([
      assessment({ source: 'Overdue' }, { record_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z' }),
      assessment({ source: 'Flooded', fields_served: 'B1' }),
      assessment({ source: 'Fine', fields_served: 'C1' }),
      flood('B1'),
    ], { today: TODAY });
    expect(rows.map((r) => r.name)).toEqual(['Flooded', 'Overdue', 'Fine']);
  });
});

describe('floodLinks: which water sources a flood may have reached', () => {
  const sources = (records) => waterSources(records, { today: TODAY });

  it('links a flood to the sources that water the field it hit, saying whether each needs a new assessment', () => {
    const f = flood('A1');
    const reassessed = assessment({ source: 'Canal', fields_served: 'A1' }, { record_date: '2026-06-15', created_at: '2026-06-15T09:00:00Z' });
    const links = floodLinks(f, sources([assessment(), reassessed, f]));
    expect(links.map((l) => [l.source.name, l.needsAssessment])).toEqual([['Well 1', true], ['Canal', false]]);
  });

  it('links a flood to the source it names', () => {
    const f = flood('Z9', {}, { water_source: 'Canal' });
    const links = floodLinks(f, sources([assessment({ source: 'Canal', fields_served: 'A1' }), assessment(), f]));
    expect(links.map((l) => l.source.name)).toEqual(['Canal']);
  });

  it('links nothing for a flood that was voided or rejected, or that is dated after today', () => {
    const rows = sources([assessment()]);
    expect(floodLinks(flood('A1', { status: 'voided' }), rows, { today: TODAY })).toEqual([]);
    expect(floodLinks(flood('A1', { status: 'rejected' }), rows, { today: TODAY })).toEqual([]);
    expect(floodLinks(flood('A1', { record_date: '2026-07-20' }), rows, { today: TODAY })).toEqual([]);
    expect(floodLinks(flood('A1', { status: 'draft' }), rows, { today: TODAY })).toHaveLength(1);
    expect(floodLinks(flood('A1', { status: 'pending_review' }), rows, { today: TODAY })).toHaveLength(1);
  });

  it('links nothing for weather that is not a flood, or a flood that touches no assessed source', () => {
    expect(floodLinks(flood('A1', {}, { event_type: 'hail' }), sources([assessment()]))).toEqual([]);
    expect(floodLinks(flood('Z9'), sources([assessment()]))).toEqual([]);
    expect(floodLinks(null, sources([assessment()]))).toEqual([]);
  });
});

describe('waterCounts and prefillFromAssessment', () => {
  it('counts the sources each way', () => {
    const rows = waterSources([
      assessment({ source: 'A', fields_served: 'A1' }), flood('A1'),
      assessment({ source: 'B', fields_served: 'B1' }, { record_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z' }),
      assessment({ source: 'C', fields_served: 'C1' }, { record_date: '2025-07-15', created_at: '2025-07-15T00:00:00Z' }),
      assessment({ source: 'D', fields_served: 'D1' }),
    ], { today: TODAY });
    expect(waterCounts(rows)).toEqual({ flood: 1, overdue: 1, not_assessed: 0, due_soon: 1, current: 1 });
  });

  it('starts a new assessment from the last one’s answers, but leaves the decision to be made again', () => {
    const prefill = prefillFromAssessment(assessment({ conclusion: 'mitigation_needed', mitigation: 'Seal the well', notes: 'Old', assessed_by: 'Ana', days_before_harvest: 3 }));
    expect(prefill).toMatchObject({ ...base, ...calm, assessed_by: 'Ana', days_before_harvest: 3 });
    for (const key of ['conclusion', 'mitigation', 'notes']) expect(prefill, key).not.toHaveProperty(key);
  });

  it('keeps only what the last assessment had', () => {
    expect(prefillFromAssessment({ payload: { source: 'Well 1' } })).toEqual({ source: 'Well 1' });
    expect(prefillFromAssessment(null)).toEqual({});
  });
});

describe('recentFloods: floods in the last year that may have reached a source being assessed', () => {
  const find = (records, options) => recentFloods(records, { today: TODAY, ...options });

  it('lists approved floods in the last year on the fields the source waters, newest first', () => {
    const a = flood('A1', { record_date: '2026-03-10' });
    const b = flood('A2', { record_date: '2026-06-10' });
    expect(find([a, b], { fields: 'A1, A2' }).map((f) => [f.id, f.date, f.field])).toEqual([[b.id, '2026-06-10', 'A2'], [a.id, '2026-03-10', 'A1']]);
  });

  it('lists a flood that names the source, whichever fields it names', () => {
    const f = flood('Z9', {}, { water_source: 'Well 1' });
    expect(find([f], { source: 'well 1', fields: 'A1' }).map((x) => x.reason)).toEqual(['named']);
  });

  it('leaves out floods from more than a year ago, in the future, not approved, not floods, and on other fields', () => {
    const records = [
      flood('A1', { record_date: '2025-06-30' }),
      flood('A1', { record_date: '2026-07-02' }),
      flood('A1', { status: 'draft' }),
      flood('A1', {}, { event_type: 'hail' }),
      flood('C3'),
    ];
    expect(find(records, { fields: 'A1' })).toEqual([]);
  });

  it('counts a flood exactly a year ago, and has nothing to match without fields or a source', () => {
    expect(find([flood('A1', { record_date: '2025-07-01' })], { fields: 'A1' })).toHaveLength(1);
    expect(find([flood('A1')], {})).toEqual([]);
    expect(find([flood('A1')], { fields: '  ', source: '' })).toEqual([]);
  });
});

describe('sourcesServing: the assessed water sources for a field', () => {
  const rows = waterSources([assessment({ source: 'Well 1', fields_served: 'A1, A2' }), assessment({ source: 'Canal', fields_served: 'B1' })], { today: TODAY });

  it('finds the sources that water a field however it is spelled, or that are named', () => {
    expect(sourcesServing(rows, { field: ' a2 ' }).map((s) => s.name)).toEqual(['Well 1']);
    expect(sourcesServing(rows, { field: 'A1; B1' }).map((s) => s.name)).toEqual(['Canal', 'Well 1']);
    expect(sourcesServing(rows, { field: 'Z9', waterSource: 'canal' }).map((s) => s.name)).toEqual(['Canal']);
  });

  it('finds nothing for a field no source waters, or for no field', () => {
    expect(sourcesServing(rows, { field: 'Z9' })).toEqual([]);
    expect(sourcesServing(rows, {})).toEqual([]);
    expect(sourcesServing([], { field: 'A1' })).toEqual([]);
  });
});

describe('naming fields and sources the way people write them', () => {
  const floodedAfter = (fields, floodField, extra = {}) => waterSources([assessment({ fields_served: fields }), flood(floodField, {}, extra)], { today: TODAY })[0];

  it.each([
    ['A2 and B1', 'B1'],
    ['A2 y B1', 'B1'],
    ['A2 & B1', 'B1'],
    ['A2/B1', 'B1'],
    ['A2; B1', 'B1'],
    ['A2,\nB1', 'B1'],
    ['A-2, B1', 'A2'],
    ['A 2, B1', 'A2'],
    ['Parcela Peña', 'parcela pena'],
    ['Parcela Pena', 'PARCELA PEÑA'],
    ['Block #3', 'Block 3'],
  ])('ties a flood on “%s” to the source, whatever the spelling (%s)', (fields, floodField) => {
    expect(floodedAfter(fields, floodField).status).toBe('flood');
  });

  it('still keeps different fields apart', () => {
    expect(floodedAfter('A2, B1', 'A20').status).toBe('current');
    expect(floodedAfter('A1', 'A11').status).toBe('current');
    expect(floodedAfter('Block 1', 'Block 10').status).toBe('current');
  });

  it('splits a box of fields the way people write them, keeping each once and as first written', () => {
    expect(fieldNamesIn('A2 and B1, b1; C3 / D4 y E5 & F6')).toEqual(['A2', 'B1', 'C3', 'D4', 'E5', 'F6']);
    expect(fieldNamesIn(' , ; ')).toEqual([]);
    expect(fieldNamesIn(undefined)).toEqual([]);
  });

  it('does not take a word that merely contains "and" or "y" for a separator', () => {
    expect(fieldNamesIn('Sandy Flat, Yard')).toEqual(['Sandy Flat', 'Yard']);
  });

  it('ties a flood that names several water sources to each of them', () => {
    const rows = waterSources([assessment({ source: 'Well 1', fields_served: 'A1' }), assessment({ source: 'Pond', fields_served: 'C1' }), assessment({ source: 'Canal', fields_served: 'D1' }), flood('Z9', {}, { water_source: 'Well 1, pond and Spring' })], { today: TODAY });
    expect(rows.map((r) => [r.name, r.status]).sort()).toEqual([['Canal', 'current'], ['Pond', 'flood'], ['Well 1', 'flood']]);
  });

  it('treats a source written two ways as one source, the newest spelling winning', () => {
    const older = assessment({ source: 'Well #1', conclusion: 'mitigation_needed', mitigation: 'x' }, { record_date: '2024-04-01', created_at: '2024-04-01T00:00:00Z' });
    const rows = waterSources([older, assessment({ source: 'Well 1' })], { today: TODAY });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Well 1', status: 'current' });
  });

  it('finds the sources for a field, and the floods on a source, by the same loose spelling', () => {
    const rows = waterSources([assessment({ fields_served: 'A-2 and B1' })], { today: TODAY });
    expect(sourcesServing(rows, { field: 'a2' }).map((s) => s.name)).toEqual(['Well 1']);
    expect(recentFloods([flood('b1')], { fields: 'A-2 and B1', today: TODAY })).toHaveLength(1);
  });
});

describe('waterSources with the farm’s list of water sources', () => {
  const reg = (name, extra = {}) => ({ id: `s-${name}`, name, source_type: null, fields_served: null, notes: null, is_active: true, ...extra });
  const rowsOf = (records, registry) => waterSources(records, { today: TODAY, registry });
  const test = (source, date, result = 'pass', extra = {}) => ({ id: `t${(n += 1)}`, kind: 'water_test', status: 'approved', record_date: date, created_at: `${date}T09:00:00Z`, payload: { source, result, result_value: 5 }, ...extra });

  it('lists a source on the farm’s list that was never assessed, as needing an assessment', () => {
    const [row] = rowsOf([], [reg('Well 1', { fields_served: 'A1, A2', source_type: 'enclosed_groundwater' })]);
    expect(row).toMatchObject({ name: 'Well 1', status: 'not_assessed', registered: true, sourceId: 's-Well 1', fields: ['A1', 'A2'], sourceType: 'enclosed_groundwater', assessedOn: null, nextReview: null, daysLeft: null, recordId: null, floods: [] });
  });

  it('marks a source as on the list, with its id, whether or not it has been assessed', () => {
    const [row] = rowsOf([assessment()], [reg('well 1')]);
    expect(row).toMatchObject({ registered: true, sourceId: 's-well 1', status: 'current', name: 'well 1' });
  });

  it('says so when an assessed source is not on the list, and still lists it', () => {
    const [row] = rowsOf([assessment({ source: 'Old pond', fields_served: 'C1' })], []);
    expect(row).toMatchObject({ name: 'Old pond', registered: false, sourceId: null, status: 'current' });
  });

  it('spells a source as the list spells it, and matches assessments to it loosely', () => {
    const [row] = rowsOf([assessment({ source: 'Well #1' })], [reg('Well 1')]);
    expect(row).toMatchObject({ name: 'Well 1', registered: true });
  });

  it('leaves out a source that is archived, however it was assessed or flooded', () => {
    expect(rowsOf([assessment(), flood('A1')], [reg('Well 1', { is_active: false })])).toEqual([]);
  });

  it('ties a flood to a source through the fields on the list as well as the fields it was assessed for', () => {
    const [row] = rowsOf([assessment({ fields_served: 'A1' }), flood('B7')], [reg('Well 1', { fields_served: 'B7' })]);
    expect(row.status).toBe('flood');
    expect(row.fields).toEqual(['B7']);
  });

  it('shows the fields it was assessed for when the list does not give any', () => {
    const [row] = rowsOf([assessment({ fields_served: 'A1, A2' })], [reg('Well 1')]);
    expect(row.fields).toEqual(['A1', 'A2']);
  });

  it('takes the kind of source from the list, or else from the newest assessment', () => {
    expect(rowsOf([assessment({ source_type: 'surface' })], [reg('Well 1', { source_type: 'canal' })])[0].sourceType).toBe('canal');
    expect(rowsOf([assessment({ source_type: 'surface' })], [reg('Well 1')])[0].sourceType).toBe('surface');
    expect(rowsOf([assessment({ source_type: 'surface' })], [])[0].sourceType).toBe('surface');
  });

  it('puts a flood first, then overdue, then never assessed, then due soon, then up to date', () => {
    const rows = rowsOf([
      assessment({ source: 'Flooded', fields_served: 'B1' }),
      assessment({ source: 'Overdue', fields_served: 'C1' }, { record_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z' }),
      assessment({ source: 'Soon', fields_served: 'D1' }, { record_date: '2025-07-15', created_at: '2025-07-15T00:00:00Z' }),
      assessment({ source: 'Fine', fields_served: 'E1' }),
      flood('B1'),
    ], [reg('New well')]);
    expect(rows.map((r) => [r.name, r.status])).toEqual([['Flooded', 'flood'], ['Overdue', 'overdue'], ['New well', 'not_assessed'], ['Soon', 'due_soon'], ['Fine', 'current']]);
  });

  it('counts the sources that were never assessed', () => {
    expect(waterCounts(rowsOf([assessment({ fields_served: 'Z1' })], [reg('New well'), reg('Newer well')]))).toEqual({ flood: 0, overdue: 0, not_assessed: 2, due_soon: 0, current: 1 });
  });

  it('keeps each source’s newest approved water test that is not dated in the future', () => {
    const rows = rowsOf([
      assessment(),
      test('Well 1', '2026-04-01', 'fail'),
      test('well 1', '2026-06-01', 'pass'),
      test('Well 1', '2026-08-01', 'fail', { status: 'draft' }),
      test('Well 1', '2026-12-01', 'fail'),
      test('Other', '2026-06-02'),
    ], []);
    expect(rows[0].lastTest).toEqual({ id: expect.any(String), date: '2026-06-01', result: 'pass', value: 5 });
  });

  it('has no last test when there are none for it', () => {
    expect(rowsOf([assessment()], [])[0].lastTest).toBeNull();
    expect(rowsOf([], [reg('New well')])[0].lastTest).toBeNull();
  });

  it('shows the last water test of a source that was never assessed', () => {
    expect(rowsOf([test('New well', '2026-06-01', 'fail')], [reg('New well')])[0].lastTest).toMatchObject({ date: '2026-06-01', result: 'fail' });
  });

  it('is unchanged for a farm that has no list yet', () => {
    const [row] = waterSources([assessment()], { today: TODAY });
    expect(row).toMatchObject({ name: 'Well 1', status: 'current', registered: false });
  });

  it('ties a flood to a source that was never assessed as needing an assessment', () => {
    const rows = rowsOf([], [reg('New well', { fields_served: 'A1' })]);
    const links = floodLinks(flood('A1'), rows);
    expect(links.map((l) => [l.source.name, l.needsAssessment])).toEqual([['New well', true]]);
  });
});

describe('unregisteredWaterSources: names in the records that are not on the farm’s list', () => {
  const reg = (name) => ({ id: `s-${name}`, name, is_active: true });
  const test = (source, date = '2026-06-01', status = 'approved') => ({ id: `t${(n += 1)}`, kind: 'water_test', status, record_date: date, created_at: `${date}T09:00:00Z`, payload: { source, result: 'pass' } });

  it('lists the sources that approved assessments, tests and floods name, most used first, with the newest assessment’s kind and fields', () => {
    const records = [
      assessment({ source: 'Old well', source_type: 'open_groundwater', fields_served: 'A1' }, { record_date: '2025-04-01', created_at: '2025-04-01T00:00:00Z' }),
      assessment({ source: 'old WELL', source_type: 'surface', fields_served: 'A1' }, { record_date: '2025-05-01', created_at: '2025-05-01T00:00:00Z' }),
      assessment({ source: 'old WELL', source_type: 'enclosed_groundwater', fields_served: 'A1, A2' }),
      test('Pond'), test('pond'), test('Pond '),
      flood('B1', {}, { water_source: 'Canal' }),
    ];
    expect(unregisteredWaterSources(records, [])).toEqual([
      { name: 'Pond', uses: 3, source_type: undefined, fields_served: undefined },
      { name: 'old WELL', uses: 3, source_type: 'enclosed_groundwater', fields_served: 'A1, A2' },
      { name: 'Canal', uses: 1, source_type: undefined, fields_served: undefined },
    ]);
  });

  it('leaves out names that are on the list however they are spelled, archived ones too', () => {
    const records = [assessment({ source: 'Well #1' }), test('POND'), test('Canal')];
    expect(unregisteredWaterSources(records, [reg('Well 1'), { ...reg('Pond'), is_active: false }]).map((u) => u.name)).toEqual(['Canal']);
  });

  it('leaves out records that are not approved, lists of sources, names that are too long, and records of other kinds', () => {
    const records = [
      test('Draft only', '2026-06-01', 'draft'), test('Voided only', '2026-06-01', 'voided'),
      flood('B1', {}, { water_source: 'Well 1, Pond' }), test('x'.repeat(61)), test('   '),
      { id: 'n1', kind: 'note', status: 'approved', payload: { text: 'x', source: 'Not water' } },
    ];
    expect(unregisteredWaterSources(records, [])).toEqual([]);
  });
});

describe('archived water sources and a source’s history', () => {
  const reg = (name, extra = {}) => ({ id: `s-${name}`, name, source_type: null, fields_served: null, notes: null, is_active: true, ...extra });
  const test = (source, date, result = 'pass', extra = {}) => ({ id: `t${(n += 1)}`, kind: 'water_test', status: 'approved', record_date: date, created_at: `${date}T09:00:00Z`, payload: { source, result }, ...extra });

  it('leaves archived sources out unless they are asked for, and then marks them', () => {
    const registry = [reg('Old well', { is_active: false }), reg('Well 1')];
    const records = [assessment({ source: 'Old well', fields_served: 'C1' }), assessment()];
    expect(waterSources(records, { today: TODAY, registry }).map((r) => r.name)).toEqual(['Well 1']);
    const rows = waterSources(records, { today: TODAY, registry, includeArchived: true });
    expect(rows.map((r) => [r.name, r.archived, r.status])).toEqual([['Well 1', false, 'current'], ['Old well', true, 'archived']]);
  });

  it('shows an archived source that was never assessed, when asked', () => {
    const [row] = waterSources([], { today: TODAY, registry: [reg('Old well', { is_active: false })], includeArchived: true });
    expect(row).toMatchObject({ name: 'Old well', archived: true, status: 'archived', recordId: null });
  });

  it('does not count archived sources', () => {
    const rows = waterSources([assessment()], { today: TODAY, registry: [reg('Old well', { is_active: false })], includeArchived: true });
    expect(waterCounts(rows)).toEqual({ flood: 0, overdue: 0, not_assessed: 0, due_soon: 0, current: 1 });
  });

  it('does not tie a flood to an archived source', () => {
    const rows = waterSources([assessment(), flood('A1')], { today: TODAY, registry: [reg('Well 1', { is_active: false })], includeArchived: true });
    expect(rows[0]).toMatchObject({ archived: true, status: 'archived', floods: [] });
  });

  it('lists a source’s approved assessments and water tests, newest first, however its name is spelled', () => {
    const a1 = assessment({ source: 'well #1' }, { record_date: '2025-03-01', created_at: '2025-03-01T00:00:00Z' });
    const a2 = assessment();
    const t1 = test('Well 1', '2026-04-01');
    const t2 = test('WELL 1', '2026-06-01', 'fail');
    const history = sourceHistory([a1, a2, t1, t2, assessment({ source: 'Canal' }), test('Canal', '2026-05-01'), assessment({}, { status: 'draft' }), test('Well 1', '2026-07-01', 'pass', { status: 'voided' }), flood('A1')], 'well1');
    expect(history.assessments.map((r) => r.id)).toEqual([a2.id, a1.id]);
    expect(history.tests.map((r) => r.id)).toEqual([t2.id, t1.id]);
    expect(history.floods).toEqual([]);
  });

  it('has an empty history for a source nothing names', () => {
    expect(sourceHistory([assessment()], 'nothing')).toEqual({ assessments: [], tests: [], floods: [] });
  });

  it('lists the floods that name a source, one of several or the only one, but not those that merely hit its fields', () => {
    const named = flood('B7', {}, { water_source: 'Pond, well 1' });
    const alone = flood('B8', { record_date: '2026-07-01' }, { water_source: 'Well 1' });
    const history = sourceHistory([named, alone, flood('A1'), flood('A1', { status: 'draft' }, { water_source: 'Well 1' })], 'well1');
    expect(history.floods.map((r) => r.id)).toEqual([alone.id, named.id]);
  });
});

describe('prefillForSource: starting an assessment of a source on the page', () => {
  const reg = (name, extra = {}) => ({ id: `s-${name}`, name, source_type: null, fields_served: null, notes: null, is_active: true, ...extra });

  it('starts a source that was never assessed from what the list says about it', () => {
    const [row] = waterSources([], { today: TODAY, registry: [reg('New well', { source_type: 'canal', fields_served: 'B1, B2' })] });
    expect(prefillForSource(row, [])).toEqual({ source: 'New well', source_type: 'canal', fields_served: 'B1, B2' });
  });

  it('gives just the name for a source the list knows nothing else about', () => {
    const [row] = waterSources([], { today: TODAY, registry: [reg('New well')] });
    expect(prefillForSource(row, [])).toEqual({ source: 'New well' });
  });

  it('starts an assessed source from its last answers, which win over the list, with the name as the list spells it and no decision', () => {
    const last = assessment({ source: 'Well #1', fields_served: 'A1', source_type: 'surface', conclusion: 'mitigation_needed', mitigation: 'x', assessed_by: 'Ana' });
    const registry = [reg('Well 1', { source_type: 'canal', fields_served: 'Z9' })];
    const [row] = waterSources([last], { today: TODAY, registry });
    const prefill = prefillForSource(row, [last]);
    expect(prefill).toMatchObject({ source: 'Well 1', source_type: 'surface', fields_served: 'A1', assessed_by: 'Ana', ...calm });
    for (const key of ['conclusion', 'mitigation', 'notes']) expect(prefill, key).not.toHaveProperty(key);
  });

  it('fills in from the list what the last assessment did not say', () => {
    const last = assessment({ source_type: undefined, fields_served: undefined });
    const [row] = waterSources([last], { today: TODAY, registry: [reg('Well 1', { source_type: 'canal', fields_served: 'Z9' })] });
    expect(prefillForSource(row, [last])).toMatchObject({ source: 'Well 1', source_type: 'canal', fields_served: 'Z9' });
  });
});

describe('latestWaterTest: the newest water test of a source being assessed', () => {
  const test = (source, date, result = 'pass', extra = {}) => ({ id: `t${(n += 1)}`, kind: 'water_test', status: 'approved', record_date: date, created_at: `${date}T09:00:00Z`, payload: { source, result, result_value: 3 }, ...extra });

  it('is the newest approved test of the source, however its name is spelled', () => {
    const records = [test('Well 1', '2026-04-01', 'fail'), test('well  #1', '2026-06-15', 'pass'), test('Canal', '2026-06-20')];
    expect(latestWaterTest(records, 'WELL 1', { today: TODAY })).toEqual({ id: expect.any(String), date: '2026-06-15', result: 'pass', value: 3 });
  });

  it('leaves out tests that are not approved or are dated after today, and other kinds of record', () => {
    const records = [test('Well 1', '2026-06-01', 'pass'), test('Well 1', '2026-06-20', 'fail', { status: 'draft' }), test('Well 1', '2026-12-01', 'fail'), assessment({ source: 'Well 1' })];
    expect(latestWaterTest(records, 'Well 1', { today: TODAY }).date).toBe('2026-06-01');
  });

  it('is nothing when there is none, or no source has been named', () => {
    expect(latestWaterTest([test('Canal', '2026-06-01')], 'Well 1', { today: TODAY })).toBeNull();
    expect(latestWaterTest([test('Canal', '2026-06-01')], '', { today: TODAY })).toBeNull();
    expect(latestWaterTest([test('Canal', '2026-06-01')], undefined, { today: TODAY })).toBeNull();
  });
});
