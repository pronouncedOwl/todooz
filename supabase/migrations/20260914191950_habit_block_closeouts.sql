-- Per-block habit closeout acknowledgements (before wake, morning, daytime, evening)
alter table todooz.habit_prefs
  add column if not exists block_closeouts jsonb not null default '{}'::jsonb;

update todooz.habit_prefs
set block_closeouts = coalesce(block_closeouts, '{}'::jsonb)
  || jsonb_build_object('morning', morning_closed_on::text)
where morning_closed_on is not null
  and coalesce(block_closeouts->>'morning', '') = '';
