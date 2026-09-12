-- =====================================================================
-- Strive Elite - allow "Plyo" as a drill-bank pillar
-- =====================================================================
-- The coach's recorded plyometric warm-ups live in the drill bank under
-- the "Plyo" pillar (every session opens with two, rotated, video
-- attached). 020's pillar check predates that pillar, so extend it.
-- =====================================================================

alter table public.elite_drills drop constraint if exists elite_drills_pillar_check;
alter table public.elite_drills add constraint elite_drills_pillar_check
  check (pillar in ('Ball Mastery','Weak Foot','Passing','Scanning','Decision Making','Confidence','Speed','Plyo'));
