-- =====================================================================
-- Strive Elite - LINK COURSES, and the Dribbling Transformation course
-- =====================================================================
-- Coach Yinka, Nov 4 2026: the Dribbling course already exists as its own
-- site (https://totalballmastery.netlify.app/). "When they click course
-- it should take them there." So a course can be a LINK: a card on the
-- Courses tab that opens a page outside the app. Same table, same coach
-- editor, same on/off switch as every other course; no steps.
--
-- elite_courses.kind gains 'link'. elite_courses.external_url holds the
-- address. A check keeps the two honest: a link course has an https
-- address, and nothing else carries one. The app never builds a link
-- from anything but this column, and lib/elite/courses.ts refuses any
-- address that is not https.
--
-- The page it points at is outside the app, so it is not gated by
-- membership: anyone holding the address can open it. That is a property
-- of the page's host, not of this table.
-- =====================================================================

alter table public.elite_courses add column if not exists external_url text;

alter table public.elite_courses drop constraint if exists elite_courses_kind_check;
alter table public.elite_courses add constraint elite_courses_kind_check
  check (kind in ('drill', 'lesson', 'link'));

alter table public.elite_courses drop constraint if exists elite_courses_link_shape;
alter table public.elite_courses add constraint elite_courses_link_shape
  check (
    (kind = 'link' and external_url ~* '^https://[^[:space:]]+$')
    or (kind <> 'link' and external_url is null)
  );

-- The course, ON, idempotent by slug. Sorted after the courses already
-- live (Keep It Up 10 ... General Nutrition Guide 70).
insert into public.elite_courses (slug, name, subtitle, intro, kind, external_url, active, sort)
values (
  'dribbling-transformation',
  'Dribbling Transformation',
  'Most dangerous dribbler on the team.',
  null,
  'link',
  'https://totalballmastery.netlify.app/',
  true,
  15
)
on conflict (slug) do nothing;
