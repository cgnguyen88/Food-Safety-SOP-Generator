import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { freshDb, signUp, asUser, asAnon, farmIdOf } from './harness.js';
import { RECORD_KINDS, RECORD_STATUSES, RECORD_SOURCES } from '../src/domain/records/kinds.js';
import { DEFAULT_SAVED_VIEWS } from '../src/domain/records/savedViews.js';
import { allowedTransitions } from '../src/domain/records/workflow.js';

const DENIED = /permission denied|row-level security/i;

/** One farm with an owner, a manager and a crew member, plus a second, unrelated farm. */
async function team(db, tag) {
  const owner = await signUp(db, { email: `${tag}-owner@example.com`, meta: { farm_name: `${tag} Farm` } });
  const manager = await signUp(db, { email: `${tag}-mgr@example.com` });
  const crew = await signUp(db, { email: `${tag}-crew@example.com` });
  const outsider = await signUp(db, { email: `${tag}-out@example.com`, meta: { farm_name: `${tag} Other` } });
  const farm = await farmIdOf(db, owner);
  await db.query(`insert into public.farm_members (farm_id, user_id, role) values ($1,$2,'manager'), ($1,$3,'crew')`, [farm, manager, crew]);
  return { farm, owner, manager, crew, outsider, otherFarm: await farmIdOf(db, outsider) };
}

const NOTE = { text: 'Saw aphids on B4' };
const insertRecord = (db, uid, farm, over = {}) =>
  asUser(db, uid, async () =>
    (
      await db.query(
        `insert into public.records (farm_id, kind, status, record_date, payload, missing_fields)
         values ($1, $2, $3, $4, $5::jsonb, $6::text[]) returning *`,
        [farm, over.kind ?? 'note', over.status ?? 'pending_review', over.date ?? '2026-10-01', JSON.stringify(over.payload ?? NOTE), over.missing ?? []],
      )
    ).rows[0],
  );
const update = (db, uid, id, set, params = []) =>
  asUser(db, uid, () => db.query(`update public.records set ${set} where id = '${id}' returning *`, params));

