-- =====================================================================
-- Strive Elite - Speed course, Level 4 "Top speed"
-- =====================================================================
-- Coach Yinka, Oct 27 2026, two phone clips: "Both are zigzag the first
-- is sprint and back pedal the second is just a straight sprint. These
-- are for top speed."
--
-- Two bank drills under the Speed pillar, COURSE DRILLS (opt_in), open
-- space, no wall, no goal, muted. Course: Level 4 "Top speed" (his
-- words), in the order he listed. No tags (none given). how / reps /
-- cues written from the footage; he edits at /coach/drills. Same
-- idempotent shape as 048.
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
    ('Speed', 'Speed: Zigzag sprint and backpedal',
     'Cones in a zigzag. Sprint to the first cone, backpedal to the next, sprint to the one after. Sprint, backpedal, sprint through the whole line.',
     '4 runs through the line, walk back between each', 5,
     'Backpedal low with short quick steps, never on your heels. Plant hard to switch direction. Full speed on every sprint, not a jog between cones.',
     130, 'https://thestriveapp.com/drills/speed-zigzag-sprint-and-backpedal.mp4'),
    ('Speed', 'Speed: Zigzag sprint',
     'Cones in a zigzag. Sprint through the whole line, cutting at each cone, and run through the last one at full speed.',
     '4 runs through the line, full rest between each', 5,
     'Cut off the outside foot and push through it. Stay low into every cone, tall out of it. Finish past the last cone, not at it.',
     140, 'https://thestriveapp.com/drills/speed-zigzag-sprint.mp4')
  ) as v(pillar, title, how, reps, minutes, cues, sort, video_url)
  where not exists (select 1 from public.elite_drills d where d.title = v.title);

  if exists (select 1 from public.elite_course_steps where course_id = cid and level_no = 4) then
    return;
  end if;

  insert into public.elite_course_steps (course_id, level_no, level_name, drill_id, sort)
  select cid, 4, 'Top speed', d.id, s.sort
  from (values
    ('Speed: Zigzag sprint and backpedal', 10),
    ('Speed: Zigzag sprint',               20)
  ) as s(title, sort)
  join public.elite_drills d on d.title = s.title;

  select count(*) into placed from public.elite_course_steps where course_id = cid and level_no = 4;
  if placed <> 2 then
    raise exception 'Speed Top speed level placed % of 2 drills; a bank title is missing', placed;
  end if;
end $$;
