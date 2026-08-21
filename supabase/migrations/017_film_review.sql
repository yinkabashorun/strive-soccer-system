-- 017: structured film reviews.
-- The coach's monthly breakdown becomes a structured analysis (summary,
-- timestamped key moments, strengths, fixes, next steps) stored as jsonb.
-- coach_notes stays populated (with the summary) for back-compat.

alter table public.elite_film_uploads
  add column if not exists review jsonb;
