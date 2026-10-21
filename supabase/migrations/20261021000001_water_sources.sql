-- Water sources: the named wells, canals, ponds and supplies a farm waters its crops from. Modelled on the field list.
--
-- Records keep a water source as text: an assessment's or a water test's `source`, and a flood's `water_source`. Free
-- text means "Well 1" and "well #1" are two sources, and nothing shows a source's condition in one place. A registry
-- gives each farm one list of names to choose from, and a place to keep what each source is and what it waters.
--
-- The rule that matters, enforced HERE and not only in the screen: while ANY record uses a water source (any status,
-- voided ones included), its name cannot be changed and it cannot be deleted, so the trail from a flood or a water test
-- back to a source cannot be broken quietly. It can be archived instead, and its kind, fields and notes can change.
--
--   * Two spellings are the same source when they differ only in capital letters, spacing or invisible characters:
--     the same comparison as for fields (`field_key()`, from the fields migration, which must have been run).
--   * A name is stored already tidied (single spaces, nothing invisible, 1 to 60 characters).
--   * Owners and managers add, change, archive and delete; every member of the farm can read.
--   * A farm can have at most 200 water sources.
--   * The sources a farm already uses in its APPROVED records are registered once, below (safe to run again).
--
-- It also closes a gap in the field list: a field named only in an assessment's "fields this water is used on" (or in a
-- water source's fields) counts as used by records now, so it cannot be renamed or deleted from under them.
--
-- Known and accepted, as for fields: the guard takes no lock, so a record saved in the same instant that its source is
-- renamed or deleted can slip through; it keeps its text and shows as "not in your list". Nothing is lost.
-- Safe to re-run.

-- ─── Which source a record names ─────────────────────────────────────────────

-- An assessment and a water test name their source in `source`; a flood names the one it may have reached in
-- `water_source`. Anything else, and anything that is not text, names none.
create or replace function public.record_water_source(p_kind text, p_payload jsonb)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_kind in ('water_assessment', 'water_test') and jsonb_typeof(p_payload->'source') = 'string' then p_payload->>'source'
    when p_kind = 'weather_event' and jsonb_typeof(p_payload->'water_source') = 'string' then p_payload->>'water_source'
    else null
  end
$$;

-- ─── The table ───────────────────────────────────────────────────────────────

create table if not exists public.water_sources (
  id            uuid primary key default gen_random_uuid(),
  farm_id       uuid not null references public.farms (id) on delete cascade,
  name          text not null,
  source_type   text,
  fields_served text,
  notes         text,
  is_active     boolean not null default true,
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint water_sources_type_check check (source_type is null or source_type in ('enclosed_groundwater', 'open_groundwater', 'surface', 'canal', 'public', 'other')),
  constraint water_sources_fields_check check (fields_served is null or char_length(fields_served) <= 1000),
  constraint water_sources_notes_check check (notes is null or char_length(notes) <= 1000)
);

-- Names are stored tidied, 1 to 60 characters (counted in characters, not bytes).
alter table public.water_sources drop constraint if exists water_sources_name_check;
alter table public.water_sources add constraint water_sources_name_check check (name = public.field_clean_name(name) and char_length(name) between 1 and 60);

create unique index if not exists water_sources_farm_key_uq on public.water_sources (farm_id, public.field_key(name));
create index if not exists water_sources_created_by_idx on public.water_sources (created_by);

-- Finding the records that use a source (for the rule below). The key is cut to its first 128 characters so an absurdly
-- long value in a record can never make the index row too large; the full comparison is made on what the index finds.
create index if not exists records_farm_water_source_key_idx
  on public.records (farm_id, left(public.field_key(public.record_water_source(kind, payload)), 128))
  where public.record_water_source(kind, payload) is not null;

-- ─── Keeping a source's name while records use it ────────────────────────────

create or replace function public.water_source_is_referenced(p_farm_id uuid, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.records r
    where r.farm_id = p_farm_id
      and public.record_water_source(r.kind, r.payload) is not null
      and left(public.field_key(public.record_water_source(r.kind, r.payload)), 128) = left(public.field_key(p_name), 128)
      and public.field_key(public.record_water_source(r.kind, r.payload)) = public.field_key(p_name)
  );
