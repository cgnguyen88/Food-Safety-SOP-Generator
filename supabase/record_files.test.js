import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { freshDb, signUp, asUser, asAnon, farmIdOf, migrationSql } from './harness.js';

// The bucket for the photos the Telegram bot keeps. The server writes (the service role bypasses these policies);
// members read their farm's folder; health-record photos live in a restricted folder for owners and managers.
describe('migration: record-files bucket', () => {
  let db;
  let owner; let manager; let crew; let other; let farmA; let farmB;
  beforeAll(async () => {
    db = await freshDb();
    owner = await signUp(db, { email: 'rf-owner@example.com' });
    manager = await signUp(db, { email: 'rf-manager@example.com' });
    crew = await signUp(db, { email: 'rf-crew@example.com' });
    other = await signUp(db, { email: 'rf-other@example.com' });
    farmA = await farmIdOf(db, owner);
    farmB = await farmIdOf(db, other);
    for (const user of [manager, crew]) await db.query('delete from public.farm_members where user_id = $1', [user]);
    await db.query(`insert into public.farm_members (farm_id, user_id, role) values ($1, $2, 'manager'), ($1, $3, 'crew')`, [farmA, manager, crew]);
    // The server files captures: ordinary ones and a restricted (illness) one for each farm.
    await db.query(
      `insert into storage.objects (bucket_id, name) values ('record-files', $1), ('record-files', $2), ('record-files', $3), ('record-files', $4), ('record-files', 'not-a-uuid/x.png'), ('record-files', 'not-a-uuid/restricted/x.png')`,
      [`${farmA}/k1/0.jpg`, `${farmA}/restricted/k3/0.jpg`, `${farmB}/k2/0.jpg`, `${farmB}/restricted/k4/0.jpg`],
    );
  }, 60_000);
  afterAll(async () => {
    await db.close();
  });

  const namesSeenBy = (userId) => asUser(db, userId, async () => (await db.query(`select name from storage.objects where bucket_id = 'record-files' order by name`)).rows.map((r) => r.name));

  it('creates a private bucket with a size cap and an allow-list of file types', async () => {
    const { rows } = await db.query(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'record-files'`);
    expect(rows[0].public).toBe(false);
    expect(Number(rows[0].file_size_limit)).toBe(5 * 1024 * 1024);
    expect([...rows[0].allowed_mime_types].sort()).toEqual(['application/pdf', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);
  });

  it('lets crew read their own farm’s ordinary files, but not the restricted folder, and nobody else’s files', async () => {
    expect(await namesSeenBy(crew)).toEqual([`${farmA}/k1/0.jpg`]);
  });

  it('lets an owner and a manager read the restricted folder of their own farm too', async () => {
    const expected = [`${farmA}/k1/0.jpg`, `${farmA}/restricted/k3/0.jpg`];
    expect(await namesSeenBy(owner)).toEqual(expected);
    expect(await namesSeenBy(manager)).toEqual(expected);
  });

  it('keeps each farm’s files, restricted or not, from every other farm', async () => {
    expect(await namesSeenBy(other)).toEqual([`${farmB}/k2/0.jpg`, `${farmB}/restricted/k4/0.jpg`]);
  });

  it('does not let an owner of one farm open the restricted folder of another, by naming it', async () => {
    const seen = await asUser(db, owner, async () => (await db.query(`select name from storage.objects where bucket_id = 'record-files' and name like $1`, [`${farmB}/%`])).rows);
    expect(seen).toHaveLength(0);
  });

  it('shows signed-out visitors nothing', async () => {
    expect(await asAnon(db, async () => (await db.query(`select name from storage.objects where bucket_id = 'record-files'`)).rows)).toHaveLength(0);
  });

  it('does not let a user who is in no farm see anything', async () => {
    const loner = await signUp(db, { email: 'rf-none@example.com' });
    await db.query('delete from public.farm_members where user_id = $1', [loner]);
    expect(await namesSeenBy(loner)).toEqual([]);
  });

  it('gives clients no way to write: upload, overwrite or delete', async () => {
    await expect(asUser(db, owner, () => db.query(`insert into storage.objects (bucket_id, name, owner) values ('record-files', $1, $2)`, [`${farmA}/evil/0.jpg`, owner]))).rejects.toThrow(/row-level security/i);
    const updated = await asUser(db, owner, () => db.query(`update storage.objects set name = $1 where bucket_id = 'record-files' and name = $2 returning name`, [`${farmA}/k1/renamed.jpg`, `${farmA}/k1/0.jpg`]));
    expect(updated.rows).toHaveLength(0);
    const deleted = await asUser(db, owner, () => db.query(`delete from storage.objects where bucket_id = 'record-files' returning name`));
    expect(deleted.rows).toHaveLength(0);
    expect(await namesSeenBy(crew)).toEqual([`${farmA}/k1/0.jpg`]);
  });

  it('is safe to re-run', async () => {
    const sql = migrationSql().find((text) => text.includes("'record-files'"));
    await db.exec(sql);
    expect(await namesSeenBy(crew)).toEqual([`${farmA}/k1/0.jpg`]);
    const { rows } = await db.query(`select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'record_files%' order by policyname`);
    expect(rows.map((r) => r.policyname)).toEqual(['record_files_select_member', 'record_files_select_restricted']);
  });

  it('flips a pre-existing public bucket of that name to private and re-applies the limits', async () => {
    const isolated = await freshDb({ beforeMigrations: `insert into storage.buckets (id, name, public, file_size_limit) values ('record-files', 'record-files', true, 999999999);` });
    try {
      const { rows } = await isolated.query(`select public, file_size_limit from storage.buckets where id = 'record-files'`);
      expect(rows[0].public).toBe(false);
      expect(Number(rows[0].file_size_limit)).toBe(5 * 1024 * 1024);
    } finally {
      await isolated.close();
    }
  });

  describe('legacy policies', () => {
    it('drops a legacy policy that names the bucket (it would be OR-ed in), keeping unrelated ones', async () => {
      const isolated = await freshDb({
        beforeMigrations: `
          insert into storage.buckets (id, name, public) values ('archive', 'archive', false);
          create policy legacy_rf on storage.objects for select to authenticated using (bucket_id = 'record-files');
          create policy archive_read on storage.objects for select to authenticated using (bucket_id = 'archive');`,
      });
      try {
        expect((await isolated.query(`select 1 from pg_policies where policyname = 'legacy_rf'`)).rows).toHaveLength(0);
        expect((await isolated.query(`select 1 from pg_policies where policyname = 'archive_read'`)).rows).toHaveLength(1);
      } finally {
        await isolated.close();
      }
    });

    it('refuses to apply next to a wide-open policy that could expose the bucket', async () => {
      await expect(freshDb({ beforeMigrations: `create policy legacy_open_read on storage.objects for select using (true);` })).rejects.toThrow(/Cannot apply: storage\.objects has permissive/i);
    });
  });
});
