-- Phase 0: accounts, farms and the farm's shared data.
--
-- Every account belongs to a farm, and RLS walls each farm's data off from every other farm.
-- Adapted from the Organic app's tested tenancy migration. Safe to re-run.
--
-- Membership is written by the server only. The app can read its farm and its members but cannot
-- add, move or remove anyone: letting an owner insert any user id would let them pull a stranger's
-- data into their farm. Inviting crew arrives later as an invite/accept flow.

-- ─── Helpers ─────────────────────────────────────────────────────────────────

-- A sign-up value, trimmed and cut to p_max characters; null when blank. Sign-up values are typed
-- by the person signing up, so they are cleaned rather than trusted.
create or replace function public.signup_text(p_meta jsonb, p_key text, p_max integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(left(btrim(coalesce(p_meta ->> p_key, '')), p_max)), '');
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── Farms ───────────────────────────────────────────────────────────────────

-- A friendly code to show people and support. NOT a secret and NOT for authorization: random()
-- is not cryptographically secure.
create or replace function public.generate_farm_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I/L
  candidate text;
  i int;
begin
  loop
    candidate := 'F-';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.farms f where f.farm_code = candidate);
  end loop;
  return candidate;
end;
$$;

create table if not exists public.farms (
  id         uuid primary key default gen_random_uuid(),
  farm_code  text not null unique default public.generate_farm_code(),
  name       text not null check (char_length(name) between 1 and 120),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists farms_created_by_idx on public.farms (created_by);

drop trigger if exists farms_touch_updated_at on public.farms;
create trigger farms_touch_updated_at
  before update on public.farms
  for each row execute function public.touch_updated_at();

-- ─── Membership ──────────────────────────────────────────────────────────────

create table if not exists public.farm_members (
  farm_id    uuid not null references public.farms (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('owner', 'manager', 'crew')),
  created_at timestamptz not null default now(),
  primary key (farm_id, user_id)
);

create index if not exists farm_members_user_id_idx on public.farm_members (user_id);

-- Policy helpers. SECURITY DEFINER so policies can consult farm_members without recursing into its
-- own RLS. `(select auth.uid())` lets Postgres work out the caller once per statement, not per row.
create or replace function public.my_farm_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.farm_id from public.farm_members m where m.user_id = (select auth.uid());
$$;

create or replace function public.has_farm_role(p_farm_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.farm_members m
    where m.farm_id = p_farm_id and m.user_id = (select auth.uid()) and m.role = any (p_roles)
  );
$$;

-- ─── Profiles ────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  first_name   text check (char_length(first_name) <= 80),
  last_name    text check (char_length(last_name) <= 80),
  phone        text check (char_length(phone) <= 40),
  organization text check (char_length(organization) <= 120),
  job_role     text check (job_role in ('owner', 'fsm', 'consultant', 'supervisor', 'other')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ─── Provisioning ────────────────────────────────────────────────────────────

-- Returns the user's farm, or creates one with the user as owner. Internal only; the app goes
-- through ensure_my_farm().
create or replace function public.ensure_farm_for_user(
  p_user_id       uuid,
  p_farm_name     text default null,
  p_fallback_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_farm_id uuid;
  v_name    text;
begin
  -- Serialize concurrent calls for the same user so only one farm is created.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  -- "The user's farm" is their oldest membership. That is only safe while membership is written by
  -- the server (see the header). When invites arrive, add an explicit active farm instead.
  select m.farm_id into v_farm_id
  from public.farm_members m
  where m.user_id = p_user_id
  order by m.created_at
  limit 1;

  if v_farm_id is not null then
    return v_farm_id;
  end if;

  v_name := nullif(btrim(left(btrim(coalesce(p_farm_name, '')), 120)), '');
  if v_name is null then
    v_name := coalesce(nullif(btrim(left(btrim(coalesce(p_fallback_name, '')), 100)), ''), 'My') || '''s Farm';
  end if;

  insert into public.farms (name, created_by) values (v_name, p_user_id) returning id into v_farm_id;
  insert into public.farm_members (farm_id, user_id, role) values (v_farm_id, p_user_id, 'owner');
  return v_farm_id;
end;
$$;

-- Creates the user's profile from what they typed at sign-up, unless they already have one.
create or replace function public.ensure_profile_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb;
begin
  select coalesce(u.raw_user_meta_data, '{}'::jsonb) into v_meta from auth.users u where u.id = p_user_id;
  if not found then
    return;
  end if;

  insert into public.profiles (id, first_name, last_name, phone, organization, job_role)
  values (
    p_user_id,
    public.signup_text(v_meta, 'first_name', 80),
    public.signup_text(v_meta, 'last_name', 80),
    public.signup_text(v_meta, 'phone', 40),
    public.signup_text(v_meta, 'organization', 120),
    case when v_meta ->> 'job_role' in ('owner', 'fsm', 'consultant', 'supervisor', 'other') then v_meta ->> 'job_role' end
  )
  on conflict (id) do nothing;
end;
$$;

-- Sets up the farm and profile for one account from its sign-up details.
create or replace function public.provision_user(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb;
  v_mail text;
begin
  select coalesce(u.raw_user_meta_data, '{}'::jsonb), u.email into v_meta, v_mail from auth.users u where u.id = p_user_id;

  perform public.ensure_profile_for_user(p_user_id);
  return public.ensure_farm_for_user(
    p_user_id,
    coalesce(public.signup_text(v_meta, 'farm_name', 120), public.signup_text(v_meta, 'organization', 120)),
    coalesce(public.signup_text(v_meta, 'name', 100), public.signup_text(v_meta, 'first_name', 100), split_part(coalesce(v_mail, ''), '@', 1))
  );
end;
$$;

-- Self-repair for the app: call after sign-in. Needs a signed-in user.
create or replace function public.ensure_my_farm()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  return public.provision_user(v_uid);
end;
$$;

-- A new account gets a farm and a profile. A failure must never block the sign-up: warn, and let
-- ensure_my_farm() repair it at the first sign-in.
create or replace function public.provision_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.provision_user(new.id);
  return new;
exception when others then
  raise warning 'provision_new_user: could not set up account %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_provision on auth.users;
create trigger on_auth_user_created_provision
  after insert on auth.users
  for each row execute function public.provision_new_user();

-- Accounts made before this migration get a farm and a profile too (safe to repeat).
do $$
declare
  r record;
begin
  for r in
    select u.id from auth.users u
    where not exists (select 1 from public.farm_members m where m.user_id = u.id)
       or not exists (select 1 from public.profiles p where p.id = u.id)
  loop
    perform public.provision_user(r.id);
  end loop;
end;
$$;

-- ─── Farm data ───────────────────────────────────────────────────────────────

-- What the app kept in each browser until now, one value per kind, shared by the farm's team.
-- Phase 1 moves incidents and activity records into proper record tables with revision history;
-- until then a value is replaced whole on each save.
create table if not exists public.farm_data (
  farm_id    uuid not null references public.farms (id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  version    integer not null default 1,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (farm_id, key),
  constraint farm_data_known_key check (key in ('farm_profile', 'incidents', 'cost_settings', 'sop_activity_records')),
  constraint farm_data_shape check (
    jsonb_typeof(value) = case when key in ('incidents', 'sop_activity_records') then 'array' else 'object' end
  ),
  -- Incidents carry their photos inline; 5 MB is about what a browser could hold before.
  constraint farm_data_size check (octet_length(value::text) <= 5242880)
);

-- For databases set up before the version column existed.
alter table public.farm_data add column if not exists version integer not null default 1;

-- The server, not the app, records who saved a value, when, and which version it is.
create or replace function public.farm_data_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  new.updated_at := now();
  new.version := case when tg_op = 'INSERT' then 1 else old.version + 1 end;
  return new;
end;
$$;

drop trigger if exists farm_data_stamp on public.farm_data;
create trigger farm_data_stamp
  before insert or update on public.farm_data
  for each row execute function public.farm_data_stamp();

-- Save one value, but only over the version the caller read (null: only if there is none yet), so a
-- second device or a stale tab can never silently overwrite a newer save. On a mismatch it raises
-- FD409 and the app reloads, merges and tries again. Runs with the caller's own rights, so RLS decides.
-- Returns the new version.
drop function if exists public.put_farm_data(uuid, text, jsonb);
create or replace function public.put_farm_data(p_farm_id uuid, p_key text, p_value jsonb, p_expected_version integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version integer;
begin
  if p_expected_version is null then
    insert into public.farm_data (farm_id, key, value)
    values (p_farm_id, p_key, p_value)
    on conflict (farm_id, key) do nothing
    returning version into v_version;
  else
    update public.farm_data d
    set value = p_value
    where d.farm_id = p_farm_id and d.key = p_key and d.version = p_expected_version
    returning d.version into v_version;
  end if;

  if v_version is not null then
    return v_version;
  end if;
  -- Nothing written. Either someone saved first, or the caller may read but not change it (crew).
  if p_expected_version is not null and exists (
    select 1 from public.farm_data d
    where d.farm_id = p_farm_id and d.key = p_key and d.version = p_expected_version
  ) then
    raise exception 'Permission denied: only owners and managers can change the farm data' using errcode = '42501';
  end if;
  raise exception 'The farm data changed since it was read' using errcode = 'FD409';
end;
$$;

-- ─── Row level security ──────────────────────────────────────────────────────

alter table public.farms enable row level security;
alter table public.farm_members enable row level security;
alter table public.profiles enable row level security;
alter table public.farm_data enable row level security;

drop policy if exists farms_select_member on public.farms;
create policy farms_select_member on public.farms
  for select to authenticated
  using (id in (select public.my_farm_ids()));

drop policy if exists farms_update_owner_manager on public.farms;
create policy farms_update_owner_manager on public.farms
  for update to authenticated
  using (public.has_farm_role(id, array['owner', 'manager']))
  with check (public.has_farm_role(id, array['owner', 'manager']));

drop policy if exists farm_members_select_same_farm on public.farm_members;
create policy farm_members_select_same_farm on public.farm_members
  for select to authenticated
  using (farm_id in (select public.my_farm_ids()));

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists farm_data_select_member on public.farm_data;
create policy farm_data_select_member on public.farm_data
  for select to authenticated
  using (farm_id in (select public.my_farm_ids()));

drop policy if exists farm_data_insert_owner_manager on public.farm_data;
create policy farm_data_insert_owner_manager on public.farm_data
  for insert to authenticated
  with check (public.has_farm_role(farm_id, array['owner', 'manager']));

drop policy if exists farm_data_update_owner_manager on public.farm_data;
create policy farm_data_update_owner_manager on public.farm_data
  for update to authenticated
  using (public.has_farm_role(farm_id, array['owner', 'manager']))
  with check (public.has_farm_role(farm_id, array['owner', 'manager']));

-- ─── Privileges (defense in depth) ───────────────────────────────────────────
-- Older Supabase projects grant ALL on new public tables to anon and authenticated, including
-- TRUNCATE, which ignores RLS. Cut them to what the app needs; RLS then narrows further. Newer
-- projects may grant nothing, so the server role gets what it needs explicitly.

revoke all on public.farms, public.farm_members, public.profiles, public.farm_data from anon, authenticated;

grant select on public.farms to authenticated;
grant update (name) on public.farms to authenticated;
grant select on public.farm_members to authenticated;
grant select on public.profiles to authenticated;
grant insert (id, first_name, last_name, phone, organization, job_role) on public.profiles to authenticated;
grant update (first_name, last_name, phone, organization, job_role) on public.profiles to authenticated;
grant select on public.farm_data to authenticated;
grant insert (farm_id, key, value) on public.farm_data to authenticated;
grant update (value) on public.farm_data to authenticated;

grant select, insert, update, delete on public.farms, public.farm_members, public.profiles, public.farm_data to service_role;

-- Internal functions: not callable from the app.
revoke all on function public.signup_text(jsonb, text, integer) from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.generate_farm_code() from public, anon, authenticated;
revoke all on function public.farm_data_stamp() from public, anon, authenticated;
revoke all on function public.provision_new_user() from public, anon, authenticated;
revoke all on function public.provision_user(uuid) from public, anon, authenticated;
revoke all on function public.ensure_farm_for_user(uuid, text, text) from public, anon, authenticated;
revoke all on function public.ensure_profile_for_user(uuid) from public, anon, authenticated;

-- What the app may call, signed in only.
revoke all on function public.my_farm_ids() from public, anon;
revoke all on function public.has_farm_role(uuid, text[]) from public, anon;
revoke all on function public.ensure_my_farm() from public, anon;
revoke all on function public.put_farm_data(uuid, text, jsonb, integer) from public, anon;
grant execute on function public.my_farm_ids() to authenticated;
grant execute on function public.has_farm_role(uuid, text[]) to authenticated;
grant execute on function public.ensure_my_farm() to authenticated;
grant execute on function public.put_farm_data(uuid, text, jsonb, integer) to authenticated;

-- KNOWN GAP (later): removing a farm's last member leaves a farm with no owner.
