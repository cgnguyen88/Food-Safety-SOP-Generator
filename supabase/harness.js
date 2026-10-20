import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Shared test harness: a real Postgres (PGlite) with stand-ins for Supabase's auth and storage,
// helpers to act as a signed-in user, the server or the anonymous role, and the migrations under test.

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
export const migrationSql = () =>
  readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));

// Minimal stand-ins for the parts of Supabase the migrations rely on.
const ROLES = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
`;

// Older Supabase projects hand every new public table to anon/authenticated. A brand-new
// project may not, so the migrations must not depend on this.
const DEFAULT_GRANTS = `alter default privileges in schema public grant all on tables to anon, authenticated;`;

const SCHEMAS = `
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language plpgsql as
    $$ declare parts text[]; begin parts := string_to_array(name, '/'); return parts[1:array_length(parts, 1) - 1]; end $$;

  grant usage on schema auth, storage to anon, authenticated, service_role;
  grant all on all tables in schema storage to anon, authenticated;
`;

/**
 * A new database with every migration applied.
 * @param {{ defaultGrants?: boolean, beforeMigrations?: string }} [options]
 *   `beforeMigrations` runs first, to set up an existing project's state (for example, users who signed up earlier).
 */
export async function freshDb({ defaultGrants = true, beforeMigrations = '' } = {}) {
  const db = new PGlite();
  try {
    await db.exec(ROLES);
    if (defaultGrants) await db.exec(DEFAULT_GRANTS);
    await db.exec(SCHEMAS);
    if (beforeMigrations) await db.exec(beforeMigrations);
    for (const sql of migrationSql()) await db.exec(sql);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

export async function signUp(db, { email, meta = {} }) {
  const { rows } = await db.query(
    'insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id',
    [email, JSON.stringify(meta)],
  );
  return rows[0].id;
}

export async function asUser(db, userId, fn) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

export async function asServiceRole(db, fn) {
  await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role service_role;`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}

export async function asAnon(db, fn) {
  await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role anon;`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}

export const farmIdOf = async (db, userId) =>
  (await db.query('select farm_id from public.farm_members where user_id = $1', [userId])).rows[0]?.farm_id;

