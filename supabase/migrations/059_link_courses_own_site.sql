-- =====================================================================
-- Strive Elite - a link course can point at a path on our own site
-- =====================================================================
-- Coach Yinka, Nov 5 2026 (sent the Dribbling Transformation site as a
-- zip: "Behind login"): the course site is hosted by the app itself, in
-- content/courses/dribbling-transformation, and served at
-- /learn/dribbling-transformation/index.html only to a signed-in coach or
-- an active member (app/learn/[slug]/[[...path]]/route.ts). 058 allowed
-- only https addresses for a link course; this widens the shape check to
-- also allow a path on our own domain that starts with a single slash.
-- No other kind carries an address.
--
-- The course row is then pointed at the hosted copy. The Netlify address
-- it held before is public to anyone holding it; the hosted copy is not.
-- =====================================================================

alter table public.elite_courses drop constraint if exists elite_courses_link_shape;
alter table public.elite_courses add constraint elite_courses_link_shape
  check (
    (kind = 'link' and (external_url ~* '^https://[^[:space:]]+$' or external_url ~ '^/[^/\\[:space:]][^\\[:space:]]*$'))
    or (kind <> 'link' and external_url is null)
  );

update public.elite_courses
   set external_url = '/learn/dribbling-transformation/index.html'
 where slug = 'dribbling-transformation' and kind = 'link';
