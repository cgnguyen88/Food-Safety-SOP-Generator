-- Phase 4: share a SOP with workers by a link or a QR code.
--
-- A share is a long random token for one SOP of one farm. Anyone holding the link can read that SOP (through the
-- server, which looks the token up) and sign that they read it; nothing else about the farm is reachable from it.
-- Owners and managers create a share and can turn it off. A turned-off share stays on file (and stays off), and a
-- farm has at most one working link per SOP, so there is never a pile of old links still open.

create table if not exists public.sop_shares (
  id         uuid primary key default gen_random_uuid(),
  farm_id    uuid not null references public.farms (id) on delete cascade,
  sop_id     integer not null,
  -- Made by the database, never chosen by a client: two random UUIDs, 64 hex characters (about 240 random bits).
  token      text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint sop_shares_sop_id_check check (sop_id between 1 and 99),
  constraint sop_shares_token_check check (token ~ '^[0-9a-f]{64}$'),
  constraint sop_shares_token_key unique (token)
);

create unique index if not exists sop_shares_one_working_link on public.sop_shares (farm_id, sop_id) where revoked_at is null;

alter table public.sop_shares enable row level security;

drop policy if exists sop_shares_select on public.sop_shares;
create policy sop_shares_select on public.sop_shares for select to authenticated
  using (public.has_farm_role(farm_id, array['owner', 'manager']));

drop policy if exists sop_shares_insert on public.sop_shares;
create policy sop_shares_insert on public.sop_shares for insert to authenticated
  with check (public.has_farm_role(farm_id, array['owner', 'manager']));

drop policy if exists sop_shares_update on public.sop_shares;
create policy sop_shares_update on public.sop_shares for update to authenticated
  using (public.has_farm_role(farm_id, array['owner', 'manager']))
  with check (public.has_farm_role(farm_id, array['owner', 'manager']));

-- The server stamps who made a share and when one was turned off, and a turned-off share can never be turned back on.
create or replace function public.sop_shares_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.created_at := now();
    new.revoked_at := null;
  else
    if old.revoked_at is not null then
      new.revoked_at := old.revoked_at;
    elsif new.revoked_at is not null then
      new.revoked_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sop_shares_stamp on public.sop_shares;
create trigger sop_shares_stamp
  before insert or update on public.sop_shares
  for each row execute function public.sop_shares_stamp();

revoke all on public.sop_shares from anon, authenticated;
grant select on public.sop_shares to authenticated;
grant insert (farm_id, sop_id) on public.sop_shares to authenticated;
grant update (revoked_at) on public.sop_shares to authenticated;
-- The server looks a token up to show the SOP; it never changes a share.
grant select on public.sop_shares to service_role;

notify pgrst, 'reload schema';
