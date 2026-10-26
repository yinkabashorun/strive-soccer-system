-- =====================================================================
-- Strive Elite - the Shooting pillar and the "needs a goal" flag
-- =====================================================================
-- Coach Yinka, Oct 25 2026: the first course on the roadmap is shooting.
-- The bank had no Shooting pillar and no way to say a drill needs a goal
-- (players have had has_goal since 019; drills did not). Step 2 of the
-- course roadmap, so his first shooting clips have a home the day they
-- arrive.
--
-- "Shooting" joins the allowed pillars the way Strengthening did (032).
-- It is NOT a rated progress metric. A Shooting drill is a skill drill
-- for the builder (it can enter a week), gated by the goal rule in
-- lib/elite/bank-conform.ts drillFitsPlayer: a drill flagged needs_goal
-- fits only a player whose profile says they HAVE a goal, exactly like
-- needs_wall and has_wall. Whether a shooting drill is a course drill
-- (slot only, offered per player, 040) is the drill's own opt_in tick,
-- unchanged. Filmed-only rule (031) applies as to every drill.
-- =====================================================================

alter table public.elite_drills
  add column if not exists needs_goal boolean not null default false;

alter table public.elite_drills drop constraint if exists elite_drills_pillar_check;
alter table public.elite_drills add constraint elite_drills_pillar_check
  check (pillar in ('Ball Mastery','Weak Foot','Passing','Scanning','Decision Making','Confidence','Speed','Plyo','Strengthening','Shooting'));
