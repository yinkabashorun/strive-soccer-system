-- =====================================================================
-- Strive Elite - courses (offer stack item 9, Oct 26 2026)
-- =====================================================================
-- Coach Yinka, Oct 23: the Courses tab is a LIBRARY every member sees,
-- nothing tracked. Oct 25: six courses in his order (shooting, weak
-- foot, strength, agility, recruiting, the General Nutrition Guide).
--
-- One primitive for two kinds of course:
--   drill  course: every step is a bank drill by id. The step's video,
--                  title and reps come FROM the drill row, so a renamed
--                  or re-filmed drill updates the course on its own.
--                  Putting a drill in a course never changes whether it
--                  is in anyone's week (that is opt_in + the player's
--                  picks, 040), so weak foot and strength drills stay in
--                  weeks exactly as today.
--   lesson course: every step is a page (title, body, optional video and
--                  download). Recruiting and nutrition. Never a homework
--                  row, so the 031 filmed guard is never involved.
--
--   elite_courses        slug, name, subtitle, intro, kind, active, sort
--   elite_course_steps   level_no, level_name, tag, drill_id OR a lesson
--
-- A step is a drill OR a lesson, enforced by a check constraint. A drill
-- in a course cannot be deleted from the bank (on delete restrict): the
-- coach takes it out of the course first, so a course never loses a
-- step silently. Coach-only writes; any signed-in member reads active
-- courses. Keep It Up is seeded exactly as the preview page reads.
-- =====================================================================

create table if not exists public.elite_courses (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  subtitle   text,
  intro      text,
  kind       text not null default 'drill' check (kind in ('drill', 'lesson')),
  active     boolean not null default false,
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.elite_course_steps (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.elite_courses(id) on delete cascade,
  level_no     int  not null default 1,
  level_name   text,
  tag          text check (tag in ('beginner', 'advanced')),
  drill_id     uuid references public.elite_drills(id) on delete restrict,
  title        text,
  body         text,
  video_url    text,
  download_url text,
  cue          text,
  pass_mark    text,
  sort         int  not null default 0,
  created_at   timestamptz not null default now(),
  constraint elite_course_step_shape check (
    (drill_id is not null and body is null)
    or (drill_id is null and title is not null and body is not null)
  )
);
create index if not exists elite_course_steps_course_idx
  on public.elite_course_steps(course_id, level_no, sort);

alter table public.elite_courses enable row level security;
alter table public.elite_course_steps enable row level security;

-- Coach writes everything; any signed-in member reads active courses.
create policy elite_courses_coach_all on public.elite_courses
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());
create policy elite_courses_member_read on public.elite_courses
  for select using (active and auth.role() = 'authenticated');

create policy elite_course_steps_coach_all on public.elite_course_steps
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());
create policy elite_course_steps_member_read on public.elite_course_steps
  for select using (
    auth.role() = 'authenticated'
    and exists (select 1 from public.elite_courses c where c.id = course_id and c.active)
  );

-- Seed: Keep It Up, the juggling ladder, as the preview page reads on
-- Oct 25 2026 (seven levels, fourteen drills, Coach Yinka's names and
-- cues, pass marks on the beginner drills only). Steps point at the
-- bank rows by title; the block refuses to seed a partial ladder.
do $$
declare
  cid uuid;
  placed int;
begin
  if exists (select 1 from public.elite_courses where slug = 'keep-it-up') then
    return;
  end if;
  insert into public.elite_courses (slug, name, subtitle, intro, kind, active, sort)
  values (
    'keep-it-up',
    'Keep It Up',
    'The Juggling Ladder',
    E'Start at Level 1, even if you can already juggle.\nPass the catch version, then work the keep it up version, then move up.\nA pass mark is in a row. A drop ends the attempt.\nFilm the day you pass a level.',
    'drill',
    true,
    10
  )
  returning id into cid;

  insert into public.elite_course_steps (course_id, level_no, level_name, tag, drill_id, cue, pass_mark, sort)
  select cid, s.level_no, s.level_name, s.tag, d.id, s.cue, s.pass_mark, s.sort
  from (values
    (1, 'One touch',             'beginner', 'Juggling: one touch, catch',                 'Toe up, ankle locked, hit the middle of the ball.', '10 in a row', 10),
    (1, 'One touch',             'advanced', 'Juggling: one touch, keep it up',            'Small touches, both feet.', null, 20),
    (2, 'Two touches each foot', 'beginner', 'Juggling: two touches each foot, catch',     'The first touch is small, the second one sends it to your chest for the catch.', '10 in a row', 10),
    (2, 'Two touches each foot', 'advanced', 'Juggling: two touches each foot, keep it up','Small touches, stay on the balls of your feet.', null, 20),
    (3, 'One, two',              'beginner', 'Juggling: one, two, catch',                  'Strong foot, weak foot, weak foot. Say it as you go: strong, weak, weak, catch. The weak foot gets two in a row, so give its first touch a little more time.', '10 in a row', 10),
    (3, 'One, two',              'advanced', 'Juggling: one, two, keep it up',             'Strong foot, weak foot, weak foot. Keep the count going out loud until the weak foot stops thinking.', null, 20),
    (4, 'Laces, inside',         'beginner', 'Juggling: laces, inside, catch',             'The laces pop it up, the inside brings it to your chest.', '10 in a row', 10),
    (4, 'Laces, inside',         'advanced', 'Juggling: laces, inside, keep it up',        'Turn the foot for the inside touch, then straight back to the laces.', null, 20),
    (5, 'Thigh',                 'beginner', 'Juggling: drop, thigh, catch',               'Knee up, thigh flat like a table, ball lands on the middle.', '10 in a row', 10),
    (5, 'Thigh',                 'advanced', 'Juggling: thighs high, keep it up',          'Drive the knee, catch it on the flat of the thigh, wait for it to come down.', null, 20),
    (6, 'Thighs, laces',         'beginner', 'Juggling: thighs, laces, catch',             'Thigh flat like a table, then meet the ball with the laces on the way down.', '10 in a row', 10),
    (6, 'Thighs, laces',         'beginner', 'Juggling: laces, thigh, catch',              'The laces touch is not soft, it gets the ball to chest level. The thigh is the softer touch, it controls it.', '10 in a row', 20),
    (6, 'Thighs, laces',         'advanced', 'Juggling: thighs, laces, keep it up',        'The thigh sets the height, the laces keep the rhythm. Stay tall.', null, 30),
    (7, 'Head',                  'advanced', 'Juggling: head it up',                       'Eyes open, forehead not the top of the head, knees soft.', null, 10)
  ) as s(level_no, level_name, tag, title, cue, pass_mark, sort)
  join public.elite_drills d on d.title = s.title;

  select count(*) into placed from public.elite_course_steps where course_id = cid;
  if placed <> 14 then
    raise exception 'Keep It Up seed placed % of 14 drills; a bank title is missing', placed;
  end if;
end $$;
