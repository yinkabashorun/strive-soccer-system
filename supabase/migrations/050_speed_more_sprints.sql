-- =====================================================================
-- Strive Elite - Speed course, five more sprints
-- =====================================================================
-- Coach Yinka, Oct 27 2026, five phone clips: "This first one is for
-- coordination / technique sprint and get around each cone. The others
-- are for acceleration so there's 15 yard sprints as the second vid I
-- sent. Then the last 3 are diff variations of a drop sprint where he
-- drops his hands and hips, shuffles a direction then sprints."
--
-- Read of the three drop sprints from the footage (his to rename):
--   IMG_7410: hands up, drop, straight sprint forward, no shuffle.
--   IMG_7412: hands up, drop, shuffle sideways, sprint forward.
--   IMG_7411: hands up, drop, shuffle sideways, turn, sprint away.
-- Five bank drills under the Speed pillar, COURSE DRILLS (opt_in),
-- open space, no wall, no goal, muted. Level 2 "Technique and
-- coordination" gains Sprint around the cones; Level 3 "Acceleration"
-- gains the 15 yard sprint and the three drop sprints, easiest first.
-- No tags (none given). how / reps / cues written from the footage; he
-- edits at /coach/drills. Idempotent by title; steps seeded only while
-- none of these five is placed; refuses a partial.
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
  select v.pillar, v.title, v.how, v.reps, v.minutes, v.cues, false, true, v.sort, v.video_url, '', false, true, false
  from (values
    ('Speed', 'Speed: Sprint around the cones',
     'Cones in a line a few yards apart. Sprint to the first cone, get all the way around it, sprint to the next and get around that one. Through the whole line, then back the other way.',
     '4 runs through the line, walk back between each', 5,
     'Short steps into the cone, long steps out of it. Drop your hips to turn, keep your chest up. Full speed between cones.',
     150, 'https://thestriveapp.com/drills/speed-sprint-around-the-cones.mp4'),
    ('Speed', 'Speed: 15 yard sprint',
     'Two cones 15 yards apart. Start low at the first cone, sprint flat out through the second. Walk back and reset before the next one.',
     '6 sprints, full rest between each', 6,
     'Lean from the ankles, not the waist. Drive the first five steps into the ground. Run through the cone, never slow into it.',
     160, 'https://thestriveapp.com/drills/speed-15-yard-sprint.mp4'),
    ('Speed', 'Speed: Drop and sprint',
     'Stand tall with both hands above your head. Drop the hands and the hips together into a low athletic stance, then sprint straight out of it.',
     '6 reps, walk back between each', 5,
     'The drop is the trigger. Hands and hips fall at the same time, then the first step goes the moment you land low. No pause at the bottom.',
     170, 'https://thestriveapp.com/drills/speed-drop-and-sprint.mp4'),
    ('Speed', 'Speed: Drop, shuffle, sprint',
     'Hands above your head. Drop the hands and the hips, shuffle two or three steps to one side, then sprint straight forward. Switch the shuffle side each rep.',
     '3 each side, walk back between each', 5,
     'Stay low through the shuffle, feet never cross. Plant the outside foot and push into the sprint. Both directions, same speed.',
     180, 'https://thestriveapp.com/drills/speed-drop-shuffle-sprint.mp4'),
    ('Speed', 'Speed: Drop, shuffle, turn and sprint',
     'Hands above your head. Drop the hands and the hips, shuffle two or three steps to one side, then turn and sprint away. Switch the shuffle side each rep.',
     '3 each side, walk back between each', 5,
     'Open the hips to turn, do not spin on the spot. First step after the turn is the long one. Head up before you go.',
     190, 'https://thestriveapp.com/drills/speed-drop-shuffle-turn-and-sprint.mp4')
  ) as v(pillar, title, how, reps, minutes, cues, sort, video_url)
  where not exists (select 1 from public.elite_drills d where d.title = v.title);

  if exists (
    select 1 from public.elite_course_steps s join public.elite_drills d on d.id = s.drill_id
    where s.course_id = cid and d.title in ('Speed: Sprint around the cones', 'Speed: 15 yard sprint', 'Speed: Drop and sprint', 'Speed: Drop, shuffle, sprint', 'Speed: Drop, shuffle, turn and sprint')
  ) then
    return;
  end if;

  insert into public.elite_course_steps (course_id, level_no, level_name, drill_id, sort)
  select cid, s.level_no, s.level_name, d.id, s.sort
  from (values
    (2, 'Technique and coordination', 'Speed: Sprint around the cones',         30),
    (3, 'Acceleration',               'Speed: 15 yard sprint',                  20),
    (3, 'Acceleration',               'Speed: Drop and sprint',                 30),
    (3, 'Acceleration',               'Speed: Drop, shuffle, sprint',           40),
    (3, 'Acceleration',               'Speed: Drop, shuffle, turn and sprint',  50)
  ) as s(level_no, level_name, title, sort)
  join public.elite_drills d on d.title = s.title;

  select count(*) into placed from public.elite_course_steps s join public.elite_drills d on d.id = s.drill_id
   where s.course_id = cid and d.title in ('Speed: Sprint around the cones', 'Speed: 15 yard sprint', 'Speed: Drop and sprint', 'Speed: Drop, shuffle, sprint', 'Speed: Drop, shuffle, turn and sprint');
  if placed <> 5 then
    raise exception 'Speed sprints placed % of 5 drills; a bank title is missing', placed;
  end if;
end $$;
