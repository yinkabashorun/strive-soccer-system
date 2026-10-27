-- =====================================================================
-- Strive Elite - Speed course, Level 5 "Explosiveness"
-- =====================================================================
-- Coach Yinka, Oct 27 2026, four phone clips: "these are for
-- explosiveness, the second should be trimmed its long jumps, then the
-- last 2 are side bounds put them in the same video it shows diff
-- directions."
--   IMG_7416: push-up position at the cone, up and sprint.
--   IMG_7417: standing long jumps, trimmed to the jumps (a hand covered
--             the lens at the start, he stands still at the end).
--   IMG_7419 + IMG_7420: side bounds down the line, away then back,
--             joined into one clip.
-- Three bank drills under the Speed pillar, COURSE DRILLS (opt_in),
-- open space, no wall, no goal, muted. Level 5 "Explosiveness" (his
-- word), in the order he sent them. No tags. how / reps / cues from
-- the footage; he edits at /coach/drills. Same idempotent shape as 048.
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
    ('Speed', 'Speed: Push-up start sprint',
     'Start in a push-up position with your hands at the cone. Push up, get your feet under you and sprint straight out. Walk back and reset.',
     '6 reps, full rest between each', 5,
     'Hands and feet move together, no standing up first. Stay low out of the start. The first three steps are pushes into the ground.',
     200, 'https://thestriveapp.com/drills/speed-push-up-start-sprint.mp4'),
    ('Speed', 'Speed: Long jumps',
     'Standing long jumps, one after another. Arms up, swing them down and back, then jump as far as you can and land in a squat. Hold the landing, then go again.',
     '3 sets of 5 jumps, full rest between sets', 5,
     'Arms drive the jump. Land soft on the whole foot, knees over the toes, and hold it. Distance comes from the push, not the reach.',
     210, 'https://thestriveapp.com/drills/speed-long-jumps.mp4'),
    ('Speed', 'Speed: Side bounds',
     'Bound sideways off one leg and land on the other, down the line and back. Push off the outside leg every time.',
     '3 sets of 6 bounds each way, full rest between sets', 5,
     'Push off the outside edge of the foot. Land soft and hold it for a beat before the next bound. Chest up, hips low.',
     220, 'https://thestriveapp.com/drills/speed-side-bounds.mp4')
  ) as v(pillar, title, how, reps, minutes, cues, sort, video_url)
  where not exists (select 1 from public.elite_drills d where d.title = v.title);

  if exists (select 1 from public.elite_course_steps where course_id = cid and level_no = 5) then
    return;
  end if;

  insert into public.elite_course_steps (course_id, level_no, level_name, drill_id, sort)
  select cid, 5, 'Explosiveness', d.id, s.sort
  from (values
    ('Speed: Push-up start sprint', 10),
    ('Speed: Long jumps',           20),
    ('Speed: Side bounds',          30)
  ) as s(title, sort)
  join public.elite_drills d on d.title = s.title;

  select count(*) into placed from public.elite_course_steps where course_id = cid and level_no = 5;
  if placed <> 3 then
    raise exception 'Speed Explosiveness level placed % of 3 drills; a bank title is missing', placed;
  end if;
end $$;
