-- =====================================================================
-- Strive Elite - two courses from filmed drills: Weak Foot and Strength
-- =====================================================================
-- Coach Yinka, Oct 26 2026 quiz: Weak Foot in four levels (Touches, Off
-- the ground, Wall moves, Wall turns), named "Weak Foot"; Strength cut
-- as his Oct 7 circuits (Core A, Core B, Hips and glutes, Legs and
-- groin), named "Strength". Zero new filming: every step is a bank drill
-- already filmed. Steps point at bank rows by title; each block refuses
-- to seed a partial course. Idempotent: a course that exists is left
-- alone. No pass marks (he gave no numbers); cues stay on the drill
-- cards, the course tile shows the video and the name (his copy rule).
-- =====================================================================

do $$
declare
  cid uuid;
  placed int;
begin
  if exists (select 1 from public.elite_courses where slug = 'weak-foot') then
    return;
  end if;
  insert into public.elite_courses (slug, name, subtitle, intro, kind, active, sort)
  values (
    'weak-foot',
    'Weak Foot',
    'Both feet, no excuses.',
    E'Weak foot only, the whole way through.\nPass a level before you move up.\nLevels 3 and 4 need a wall.',
    'drill',
    true,
    20
  )
  returning id into cid;

  insert into public.elite_course_steps (course_id, level_no, level_name, tag, drill_id, sort)
  select cid, s.level_no, s.level_name, s.tag, d.id, s.sort
  from (values
    (1, 'Touches',        'beginner', 'Weak foot tap, pull, push',           10),
    (1, 'Touches',        'advanced', 'Weak foot outside pull, inside pull', 20),
    (2, 'Off the ground', 'beginner', 'Weak foot pop and settle',            10),
    (2, 'Off the ground', 'advanced', 'Weak foot pop and juggle',            20),
    (3, 'Wall moves',     'advanced', 'Wall pass, touch, stepover',          10),
    (3, 'Wall moves',     'advanced', 'Wall pass, touch, scissor',           20),
    (4, 'Wall turns',     'advanced', 'Wall pass, touch behind the leg',     10),
    (4, 'Wall turns',     'advanced', 'Wall pass, touch, L turn',            20)
  ) as s(level_no, level_name, tag, title, sort)
  join public.elite_drills d on d.title = s.title;

  select count(*) into placed from public.elite_course_steps where course_id = cid;
  if placed <> 8 then
    raise exception 'Weak Foot seed placed % of 8 drills; a bank title is missing', placed;
  end if;
end $$;

do $$
declare
  cid uuid;
  placed int;
begin
  if exists (select 1 from public.elite_courses where slug = 'strength') then
    return;
  end if;
  insert into public.elite_courses (slug, name, subtitle, intro, kind, active, sort)
  values (
    'strength',
    'Strength',
    'Core, hips, legs. The finishers.',
    E'Every one of these is a session finisher: five minutes after the skill work.\nHold the form before you add time or reps.',
    'drill',
    true,
    30
  )
  returning id into cid;

  insert into public.elite_course_steps (course_id, level_no, level_name, drill_id, sort)
  select cid, s.level_no, s.level_name, d.id, s.sort
  from (values
    (1, 'Core A',          'Strength: Front plank',                 10),
    (1, 'Core A',          'Strength: Bird dog',                    20),
    (1, 'Core A',          'Strength: Hollow hold',                 30),
    (1, 'Core A',          'Strength: Six inches',                  40),
    (2, 'Core B',          'Strength: Hip dips',                    10),
    (2, 'Core B',          'Strength: Mountain climbers',           20),
    (2, 'Core B',          'Strength: V-ups',                       30),
    (2, 'Core B',          'Strength: Toe-touch crunch',            40),
    (3, 'Hips and glutes', 'Strength: Single leg bridge',           10),
    (3, 'Hips and glutes', 'Strength: Long-lever hamstring bridge', 20),
    (4, 'Legs and groin',  'Strength: Split squat',                 10),
    (4, 'Legs and groin',  'Strength: Single leg RDL',              20),
    (4, 'Legs and groin',  'Strength: Wall sit',                    30)
  ) as s(level_no, level_name, title, sort)
  join public.elite_drills d on d.title = s.title;

  select count(*) into placed from public.elite_course_steps where course_id = cid;
  if placed <> 13 then
    raise exception 'Strength seed placed % of 13 drills; a bank title is missing', placed;
  end if;
end $$;