describe('records', () => {
  let db;
  let t;
  beforeAll(async () => {
    db = await freshDb({ defaultGrants: false });
    t = await team(db, 'rec');
  }, 60_000);
  afterAll(async () => {
    await db.close();
  });

  describe('creating', () => {
    it('lets crew submit a record for review; the server sets who created it, its version and its source', async () => {
      const r = await insertRecord(db, t.crew, t.farm);
      expect(r).toMatchObject({ farm_id: t.farm, created_by: t.crew, status: 'pending_review', version: 1, source: 'manual', reviewed_by: null });
    });

    it.each(['draft', 'needs_info', 'pending_review'])('lets crew create a %s record', async (status) => {
      expect((await insertRecord(db, t.crew, t.farm, { status })).status).toBe(status);
    });

    it.each(['approved', 'rejected', 'voided'])('does not let crew create a %s record', async (status) => {
      await expect(insertRecord(db, t.crew, t.farm, { status })).rejects.toThrow(DENIED);
    });

    it.each(['owner', 'manager'])('lets a %s create an already-approved record and records who approved it', async (who) => {
      const r = await insertRecord(db, t[who], t.farm, { status: 'approved' });
      expect(r.status).toBe('approved');
      expect(r.reviewed_by).toBe(t[who]);
      expect(r.reviewed_at).not.toBeNull();
    });

    it('rejects records for another farm, and from anonymous callers', async () => {
      await expect(insertRecord(db, t.crew, t.otherFarm)).rejects.toThrow(DENIED);
      await expect(asAnon(db, () => db.query(`insert into public.records (farm_id, kind, payload) values ('${t.farm}','note','{}')`))).rejects.toThrow(/permission denied/i);
    });

    it('does not let a client choose server-controlled columns (author, version, reviewer)', async () => {
      for (const col of ['created_by', 'version', 'reviewed_by', 'reviewed_at', 'created_at', 'id', 'source', 'source_ref']) {
        await expect(
          asUser(db, t.crew, () => db.query(`insert into public.records (farm_id, kind, ${col}) values ('${t.farm}','note', null)`)),
          col,
        ).rejects.toThrow(/permission denied/i);
      }
    });

    it('refuses an EMPTY record in review or approval (the database does not trust the client’s own "missing" list), but allows an empty draft', async () => {
      await expect(insertRecord(db, t.crew, t.farm, { status: 'pending_review', payload: {} })).rejects.toThrow(/incomplete/i);
      await expect(insertRecord(db, t.owner, t.farm, { status: 'approved', payload: {} })).rejects.toThrow(/incomplete/i);
      expect((await insertRecord(db, t.crew, t.farm, { status: 'draft', payload: {} })).status).toBe('draft');
    });

    it('refuses to put an incomplete record into review or approval, but allows it as a draft or needs_info', async () => {
      await expect(insertRecord(db, t.crew, t.farm, { status: 'pending_review', missing: ['field'] })).rejects.toThrow(/incomplete/i);
      await expect(insertRecord(db, t.owner, t.farm, { status: 'approved', missing: ['field'] })).rejects.toThrow(/incomplete/i);
      expect((await insertRecord(db, t.crew, t.farm, { status: 'needs_info', missing: ['field'] })).missing_fields).toEqual(['field']);
      expect((await insertRecord(db, t.crew, t.farm, { status: 'draft', missing: ['field'] })).status).toBe('draft');
    });
  });

  describe('data constraints', () => {
    const raw = (col, value) => db.query(`insert into public.records (farm_id, kind, status, ${col}) values ('${t.farm}', 'note', 'draft', ${value})`);

    it.each([
      ['an unknown kind', `insert into public.records (farm_id, kind, status) values ('FARM', 'bogus', 'draft')`],
      ['an unknown status', `insert into public.records (farm_id, kind, status) values ('FARM', 'note', 'archived')`],
      ['an unknown source', `insert into public.records (farm_id, kind, status, source) values ('FARM', 'note', 'draft', 'carrier_pigeon')`],
      ['a payload that is an array', `insert into public.records (farm_id, kind, status, payload) values ('FARM', 'note', 'draft', '[1]')`],
      ['a confidence above 1', `insert into public.records (farm_id, kind, status, confidence) values ('FARM', 'note', 'draft', 1.5)`],
      ['attachments that are not an array', `insert into public.records (farm_id, kind, status, attachments) values ('FARM', 'note', 'draft', '{}')`],
      ['an oversized payload', `insert into public.records (farm_id, kind, status, payload) values ('FARM', 'note', 'draft', jsonb_build_object('x', repeat('a', 70000)))`],
    ])('rejects %s', async (_label, sql) => {
      await expect(db.query(sql.replace('FARM', t.farm))).rejects.toThrow(/check constraint|violates/i);
    });

    it('accepts the boundary values', async () => {
      await db.query(`insert into public.records (farm_id, kind, status, confidence) values ('${t.farm}', 'note', 'draft', 1.0), ('${t.farm}', 'note', 'draft', 0)`);
      await raw('payload', `'{}'::jsonb`);
    });
  });

  describe('visibility', () => {
    it('shows every record of a farm to all its members, and nothing to other farms', async () => {
      const mine = await insertRecord(db, t.crew, t.farm, { payload: { text: 'visible to the team' } });
      for (const who of ['owner', 'manager', 'crew']) {
        const rows = await asUser(db, t[who], async () => (await db.query('select id from public.records where id = $1', [mine.id])).rows);
        expect(rows, who).toHaveLength(1);
      }
      expect(await asUser(db, t.outsider, async () => (await db.query('select id from public.records where id = $1', [mine.id])).rows)).toHaveLength(0);
      await expect(asAnon(db, () => db.query('select * from public.records'))).rejects.toThrow(/permission denied/i);
    });
  });

  describe('review workflow', () => {
    it('lets an owner or manager approve a crew record; the server stamps the reviewer, time and version', async () => {
      const r = await insertRecord(db, t.crew, t.farm);
      const { rows } = await update(db, t.manager, r.id, `status = 'approved'`);
      expect(rows[0]).toMatchObject({ status: 'approved', reviewed_by: t.manager, version: 2 });
      expect(rows[0].reviewed_at).not.toBeNull();
    });

    it('does not let crew approve, reject or void records, including their own', async () => {
      const own = await insertRecord(db, t.crew, t.farm);
      for (const status of ['approved', 'rejected', 'voided']) {
        await expect(update(db, t.crew, own.id, `status = '${status}'`), status).rejects.toThrow(DENIED);
      }
      const others = await insertRecord(db, t.manager, t.farm, { status: 'pending_review' });
      expect((await update(db, t.crew, others.id, `status = 'approved'`)).rows).toHaveLength(0);
    });

    it('lets crew edit their own unreviewed record, but not other people’s or an approved one', async () => {
      const own = await insertRecord(db, t.crew, t.farm);
      const edited = await update(db, t.crew, own.id, `payload = '{"text":"fixed"}'`);
      expect(edited.rows[0]).toMatchObject({ payload: { text: 'fixed' }, version: 2 });

      const others = await insertRecord(db, t.manager, t.farm, { status: 'pending_review' });
      expect((await update(db, t.crew, others.id, `payload = '{"text":"hijack"}'`)).rows).toHaveLength(0);

      await update(db, t.owner, own.id, `status = 'approved'`);
      expect((await update(db, t.crew, own.id, `payload = '{"text":"too late"}'`)).rows).toHaveLength(0);
    });

    it('lets owners and managers correct an approved record; it stays approved and keeps the original approver', async () => {
      const r = await insertRecord(db, t.owner, t.farm, { status: 'approved' });
      const { rows } = await update(db, t.manager, r.id, `payload = '{"text":"corrected"}'`);
      expect(rows[0]).toMatchObject({ status: 'approved', version: 2, reviewed_by: t.owner });
    });

    it('blocks other farms from touching the record', async () => {
      const r = await insertRecord(db, t.crew, t.farm);
      expect((await update(db, t.outsider, r.id, `status = 'approved'`)).rows).toHaveLength(0);
    });

    it('does not let clients change columns the server owns', async () => {
      const r = await insertRecord(db, t.crew, t.farm);
      for (const set of [`farm_id = '${t.otherFarm}'`, `created_by = '${t.owner}'`, `source = 'import'`, `source_ref = 'x'`, `version = 99`, `reviewed_by = '${t.owner}'`, `created_at = now()`, `id = gen_random_uuid()`]) {
        await expect(update(db, t.owner, r.id, set), set).rejects.toThrow(/permission denied/i);
      }
    });

    it('enforces the status transitions in the database, not just the UI', async () => {
      const approved = await insertRecord(db, t.owner, t.farm, { status: 'approved' });
      await expect(update(db, t.owner, approved.id, `status = 'pending_review'`)).rejects.toThrow(/invalid status change/i);
      await expect(update(db, t.owner, approved.id, `status = 'rejected'`)).rejects.toThrow(/invalid status change/i);

      const pending = await insertRecord(db, t.crew, t.farm);
      await update(db, t.owner, pending.id, `status = 'rejected'`);
      expect((await update(db, t.owner, pending.id, `status = 'pending_review'`)).rows[0].status).toBe('pending_review'); // resubmit
    });

    it('treats voided as final: nothing about the record can change afterwards', async () => {
      const r = await insertRecord(db, t.owner, t.farm, { status: 'approved' });
      await update(db, t.owner, r.id, `status = 'voided'`);
      await expect(update(db, t.owner, r.id, `status = 'approved'`)).rejects.toThrow(/voided/i);
      await expect(update(db, t.owner, r.id, `payload = '{"text":"x"}'`)).rejects.toThrow(/voided/i);
    });

    it('will not move an incomplete record into review or approval', async () => {
      const r = await insertRecord(db, t.crew, t.farm, { status: 'needs_info', missing: ['field'] });
      await expect(update(db, t.crew, r.id, `status = 'pending_review'`)).rejects.toThrow(/incomplete/i);
      const done = await update(db, t.crew, r.id, `missing_fields = '{}', status = 'pending_review'`);
      expect(done.rows[0].status).toBe('pending_review');
    });

    it.each(['owner', 'manager', 'crew'])('agrees with the JavaScript workflow rules for every status change a %s could attempt', async (role) => {
      const mismatches = [];
      for (const from of RECORD_STATUSES) {
        for (const to of RECORD_STATUSES.filter((s) => s !== from)) {
          // Created by the crew member (so crew rules apply to "their own" record); inserted directly so any starting status is possible.
          const { rows } = await db.query(
            `insert into public.records (farm_id, kind, status, payload, created_by) values ($1, 'note', $2, '{"text":"x"}'::jsonb, $3) returning id`,
            [t.farm, from, t.crew],
          );
          let allowedByDb;
          try {
            const result = await update(db, t[role], rows[0].id, `status = '${to}'`);
            allowedByDb = result.rows.length === 1;
          } catch (error) {
            if (!/invalid status change|voided|row-level security|permission denied/i.test(error.message)) throw error;
            allowedByDb = false;
          }
          const allowedByJs = allowedTransitions(from, role).includes(to);
          if (allowedByDb !== allowedByJs) mismatches.push(`${role}: ${from} -> ${to} (database ${allowedByDb ? 'allows' : 'blocks'}, JavaScript ${allowedByJs ? 'allows' : 'blocks'})`);
        }
      }
      expect(mismatches).toEqual([]);
    });

    it('treats a no-op update as nothing: no new version and no noise in the history', async () => {
      const r = await insertRecord(db, t.crew, t.farm, { payload: { text: 'same' } });
      const result = await update(db, t.crew, r.id, `payload = payload, record_date = record_date`);
      expect(result.rows[0].version).toBe(1);
      const { rows } = await db.query('select count(*)::int as n from public.record_revisions where record_id = $1', [r.id]);
      expect(rows[0].n).toBe(1);
    });

    it('lets an account be deleted without altering its records: they stay as they were, with the person erased from them', async () => {
      const author = await signUp(db, { email: 'gone-author@example.com' });
      const reviewer = await signUp(db, { email: 'gone-reviewer@example.com' });
      await db.query(`insert into public.farm_members (farm_id, user_id, role) values ($1,$2,'crew'), ($1,$3,'manager')`, [t.farm, author, reviewer]);

      const approved = await insertRecord(db, author, t.farm, { payload: { text: 'by the author' } });
      await update(db, reviewer, approved.id, `status = 'approved'`);
      const voided = await insertRecord(db, reviewer, t.farm, { status: 'approved', payload: { text: 'voided later' } });
      await update(db, reviewer, voided.id, `status = 'voided'`);
      const revisionsBefore = (await db.query('select count(*)::int as n from public.record_revisions where record_id in ($1,$2)', [approved.id, voided.id])).rows[0].n;

      await db.query('delete from auth.users where id = $1', [author]);
      await db.query('delete from auth.users where id = $1', [reviewer]);

      const { rows } = await db.query('select id, status, version, created_by, reviewed_by from public.records where id in ($1,$2) order by created_at', [approved.id, voided.id]);
      expect(rows).toEqual([
        { id: approved.id, status: 'approved', version: 2, created_by: null, reviewed_by: null },
        { id: voided.id, status: 'voided', version: 2, created_by: null, reviewed_by: null },
      ]);
      const revisionsAfter = (await db.query('select count(*)::int as n from public.record_revisions where record_id in ($1,$2)', [approved.id, voided.id])).rows[0].n;
      expect(revisionsAfter).toBe(revisionsBefore);
    });

    it('still blocks a normal edit of created_by or reviewed_by even though account deletion may clear them', async () => {
      const r = await insertRecord(db, t.owner, t.farm, { status: 'approved' });
      // a SERVER-side change to a different user is not "erasure" and must be refused...
      await expect(db.query(`update public.records set created_by = $2 where id = $1`, [r.id, t.crew])).rejects.toThrow(/immutable/i);
      // ...including when it is disguised as erasure by clearing reviewed_by in the same statement
      await expect(db.query(`update public.records set created_by = $2, reviewed_by = null where id = $1`, [r.id, t.crew])).rejects.toThrow(/immutable/i);
      await expect(db.query(`update public.records set reviewed_by = null, payload = '{"text":"sneaky"}' where id = $1`, [r.id])).resolves.toBeDefined(); // payload edit by the server is a normal edit (new version)
    });

    it('indexes the user columns so deleting an account does not scan whole tables', async () => {
      const { rows } = await db.query(`select indexdef from pg_indexes where schemaname = 'public' and tablename in ('records', 'record_revisions', 'saved_views')`);
      const defs = rows.map((r) => r.indexdef).join('\n');
      for (const col of ['reviewed_by', 'changed_by', 'created_by']) expect(defs, col).toMatch(new RegExp(`\\(${col}\\)`));
    });

    it('has no delete path for anyone, owners included: records are voided, never deleted', async () => {
      const r = await insertRecord(db, t.owner, t.farm, { status: 'approved' });
      await expect(asUser(db, t.owner, () => db.query('delete from public.records where id = $1', [r.id]))).rejects.toThrow(/permission denied/i);
    });
  });

  describe('change history (record_revisions)', () => {
    it('writes a revision for creation, every edit and every status change, with who and what', async () => {
      const r = await insertRecord(db, t.crew, t.farm, { payload: { text: 'v1' } });
      await update(db, t.crew, r.id, `payload = '{"text":"v2"}'`);
      await update(db, t.owner, r.id, `status = 'approved'`);

      const { rows } = await db.query('select version, change_type, changed_by, before, after from public.record_revisions where record_id = $1 order by version', [r.id]);
      expect(rows.map((x) => [x.version, x.change_type])).toEqual([[1, 'created'], [2, 'edited'], [3, 'status:approved']]);
      expect(rows.map((x) => x.changed_by)).toEqual([t.crew, t.crew, t.owner]);
      expect(rows[0].before).toBeNull();
      expect(rows[1].before.payload).toEqual({ text: 'v1' });
      expect(rows[1].after.payload).toEqual({ text: 'v2' });
      expect(rows[2].after.status).toBe('approved');
    });

    it('attributes a server-side (service role) insert to the author it names, since there is no signed-in caller', async () => {
      const { rows } = await db.query(
        `insert into public.records (farm_id, kind, status, payload, created_by, source, source_ref)
         values ($1, 'note', 'pending_review', '{"text":"captured"}', $2, 'web_upload', 'cap-attr#0') returning id`,
        [t.farm, t.crew],
      );
      const revisions = await db.query('select changed_by from public.record_revisions where record_id = $1', [rows[0].id]);
      expect(revisions.rows.map((x) => x.changed_by)).toEqual([t.crew]);
    });

    it('is visible to the farm’s members and nobody else', async () => {
      const r = await insertRecord(db, t.crew, t.farm);
      const count = (uid) => asUser(db, uid, async () => (await db.query('select 1 from public.record_revisions where record_id = $1', [r.id])).rows.length);
      expect(await count(t.crew)).toBe(1);
      expect(await count(t.owner)).toBe(1);
      expect(await count(t.outsider)).toBe(0);
      await expect(asAnon(db, () => db.query('select * from public.record_revisions'))).rejects.toThrow(/permission denied/i);
    });

    it('cannot be written, altered or erased by any client, including owners', async () => {
      const r = await insertRecord(db, t.owner, t.farm);
      const id = r.id;
      await expect(asUser(db, t.owner, () => db.query(`insert into public.record_revisions (record_id, farm_id, version, change_type) values ('${id}','${t.farm}', 99, 'edited')`))).rejects.toThrow(/permission denied/i);
      await expect(asUser(db, t.owner, () => db.query(`update public.record_revisions set change_type = 'x' where record_id = '${id}'`))).rejects.toThrow(/permission denied/i);
      await expect(asUser(db, t.owner, () => db.query(`delete from public.record_revisions where record_id = '${id}'`))).rejects.toThrow(/permission denied/i);
    });
  });

  describe('saved views', () => {
    it('seeds the pinned default views for every new farm', async () => {
      const { rows } = await asUser(db, t.crew, () => db.query('select slug, is_default, pinned from public.saved_views where farm_id = $1 order by position', [t.farm]));
      expect(rows.map((r) => r.slug)).toEqual(DEFAULT_SAVED_VIEWS.map((v) => v.slug));
      expect(rows.every((r) => r.is_default && r.pinned)).toBe(true);
    });

    it('matches the JavaScript definitions exactly (names and filters)', async () => {
      const { rows } = await db.query('select slug, name, filter from public.saved_views where farm_id = $1 order by position', [t.farm]);
      expect(rows).toEqual(DEFAULT_SAVED_VIEWS.map((v) => ({ slug: v.slug, name: v.name.en, filter: v.filter })));
    });

    it('keeps the database’s allowed kinds, statuses and sources identical to the JavaScript vocabulary', async () => {
      const values = async (name) => {
        const { rows } = await db.query(`select pg_get_constraintdef(oid) as def from pg_constraint where conname = $1`, [name]);
        return [...rows[0].def.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]).sort();
      };
      expect(await values('records_kind_check')).toEqual([...RECORD_KINDS].sort());
      expect(await values('records_status_check')).toEqual([...RECORD_STATUSES].sort());
      expect(await values('records_source_check')).toEqual([...RECORD_SOURCES].sort());
    });

    it('lets crew read views but not create, change or delete them', async () => {
      const denied = (sql) => expect(asUser(db, t.crew, () => db.query(sql))).rejects.toThrow(DENIED);
      await denied(`insert into public.saved_views (farm_id, name, filter) values ('${t.farm}', 'Mine', '{}')`);
      expect((await asUser(db, t.crew, () => db.query(`update public.saved_views set pinned = false where farm_id = '${t.farm}' returning id`))).rows).toHaveLength(0);
      expect((await asUser(db, t.crew, () => db.query(`delete from public.saved_views where farm_id = '${t.farm}' returning id`))).rows).toHaveLength(0);
    });

    it('lets owners and managers add, rename, unpin and delete their own views, but never touch identity columns or default views’ existence', async () => {
      const added = await asUser(db, t.manager, async () =>
        (await db.query(`insert into public.saved_views (farm_id, name, filter) values ('${t.farm}', 'Kelp purchases', '{"kinds":["purchase"]}') returning *`)).rows[0],
      );
      expect(added).toMatchObject({ is_default: false, slug: null, created_by: t.manager });

      const renamed = await asUser(db, t.owner, () => db.query(`update public.saved_views set name = 'Kelp', pinned = false where id = '${added.id}' returning name, pinned`));
      expect(renamed.rows[0]).toEqual({ name: 'Kelp', pinned: false });

      await expect(asUser(db, t.owner, () => db.query(`update public.saved_views set slug = 'x' where id = '${added.id}'`))).rejects.toThrow(/permission denied/i);
      await expect(asUser(db, t.owner, () => db.query(`update public.saved_views set is_default = true where id = '${added.id}'`))).rejects.toThrow(/permission denied/i);
      await expect(asUser(db, t.owner, () => db.query(`update public.saved_views set farm_id = '${t.otherFarm}' where id = '${added.id}'`))).rejects.toThrow(/permission denied/i);

      expect((await asUser(db, t.owner, () => db.query(`delete from public.saved_views where id = '${added.id}' returning id`))).rows).toHaveLength(1);
      expect((await asUser(db, t.owner, () => db.query(`delete from public.saved_views where farm_id = '${t.farm}' and is_default returning id`))).rows).toHaveLength(0);
    });

    it('validates a view’s name and filter shape and keeps other farms out', async () => {
      const insert = (name, filter) => asUser(db, t.owner, () => db.query(`insert into public.saved_views (farm_id, name, filter) values ('${t.farm}', $1, $2::jsonb)`, [name, filter]));
      await expect(insert('', '{}')).rejects.toThrow(/check constraint/i);
      await expect(insert('x'.repeat(81), '{}')).rejects.toThrow(/check constraint/i);
      await expect(insert('ok', '[1]')).rejects.toThrow(/check constraint/i);
      expect(await asUser(db, t.outsider, async () => (await db.query(`select 1 from public.saved_views where farm_id = '${t.farm}'`)).rows)).toHaveLength(0);
    });
  });
});

