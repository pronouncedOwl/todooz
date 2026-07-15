-- Todos table (personal task list). Ready to run in Supabase SQL editor or CLI.

create type public.todo_priority as enum ('high', 'medium', 'low');

create table public.todos (
  id text primary key,
  title text not null,
  priority public.todo_priority not null default 'medium',
  due_date date,
  project text,
  completed boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index todos_due_date_idx on public.todos (due_date);
create index todos_priority_idx on public.todos (priority);
create index todos_completed_idx on public.todos (completed);

alter table public.todos enable row level security;

-- Personal app: open read/update for anon until auth is added.
create policy "Allow anon read todos"
  on public.todos for select
  to anon, authenticated
  using (true);

create policy "Allow anon update todos"
  on public.todos for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "Allow anon insert todos"
  on public.todos for insert
  to anon, authenticated
  with check (true);

create policy "Allow anon delete todos"
  on public.todos for delete
  to anon, authenticated
  using (true);

-- Seed from TaskWorkTrack export (2026-07-15). Recurring daily habits not included.
insert into public.todos (id, title, priority, due_date, project, completed, notes) values
  ('task-001', 'Get wife''s car inspected', 'high', '2026-07-03', 'Wife''s car registration renewal', false, ''),
  ('task-002', 'Katie''s business — initial reporting draft', 'high', '2026-07-03', null, false, ''),
  ('task-003', 'Schedule dentist appointment', 'high', '2026-07-03', null, false, ''),
  ('task-004', 'Book + attend Dr. Yadiv appointment', 'high', '2026-07-06', 'Back surgery prep (Dr. Yadiv)', false, ''),
  ('task-005', 'Renew wife''s registration online', 'high', '2026-07-10', 'Wife''s car registration renewal', false, ''),
  ('task-006', 'Get exact surgery details from surgeon', 'high', '2026-07-13', null, false, ''),
  ('task-007', 'Get FMLA form requirements from work', 'high', null, 'Back surgery prep (Dr. Yadiv)', false, ''),
  ('task-008', 'Inspect bolts & check for special tools', 'low', '2026-07-11', 'Fix backyard swing set', false, ''),
  ('task-047', 'Home Depot run for materials', 'low', '2026-07-11', 'Fix backyard swing set', false, ''),
  ('task-048', 'Build/repair the swing set', 'low', '2026-07-11', 'Fix backyard swing set', false, ''),
  ('task-009', 'Finish power-washing the driveway', 'medium', '2026-07-11', null, false, ''),
  ('task-012', 'Replace metal cut-off saw blade (buy + install)', 'medium', '2026-08-01', null, false, ''),
  ('task-013', 'Create a scavenger hunt for the kids', 'medium', '2026-08-14', null, false, ''),
  ('task-014', 'Replace table-saw blade (buy + install)', 'medium', '2026-08-28', null, false, ''),
  ('task-015', 'Assess AI tools & make a cost-reduction plan', 'medium', null, null, false, ''),
  ('task-016', 'Assess Katie''s current websites', 'medium', null, 'Katie''s business — hosting cleanup', false, ''),
  ('task-017', 'Build own house-info dashboard (replace DAC board)', 'medium', null, 'House-info dashboard', false, ''),
  ('task-018', 'Cancel Swimply', 'medium', null, null, false, ''),
  ('task-019', 'Check spare tire setup — my car', 'medium', null, null, false, ''),
  ('task-020', 'Check spare tire setup — wife''s car', 'medium', null, null, false, ''),
  ('task-021', 'Close out the old hosting (no data loss)', 'medium', null, 'Katie''s business — hosting cleanup', false, ''),
  ('task-022', 'Consolidate sites onto Vercel', 'medium', null, 'Katie''s business — hosting cleanup', false, ''),
  ('task-023', 'Display running total by category on a dedicated screen', 'medium', null, 'Credit-card spending dashboard', false, ''),
  ('task-024', 'Host the dashboard on the Mac mini', 'medium', null, 'House-info dashboard', false, ''),
  ('task-025', 'Identify what''s still paid on the other host', 'medium', null, 'Katie''s business — hosting cleanup', false, ''),
  ('task-026', 'Research existing credit-card dashboard tools', 'medium', null, 'Credit-card spending dashboard', false, ''),
  ('task-027', 'Set up the dashboard', 'medium', null, 'Credit-card spending dashboard', false, ''),
  ('task-028', 'Power-wash the back porch', 'low', '2026-07-11', null, false, ''),
  ('task-029', 'Set up Simply Piano + first lesson', 'low', '2026-10-01', null, false, ''),
  ('task-030', '3D-print a Yeti cap organizer', 'low', null, null, false, ''),
  ('task-031', '3D-print housings for kids'' transmitter tool', 'low', null, null, false, ''),
  ('task-032', '3D-print the liner/tray', 'low', null, '3D-print truck liner/tray', false, ''),
  ('task-033', 'Assemble quick-fishing box for the truck', 'low', null, 'Fishing gear prep', false, ''),
  ('task-034', 'Clean out & organize the big equipment box', 'low', null, 'Fishing gear prep', false, ''),
  ('task-035', 'Cut out photos & install in truck', 'low', null, 'Print new truck photos', false, ''),
  ('task-036', 'Design a custom liner/tray that fits', 'low', null, '3D-print truck liner/tray', false, ''),
  ('task-037', 'Edit photos to correct size', 'low', null, 'Print new truck photos', false, ''),
  ('task-038', 'Find the right photos', 'low', null, 'Print new truck photos', false, ''),
  ('task-039', 'Measure truck spaces for photos', 'low', null, 'Print new truck photos', false, ''),
  ('task-040', 'Order/send photos to Walgreens', 'low', null, 'Print new truck photos', false, ''),
  ('task-041', 'Paint new numbers on the driveway', 'low', null, null, false, ''),
  ('task-042', 'Pick up photos at Walgreens', 'low', null, 'Print new truck photos', false, ''),
  ('task-043', 'Remove watch links + replace watch battery', 'low', null, null, false, ''),
  ('task-044', 'Restring all fishing reels', 'low', null, 'Fishing gear prep', false, ''),
  ('task-045', 'Search online for a pre-made truck liner/tray', 'low', null, '3D-print truck liner/tray', false, ''),
  ('task-046', 'Take down backyard bird feeder', 'low', null, null, false, '');
