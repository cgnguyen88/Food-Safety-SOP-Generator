import { describe, it, expect } from 'vitest';
import { mentionsLot, knownLots, traceLot } from './trace.js';

let n = 0;
const rec = (kind, record_date, payload, extra = {}) => ({ id: `r${(n += 1)}`, kind, status: 'approved', record_date, created_at: `${record_date}T08:00:00Z`, payload, ...extra });
const harvest = (lot_code, extra = {}, date = '2026-07-03') => rec('harvest', date, { crop: 'Lettuce', field: 'A1', quantity: 40, unit: 'cartons', lot_code, crew: 'Crew 2', ...extra });
const packing = (lot_code, date = '2026-07-03') => rec('packing_cooling', date, { lot_code, product: 'Lettuce', quantity: 40, unit: 'cartons' });
const shipment = (lot_codes, customer, quantity, date = '2026-07-04') => rec('shipment', date, { customer, lot_codes, quantity, unit: 'cartons' });

describe('mentionsLot', () => {
  it('finds a lot code in a list written however the farm writes lists', () => {
    expect(mentionsLot('GVF-1, GVF-2', 'GVF-2')).toBe(true);
    expect(mentionsLot('gvf-1;gvf-2', 'GVF-1')).toBe(true);
    expect(mentionsLot('GVF-1 GVF-2\nGVF-3', 'GVF-3')).toBe(true);
  });

  it('finds a lot code that has a space or a slash in it', () => {
    expect(mentionsLot('Lot 12', 'LOT 12')).toBe(true);
    expect(mentionsLot('Lot 12, Lot 13', 'LOT 13')).toBe(true);
    expect(mentionsLot('L1/L2, L3', 'L1/L2')).toBe(true);
    expect(mentionsLot('lot   12', 'LOT 12')).toBe(true);
  });

  it('does not take one code for another that only starts the same way, or has a number added', () => {
    expect(mentionsLot('GVF-10', 'GVF-1')).toBe(false);
    expect(mentionsLot('GVF-1-2', 'GVF-1')).toBe(false);
    expect(mentionsLot('XGVF-1', 'GVF-1')).toBe(false);
    expect(mentionsLot('A.1', 'A')).toBe(false);
  });

  it('is false for blanks and things that are not text', () => {
    expect(mentionsLot('', 'GVF-1')).toBe(false);
    expect(mentionsLot(undefined, 'GVF-1')).toBe(false);
    expect(mentionsLot('GVF-1', '')).toBe(false);
    expect(mentionsLot(5, 'GVF-1')).toBe(false);
  });
});

describe('knownLots', () => {
  it('lists each lot code that harvests have used, newest first, with what it was', () => {
    const lots = knownLots([harvest('GVF-1'), harvest('GVF-2', { crop: 'Kale', field: 'B2' }, '2026-07-10'), harvest('gvf-1', {}, '2026-07-05'), harvest('')]);
    expect(lots).toEqual([
      { code: 'GVF-2', date: '2026-07-10', crop: 'Kale', field: 'B2' },
      { code: 'GVF-1', date: '2026-07-05', crop: 'Lettuce', field: 'A1' },
    ]);
  });

  it('only counts approved harvests', () => {
    expect(knownLots([harvest('GVF-1', {}, '2026-07-03'), { ...harvest('GVF-9'), status: 'pending_review' }, rec('shipment', '2026-07-03', { lot_codes: 'GVF-8' })]).map((l) => l.code)).toEqual(['GVF-1']);
  });
});

