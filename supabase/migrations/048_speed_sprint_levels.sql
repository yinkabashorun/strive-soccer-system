-- =====================================================================
-- Strive Elite - Speed course, the first sprint levels
-- =====================================================================
-- Coach Yinka, Oct 27 2026, four phone clips: "Stop & go and 50%, 100%,
-- 25%, and the first and last vids need to be put together as kneel and
-- drive. Stop and go and the % ones are for technique / coordination."
--
-- Three bank drills under the Speed pillar, COURSE DRILLS (opt_in): they
-- show on the Speed course page for every member and never reach a week
-- unless the coach offers one to a player in the slot. Open space, no
-- wall, no goal. The two kneel-and-drive takes were joined into one clip.
-- Course: Level 2 "Technique and coordination" (Stop and go; 50%, 100%,
-- 25%) in the order he listed them, Level 3 "Acceleration" (Kneel and
-- drive; he gave no level for it, the name is mine, it moves in the
-- editor). No tags (none given). how / reps / cues written from the
-- footage; he edits at /coach/drills. Idempotent: a drill that already
-- exists by title is left alone; the steps are seeded only while Level 2
-- is absent; the block refuses a partial result.
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
    ('Speed', 'Speed: Stop and go',
     'Sprint to the cone, stop dead on it with your weight low and both feet under you, then go again straight away. Sprint, stop, go.',
     '6 reps, walk back between each', 5,
     'Chop your steps into the stop. Chest over your knees, not behind them. The first step out is a push, not a reach.',
     100, 'https://thestriveapp.com/drills/speed-stop-and-go.mp4'),
    ('Speed', 'Speed: 50%, 100%, 25%',
     'Three runs over the same distance. The first at half speed, the second flat out, the third at a quarter speed. Walk back after each run.',
     '3 rounds of the three runs, full rest between rounds', 6,
     'Same arm action at every speed. Tall through the hips. The slow runs are where you fix the technique, the fast one is where you test it.',
     110, 'https://thestriveapp.com/drills/speed-50-100-25.mp4'),
    ('Speed', 'Speed: Kneel and drive',
     'Start on one knee at the cone, back knee down, front foot flat. Drive out of the kneel straight into a sprint. Both sides.',
     '4 each side, walk back between each', 5,
     'Push the ground away with the front foot. Stay low for the first three steps. The arms drive the legs.',
     120, 'https://thestriveapp.com/drills/speed-kneel-and-drive.mp4')
  ) as v(pillar, title, how, reps, minutes, cues, sort, video_url)
  where not exists (select 1 from public.elite_drills d where d.title = v.title);

  if exists (select 1 from public.elite_course_steps where course_id = cid and level_no = 2) then
    return;
  end if;

  insert into public.elite_course_steps (course_id, level_no, level_name, drill_id, sort)
  select cid, s.level_no, s.level_name, d.id, s.sort
  from (values
    (2, 'Technique and coordination', 'Speed: Stop and go',      10),
    (2, 'Technique and coordination', 'Speed: 50%, 100%, 25%',   20),
    (3, 'Acceleration',               'Speed: Kneel and drive',  10)
  ) as s(level_no, level_name, title, sort)
  join public.elite_drills d on d.title = s.title;

  select count(*) into placed from public.elite_course_steps where course_id = cid and level_no in (2, 3);
  if placed <> 3 then
    raise exception 'Speed sprint levels placed % of 3 drills; a bank title is missing', placed;
  end if;
end $$;
