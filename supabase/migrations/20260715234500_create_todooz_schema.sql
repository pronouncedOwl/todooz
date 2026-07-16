-- Toodooz app schema (isolated from public + taskworktrack)
create schema if not exists todooz;

create type todooz.todo_priority as enum ('high', 'medium', 'low');

create table todooz.todos (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  priority todooz.todo_priority not null default 'medium',
  due_date date,
  project text,
  completed boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index todos_user_id_idx on todooz.todos (user_id);
create index todos_due_date_idx on todooz.todos (due_date);
create index todos_priority_idx on todooz.todos (priority);
create index todos_completed_idx on todooz.todos (completed);

create table todooz.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index projects_user_id_idx on todooz.projects (user_id);

create table todooz.recurring_templates (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  freq text not null check (freq in ('DAILY', 'WEEKLY')),
  interval integer not null default 1,
  times_per_day integer not null default 1,
  byweekday jsonb,
  anchor date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index recurring_templates_user_id_idx on todooz.recurring_templates (user_id);

create table todooz.recurring_instances (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id text not null references todooz.recurring_templates (id) on delete cascade,
  date date not null,
  occurrence integer not null default 1,
  completed boolean not null default false,
  status text not null default 'open' check (status in ('open', 'incomplete', 'completed')),
  created_at timestamptz not null default now(),
  unique (template_id, date, occurrence)
);

create index recurring_instances_user_id_idx on todooz.recurring_instances (user_id);
create index recurring_instances_date_idx on todooz.recurring_instances (date);
create index recurring_instances_template_idx on todooz.recurring_instances (template_id);

alter table todooz.todos enable row level security;
alter table todooz.projects enable row level security;
alter table todooz.recurring_templates enable row level security;
alter table todooz.recurring_instances enable row level security;

create policy "Users manage own todos"
  on todooz.todos for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own projects"
  on todooz.projects for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own recurring templates"
  on todooz.recurring_templates for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own recurring instances"
  on todooz.recurring_instances for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant usage on schema todooz to anon, authenticated, service_role;
grant all on all tables in schema todooz to anon, authenticated, service_role;
grant all on all routines in schema todooz to anon, authenticated, service_role;
grant all on all sequences in schema todooz to anon, authenticated, service_role;
alter default privileges for role postgres in schema todooz grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema todooz grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema todooz grant all on sequences to anon, authenticated, service_role;

-- Expose alongside existing custom schemas
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, taskworktrack, todooz';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
