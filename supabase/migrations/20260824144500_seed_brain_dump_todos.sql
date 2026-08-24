-- Seed todos from 2026-08-24 brain dump (single-user app).
-- user_id resolves to the sole auth user at apply time.

insert into todooz.todos (id, user_id, title, priority, due_date, project, completed, notes)
select
  v.id,
  (select id from auth.users order by created_at asc limit 1),
  v.title,
  v.priority::todooz.todo_priority,
  v.due_date::date,
  null,
  false,
  v.notes
from (
  values
    -- Topos / Katie (high)
    (
      'task-topos-otter',
      'Go through Otter AI notes and parse out Topos todos',
      'high',
      '2026-08-24',
      'Katie Topos website — prep before tomorrow''s follow-up'
    ),
    (
      'task-topos-work',
      'Do as much Topos website work as possible before Katie follow-up',
      'high',
      '2026-08-24',
      'Push progress today so follow-up questions are concrete'
    ),
    (
      'task-topos-meet',
      'Follow-up and questions meeting with Katie (Topos)',
      'high',
      '2026-08-25',
      ''
    ),
    (
      'task-topos-ship',
      'Ship Topos website changes',
      'high',
      '2026-08-27',
      'Target: changes out by Thursday'
    ),

    -- Personal (medium, due today)
    (
      'task-headphones',
      'Find all headphones and put them back in their chargers',
      'medium',
      '2026-08-24',
      ''
    ),
    (
      'task-pills',
      'Refill pill containers',
      'medium',
      '2026-08-24',
      ''
    ),
    (
      'task-roller',
      'Use a roller on my legs',
      'medium',
      '2026-08-24',
      ''
    ),
    (
      'task-protein',
      'Track protein consumption today',
      'medium',
      '2026-08-24',
      ''
    ),
    (
      'task-hair-removal',
      'Body hair removal',
      'medium',
      '2026-08-24',
      ''
    ),
    (
      'task-nap',
      'Take a nap',
      'medium',
      '2026-08-24',
      ''
    ),

    -- Videos (low; done by end of next week)
    (
      'task-vid-cr',
      'Edit short Costa Rica trip video (GoPro)',
      'low',
      '2026-09-06',
      ''
    ),
    (
      'task-vid-ca',
      'Edit short Canada trip video (GoPro)',
      'low',
      '2026-09-06',
      ''
    ),
    (
      'task-vid-summer',
      'Edit whole-summer / before-40 video (GoPro)',
      'low',
      '2026-09-06',
      'Include summer trip footage'
    ),
    (
      'task-vid-bday',
      'Edit birthday party videos for Instagram',
      'low',
      '2026-09-06',
      'A couple of short clips'
    )
) as v(id, title, priority, due_date, notes)
where not exists (
  select 1 from todooz.todos t where t.id = v.id
);
