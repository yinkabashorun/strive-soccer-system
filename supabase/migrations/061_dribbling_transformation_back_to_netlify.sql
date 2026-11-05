-- =====================================================================
-- Strive Elite - Dribbling Transformation opens the original course site
-- =====================================================================
-- Coach Yinka, Nov 5 2026: "i prefer the old one. so send it to the
-- netlify, but before they land have a page that shares the password".
-- The course row goes back to a LINK course pointing at the original
-- site. Tapping the card opens its page in the app (LinkCourseGate),
-- which shows the course's intro lines and then the button to the site.
--
-- The password is course CONTENT, written into the intro in the database
-- by hand (the repository is public, so it is deliberately not in this
-- file). This statement only sets a placeholder intro when none is set.
--
-- The 27 in-app pages from 060 are kept on the course row, untouched and
-- unused while it is a link course. Switching the kind back to 'lesson'
-- and clearing the address shows them again.
-- =====================================================================

update public.elite_courses
   set kind = 'link',
       external_url = 'https://totalballmastery.netlify.app/',
       intro = coalesce(nullif(intro, ''), 'Open the course below.')
 where slug = 'dribbling-transformation';
