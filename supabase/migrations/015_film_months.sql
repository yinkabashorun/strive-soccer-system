-- =====================================================================
-- Strive Elite — monthly film review
-- =====================================================================
-- Film comes back as a LINK-based monthly review: the player submits one
-- video link per program month (Month 1, Month 2, Month 3…), the coach
-- reviews it and leaves feedback. elite_film_uploads already exists with
-- the right RLS (player inserts/reads own, coach full access); it just
-- needs the month slot.
-- =====================================================================

alter table public.elite_film_uploads
  add column if not exists month int not null default 1;

create index if not exists elite_film_month_idx
  on public.elite_film_uploads(player_id, month);
