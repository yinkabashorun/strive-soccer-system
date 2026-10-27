-- =====================================================================
-- Strive Elite - Speed course: The cross, and the levels made simple
-- =====================================================================
-- Coach Yinka, Oct 27 2026: "This is the last drill it is called the
-- cross. After you put this in organize the course as best you can and
-- simplistic."
--
-- The cross (IMG_7422): five cones in a cross, every move starts and
-- ends on the middle cone; sprint, backpedal and shuffle to each arm.
-- It is change of direction at speed, so it joins the two zigzags in
-- Top speed, last. Course drill (opt_in), open space, muted.
--
-- Simple ladder, one plain name per level, his words kept where he gave
-- them (Technique, Acceleration, Top speed, Explosiveness):
--   1 Warm-up        the three plyos (was "Bounce", my name)
--   2 Technique      Stop and go; 50%, 100%, 25%; Sprint around the cones
--   3 Acceleration   Kneel and drive; 15 yard sprint; the three drop sprints
--   4 Top speed      Zigzag sprint and backpedal; Zigzag sprint; The cross
--   5 Explosiveness  Push-up start sprint; Long jumps; Side bounds
-- Intro cut to three short lines. Idempotent: the drill by title, the
-- step while absent, the renames and intro by value.
-- =====================================================================

do $$
declare
  cid uuid;
  placed int;
begin
  select id into cid from public.elite_courses where slug = 'speed';
  if cid is null then
    raise exception 'Speed course missing; run 044 first';
  end if;

  insert into public.elite_drills (pillar, title, how, reps, minutes, cues, needs_wall, active, sort, video_url, demo_by, small_space, opt_in, needs_goal)
  select 'Speed', 'Speed: The cross',
    'Five cones in a cross, one in the middle. Start on the middle cone. Sprint to the top cone and backpedal to the middle. Shuffle to one side cone and back. Shuffle to the other side and back. Backpedal to the bottom cone and sprint back to the middle.',
    '4 rounds, full rest between each', 5,
    'Face the same way the whole time. Low in every shuffle, feet never cross. Touch the middle cone every time and change direction off a hard plant.',
    false, true, 230, 'https://thestriveapp.com/drills/speed-the-cross.mp4', '', false, true, false
  where not exists (select 1 from public.elite_drills where title = 'Speed: The cross');

  if not exists (
    select 1 from public.elite_course_steps s join public.elite_drills d on d.id = s.drill_id
    where s.course_id = cid and d.title = 'Speed: The cross'
  ) then
    insert into public.elite_course_steps (course_id, level_no, level_name, drill_id, sort)
    select cid, 4, 'Top speed', d.id, 30 from public.elite_drills d where d.title = 'Speed: The cross';
  end if;

  update public.elite_course_steps set level_name = 'Warm-up'   where course_id = cid and level_no = 1 and level_name is distinct from 'Warm-up';
  update public.elite_course_steps set level_name = 'Technique' where course_id = cid and level_no = 2 and level_name is distinct from 'Technique';

  update public.elite_courses
     set intro = E'Warm up first, every time.\nWork one level at a time. Full rest between reps; speed is never tired work.\nLand soft, leave fast.'
   where id = cid;

  select count(*) into placed from public.elite_course_steps where course_id = cid;
  if placed <> 17 then
    raise exception 'Speed course has % steps after the cross, expected 17', placed;
  end if;
end $$;
