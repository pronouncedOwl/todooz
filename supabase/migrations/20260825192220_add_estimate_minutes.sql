-- Optional ballpark planning estimate (minutes). Not time tracking.
alter table todooz.todos
  add column estimate_minutes integer
  check (estimate_minutes is null or estimate_minutes > 0);