describe('traceLot: forward and the lot itself', () => {
  const records = [
    harvest('GVF-1'),
    harvest('GVF-2', { field: 'B2' }, '2026-07-05'),
    packing('GVF-1'),
    shipment('GVF-1', 'Fresh Mart', 25),
    shipment('gvf-1, GVF-2', 'Corner Grocer', 30),
    shipment('GVF-2', 'Fresh Mart', 40, '2026-07-06'),
  ];

  it('finds the harvests, packing and shipments of a lot however the code is written', () => {
    const trace = traceLot(records, ' gvf-1 ');
    expect(trace.code).toBe('GVF-1');
    expect(trace.found).toBe(true);
    expect(trace.harvests).toHaveLength(1);
    expect(trace.packing).toHaveLength(1);
    expect(trace.shipments).toHaveLength(2);
  });

  it('lists the field, crop and crew', () => {
    const trace = traceLot(records, 'GVF-1');
    expect(trace.fields).toEqual(['A1']);
    expect(trace.crops).toEqual(['Lettuce']);
    expect(trace.crew).toEqual(['Crew 2']);
  });

  it('lists the customers, each with its shipments', () => {
    const trace = traceLot(records, 'GVF-1');
    expect(trace.customers.map((c) => [c.name, c.shipments.length])).toEqual([['Corner Grocer', 1], ['Fresh Mart', 1]]);
  });

  it('counts the same customer once, however it is written', () => {
    const trace = traceLot([harvest('GVF-1'), shipment('GVF-1', 'Fresh Mart', 5), shipment('GVF-1', ' fresh  mart ', 5, '2026-07-05')], 'GVF-1');
    expect(trace.customers).toHaveLength(1);
    expect(trace.customers[0].shipments).toHaveLength(2);
  });

  it('adds up what was harvested, and what shipped only this lot, and notes shipments that mixed lots', () => {
    const trace = traceLot(records, 'GVF-1');
    expect(trace.harvested).toEqual([{ unit: 'cartons', quantity: 40 }]);
    expect(trace.shipped).toEqual([{ unit: 'cartons', quantity: 25 }]);
    expect(trace.sharedShipments).toBe(1);
  });

  it('keeps different units apart', () => {
    const trace = traceLot([harvest('GVF-1'), harvest('GVF-1', { quantity: 100, unit: 'lb' })], 'GVF-1');
    expect(trace.harvested).toEqual([{ unit: 'cartons', quantity: 40 }, { unit: 'lb', quantity: 100 }]);
  });

  it('says a lot was not found when no record has it', () => {
    const trace = traceLot(records, 'NOPE-1');
    expect(trace.found).toBe(false);
    expect(trace.harvests).toEqual([]);
    expect(trace.back).toEqual({ amendments: [], waterTests: [], sanitation: [], fieldEvents: [], correctiveActions: [] });
  });

  it('is nothing for a blank code', () => {
    expect(traceLot(records, '  ')).toBeNull();
    expect(traceLot(records, undefined)).toBeNull();
  });

  it('ignores records that are not approved', () => {
    const trace = traceLot([harvest('GVF-1'), { ...shipment('GVF-1', 'Fresh Mart', 5), status: 'pending_review' }], 'GVF-1');
    expect(trace.shipments).toEqual([]);
  });
});

describe('traceLot: lot codes written with spaces and slashes', () => {
  it('follows a lot whose code has a space in it to its shipments and customers', () => {
    const trace = traceLot([harvest('Lot 12'), shipment('Lot 12', 'Fresh Mart', 5), shipment('Lot 12, Lot 13', 'Corner Grocer', 9)], 'lot 12');
    expect(trace.shipments).toHaveLength(2);
    expect(trace.customers.map((c) => c.name)).toEqual(['Corner Grocer', 'Fresh Mart']);
    expect(trace.shipped).toEqual([{ unit: 'cartons', quantity: 5 }]);
    expect(trace.sharedShipments).toBe(1);
  });

  it('finds corrective actions that name a code with a dot in it', () => {
    const action = rec('corrective_action', '2026-07-08', { problem: 'p', action: 'a', affected: 'Lot L.1 recalled' });
    expect(traceLot([harvest('L.1'), action], 'L.1').back.correctiveActions.map((r) => r.id)).toEqual([action.id]);
  });
});

