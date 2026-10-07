-- =====================================================================
-- Strive Elite - allow "Strengthening" as a drill-bank pillar
-- =====================================================================
-- Core / hip / glute / groin strengthening and injury-prevention work
-- lives in the drill bank under the "Strengthening" pillar. These are
-- FINISHERS: the builder places at most one per session, always last,
-- and only when the player needs it (coach note, call note or check-in
-- mentions an injury, rehab, prevention, core, hip or strength work) or
-- the AI judges a couple of sessions that week benefit from one. Not a
-- rated progress metric. Filmed-only rule (031 trigger) applies as to
-- every other drill. 023's pillar check predates this pillar, so extend it.
-- =====================================================================

alter table public.elite_drills drop constraint if exists elite_drills_pillar_check;
alter table public.elite_drills add constraint elite_drills_pillar_check
  check (pillar in ('Ball Mastery','Weak Foot','Passing','Scanning','Decision Making','Confidence','Speed','Plyo','Strengthening'));
