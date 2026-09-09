-- Add before_wake time-of-day section and seed new/moved habits

alter table todooz.recurring_templates
  drop constraint if exists recurring_templates_time_of_day_check;

alter table todooz.recurring_templates
  add constraint recurring_templates_time_of_day_check
  check (time_of_day in ('before_wake', 'morning', 'daytime', 'evening'));

-- Moves
update todooz.recurring_templates
set time_of_day = 'before_wake', time_slots = null
where id = 'rec-c84fb777';

update todooz.recurring_templates
set
  time_of_day = 'morning',
  time_slots = '["morning", "daytime"]'::jsonb
where id = 'rec-7de50416';

update todooz.recurring_templates
set time_of_day = 'morning', time_slots = null
where id = 'rec-388c170e';

-- New habits (idempotent upserts by id). user_id filled for existing solo user when present.
insert into todooz.recurring_templates (
  id, user_id, title, freq, interval, times_per_day, byweekday, anchor, notes, time_of_day, time_slots
)
select
  v.id,
  u.id,
  v.title,
  'DAILY',
  1,
  1,
  null,
  null,
  v.notes,
  v.time_of_day,
  null
from (values
  ('rec-morning-ritual', 'Morning ritual', 'before_wake', ''),
  ('rec-downstairs-reset', 'Downstairs reset', 'daytime', ''),
  ('rec-upstairs-reset', 'Upstairs reset', 'daytime', ''),
  ('rec-move-along-laundry', 'Move-along laundry', 'daytime', '')
) as v(id, title, time_of_day, notes)
cross join lateral (
  select id from auth.users order by created_at asc limit 1
) u
on conflict (id) do update
set
  title = excluded.title,
  freq = excluded.freq,
  interval = excluded.interval,
  times_per_day = excluded.times_per_day,
  time_of_day = excluded.time_of_day,
  time_slots = excluded.time_slots,
  notes = excluded.notes;
