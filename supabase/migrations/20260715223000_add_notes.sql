-- For databases created before notes existed.
alter table public.todos
  add column if not exists notes text not null default '';
