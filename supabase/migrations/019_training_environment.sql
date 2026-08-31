-- =====================================================================
-- Strive Elite - training environment (wall / goal access)
-- =====================================================================
-- Asked at onboarding so every generated plan only prescribes equipment
-- the player actually has. null = not asked yet (pre-019 players); the
-- AI treats unknown as "no wall, no goal" so drills always make sense.
--
-- DO NOT run automatically - paste into the Supabase SQL editor.
-- =====================================================================

alter table public.elite_players
  add column if not exists has_wall boolean,
  add column if not exists has_goal boolean;
