-- Add before_bed time-of-day; seed foot/nail medicine, pimple patch, whitening;
-- move second brush-teeth occurrence to before_bed.

alter table todooz.recurring_templates
  drop constraint if exists recurring_templates_time_of_day_check;

alter table todooz.recurring_templates
  add constraint recurring_templates_time_of_day_check
  check (time_of_day in ('before_wake', 'morning', 'daytime', 'evening', 'before_bed'));

-- Brush teeth: (1/2) morning, (2/2) before bed
update todooz.recurring_templates
set
  time_of_day = 'morning',
  time_slots = '["morning", "before_bed"]'::jsonb
where id = 'rec-7de50416';

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
  ('rec-foot-nail-medicine', 'Foot and Nail medicine', 'before_bed', ''),
  ('rec-pimple-patch', 'Pimple Patch', 'before_bed', ''),
  ('rec-do-whitening', 'Do whitening', 'daytime', '')
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
