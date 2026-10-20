import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { freshDb, signUp, asUser, asAnon, asServiceRole, farmIdOf } from './harness.js';
import { signOffRow, findSop } from '../api/_lib/shareSop.js';

// A share is the key to one SOP of one farm for anyone holding its link, so it must be unguessable, made only by the
// database, made and turned off only by owners and managers, and impossible to turn back on.
describe('migration: SOP shares', () => {
  let db;
  let owner; let manager; let crew; let outsider;
  let farmA; let farmB;

  beforeAll(async () => {
    db = await freshDb();
    owner = await signUp(db, { email: 's-owner@example.com' });
    manager = await signUp(db, { email: 's-manager@example.com' });
    crew = await signUp(db, { email: 's-crew@example.com' });
    outsider = await signUp(db, { email: 's-outsider@example.com' });
    farmA = await farmIdOf(db, owner);
    farmB = await farmIdOf(db, outsider);
    for (const user of [manager, crew]) await db.query('delete from public.farm_members where user_id = $1', [user]);
    await db.query(`insert into public.farm_members (farm_id, user_id, role) values ($1, $2, 'manager'), ($1, $3, 'crew')`, [farmA, manager, crew]);
  }, 60_000);
  afterAll(async () => {
    await db.close();
  });

  const as = (user, sql, params = []) => asUser(db, user, () => db.query(sql, params));
  const share = (user, farm, sop) => as(user, 'insert into public.sop_shares (farm_id, sop_id) values ($1, $2) returning id, token, created_by, revoked_at', [farm, sop]);

  it('lets an owner and a manager make a share, and the database makes the token', async () => {
    const a = await share(owner, farmA, 1);
    const b = await share(manager, farmA, 2);
    expect(a.rows[0].token).toMatch(/^[0-9a-f]{64}$/);
    expect(b.rows[0].token).toMatch(/^[0-9a-f]{64}$/);
    expect(a.rows[0].token).not.toBe(b.rows[0].token);
    expect(a.rows[0].created_by).toBe(owner);
    expect(b.rows[0].created_by).toBe(manager);
  });

  it('does not let a client choose the token or who made the share', async () => {
    await expect(as(owner, `insert into public.sop_shares (farm_id, sop_id, token) values ($1, 3, repeat('a', 64))`, [farmA])).rejects.toThrow(/permission denied/i);
    await expect(as(owner, `insert into public.sop_shares (farm_id, sop_id, created_by) values ($1, 3, $2)`, [farmA, crew])).rejects.toThrow(/permission denied/i);
    await expect(as(owner, `insert into public.sop_shares (farm_id, sop_id, revoked_at) values ($1, 3, now())`, [farmA])).rejects.toThrow(/permission denied/i);
  });

  it('does not let crew, outsiders or signed-out visitors make or see shares', async () => {
    await expect(share(crew, farmA, 4)).rejects.toThrow(/row-level security/i);
    await expect(share(outsider, farmA, 4)).rejects.toThrow(/row-level security/i);
    await expect(share(owner, farmB, 4)).rejects.toThrow(/row-level security/i);
    expect((await as(crew, 'select id from public.sop_shares')).rows).toHaveLength(0);
    expect((await as(outsider, 'select id from public.sop_shares where farm_id = $1', [farmA])).rows).toHaveLength(0);
    await expect(asAnon(db, () => db.query('select token from public.sop_shares'))).rejects.toThrow(/permission denied/i);
    await expect(asAnon(db, () => db.query(`insert into public.sop_shares (farm_id, sop_id) values ($1, 4)`, [farmA]))).rejects.toThrow(/permission denied/i);
  });

  it('lets owners and managers see their farm’s shares and no other farm’s', async () => {
    await share(outsider, farmB, 1);
    expect((await as(owner, 'select sop_id from public.sop_shares order by sop_id')).rows.map((r) => r.sop_id)).toEqual([1, 2]);
    expect((await as(manager, 'select sop_id from public.sop_shares order by sop_id')).rows.map((r) => r.sop_id)).toEqual([1, 2]);
    expect((await as(outsider, 'select sop_id from public.sop_shares')).rows.map((r) => r.sop_id)).toEqual([1]);
  });

  it('allows only one working link for a SOP', async () => {
    await expect(share(owner, farmA, 1)).rejects.toThrow(/duplicate key|unique/i);
    await expect(share(manager, farmA, 2)).rejects.toThrow(/duplicate key|unique/i);
  });

  it('refuses a SOP number that cannot exist', async () => {
    await expect(share(owner, farmA, 0)).rejects.toThrow(/check constraint/i);
    await expect(share(owner, farmA, 100)).rejects.toThrow(/check constraint/i);
  });

  it('lets an owner or manager turn a share off, and the server stamps the time', async () => {
    const turnedOff = await as(owner, `update public.sop_shares set revoked_at = '2000-01-01' where farm_id = $1 and sop_id = 1 returning revoked_at > now() - interval '1 minute' as fresh`, [farmA]);
    expect(turnedOff.rows).toEqual([{ fresh: true }]);
    const byManager = await as(manager, `update public.sop_shares set revoked_at = now() where farm_id = $1 and sop_id = 2 returning id`, [farmA]);
    expect(byManager.rows).toHaveLength(1);
  });

  it('never turns a turned-off share back on, but lets a new link be made', async () => {
    await as(owner, `update public.sop_shares set revoked_at = null where farm_id = $1 and sop_id = 1`, [farmA]);
    expect((await as(owner, `select revoked_at is not null as off from public.sop_shares where farm_id = $1 and sop_id = 1`, [farmA])).rows).toEqual([{ off: true }]);
    const again = await share(owner, farmA, 1);
    expect(again.rows[0].token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not let crew or outsiders turn a share off, and does not let a share change otherwise', async () => {
    expect((await as(crew, `update public.sop_shares set revoked_at = now() where farm_id = $1 returning id`, [farmA])).rows).toHaveLength(0);
    expect((await as(outsider, `update public.sop_shares set revoked_at = now() where farm_id = $1 returning id`, [farmA])).rows).toHaveLength(0);
    await expect(as(owner, `update public.sop_shares set sop_id = 9 where farm_id = $1`, [farmA])).rejects.toThrow(/permission denied/i);
    await expect(as(owner, `update public.sop_shares set token = repeat('b', 64) where farm_id = $1`, [farmA])).rejects.toThrow(/permission denied/i);
    await expect(as(owner, `update public.sop_shares set farm_id = $1 where farm_id = $2`, [farmB, farmA])).rejects.toThrow(/permission denied/i);
  });

  it('cannot be deleted from the app', async () => {
    await expect(as(owner, 'delete from public.sop_shares where farm_id = $1', [farmA])).rejects.toThrow(/permission denied/i);
  });

  it('lets the server look a link up, but not change it', async () => {
    const { rows } = await asServiceRole(db, () => db.query(`select token from public.sop_shares where farm_id = $1 and revoked_at is null order by sop_id`, [farmA]));
    expect(rows.length).toBeGreaterThan(0);
    await expect(asServiceRole(db, () => db.query(`update public.sop_shares set revoked_at = now() where farm_id = $1`, [farmA]))).rejects.toThrow(/permission denied/i);
  });

  describe('the sign-off the server files from a link', () => {
    const insert = (row) =>
      asServiceRole(db, () =>
        db.query(
          `insert into public.records (farm_id, kind, status, record_date, payload, missing_fields, fingerprint, source, source_ref)
           values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9) returning id, status, source, created_by, version`,
          [row.farm_id, row.kind, row.status, row.record_date, JSON.stringify(row.payload), row.missing_fields, row.fingerprint, row.source, row.source_ref],
        ),
      );
    const made = (name, today = '2026-10-20') => signOffRow({ share: { id: 'share-x', farm_id: farmA }, sop: findSop(1), name, today, lang: 'en' }).row;

    it('is accepted as a training record waiting for review, with no author', async () => {
      const { rows } = await insert(made('Maria Lopez'));
      expect(rows[0]).toMatchObject({ status: 'pending_review', source: 'web_upload', created_by: null, version: 1 });
      const revisions = await db.query('select change_type, changed_by from public.record_revisions where record_id = $1', [rows[0].id]);
      expect(revisions.rows).toEqual([{ change_type: 'created', changed_by: null }]);
    });

    it('is refused as a duplicate when the same person signs the same SOP twice on one day, but not for another day or person', async () => {
      await expect(insert(made('maria lopez'))).rejects.toThrow(/duplicate key|unique/i);
      await insert(made('Maria Lopez', '2026-10-21'));
      await insert(made('Jose Ruiz'));
    });

    it('is not visible to people outside the farm, and crew see it only as the record it is', async () => {
      expect((await as(outsider, `select id from public.records where source = 'web_upload'`)).rows).toHaveLength(0);
      expect((await as(manager, `select id from public.records where source = 'web_upload' and farm_id = $1`, [farmA])).rows.length).toBeGreaterThan(0);
    });
  });
});
