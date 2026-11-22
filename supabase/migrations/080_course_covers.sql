-- 080: a cover picture for every course (Nov 22 2026, Coach Yinka: "all of
-- the courses need images"). A course card already showed the still of its
-- first drill clip on our own domain (courseCover, lib/elite/courses.ts);
-- a lesson course, a link course and a course whose clips are hosted
-- elsewhere showed a plain dark card. cover_url is a picture the coach
-- picks, shown first; the drill still stays the fallback.
--
-- Only a path to an image on our own site (public/), never another host,
-- so a card can never pull a picture from somewhere we do not control.

alter table elite_courses add column if not exists cover_url text;

alter table elite_courses drop constraint if exists elite_courses_cover_url_check;
alter table elite_courses add constraint elite_courses_cover_url_check
  check (cover_url is null or cover_url ~ '^/[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*\.(jpg|jpeg|png|webp)$');

-- The first covers (files in public/courses), picked from Strive's own
-- photos and drill footage. The coach changes any of them at /coach/drills.
update elite_courses set cover_url = '/courses/strength.jpg' where slug = 'strength' and cover_url is null;
update elite_courses set cover_url = '/courses/dribbling-transformation.jpg' where slug = 'dribbling-transformation' and cover_url is null;
update elite_courses set cover_url = '/courses/college-recruiting.jpg' where slug = 'college-recruiting' and cover_url is null;
update elite_courses set cover_url = '/courses/academy-recruiting.jpg' where slug = 'academy-recruiting' and cover_url is null;
