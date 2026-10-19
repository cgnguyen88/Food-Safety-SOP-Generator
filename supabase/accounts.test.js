import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { migrationSql, freshDb, signUp, asUser, asAnon, asServiceRole, farmIdOf } from './harness.js';

const DENIED = /permission denied|row-level security/i;

const EARLIER_USERS = {
  maria: '11111111-1111-1111-1111-111111111111',
  joe: '22222222-2222-2222-2222-222222222222',
};
// Accounts that existed before the migrations ran (they must get a farm and a profile too).
const EARLIER_SIGN_UPS = `
  insert into auth.users (id, email, raw_user_meta_data) values
    ('${EARLIER_USERS.maria}', 'maria@example.com', '{"first_name":"Maria","organization":"Valley Greens"}'),
    ('${EARLIER_USERS.joe}',   'joe@example.com',   '{}');
`;

const farmNameOf = async (db, userId) =>
  (await db.query('select f.name from public.farms f join public.farm_members m on m.farm_id = f.id where m.user_id = $1', [userId])).rows[0]?.name;

const addMember = (db, farmId, userId, role) =>
  db.query('insert into public.farm_members (farm_id, user_id, role) values ($1, $2, $3)', [farmId, userId, role]);

const versionOf = async (db, farmId, key) =>
  (await db.query('select version from public.farm_data where farm_id = $1 and key = $2', [farmId, key])).rows[0]?.version ?? null;

/** Save over a given version (`expected`), as a person would after reading it. */
const putAt = (db, userId, farmId, key, value, expected) =>
  asUser(db, userId, async () => (await db.query('select public.put_farm_data($1, $2, $3::jsonb, $4) as version', [farmId, key, JSON.stringify(value), expected])).rows[0].version);

/** Save over whatever version is there now (a fresh read, then a save). */
const putData = async (db, userId, farmId, key, value) => putAt(db, userId, farmId, key, value, await versionOf(db, farmId, key));

const readData = (db, userId) =>
  asUser(db, userId, async () => (await db.query('select farm_id, key, value from public.farm_data order by key')).rows);

