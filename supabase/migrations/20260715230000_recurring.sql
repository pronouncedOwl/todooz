-- Recurring / self-care templates and daily instances.

create table public.recurring_templates (
  id text primary key,
  title text not null,
  freq text not null check (freq in ('DAILY', 'WEEKLY')),
  interval integer not null default 1,
  times_per_day integer not null default 1,
  byweekday jsonb,
  anchor date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.recurring_instances (
  id text primary key,
  template_id text not null references public.recurring_templates (id) on delete cascade,
  date date not null,
  occurrence integer not null default 1,
  completed boolean not null default false,
  status text not null default 'open' check (status in ('open', 'incomplete', 'completed')),
  created_at timestamptz not null default now(),
  unique (template_id, date, occurrence)
);

create index recurring_instances_date_idx on public.recurring_instances (date);
create index recurring_instances_template_idx on public.recurring_instances (template_id);

alter table public.recurring_templates enable row level security;
alter table public.recurring_instances enable row level security;

create policy "Allow anon all recurring_templates"
  on public.recurring_templates for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "Allow anon all recurring_instances"
  on public.recurring_instances for all
  to anon, authenticated
  using (true)
  with check (true);