$$;

create or replace function public.water_sources_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if public.water_source_is_referenced(old.farm_id, old.name) then
      raise exception 'The water source "%" is used by records and cannot be deleted. Archive it instead.', old.name using errcode = '23514';
    end if;
    return old;
  end if;

  if new.farm_id <> old.farm_id then
    raise exception 'A water source cannot move to another farm.' using errcode = '42501';
  end if;
  -- A change of capital letters is fine: records match a source ignoring them.
  if public.field_key(new.name) <> public.field_key(old.name) and public.water_source_is_referenced(old.farm_id, old.name) then
    raise exception 'The water source "%" is used by records and cannot be renamed.', old.name using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists water_sources_guard on public.water_sources;
create trigger water_sources_guard
  before update or delete on public.water_sources
  for each row execute function public.water_sources_guard();

-- A farm has at most 200 water sources.
create or replace function public.water_sources_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- One insert at a time per farm, so two at once cannot both slip under the limit.
  perform pg_advisory_xact_lock(hashtextextended(new.farm_id::text, 0));
  if (select count(*) from public.water_sources s where s.farm_id = new.farm_id) >= 200 then
    raise exception 'A farm can have at most 200 water sources.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists water_sources_limit on public.water_sources;
create trigger water_sources_limit
  before insert on public.water_sources
  for each row execute function public.water_sources_limit();

-- ─── Fields named in an assessment or a water source ─────────────────────────

-- The field list's rule (a field that records use cannot be renamed or deleted) now also counts a field listed in an
-- assessment's "fields this water is used on" or in a water source's fields. The list is split the way the app splits it:
-- at commas, semicolons, slashes, "&", line breaks, and the words "and" and "y".
create or replace function public.field_is_referenced(p_farm_id uuid, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.records r
    where r.farm_id = p_farm_id
      and jsonb_typeof(r.payload->'field') = 'string'
      and left(public.field_key(r.payload->>'field'), 128) = left(public.field_key(p_name), 128)
      and public.field_key(r.payload->>'field') = public.field_key(p_name)
  )
  or exists (
    select 1
    from public.records r
    cross join lateral regexp_split_to_table(left(r.payload->>'fields_served', 2000), E'[,;/&\\n]|\\s+(?:and|y)\\s+', 'i') as part
    where r.farm_id = p_farm_id
      and r.kind = 'water_assessment'
      and jsonb_typeof(r.payload->'fields_served') = 'string'
      and public.field_key(part) = public.field_key(p_name)
  )
  or exists (
    select 1
    from public.water_sources s
    cross join lateral regexp_split_to_table(s.fields_served, E'[,;/&\\n]|\\s+(?:and|y)\\s+', 'i') as part
    where s.farm_id = p_farm_id
      and public.field_key(part) = public.field_key(p_name)
  );
$$;

-- ─── Row level security ──────────────────────────────────────────────────────

alter table public.water_sources enable row level security;

drop policy if exists water_sources_select_farm on public.water_sources;
create policy water_sources_select_farm on public.water_sources
  for select to authenticated
  using (farm_id in (select public.my_farm_ids()));

drop policy if exists water_sources_insert_manager on public.water_sources;
create policy water_sources_insert_manager on public.water_sources
  for insert to authenticated
  with check (public.has_farm_role(farm_id, array['owner', 'manager']) and created_by = (select auth.uid()));

drop policy if exists water_sources_update_manager on public.water_sources;
create policy water_sources_update_manager on public.water_sources
  for update to authenticated
  using (public.has_farm_role(farm_id, array['owner', 'manager']))
  with check (public.has_farm_role(farm_id, array['owner', 'manager']));

drop policy if exists water_sources_delete_manager on public.water_sources;
create policy water_sources_delete_manager on public.water_sources
  for delete to authenticated
  using (public.has_farm_role(farm_id, array['owner', 'manager']));