describe('accounts, farms and farm data', () => {
  let db;
  beforeAll(async () => {
    db = await freshDb({ beforeMigrations: EARLIER_SIGN_UPS });
  }, 60_000);
  afterAll(async () => {
    await db.close();
  });

  describe('a farm for every account', () => {
    it('creates a farm with the new person as its owner, named after the organisation given at sign-up', async () => {
      const id = await signUp(db, { email: 'ana@example.com', meta: { first_name: 'Ana', last_name: 'Reyes', organization: 'Reyes Family Farm' } });
      const { rows } = await db.query(
        `select f.name, f.farm_code, f.created_by, m.role from public.farms f
           join public.farm_members m on m.farm_id = f.id where m.user_id = $1`,
        [id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ name: 'Reyes Family Farm', role: 'owner', created_by: id });
      expect(rows[0].farm_code).toMatch(/^F-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    });

    it('prefers an explicit farm name over the organisation', async () => {
      const id = await signUp(db, { email: 'fn@example.com', meta: { farm_name: 'North Field Co', organization: 'Holding LLC' } });
      expect(await farmNameOf(db, id)).toBe('North Field Co');
    });

    it("falls back to the person's first name, then to the email, when no farm or organisation is given", async () => {
      const named = await signUp(db, { email: 'luis@example.com', meta: { first_name: 'Luis' } });
      const emailOnly = await signUp(db, { email: 'carlos@example.com' });
      expect(await farmNameOf(db, named)).toBe("Luis's Farm");
      expect(await farmNameOf(db, emailOnly)).toBe("carlos's Farm");
    });

    it('trims and shortens long farm names (120 characters) and ignores blank ones', async () => {
      const long = await signUp(db, { email: 'long@example.com', meta: { organization: `  ${'x'.repeat(500)}  ` } });
      const blank = await signUp(db, { email: 'blank@example.com', meta: { first_name: 'Bea', organization: '    ' } });
      expect((await farmNameOf(db, long)).length).toBe(120);
      expect(await farmNameOf(db, blank)).toBe("Bea's Farm");
    });

    it('gives every farm its own farm code', async () => {
      for (let i = 0; i < 40; i += 1) await signUp(db, { email: `bulk${i}@example.com` });
      const { rows } = await db.query('select count(*)::int as total, count(distinct farm_code)::int as uniq from public.farms');
      expect(rows[0].uniq).toBe(rows[0].total);
    });

    it('also gives accounts made before this migration a farm and a profile', async () => {
      for (const id of Object.values(EARLIER_USERS)) expect(await farmIdOf(db, id)).toBeTruthy();
      expect(await farmNameOf(db, EARLIER_USERS.maria)).toBe('Valley Greens');
      const { rows } = await db.query('select first_name from public.profiles where id = $1', [EARLIER_USERS.maria]);
      expect(rows).toEqual([{ first_name: 'Maria' }]);
    });

    it('works when Supabase Auth (not a superuser) creates the account', async () => {
      await db.exec(`
        do $$ begin
          if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
        end $$;
        grant usage on schema auth, public to supabase_auth_admin;
        grant insert on auth.users to supabase_auth_admin;
      `);
      const id = crypto.randomUUID();
      await db.exec('set role supabase_auth_admin;');
      try {
        await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'authadmin@example.com', '{"organization":"Made By Auth","first_name":"Ivy"}')`, [id]);
      } finally {
        await db.exec('reset role;');
      }
      expect(await farmNameOf(db, id)).toBe('Made By Auth');
      expect((await db.query('select first_name from public.profiles where id = $1', [id])).rows).toEqual([{ first_name: 'Ivy' }]);
    });

    it('ensure_my_farm() returns the same farm every time and needs a signed-in user', async () => {
      const id = await signUp(db, { email: 'idem@example.com', meta: { organization: 'Idem Farm' } });
      const first = await farmIdOf(db, id);
      const again = await asUser(db, id, async () => (await db.query('select public.ensure_my_farm() as f')).rows[0].f);
      expect(again).toBe(first);
      expect((await db.query('select count(*)::int as n from public.farm_members where user_id = $1', [id])).rows[0].n).toBe(1);
      await expect(asAnon(db, () => db.query('select public.ensure_my_farm()'))).rejects.toThrow();
    });

    it('never blocks a sign-up when setting up the farm or profile fails, and repairs both later', async () => {
      const isolated = await freshDb();
      try {
        await isolated.exec(`
          alter table public.farm_members add constraint test_block check (false) not valid;
          alter table public.profiles add constraint test_block check (false) not valid;
        `);
        const id = await signUp(isolated, { email: 'late@example.com', meta: { organization: 'Late Farm', first_name: 'Lee' } });
        expect((await isolated.query('select 1 from auth.users where id = $1', [id])).rows).toHaveLength(1);
        expect(await farmIdOf(isolated, id)).toBeUndefined();

        await isolated.exec(`
          alter table public.farm_members drop constraint test_block;
          alter table public.profiles drop constraint test_block;
        `);
        const healed = await asUser(isolated, id, async () => (await isolated.query('select public.ensure_my_farm() as f')).rows[0].f);
        expect(healed).toBe(await farmIdOf(isolated, id));
        expect(await farmNameOf(isolated, id)).toBe('Late Farm');
        expect((await isolated.query('select first_name from public.profiles where id = $1', [id])).rows).toEqual([{ first_name: 'Lee' }]);
      } finally {
        await isolated.close();
      }
    });
  });

  describe('profiles', () => {
    it('fills the profile from what the person typed at sign-up', async () => {
      const id = await signUp(db, {
        email: 'full@example.com',
        meta: { first_name: ' Rosa ', last_name: 'Diaz', phone: '555-0100', organization: 'Diaz Farms', job_role: 'fsm' },
      });
      const { rows } = await db.query('select first_name, last_name, phone, organization, job_role from public.profiles where id = $1', [id]);
      expect(rows).toEqual([{ first_name: 'Rosa', last_name: 'Diaz', phone: '555-0100', organization: 'Diaz Farms', job_role: 'fsm' }]);
    });

    it('drops an unknown job role and shortens over-long values instead of refusing the sign-up', async () => {
      const id = await signUp(db, { email: 'odd@example.com', meta: { first_name: 'y'.repeat(300), job_role: 'superadmin', phone: '9'.repeat(100) } });
      const { rows } = await db.query('select first_name, phone, job_role from public.profiles where id = $1', [id]);
      expect(rows[0].job_role).toBeNull();
      expect(rows[0].first_name).toHaveLength(80);
      expect(rows[0].phone).toHaveLength(40);
    });

    it('lets a person read and change only their own profile', async () => {
      const a = await signUp(db, { email: 'pa@example.com', meta: { first_name: 'Pia' } });
      const b = await signUp(db, { email: 'pb@example.com', meta: { first_name: 'Ben' } });
      const seen = await asUser(db, a, async () => (await db.query('select id from public.profiles')).rows.map((r) => r.id));
      expect(seen).toEqual([a]);

      const mine = await asUser(db, a, () => db.query(`update public.profiles set first_name = 'Pilar', job_role = 'owner' where id = $1 returning first_name`, [a]));
      expect(mine.rows).toEqual([{ first_name: 'Pilar' }]);
      const theirs = await asUser(db, a, () => db.query(`update public.profiles set first_name = 'Hacked' where id = $1 returning id`, [b]));
      expect(theirs.rows).toHaveLength(0);
      await asUser(db, a, () => db.query(`update public.profiles set last_name = 'Everyone'`));
      expect((await db.query('select last_name from public.profiles where id = $1', [b])).rows[0].last_name).toBeNull();
      await expect(asUser(db, a, () => db.query(`update public.profiles set id = $2 where id = $1`, [a, b]))).rejects.toThrow(DENIED);
      await expect(asUser(db, a, () => db.query(`update public.profiles set job_role = 'boss' where id = $1`, [a]))).rejects.toThrow(/check constraint/i);
    });

    it('lets a person recreate their own missing profile, but not anyone else’s', async () => {
      const a = await signUp(db, { email: 'gone@example.com' });
      const b = await signUp(db, { email: 'other@example.com' });
      await db.query('delete from public.profiles where id = any($1)', [[a, b]]);
      await asUser(db, a, () => db.query(`insert into public.profiles (id, first_name) values ($1, 'Back')`, [a]));
      await expect(asUser(db, a, () => db.query(`insert into public.profiles (id, first_name) values ($1, 'Fake')`, [b]))).rejects.toThrow(DENIED);
    });

    it('keeps the profile’s updated_at current, and the app cannot set it', async () => {
      const id = await signUp(db, { email: 'touch@example.com' });
      await db.exec('set session_replication_role = replica;'); // skip triggers to backdate the row
      await db.query(`update public.profiles set updated_at = '2000-01-01' where id = $1`, [id]);
      await db.exec('reset session_replication_role;');
      await asUser(db, id, () => db.query(`update public.profiles set phone = '1' where id = $1`, [id]));
      const { rows } = await db.query(`select updated_at > now() - interval '1 minute' as fresh from public.profiles where id = $1`, [id]);
      expect(rows[0].fresh).toBe(true);
      await expect(asUser(db, id, () => db.query(`update public.profiles set updated_at = '2000-01-01' where id = $1`, [id]))).rejects.toThrow(DENIED);
    });
  });

  describe('farm and membership walls (RLS)', () => {
    it('lets each person see only their own farm', async () => {
      const a = await signUp(db, { email: 'iso-a@example.com', meta: { organization: 'A Farm' } });
      const b = await signUp(db, { email: 'iso-b@example.com', meta: { organization: 'B Farm' } });
      expect(await asUser(db, a, async () => (await db.query('select name from public.farms')).rows.map((r) => r.name))).toEqual(['A Farm']);
      expect(await asUser(db, b, async () => (await db.query('select name from public.farms')).rows.map((r) => r.name))).toEqual(['B Farm']);
    });

    it("stops a person from editing another farm, and nobody can create or delete farms from the app", async () => {
      const a = await signUp(db, { email: 'edit-a@example.com' });
      const b = await signUp(db, { email: 'edit-b@example.com' });
      const farmB = await farmIdOf(db, b);
      const updated = await asUser(db, a, () => db.query(`update public.farms set name = 'Pwned' where id = $1 returning id`, [farmB]));
      expect(updated.rows).toHaveLength(0);
      await expect(asUser(db, a, () => db.query(`insert into public.farms (name) values ('Rogue')`))).rejects.toThrow(DENIED);
      await expect(asUser(db, a, async () => db.query('delete from public.farms where id = $1', [await farmIdOf(db, a)]))).rejects.toThrow(DENIED);
    });

    it('lets owners and managers rename the farm, but not crew, and nobody can change its id, code or creator', async () => {
      const owner = await signUp(db, { email: 'own@example.com', meta: { organization: 'Role Farm' } });
      const manager = await signUp(db, { email: 'mgr@example.com' });
      const crew = await signUp(db, { email: 'crew@example.com' });
      const farm = await farmIdOf(db, owner);
      await addMember(db, farm, manager, 'manager');
      await addMember(db, farm, crew, 'crew');

      const rename = (uid, name) => asUser(db, uid, () => db.query('update public.farms set name = $2 where id = $1 returning id', [farm, name]));
      expect((await rename(crew, 'By Crew')).rows).toHaveLength(0);
      expect((await rename(manager, 'By Manager')).rows).toHaveLength(1);
      expect((await rename(owner, 'By Owner')).rows).toHaveLength(1);

      const update = (set) => asUser(db, manager, () => db.query(`update public.farms set ${set} where id = '${farm}'`));
      await expect(update(`farm_code = 'F-HIJACK'`)).rejects.toThrow(DENIED);
      await expect(update(`created_by = '${manager}'`)).rejects.toThrow(DENIED);
      await expect(update('id = gen_random_uuid()')).rejects.toThrow(DENIED);
    });

    it('does not let the app write memberships at all (adding people comes later as an invite)', async () => {
      const owner = await signUp(db, { email: 'm-own@example.com' });
      const crew = await signUp(db, { email: 'm-crew@example.com' });
      const outsider = await signUp(db, { email: 'm-out@example.com' });
      const farm = await farmIdOf(db, owner);
      await addMember(db, farm, crew, 'crew');

      const write = (uid, sql, params) => asUser(db, uid, () => db.query(sql, params));
      await expect(write(owner, `insert into public.farm_members (farm_id, user_id, role) values ($1, $2, 'crew')`, [farm, outsider])).rejects.toThrow(DENIED);
      await expect(write(owner, `update public.farm_members set role = 'manager' where farm_id = $1 and user_id = $2`, [farm, crew])).rejects.toThrow(DENIED);
      await expect(write(owner, `delete from public.farm_members where farm_id = $1 and user_id = $2`, [farm, crew])).rejects.toThrow(DENIED);
      await expect(write(outsider, `insert into public.farm_members (farm_id, user_id, role) values ($1, $2, 'owner')`, [farm, outsider])).rejects.toThrow(DENIED);
      await expect(write(crew, `update public.farm_members set role = 'owner' where farm_id = $1 and user_id = $2`, [farm, crew])).rejects.toThrow(DENIED);

      expect(await asUser(db, crew, async () => (await db.query('select user_id from public.farm_members where farm_id = $1', [farm])).rows)).toHaveLength(2);
    });

    it('rejects a role that does not exist', async () => {
      const owner = await signUp(db, { email: 'badrole@example.com' });
      const other = await signUp(db, { email: 'badrole2@example.com' });
      await expect(addMember(db, await farmIdOf(db, owner), other, 'superuser')).rejects.toThrow(/check constraint/i);
    });
  });

  describe('farm data (the farm profile, incidents, cost settings and SOP activity records)', () => {
    let owner; let manager; let crew; let stranger; let farm;
    beforeAll(async () => {
      owner = await signUp(db, { email: 'd-own@example.com', meta: { organization: 'Data Farm' } });
      manager = await signUp(db, { email: 'd-mgr@example.com' });
      crew = await signUp(db, { email: 'd-crew@example.com' });
      stranger = await signUp(db, { email: 'd-out@example.com' });
      farm = await farmIdOf(db, owner);
      await addMember(db, farm, manager, 'manager');
      await addMember(db, farm, crew, 'crew');
    });

    it('saves and replaces a value, and returns its new version', async () => {
      expect(await putData(db, owner, farm, 'farm_profile', { farmName: 'Data Farm', crops: ['lettuce'] })).toBe(1);
      expect(await putData(db, owner, farm, 'farm_profile', { farmName: 'Data Farm', crops: ['lettuce', 'kale'] })).toBe(2);
      const rows = await readData(db, owner);
      expect(rows).toEqual([{ farm_id: farm, key: 'farm_profile', value: { farmName: 'Data Farm', crops: ['lettuce', 'kale'] } }]);
    });

    it('refuses a save over an older version, so a second device cannot overwrite a newer save', async () => {
      const read = await versionOf(db, farm, 'farm_profile');
      await putAt(db, manager, farm, 'farm_profile', { farmName: 'From the phone' }, read);
      await expect(putAt(db, owner, farm, 'farm_profile', { farmName: 'From the laptop' }, read)).rejects.toMatchObject({ code: 'FD409' });
      await expect(putAt(db, owner, farm, 'farm_profile', { farmName: 'Thought it was new' }, null)).rejects.toMatchObject({ code: 'FD409' });
      expect((await readData(db, owner)).find((r) => r.key === 'farm_profile').value).toEqual({ farmName: 'From the phone' });
      expect(await putAt(db, owner, farm, 'farm_profile', { farmName: 'Merged' }, read + 1)).toBe(read + 2);
    });

    it('creates a value only when there is none yet', async () => {
      const fresh = await signUp(db, { email: 'cas-new@example.com' });
      const freshFarm = await farmIdOf(db, fresh);
      expect(await putAt(db, fresh, freshFarm, 'incidents', [], null)).toBe(1);
      await expect(putAt(db, fresh, freshFarm, 'incidents', [{ id: 'x' }], 7)).rejects.toMatchObject({ code: 'FD409' });
    });

    it('lets owners and managers save, and the whole team read, but crew cannot change it', async () => {
      await putData(db, manager, farm, 'incidents', [{ id: 'i1', title: 'Glove found in bin' }]);
      expect((await readData(db, crew)).map((r) => r.key)).toEqual(['farm_profile', 'incidents']);
      await expect(putData(db, crew, farm, 'incidents', [])).rejects.toThrow(DENIED);
      await expect(putAt(db, crew, farm, 'incidents', [], await versionOf(db, farm, 'incidents'))).rejects.toMatchObject({ code: '42501' });
      const crewEdit = await asUser(db, crew, () => db.query(`update public.farm_data set value = '[]' where farm_id = $1 returning key`, [farm]));
      expect(crewEdit.rows).toHaveLength(0);
      expect((await readData(db, owner)).find((r) => r.key === 'incidents').value).toEqual([{ id: 'i1', title: 'Glove found in bin' }]);
    });

    it("keeps one farm's data away from everyone else", async () => {
      expect(await readData(db, stranger)).toEqual([]);
      await expect(putData(db, stranger, farm, 'cost_settings', { wage: 1 })).rejects.toThrow(DENIED);
      const strangerFarm = await farmIdOf(db, stranger);
      await putData(db, stranger, strangerFarm, 'cost_settings', { wage: 20 });
      expect((await readData(db, owner)).map((r) => r.key)).toEqual(['farm_profile', 'incidents']);
    });

    it('records who saved it last and when, and the app cannot fake either', async () => {
      await putData(db, owner, farm, 'cost_settings', { wage: 17 });
      await db.exec('set session_replication_role = replica;'); // skip triggers to backdate the row
      await db.query(`update public.farm_data set updated_at = '2000-01-01' where farm_id = $1 and key = 'cost_settings'`, [farm]);
      await db.exec('reset session_replication_role;');
      await putData(db, manager, farm, 'cost_settings', { wage: 18 });
      const { rows } = await db.query(`select updated_by, updated_at > now() - interval '1 minute' as fresh from public.farm_data where farm_id = $1 and key = 'cost_settings'`, [farm]);
      expect(rows).toEqual([{ updated_by: manager, fresh: true }]);
      await expect(asUser(db, owner, () => db.query(`update public.farm_data set updated_by = $2 where farm_id = $1`, [farm, crew]))).rejects.toThrow(DENIED);
      await expect(asUser(db, owner, () => db.query(`update public.farm_data set updated_at = '2000-01-01' where farm_id = $1`, [farm]))).rejects.toThrow(DENIED);
      await expect(asUser(db, owner, () => db.query(`update public.farm_data set version = 1 where farm_id = $1`, [farm]))).rejects.toThrow(DENIED);
    });

    it('cannot move a farm’s data to another farm or rename its key', async () => {
      const other = await farmIdOf(db, stranger);
      await expect(asUser(db, owner, () => db.query(`update public.farm_data set farm_id = $2 where farm_id = $1`, [farm, other]))).rejects.toThrow(DENIED);
      await expect(asUser(db, owner, () => db.query(`update public.farm_data set key = 'incidents' where farm_id = $1 and key = 'cost_settings'`, [farm]))).rejects.toThrow(DENIED);
    });

    it('accepts only the four known kinds of data, each in its expected shape', async () => {
      await expect(putData(db, owner, farm, 'secrets', { a: 1 })).rejects.toThrow(/check constraint/i);
      await expect(putData(db, owner, farm, 'incidents', { not: 'a list' })).rejects.toThrow(/check constraint/i);
      await expect(putData(db, owner, farm, 'farm_profile', ['not', 'an', 'object'])).rejects.toThrow(/check constraint/i);
      await expect(putData(db, owner, farm, 'cost_settings', 'text')).rejects.toThrow(/check constraint/i);
      await putData(db, owner, farm, 'sop_activity_records', [{ sopId: 'sop1', date: '2026-10-18' }]);
      await expect(putData(db, owner, farm, 'sop_activity_records', {})).rejects.toThrow(/check constraint/i);
    });

    it('refuses a value over 5 MB, so one save cannot fill the database', async () => {
      const big = [{ photo: 'x'.repeat(5 * 1024 * 1024) }];
      await expect(putData(db, owner, farm, 'incidents', big)).rejects.toThrow(/check constraint/i);
    });

    it('lets the first sign-in import browser data with a plain insert that never overwrites saved data', async () => {
      const fresh = await signUp(db, { email: 'importer@example.com' });
      const freshFarm = await farmIdOf(db, fresh);
      const insert = (value) => asUser(db, fresh, () => db.query(`insert into public.farm_data (farm_id, key, value) values ($1, 'cost_settings', $2::jsonb)`, [freshFarm, JSON.stringify(value)]));
      await insert({ wage: 15 });
      await expect(insert({ wage: 99 })).rejects.toThrow(/duplicate key/i);
      expect((await readData(db, fresh))[0].value).toEqual({ wage: 15 });
      await expect(asUser(db, crew, () => db.query(`insert into public.farm_data (farm_id, key, value) values ($1, 'sop_activity_records', '[]')`, [farm]))).rejects.toThrow(DENIED);
    });

    it('cannot be deleted or emptied from the app', async () => {
      await expect(asUser(db, owner, () => db.query('delete from public.farm_data where farm_id = $1', [farm]))).rejects.toThrow(DENIED);
      await expect(asUser(db, owner, () => db.query('truncate public.farm_data'))).rejects.toThrow(DENIED);
    });

    it('is deleted with its farm', async () => {
      const temp = await signUp(db, { email: 'temp@example.com' });
      const tempFarm = await farmIdOf(db, temp);
      await putData(db, temp, tempFarm, 'farm_profile', { farmName: 'Temp' });
      await asServiceRole(db, () => db.query('delete from public.farms where id = $1', [tempFarm]));
      expect((await db.query('select 1 from public.farm_data where farm_id = $1', [tempFarm])).rows).toHaveLength(0);
    });
  });

  describe('privileges', () => {
    it('denies people who are not signed in any access', async () => {
      for (const table of ['farms', 'farm_members', 'profiles', 'farm_data']) {
        await expect(asAnon(db, () => db.query(`select * from public.${table}`)), table).rejects.toThrow(/permission denied/i);
      }
      await expect(asAnon(db, () => db.query(`select public.put_farm_data(gen_random_uuid(), 'incidents', '[]', null)`))).rejects.toThrow(/permission denied/i);
    });

    it('removes TRUNCATE and other privileges that get around RLS', async () => {
      for (const table of ['farms', 'farm_members', 'profiles', 'farm_data']) {
        for (const privilege of ['TRUNCATE', 'REFERENCES', 'TRIGGER']) {
          const { rows } = await db.query(`select has_table_privilege('authenticated', 'public.${table}', '${privilege}') as allowed`);
          expect(rows[0].allowed, `${table} ${privilege}`).toBe(false);
        }
      }
    });

    it('keeps internal functions away from the app and offers only the intended ones', async () => {
      const canRun = async (role, fn) => (await db.query(`select has_function_privilege('${role}', '${fn}', 'execute') as ok`)).rows[0].ok;
      const internal = [
        'public.generate_farm_code()',
        'public.touch_updated_at()',
        'public.farm_data_stamp()',
        'public.provision_new_user()',
        'public.provision_user(uuid)',
        'public.ensure_farm_for_user(uuid,text,text)',
        'public.ensure_profile_for_user(uuid)',
        'public.signup_text(jsonb,text,integer)',
      ];
      for (const fn of internal) {
        expect(await canRun('anon', fn), `anon ${fn}`).toBe(false);
        expect(await canRun('authenticated', fn), `authenticated ${fn}`).toBe(false);
      }
      for (const fn of ['public.ensure_my_farm()', 'public.put_farm_data(uuid,text,jsonb,integer)', 'public.my_farm_ids()', 'public.has_farm_role(uuid,text[])']) {
        expect(await canRun('authenticated', fn), fn).toBe(true);
        expect(await canRun('anon', fn), fn).toBe(false);
      }
    });
  });

  describe('on a brand-new Supabase project (no default grants)', () => {
    let bare;
    beforeAll(async () => {
      bare = await freshDb({ defaultGrants: false });
    }, 60_000);
    afterAll(async () => {
      await bare.close();
    });

    it('supports everything the app does: sign up, read the profile and farm, save and read farm data', async () => {
      const id = await signUp(bare, { email: 'new@example.com', meta: { first_name: 'Nia', organization: 'New Farm' } });
      const farm = await asUser(bare, id, async () => (await bare.query('select public.ensure_my_farm() as f')).rows[0].f);
      expect(await asUser(bare, id, async () => (await bare.query('select first_name from public.profiles')).rows)).toEqual([{ first_name: 'Nia' }]);
      expect(await asUser(bare, id, async () => (await bare.query('select name, farm_code from public.farms')).rows[0].name)).toBe('New Farm');
      await asUser(bare, id, () => bare.query(`update public.profiles set phone = '555' where id = $1`, [id]));
      await putData(bare, id, farm, 'incidents', [{ id: 'a' }]);
      await asUser(bare, id, () => bare.query(`insert into public.farm_data (farm_id, key, value) values ($1, 'cost_settings', '{}')`, [farm]));
      expect((await readData(bare, id)).map((r) => r.key)).toEqual(['cost_settings', 'incidents']);
    });
  });

  it('replaces the older three-argument save function when run again on an existing database', async () => {
    expect((await db.query(`select to_regprocedure('public.put_farm_data(uuid,text,jsonb)') as old`)).rows[0].old).toBeNull();
  });

  it('can be run again without changing data or policies', async () => {
    const again = await freshDb();
    try {
      const id = await signUp(again, { email: 'rerun@example.com', meta: { organization: 'Rerun Farm', first_name: 'Rae' } });
      await putData(again, id, await farmIdOf(again, id), 'farm_profile', { farmName: 'Rerun Farm' });
      const snapshot = async () => ({
        policies: (await again.query('select tablename, policyname, cmd, qual, with_check from pg_policies order by 1, 2')).rows,
        farms: (await again.query('select id, farm_code, name from public.farms')).rows,
        members: (await again.query('select farm_id, user_id, role from public.farm_members')).rows,
        profiles: (await again.query('select * from public.profiles')).rows,
        data: (await again.query('select * from public.farm_data')).rows,
      });
      const before = await snapshot();
      for (const sql of migrationSql()) await again.exec(sql);
      expect(await snapshot()).toEqual(before);
    } finally {
      await again.close();
    }
  });

  it('repairs, when run again, an account that lost its farm or profile', async () => {
    const id = await signUp(db, { email: 'repair@example.com', meta: { organization: 'Repair Farm' } });
    await db.query('delete from public.farms where id = (select farm_id from public.farm_members where user_id = $1)', [id]);
    const profileOnly = await signUp(db, { email: 'repair2@example.com', meta: { first_name: 'Remy' } });
    await db.query('delete from public.profiles where id = any($1)', [[id, profileOnly]]);
    for (const sql of migrationSql()) await db.exec(sql);
    expect(await farmNameOf(db, id)).toBe('Repair Farm');
    expect((await db.query('select 1 from public.profiles where id = $1', [id])).rows).toHaveLength(1);
    expect((await db.query('select first_name from public.profiles where id = $1', [profileOnly])).rows).toEqual([{ first_name: 'Remy' }]);
  });
});
