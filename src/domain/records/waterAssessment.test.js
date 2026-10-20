import { describe, it, expect } from 'vitest';
import {
  CONCERN_KEYS, assessConcerns, fieldNamesIn, floodLinks, prefillFromAssessment, recentFloods, sourcesServing, waterCounts, waterSources,
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
    expect(waterCounts(rows)).toEqual({ flood: 1, overdue: 1, due_soon: 1, current: 1 });
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

describe('a water source that is not used any more', () => {
  const retired = (source = 'Well 1', date = '2026-05-01') => assessment({ source, conclusion: 'retired' }, { record_date: date, created_at: `${date}T09:00:00Z` });

  it('leaves the list once its newest assessment says so, however overdue or flooded it was', () => {
    const old = assessment({}, { record_date: '2024-01-01', created_at: '2024-01-01T00:00:00Z' });
    expect(waterSources([old, flood('A1'), retired()], { today: TODAY })).toEqual([]);
  });

  it('is not brought back by a flood, only by a newer assessment that says it is in use', () => {
    expect(waterSources([assessment(), retired(), flood('A1', { record_date: '2026-06-20', created_at: '2026-06-20T09:00:00Z' })], { today: TODAY })).toEqual([]);
    const again = assessment({}, { record_date: '2026-06-01', created_at: '2026-06-01T09:00:00Z' });
    expect(waterSources([assessment(), retired(), again], { today: TODAY }).map((r) => [r.name, r.status])).toEqual([['Well 1', 'current']]);
  });

  it('only takes that source off the list, and an unapproved or future retirement changes nothing', () => {
    const rows = waterSources([assessment({ source: 'Canal', fields_served: 'B1' }), retired('Well 1'), assessment(), retired('Canal', '2026-08-01')], { today: TODAY });
    expect(rows.map((r) => r.name)).toEqual(['Canal']);
    expect(waterSources([assessment(), { ...retired(), status: 'pending_review' }], { today: TODAY })).toHaveLength(1);
  });

  it('is not tied to floods', () => {
    const rows = waterSources([retired(), assessment({ source: 'Canal', fields_served: 'B1' })], { today: TODAY });
    expect(sourcesServing(rows, { field: 'A1' })).toEqual([]);
  });
});
