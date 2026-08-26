-- Optional ballpark planning estimate (minutes). Not time tracking.
-- Stored on the template so every occurrence inherits it.
alter table todooz.recurring_templates
  add column estimate_minutes integer
  check (estimate_minutes is null or estimate_minutes > 0);
