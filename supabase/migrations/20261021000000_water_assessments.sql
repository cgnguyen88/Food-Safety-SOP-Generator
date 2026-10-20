-- Water assessments: a new kind of record, one per water source, looked at the way the Produce Safety Rule asks
-- (21 CFR 112.43). It is an ordinary record, so it has the same drafts, review, history and reports as the others.
--
-- The list of kinds is enforced here as well as in the app, so the constraint is replaced by one that also allows it.
-- (A test keeps this list and the app's in step.) Nothing else changes: who may see or change a record never depends
-- on the kinds this adds, only on illness_injury being restricted.

alter table public.records drop constraint records_kind_check;
alter table public.records add constraint records_kind_check check (kind in (
  'sanitizer_label', 'sanitizer_purchase', 'sanitation_log',
  'weather_event', 'wildlife_check', 'soil_amendment', 'water_test', 'water_assessment',
  'training', 'visitor', 'illness_injury',
  'harvest', 'packing_cooling', 'shipment', 'corrective_action',
  'note'
));

-- Ask the Supabase API to reload what it knows about the tables.
notify pgrst, 'reload schema';
