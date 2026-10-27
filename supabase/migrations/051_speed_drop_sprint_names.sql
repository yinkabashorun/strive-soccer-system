-- =====================================================================
-- Strive Elite - Speed course, the drop sprints named by Coach Yinka
-- =====================================================================
-- Coach Yinka, Oct 27 2026, correcting the 050 read: "The first is
-- shuffle in place, then it's shuffle forward back, then sideways."
-- The three clips in the order he sent them (IMG_7410, 7411, 7412):
--   Drop, shuffle in place, sprint
--   Drop, shuffle forward and back, sprint
--   Drop, shuffle sideways, sprint
-- Titles, how, cues and file names follow; the Acceleration level order
-- follows his. Idempotent: each update keys on the old title and is a
-- no-op once renamed.
-- =====================================================================

update public.elite_drills set
  title = 'Speed: Drop, shuffle in place, sprint',
  how = 'Stand tall with both hands above your head. Drop the hands and the hips into a low stance, shuffle your feet fast on the spot, then sprint straight out of it.',
  cues = 'The drop is the trigger. Feet fast and light on the spot, hips low. The first step goes the moment you leave the shuffle, no pause.',
  video_url = 'https://thestriveapp.com/drills/speed-drop-shuffle-in-place-sprint.mp4'
where title = 'Speed: Drop and sprint';

update public.elite_drills set
  title = 'Speed: Drop, shuffle forward and back, sprint',
  how = 'Hands above your head. Drop the hands and the hips, shuffle a couple of steps forward and back, then sprint.',
  cues = 'Stay low through the shuffle, short steps forward and back. Plant the back foot and push into the sprint. Head up before you go.',
  video_url = 'https://thestriveapp.com/drills/speed-drop-shuffle-forward-back-sprint.mp4'
where title = 'Speed: Drop, shuffle, turn and sprint';

update public.elite_drills set
  title = 'Speed: Drop, shuffle sideways, sprint',
  how = 'Hands above your head. Drop the hands and the hips, shuffle two or three steps to one side, then sprint straight forward. Switch the side each rep.',
  cues = 'Stay low through the shuffle, feet never cross. Plant the outside foot and push into the sprint. Both directions, same speed.',
  video_url = 'https://thestriveapp.com/drills/speed-drop-shuffle-sideways-sprint.mp4'
where title = 'Speed: Drop, shuffle, sprint';

-- Acceleration order: Kneel and drive 10, 15 yard sprint 20, in place 30,
-- forward and back 40, sideways 50.
update public.elite_course_steps s set sort = v.sort
from (values
  ('Speed: Drop, shuffle in place, sprint',          30),
  ('Speed: Drop, shuffle forward and back, sprint',  40),
  ('Speed: Drop, shuffle sideways, sprint',          50)
) as v(title, sort)
join public.elite_drills d on d.title = v.title
join public.elite_courses c on c.slug = 'speed'
where s.drill_id = d.id and s.course_id = c.id and s.level_no = 3;
