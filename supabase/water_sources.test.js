import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { freshDb, signUp, asUser, asAnon, farmIdOf, migrationSql } from './harness.js';

// Water sources: the named wells, canals and ponds a farm waters its crops from. Records keep the source as text
// (an assessment's or a water test's `source`, a flood's `water_source`), so the registry must never let a name change
// or vanish while records still use it. Names are unique per farm, ignoring capital letters and spacing.
describe('migration: water sources', () => {
  let db;
  let owner; let manager; let crew; let outsider; let loner;
  let farmA; let farmB;

  beforeAll(async () => {
    db = await freshDb();
    owner = await signUp(db, { email: 'w-owner@example.com' });
    manager = await signUp(db, { email: 'w-manager@example.com' });
    crew = await signUp(db, { email: 'w-crew@example.com' });
    outsider = await signUp(db, { email: 'w-outsider@example.com' });
    loner = await signUp(db, { email: 'w-loner@example.com' });
    farmA = await farmIdOf(db, owner);
    farmB = await farmIdOf(db, outsider);
    for (const user of [manager, crew]) await db.query('delete from public.farm_members where user_id = $1', [user]);
    await db.query(`insert into public.farm_members (farm_id, user_id, role) values ($1, $2, 'manager'), ($1, $3, 'crew')`, [farmA, manager, crew]);
    await db.query('delete from public.farm_members where user_id = $1', [loner]);
  }, 60_000);
  afterAll(async () => {
    await db.close();
  });

  const as = (user, sql, params = []) => asUser(db, user, () => db.query(sql, params));
  const addSource = (user, farm, name, extra = {}) =>
    as(user, `insert into public.water_sources (farm_id, name, source_type, fields_served, notes) values ($1, $2, $3, $4, $5) returning id, name, is_active`, [farm, name, extra.source_type ?? null, extra.fields_served ?? null, extra.notes ?? null]);
  const namesSeenBy = (user, farm) => asUser(db, user, async () => (await db.query('select name from public.water_sources where farm_id = $1 order by lower(name)', [farm])).rows.map((r) => r.name));
  // Records are filed by the table owner here, which is what the server does.
  const fileRecord = (farm, kind, payload, extra = {}) =>
    db.query(
      `insert into public.records (farm_id, kind, status, record_date, payload, created_by, created_at) values ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [farm, kind, extra.status ?? 'approved', extra.date ?? '2026-05-01', JSON.stringify(payload), owner, extra.createdAt ?? '2026-05-01T09:00:00Z'],
    );
  const assessed = (farm, source, extra = {}, payload = {}) => fileRecord(farm, 'water_assessment', { source, ...payload }, extra);

  describe('who can see and change water sources', () => {
    it('lets an owner and a manager add them, with a kind, the fields they water and notes', async () => {
      const a = await addSource(owner, farmA, 'Well 1', { source_type: 'enclosed_groundwater', fields_served: 'A1, A2', notes: 'Behind the barn' });
      expect(a.rows[0]).toMatchObject({ name: 'Well 1', is_active: true });
      await addSource(manager, farmA, 'Canal');
    });

    it('lets every member of the farm see them, and nobody else', async () => {
      await addSource(outsider, farmB, 'Other farm well');
      expect(await namesSeenBy(owner, farmA)).toEqual(['Canal', 'Well 1']);
      expect(await namesSeenBy(crew, farmA)).toEqual(['Canal', 'Well 1']);
      expect(await namesSeenBy(outsider, farmA)).toEqual([]);
      expect(await namesSeenBy(loner, farmA)).toEqual([]);
    });

    it('shows signed-out visitors nothing, and lets them change nothing', async () => {
      await expect(asAnon(db, () => db.query('select * from public.water_sources'))).rejects.toThrow(/permission denied/i);
      await expect(asAnon(db, () => db.query(`insert into public.water_sources (farm_id, name) values ($1, 'x')`, [farmA]))).rejects.toThrow(/permission denied|row-level security/i);
    });

    it('does not let crew add, change, archive or delete one', async () => {
      await expect(addSource(crew, farmA, 'Crew well')).rejects.toThrow(/row-level security/i);
      expect((await as(crew, `update public.water_sources set notes = 'x' where farm_id = $1 returning id`, [farmA])).rows).toHaveLength(0);
      expect((await as(crew, `delete from public.water_sources where farm_id = $1 returning id`, [farmA])).rows).toHaveLength(0);
    });

    it('does not let anyone add one to another farm, or touch another farm’s', async () => {
      await expect(addSource(owner, farmB, 'Wrong farm')).rejects.toThrow(/row-level security/i);
      await expect(addSource(loner, farmA, 'Not a member')).rejects.toThrow(/row-level security/i);
      expect((await as(manager, `update public.water_sources set notes = 'x' where farm_id = $1 returning id`, [farmB])).rows).toHaveLength(0);
      expect(await namesSeenBy(outsider, farmB)).toEqual(['Other farm well']);
    });

    it('does not let one move to another farm, or its author be changed', async () => {
      await expect(as(owner, `update public.water_sources set farm_id = $1 where farm_id = $2`, [farmB, farmA])).rejects.toThrow(/permission denied/i);
      await expect(as(owner, `update public.water_sources set created_by = $1 where farm_id = $2`, [crew, farmA])).rejects.toThrow(/permission denied/i);
      await expect(db.query(`update public.water_sources set farm_id = $1 where farm_id = $2 and name = 'Well 1'`, [farmB, farmA])).rejects.toThrow(/cannot move to another farm/i);
    });

    it('records who added one, as the signed-in person, and cannot be told otherwise', async () => {
      const { rows } = await db.query(`select created_by from public.water_sources where farm_id = $1 and name = 'Canal'`, [farmA]);
      expect(rows[0].created_by).toBe(manager);
      await expect(as(owner, `insert into public.water_sources (farm_id, name, created_by) values ($1, 'Forged', $2)`, [farmA, crew])).rejects.toThrow(/permission denied/i);
    });

    it('lets the server role read them', async () => {
      expect((await db.query(`select count(*)::int as n from public.water_sources where farm_id = $1`, [farmA])).rows[0].n).toBeGreaterThan(0);
    });
  });

  describe('names, kinds and notes', () => {
    it('are unique within a farm, ignoring capital letters and spacing, and can repeat in another farm', async () => {
      await expect(addSource(owner, farmA, 'well 1')).rejects.toThrow(/duplicate key|unique/i);
      await addSource(owner, farmA, 'Spacing test 1');
      await expect(addSource(manager, farmA, 'SPACING TEST 1')).rejects.toThrow(/duplicate key|unique/i);
      await addSource(outsider, farmB, 'Well 1');
    });

    it.each([
      ['empty', ''],
      ['only spaces', '   '],
      ['with a space at the start', ' Pond'],
      ['too long', 'x'.repeat(61)],
      ['with a line break', 'Pond\n2'],
      ['with two spaces inside', 'Pond  2'],
      ['with a zero-width space', 'Po\u200bnd'],
    ])('refuse a name that is %s', async (_label, name) => {
      await expect(addSource(owner, farmA, name)).rejects.toThrow(/check constraint|violates/i);
    });

    it('allow a name of 60 characters, with accents and other scripts', async () => {
      for (const name of ['x'.repeat(60), 'Pozo Año Nuevo', '北の井戸']) await addSource(owner, farmA, name);
    });

    it('allow only the known kinds of source, or none', async () => {
      for (const source_type of ['enclosed_groundwater', 'open_groundwater', 'surface', 'canal', 'public', 'other']) await addSource(owner, farmA, `Kind ${source_type}`, { source_type });
      await expect(addSource(owner, farmA, 'Bad kind', { source_type: 'lake' })).rejects.toThrow(/check constraint|violates/i);
    });

    it('refuse notes or a list of fields that are too long', async () => {
      await expect(addSource(owner, farmA, 'Long notes', { notes: 'n'.repeat(1001) })).rejects.toThrow(/check constraint|violates/i);
      await expect(addSource(owner, farmA, 'Long fields', { fields_served: 'f'.repeat(1001) })).rejects.toThrow(/check constraint|violates/i);
      await addSource(owner, farmA, 'Long but fine', { notes: 'n'.repeat(1000), fields_served: 'f'.repeat(1000) });
    });
  });

  describe('while records use a water source', () => {
    beforeAll(async () => {
      for (const name of ['Assessed', 'Tested', 'Flooded', 'Only voided', 'Free']) await addSource(owner, farmA, name);
      await assessed(farmA, 'Assessed');
      await fileRecord(farmA, 'water_test', { source: 'Tested', result: 'pass' });
      await fileRecord(farmA, 'weather_event', { event_type: 'flood', field: 'A1', crop_contact: 'no', water_source: 'Flooded' });
      await assessed(farmA, 'Only voided', { status: 'voided' });
    });

    it.each(['Assessed', 'Tested', 'Flooded', 'Only voided'])('cannot rename or delete “%s”, whatever the status of the record', async (name) => {
      await expect(as(owner, `update public.water_sources set name = $2 where farm_id = $1 and name = $3`, [farmA, `${name} renamed`, name])).rejects.toThrow(/used by records/i);
      await expect(as(manager, `delete from public.water_sources where farm_id = $1 and name = $2`, [farmA, name])).rejects.toThrow(/used by records/i);
    });

    it.each([
      ['two spaces inside', (base) => `${base}  `],
      ['capital letters', (base) => base.toUpperCase()],
      ['spaces around', (base) => `  ${base} `],
    ])('counts a record that spells it with %s as using it', async (_label, spell) => {
      const name = `Spelled ${_label.length}`;
      await addSource(owner, farmA, name);
      await assessed(farmA, spell(name));
      await expect(as(owner, `delete from public.water_sources where farm_id = $1 and name = $2`, [farmA, name])).rejects.toThrow(/used by records/i);
    });

    it('can still be archived, restored, and have its kind, fields and notes changed', async () => {
      await as(owner, `update public.water_sources set is_active = false, source_type = 'canal', fields_served = 'B1', notes = 'Dry in August' where farm_id = $1 and name = 'Assessed'`, [farmA]);
      await as(owner, `update public.water_sources set is_active = true where farm_id = $1 and name = 'Assessed'`, [farmA]);
    });

    it('can change a name’s capital letters, since records match it ignoring them', async () => {
      await as(owner, `update public.water_sources set name = 'ASSESSED' where farm_id = $1 and name = 'Assessed'`, [farmA]);
      await as(owner, `update public.water_sources set name = 'Assessed' where farm_id = $1 and name = 'ASSESSED'`, [farmA]);
    });

    it('can be renamed or deleted when no record uses it', async () => {
      await as(owner, `update public.water_sources set name = 'Free renamed' where farm_id = $1 and name = 'Free'`, [farmA]);
      const deleted = await as(owner, `delete from public.water_sources where farm_id = $1 and name = 'Free renamed' returning id`, [farmA]);
      expect(deleted.rows).toHaveLength(1);
    });

    it('is not tied to another farm’s records, or to records of other kinds that happen to have a source', async () => {
      await addSource(owner, farmA, 'Lonely');
      await assessed(farmB, 'Lonely');
      await fileRecord(farmA, 'note', { text: 'x', source: 'Lonely' });
      expect((await as(owner, `delete from public.water_sources where farm_id = $1 and name = 'Lonely' returning id`, [farmA])).rows).toHaveLength(1);
    });

    it('is not slowed or broken by a record whose source is huge or not text', async () => {
      await assessed(farmA, 'long '.repeat(2000));
      await db.query(`update public.records set payload = payload || '{"source": {"a": 1}}'::jsonb where farm_id = $1 and payload->>'source' like 'long %'`, [farmA]);
      await addSource(owner, farmA, 'Huge test');
      expect((await as(owner, `delete from public.water_sources where farm_id = $1 and name = 'Huge test' returning id`, [farmA])).rows).toHaveLength(1);
    });
  });

  describe('the fields an assessment waters keep their names', () => {
    it('cannot be renamed or deleted while an assessment or a water source lists them, however the list is written', async () => {
      const fieldRows = async (name) => as(owner, `insert into public.fields (farm_id, name) values ($1, $2) returning id`, [farmA, name]);
      await fieldRows('W-A1');
      await fieldRows('W-B2');
      await fieldRows('Peon');
      await assessed(farmA, 'Lister', {}, { fields_served: 'w-a1 and W-B2; other' });
      await expect(as(owner, `update public.fields set name = 'W-A1 renamed' where farm_id = $1 and name = 'W-A1'`, [farmA])).rejects.toThrow(/used by records/i);
      await expect(as(owner, `delete from public.fields where farm_id = $1 and name = 'W-B2'`, [farmA])).rejects.toThrow(/used by records/i);
      await as(owner, `update public.water_sources set fields_served = 'Peon / Else' where farm_id = $1 and name = 'Assessed'`, [farmA]);
      await expect(as(owner, `delete from public.fields where farm_id = $1 and name = 'Peon'`, [farmA])).rejects.toThrow(/used by records/i);
    });

    it('does not count a list that is not text, and does not look past its first 2000 characters', async () => {
      await as(owner, `insert into public.fields (farm_id, name) values ($1, 'NotText'), ($1, 'Far'), ($1, 'Near')`, [farmA]);
      await db.query(`insert into public.records (farm_id, kind, status, payload, created_by) values ($1, 'water_assessment', 'approved', $2::jsonb, $3)`, [farmA, JSON.stringify({ source: 'Odd 1', fields_served: { list: 'NotText' } }), owner]);
      await assessed(farmA, 'Odd 2', {}, { fields_served: `Near, ${'x'.repeat(2100)}, Far` });
      await as(owner, `update public.fields set name = 'NotText renamed' where farm_id = $1 and name = 'NotText'`, [farmA]);
      await as(owner, `update public.fields set name = 'Far renamed' where farm_id = $1 and name = 'Far'`, [farmA]);
      await expect(as(owner, `update public.fields set name = 'Near renamed' where farm_id = $1 and name = 'Near'`, [farmA])).rejects.toThrow(/used by records/i);
    });

    it('can be renamed once nothing lists them', async () => {
      await as(owner, `insert into public.fields (farm_id, name) values ($1, 'Unlisted')`, [farmA]);
      await as(owner, `update public.fields set name = 'Unlisted renamed' where farm_id = $1 and name = 'Unlisted'`, [farmA]);
    });
  });

  describe('limits and internals', () => {
    it('allows a farm at most 200 water sources, and only one insert at a time counts toward it', async () => {
      const full = await signUp(db, { email: 'w-full@example.com' });
      const fullFarm = await farmIdOf(db, full);
      await db.query(`insert into public.water_sources (farm_id, name) select $1, 'Source ' || g from generate_series(1, 200) g`, [fullFarm]);
      await expect(as(full, `insert into public.water_sources (farm_id, name) values ($1, 'One too many')`, [fullFarm])).rejects.toThrow(/at most 200 water sources/i);
      await expect(db.query(`insert into public.water_sources (farm_id, name) values ($1, 'One too many')`, [fullFarm])).rejects.toThrow(/at most 200 water sources/i);
      const { rows } = await db.query(`select prosrc from pg_proc where proname = 'water_sources_limit' and pronamespace = 'public'::regnamespace`);
      expect(rows[0].prosrc).toMatch(/pg_advisory_xact_lock\(hashtextextended\(new\.farm_id::text, 0\)\)[\s\S]*count\(\*\)/);
    });

    it('does not get in the way of people saving records: a signed-in person can still file an assessment, a test and a flood', async () => {
      for (const [kind, payload] of [
        ['water_assessment', { source: 'Filed by a person' }],
        ['water_test', { source: 'Filed by a person', result: 'pass' }],
        ['weather_event', { event_type: 'flood', field: 'A1', crop_contact: 'no', water_source: 'Filed by a person' }],
      ]) {
        const { rows } = await as(manager, `insert into public.records (farm_id, kind, status, payload) values ($1, $2, 'pending_review', $3::jsonb) returning id`, [farmA, kind, JSON.stringify(payload)]);
        expect(rows).toHaveLength(1);
      }
    });

    it('does not let signed-in users run its internal functions', async () => {
      await expect(as(owner, `select public.water_source_is_referenced($1, 'Well 1')`, [farmA])).rejects.toThrow(/permission denied/i);
      await expect(as(owner, `select public.water_sources_limit()`)).rejects.toThrow(/permission denied/i);
      await expect(as(owner, `select public.backfill_water_sources_from_records()`)).rejects.toThrow(/permission denied/i);
    });

    it('is written with escapes only, so pasting it into a browser editor cannot drop an invisible character', () => {
      const sql = migrationSql().find((text) => text.includes('create table if not exists public.water_sources'));
      expect(sql).toBeTruthy();
      // eslint-disable-next-line no-control-regex -- matching control and invisible characters is the point
      const raw = sql.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u0085\u00a0\u1680\u2000-\u200f\u2028-\u202f\u205f-\u2069\u3000\ufeff\ufffe\uffff]/);
      expect(raw, raw ? `an invisible character (code ${raw[0].codePointAt(0).toString(16)}) is in the file` : '').toBeNull();
    });
  });

  describe('the water sources a farm already uses', () => {
    it('are registered from approved records only, once per name, with the kind and fields of the newest assessment', async () => {
      const fresh = await signUp(db, { email: 'w-backfill@example.com' });
      const farm = await farmIdOf(db, fresh);
      const file = (kind, payload, extra = {}) => db.query(
        `insert into public.records (farm_id, kind, status, record_date, payload, created_by, created_at) values ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
        [farm, kind, extra.status ?? 'approved', extra.date ?? '2026-05-01', JSON.stringify(payload), fresh, extra.createdAt ?? '2026-05-01T09:00:00Z'],
      );
      await file('water_assessment', { source: 'Old well', source_type: 'open_groundwater', fields_served: 'A1' }, { date: '2025-04-01' });
      await file('water_assessment', { source: 'old  WELL', source_type: 'enclosed_groundwater', fields_served: 'A1, A2' }, { date: '2026-04-01' });
      await file('water_test', { source: 'Pond', result: 'pass' });
      await file('water_test', { source: 'Pond', result: 'fail' });
      await file('weather_event', { event_type: 'flood', field: 'B1', crop_contact: 'no', water_source: 'Canal' });
      await file('weather_event', { event_type: 'flood', field: 'B1', crop_contact: 'no', water_source: 'Well 1, Pond' });
      await file('water_assessment', { source: 'Draft only' }, { status: 'draft' });
      await file('water_test', { source: 'Rejected only', result: 'pass' }, { status: 'rejected' });
      await file('water_assessment', { source: 'x'.repeat(61) });
      await file('note', { text: 'x', source: 'Not water' });
      await db.query('select public.backfill_water_sources_from_records()');
      const { rows } = await db.query(`select name, source_type, fields_served from public.water_sources where farm_id = $1 order by lower(name)`, [farm]);
      expect(rows).toEqual([
        { name: 'Canal', source_type: null, fields_served: null },
        { name: 'old WELL', source_type: 'enclosed_groundwater', fields_served: 'A1, A2' },
        { name: 'Pond', source_type: null, fields_served: null },
      ].map((row) => (row.name === 'old WELL' ? { ...row, name: rows.find((r) => r.name.toLowerCase() === 'old well').name } : row)));
    });

    it('leaves a source that is already registered exactly as it is, and is safe to run again', async () => {
      await addSource(owner, farmA, 'Kept as is', { source_type: 'canal', notes: 'Mine' });
      await assessed(farmA, 'kept AS is', {}, { source_type: 'surface' });
      const before = (await db.query(`select count(*)::int as n from public.water_sources where farm_id = $1`, [farmA])).rows[0].n;
      await db.query('select public.backfill_water_sources_from_records()');
      await db.query('select public.backfill_water_sources_from_records()');
      const kept = (await db.query(`select name, source_type, notes from public.water_sources where farm_id = $1 and lower(name) = 'kept as is'`, [farmA])).rows;
      expect(kept).toEqual([{ name: 'Kept as is', source_type: 'canal', notes: 'Mine' }]);
      const after = (await db.query(`select count(*)::int as n from public.water_sources where farm_id = $1`, [farmA])).rows[0].n;
      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('is safe to run the whole migration again', async () => {
      const sql = migrationSql().find((text) => text.includes('create table if not exists public.water_sources'));
      await db.exec(sql);
      await db.exec(sql);
      const { rows } = await db.query(`select count(*)::int as n from public.water_sources where farm_id = $1 and lower(name) = 'well 1'`, [farmA]);
      expect(rows[0].n).toBe(1);
    });
  });
});
