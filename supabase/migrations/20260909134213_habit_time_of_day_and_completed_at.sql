-- Habit time-of-day sections, skip status, morning closeout prefs, todo completed_at

alter table todooz.recurring_templates
  add column if not exists time_of_day text not null default 'daytime'
    check (time_of_day in ('morning', 'daytime', 'evening'));

alter table todooz.recurring_templates
  add column if not exists time_slots jsonb;

-- Allow skipped as an instance status
alter table todooz.recurring_instances
  drop constraint if exists recurring_instances_status_check;

alter table todooz.recurring_instances
  add constraint recurring_instances_status_check
  check (status in ('open', 'incomplete', 'completed', 'skipped'));

-- Per-user habit prefs (morning block closeout)
create table if not exists todooz.habit_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  morning_closed_on date
);

alter table todooz.habit_prefs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'todooz'
      and tablename = 'habit_prefs'
      and policyname = 'Users manage own habit prefs'
  ) then
    create policy "Users manage own habit prefs"
      on todooz.habit_prefs for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

grant all on table todooz.habit_prefs to anon, authenticated, service_role;

-- Track when a todo was completed for Done-list ordering
alter table todooz.todos
  add column if not exists completed_at timestamptz;

update todooz.todos
set completed_at = updated_at
where completed = true and completed_at is null;

-- Seed time-of-day groupings (best guess; editable in UI)
update todooz.recurring_templates set time_of_day = 'morning'
where id in (
  'rec-vyvanse',
  'rec-supplements',
  'rec-shower',
  'rec-stretch',
  'rec-pt',
  'rec-toe-medicine',
  'rec-journal'
);

update todooz.recurring_templates
set
  time_of_day = 'morning',
  time_slots = '["morning", "daytime"]'::jsonb
where id = 'rec-drink-water';

update todooz.recurring_templates set time_of_day = 'daytime'
where id in (
  'rec-garage',
  'rec-frisbee',
  'rec-reach-friend',
  'rec-alan-watts',
  'rec-kids-mail',
  'rec-trim-nails',
  'rec-trim-hair'
);