describe('traceLot: back to the field', () => {
  const lot = harvest('GVF-1', { field: 'A1' }, '2026-07-03');
  const amendment = (date, field = 'A1', type = 'compost') => rec('soil_amendment', date, { amendment_type: type, field, product: 'Mix' });
  const water = (date, use, result = 'pass') => rec('water_test', date, { source: 'Well 1', water_use: use, result });
  const sanitation = (date, result = 'pass') => rec('sanitation_log', date, { item: 'Bins', method: 'clean_sanitize', check_result: result });

  it('finds soil amendments on the field before the harvest, up to a year back', () => {
    const trace = traceLot([lot, amendment('2026-05-01'), amendment('2025-07-03'), amendment('2025-07-02'), amendment('2026-07-04'), amendment('2026-05-01', 'B2')], 'GVF-1');
    expect(trace.back.amendments.map((r) => r.record_date)).toEqual(['2025-07-03', '2026-05-01']);
  });

  it('finds the latest water test of each use on or before the harvest', () => {
    const trace = traceLot([lot, water('2026-05-01', 'pre_harvest'), water('2026-06-20', 'pre_harvest', 'fail'), water('2026-07-03', 'harvest_postharvest'), water('2026-07-10', 'pre_harvest')], 'GVF-1');
    expect(trace.back.waterTests.map((r) => [r.record_date, r.payload.result])).toEqual([['2026-06-20', 'fail'], ['2026-07-03', 'pass']]);
  });

  it('finds the cleaning logs from the day of the harvest and the day of packing', () => {
    const trace = traceLot([lot, packing('GVF-1', '2026-07-04'), sanitation('2026-07-03'), sanitation('2026-07-04', 'fail'), sanitation('2026-07-02'), sanitation('2026-07-05')], 'GVF-1');
    expect(trace.back.sanitation.map((r) => r.record_date)).toEqual(['2026-07-03', '2026-07-04']);
  });

  it('finds weather events and animal checks on the field in the month before the harvest', () => {
    const flood = rec('weather_event', '2026-06-20', { event_type: 'flood', field: 'A1', crop_contact: 'no' });
    const animals = rec('wildlife_check', '2026-07-01', { field: 'a1', evidence: 'yes' });
    const old = rec('wildlife_check', '2026-05-01', { field: 'A1', evidence: 'no' });
    const other = rec('wildlife_check', '2026-07-01', { field: 'B2', evidence: 'yes' });
    const trace = traceLot([lot, flood, animals, old, other], 'GVF-1');
    expect(trace.back.fieldEvents.map((r) => r.id)).toEqual([flood.id, animals.id]);
  });

  it('finds corrective actions for the field or naming the lot', () => {
    const forField = rec('corrective_action', '2026-07-04', { problem: 'p', action: 'a', field: 'A1', clears_hold: 'yes' });
    const forLot = rec('corrective_action', '2026-07-08', { problem: 'p', action: 'a', affected: 'Lot gvf-1 and others' });
    const unrelated = rec('corrective_action', '2026-07-08', { problem: 'p', action: 'a', affected: 'GVF-10' });
    const trace = traceLot([lot, forField, forLot, unrelated], 'GVF-1');
    expect(trace.back.correctiveActions.map((r) => r.id)).toEqual([forField.id, forLot.id]);
  });

  it('traces back from every harvest of the lot when it came from two fields', () => {
    const two = [harvest('GVF-1', { field: 'A1' }), harvest('GVF-1', { field: 'B2' }), amendment('2026-05-01', 'A1'), amendment('2026-05-02', 'B2')];
    const trace = traceLot(two, 'GVF-1');
    expect(trace.fields).toEqual(['A1', 'B2']);
    expect(trace.back.amendments).toHaveLength(2);
  });

  it('does not change the records it is given', () => {
    const records = [lot, amendment('2026-05-01')];
    const copy = JSON.parse(JSON.stringify(records));
    traceLot(records, 'GVF-1');
    expect(records).toEqual(copy);
  });
});

describe('traceLot: what the records do not show', () => {
  it('lists what an auditor would ask for and the records do not have', () => {
    expect(traceLot([harvest('GVF-1', { crew: '' })], 'GVF-1').gaps).toEqual(['no_crew', 'no_water_test', 'no_sanitation', 'no_shipment']);
  });

  it('lists nothing missing when the lot is fully recorded', () => {
    const records = [
      harvest('GVF-1'),
      shipment('GVF-1', 'Fresh Mart', 5),
      rec('water_test', '2026-06-01', { source: 'Well', water_use: 'pre_harvest', result: 'pass' }),
      rec('sanitation_log', '2026-07-03', { item: 'Bins', method: 'clean_sanitize', check_result: 'pass' }),
    ];
    expect(traceLot(records, 'GVF-1').gaps).toEqual([]);
  });

  it('says there is no harvest when only a shipment names the lot', () => {
    expect(traceLot([shipment('GVF-1', 'Fresh Mart', 5)], 'GVF-1').gaps).toContain('no_harvest');
  });
});
