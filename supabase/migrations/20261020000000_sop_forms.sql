-- Phase 4: the SOP forms a farm fills in are kept with the farm, so they are no longer lost when the page is left.
-- One value holds every SOP's form: { "<sop id>": { "<field id>": "text", ... }, ... }. It uses the same table, save
-- rules and conflict handling as the farm profile, so only the list of known kinds of data changes.

alter table public.farm_data drop constraint if exists farm_data_known_key;
alter table public.farm_data add constraint farm_data_known_key
  check (key in ('farm_profile', 'incidents', 'cost_settings', 'sop_activity_records', 'sop_forms'));

-- A value of this kind is an object (the table's shape rule treats every kind that is not a list as one).

notify pgrst, 'reload schema';