describe('migrating an existing database', () => {
  it('seeds default views for farms that existed before this migration', async () => {
    const earlier = '33333333-3333-3333-3333-333333333333';
    // An account made before any migration ran gets its farm from the accounts migration, before views exist.
    const db = await freshDb({ beforeMigrations: `insert into auth.users (id, email) values ('${earlier}', 'early@example.com');` });
    try {
      const farm = await farmIdOf(db, earlier);
      const { rows } = await db.query('select count(*)::int as n from public.saved_views where farm_id = $1 and is_default', [farm]);
      expect(rows[0].n).toBe(DEFAULT_SAVED_VIEWS.length);
    } finally {
      await db.close();
    }
  });
});

describe('illness and injury reports (health information)', () => {
  let db;
  let t;
  const ILLNESS = { person: 'J. Doe', type: 'illness', description: 'Vomiting', removed_from_contact: 'yes' };
  beforeAll(async () => {
    db = await freshDb({ defaultGrants: false });
    t = await team(db, 'ill');
  }, 60_000);
  afterAll(async () => {
    await db.close();
  });

  it('lets owners and managers record them and see them', async () => {
    const byOwner = await insertRecord(db, t.owner, t.farm, { kind: 'illness_injury', payload: ILLNESS });
    const byManager = await insertRecord(db, t.manager, t.farm, { kind: 'illness_injury', payload: { ...ILLNESS, person: 'R. Roe' } });
    for (const who of [t.owner, t.manager]) {
      const ids = await asUser(db, who, async () => (await db.query(`select id from public.records where kind = 'illness_injury'`)).rows.map((r) => r.id));
      expect(ids.sort()).toEqual([byOwner.id, byManager.id].sort());
    }
  });

  it('hides them, and their change history, from crew, who still see every other kind of record', async () => {
    const report = await insertRecord(db, t.owner, t.farm, { kind: 'illness_injury', payload: ILLNESS });
    await update(db, t.owner, report.id, `payload = payload || '{"return_date":"2026-10-05"}'::jsonb`);
    const note = await insertRecord(db, t.owner, t.farm);
    const seen = await asUser(db, t.crew, async () => (await db.query('select id, kind from public.records')).rows);
    expect(seen.map((r) => r.kind)).not.toContain('illness_injury');
    expect(seen.map((r) => r.id)).toContain(note.id);
    const history = await asUser(db, t.crew, async () => (await db.query('select record_id from public.record_revisions')).rows.map((r) => r.record_id));
    expect(history).not.toContain(report.id);
    expect(history).toContain(note.id);
  });

  it('does not let crew create one, or change one', async () => {
    await expect(insertRecord(db, t.crew, t.farm, { kind: 'illness_injury', payload: ILLNESS })).rejects.toThrow(DENIED);
    // Without reading the row back too, so it is the insert rule itself that refuses.
    await expect(asUser(db, t.crew, () => db.query(
      `insert into public.records (farm_id, kind, status, record_date, payload) values ($1, 'illness_injury', 'pending_review', '2026-10-01', $2::jsonb)`,
      [t.farm, JSON.stringify(ILLNESS)],
    ))).rejects.toThrow(DENIED);
    const report = await insertRecord(db, t.owner, t.farm, { kind: 'illness_injury', payload: ILLNESS, status: 'pending_review' });
    expect((await update(db, t.crew, report.id, `status = 'approved'`)).rows).toHaveLength(0);
  });

  it('keeps them away from other farms entirely', async () => {
    await insertRecord(db, t.owner, t.farm, { kind: 'illness_injury', payload: ILLNESS });
    expect(await asUser(db, t.outsider, async () => (await db.query(`select 1 from public.records where kind = 'illness_injury'`)).rows)).toHaveLength(0);
  });

  it('does not let the visibility check itself be used by people who are not signed in', async () => {
    await expect(asAnon(db, () => db.query(`select public.can_see_record_kind(gen_random_uuid(), 'note')`))).rejects.toThrow(/permission denied/i);
  });
});

describe('the farm season', () => {
  let db;
  let t;
  beforeAll(async () => {
    db = await freshDb({ defaultGrants: false });
    t = await team(db, 'season');
  }, 60_000);
  afterAll(async () => {
    await db.close();
  });

  it('starts on 1 January, and owners and managers can move it (crew cannot)', async () => {
    const season = (uid) => asUser(db, uid, async () => (await db.query('select season_start_month as m, season_start_day as d from public.farms')).rows[0]);
    expect(await season(t.owner)).toEqual({ m: 1, d: 1 });
    const set = (uid, m) => asUser(db, uid, () => db.query(`update public.farms set season_start_month = $1 where id = $2 returning id`, [m, t.farm]));
    expect((await set(t.manager, 4)).rows).toHaveLength(1);
    expect((await set(t.crew, 9)).rows).toHaveLength(0);
    expect(await season(t.owner)).toEqual({ m: 4, d: 1 });
    await expect(set(t.owner, 13)).rejects.toThrow(/check constraint/i);
  });
});
