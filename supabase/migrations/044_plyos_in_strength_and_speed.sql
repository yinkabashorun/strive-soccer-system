-- =====================================================================
-- Strive Elite - plyos into the Strength course, and the Speed course
-- =====================================================================
-- Coach Yinka, Oct 26 2026: "add certain plyos to strength and certain
-- plyos to a speed course we will make. We will take sprint vids."
--
-- The seven filmed plyo warm-ups split by what they train:
--   Strength, new Level 5 "Power": the loaded, single-leg and deep
--     jumps (Bulgarian split jumps, Squat jumps, Alternating lunge
--     jumps, Single leg step down hops).
--   Speed, Level 1 "Bounce": the elastic, reactive, horizontal work
--     (Pogo jumps, Lateral hops over object, Broad jumps). The sprint
--     levels are added at /coach/drills as the clips land.
-- The split is a coaching read; any step moves in the editor. A plyo in
-- a course is unchanged in the week: it stays a warm-up the builder
-- rotates. Idempotent; each block refuses a partial result.
-- =====================================================================

do $$
declare
  cid uuid;
  placed int;
begin
  select id into cid from public.elite_courses where slug = 'strength';
  if cid is null then
    raise exception 'Strength course missing; run 043 first';
  end if;
  if exists (select 1 from public.elite_course_steps where course_id = cid and level_no = 5) then
    return;
  end if;
  insert into public.elite_course_steps (course_id, level_no, level_name, drill_id, sort)
  select cid, 5, 'Power', d.id, s.sort
  from (values
    ('Plyo warm-up: Squat jumps',                10),
    ('Plyo warm-up: Alternating lunge jumps',    20),
    ('Plyo warm-up: Bulgarian split jumps',      30),
    ('Plyo warm-up: Single leg step down hops',  40)
  ) as s(title, sort)
  join public.elite_drills d on d.title = s.title;
  select count(*) into placed from public.elite_course_steps where course_id = cid and level_no = 5;
  if placed <> 4 then
    raise exception 'Strength Power level placed % of 4 plyos; a bank title is missing', placed;
  end if;
end $$;

do $$
declare
  cid uuid;
  placed int;
begin
  if exists (select 1 from public.elite_courses where slug = 'speed') then
    return;
  end if;
  insert into public.elite_courses (slug, name, subtitle, intro, kind, active, sort)
  values (
    'speed',
    'Speed',
    'Explosive first steps and quick feet.',
    E'Land soft, leave fast.\nFull rest between sets. Speed is never tired work.',
    'drill',
    true,
    40
  )
  returning id into cid;
  insert into public.elite_course_steps (course_id, level_no, level_name, drill_id, sort)
  select cid, 1, 'Bounce', d.id, s.sort
  from (values
    ('Plyo warm-up: Pogo jumps',                10),
    ('Plyo warm-up: Lateral hops over object',  20),
    ('Plyo warm-up: Broad jumps',               30)
  ) as s(title, sort)
  join public.elite_drills d on d.title = s.title;
  select count(*) into placed from public.elite_course_steps where course_id = cid;
  if placed <> 3 then
    raise exception 'Speed seed placed % of 3 plyos; a bank title is missing', placed;
  end if;
end $$;