-- ─── Privileges (column-level: defense in depth) ─────────────────────────────

revoke all on public.water_sources from anon, authenticated;
grant select on public.water_sources to authenticated;
-- The farm and the author are set once, at creation (the author by default, from the signed-in person).
grant insert (farm_id, name, source_type, fields_served, notes) on public.water_sources to authenticated;
grant update (name, source_type, fields_served, notes, is_active) on public.water_sources to authenticated;
grant delete on public.water_sources to authenticated;

revoke all on function public.water_source_is_referenced(uuid, text) from public, anon, authenticated;
revoke all on function public.water_sources_guard() from public, anon, authenticated;
revoke all on function public.water_sources_limit() from public, anon, authenticated;
-- (`record_water_source` stays callable by everyone: the index above runs it as the person saving a record. It only
-- computes on the text it is given. The others are run by the database itself, as the owner, on the person's behalf;
-- `field_is_referenced` was already closed to everyone in the fields migration, and stays so: `create or replace` keeps
-- its privileges.)

-- ─── The water sources a farm already uses ───────────────────────────────────

-- Registers every water source named in a farm's APPROVED records (a draft or a rejected record has not been reviewed, so
-- its text is not turned into a source), once per name, spelled the way the records spell it most often, with the kind
-- and the fields of its newest approved assessment when it has one. A name that cannot be a source's name (empty, longer
-- than 60 characters, or a list: it holds a comma or a semicolon) is skipped, the most used names come first when a farm
-- would pass 200, and a source that is already registered is left exactly as it is.
create or replace function public.backfill_water_sources_from_records()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  created integer;
begin
  with used as (
    select r.farm_id, public.field_clean_name(public.record_water_source(r.kind, r.payload)) as name, count(*) as uses
    from public.records r
    where r.status = 'approved' and public.record_water_source(r.kind, r.payload) is not null
    group by r.farm_id, public.field_clean_name(public.record_water_source(r.kind, r.payload))
  ),
  keyed as (
    select farm_id, name, uses, public.field_key(name) as key,
           sum(uses) over (partition by farm_id, public.field_key(name)) as total
    from used
    where char_length(name) between 1 and 60 and name !~ '[,;]'
  ),
  best as (
    select distinct on (farm_id, key) farm_id, name, key, total
    from keyed
    order by farm_id, key, uses desc, name
  ),
  fresh as (
    select b.farm_id, b.name, b.key, row_number() over (partition by b.farm_id order by b.total desc, b.name) as rank
    from best b
    where not exists (select 1 from public.water_sources s where s.farm_id = b.farm_id and public.field_key(s.name) = b.key)
  )
  insert into public.water_sources (farm_id, name, source_type, fields_served)
  select c.farm_id, c.name, latest.source_type, latest.fields_served
  from fresh c
  left join lateral (
    select
      case when a.payload->>'source_type' in ('enclosed_groundwater', 'open_groundwater', 'surface', 'canal', 'public', 'other') then a.payload->>'source_type' end as source_type,
      nullif(left(btrim(a.payload->>'fields_served'), 1000), '') as fields_served
    from public.records a
    where a.farm_id = c.farm_id and a.kind = 'water_assessment' and a.status = 'approved'
      and jsonb_typeof(a.payload->'source') = 'string'
      and public.field_key(a.payload->>'source') = c.key
    order by a.record_date desc nulls last, a.created_at desc
    limit 1
  ) latest on true
  where c.rank <= greatest(0, 200 - (select count(*) from public.water_sources s where s.farm_id = c.farm_id))
  on conflict (farm_id, public.field_key(name)) do nothing;

  get diagnostics created = row_count;
  return created;
end;
$$;

revoke all on function public.backfill_water_sources_from_records() from public, anon, authenticated;

select public.backfill_water_sources_from_records();

-- The server role (Telegram agent, imports) keeps the list too; newer projects grant it nothing by default.
grant select, insert, update, delete on public.water_sources to service_role;

-- Tell the Supabase API about the new table and functions now, not at its next restart.
notify pgrst, 'reload schema';
