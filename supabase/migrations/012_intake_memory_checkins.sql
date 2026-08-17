-- =====================================================================
-- Strive Elite — player intake, AI memory, and weekly check-ins
-- =====================================================================
-- Adds the data that lets us (a) onboard a player with a full intake
-- form, (b) give the AI real per-player memory (intake + a coach memory
-- note), and (c) run a structured weekly check-in loop.
--
-- Membership "paused" is represented with the existing 'canceled' status
-- (no enum change needed) — the UI labels it "Paused".
--
-- DO NOT run automatically — apply once the connector is unblocked, or
-- paste into the Supabase SQL editor.
-- =====================================================================

-- 1) intake + memory columns on elite_players -------------------------
alter table public.elite_players
  add column if not exists club            text not null default '',
  add column if not exists dominant_foot   text not null default '',
  add column if not exists self_assessment jsonb not null default '{}'::jsonb,
  add column if not exists coach_memory    text not null default '',
  add column if not exists onboarded_at    timestamptz;

-- 2) weekly check-ins --------------------------------------------------
create table if not exists public.elite_checkins (
  id                uuid primary key default gen_random_uuid(),
  player_id         uuid not null references public.elite_players(id) on delete cascade,
  week              int  not null default 1,
  rating            int  check (rating between 1 and 5),   -- how the week went
  energy            int  check (energy between 1 and 5),   -- energy / freshness
  went_well         text not null default '',
  struggled         text not null default '',
  note              text not null default '',
  coach_feedback    text not null default '',
  coach_feedback_at timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists elite_checkins_player_idx
  on public.elite_checkins(player_id, created_at desc);

alter table public.elite_checkins enable row level security;

-- player reads their own + their coach; player inserts their own;
-- coach (or admin) has full access (to write feedback).
drop policy if exists elite_checkins_read on public.elite_checkins;
create policy elite_checkins_read on public.elite_checkins
  for select using (public.elite_is_coach() or public.elite_owns_player(player_id));

drop policy if exists elite_checkins_player_insert on public.elite_checkins;
create policy elite_checkins_player_insert on public.elite_checkins
  for insert with check (public.elite_owns_player(player_id));

drop policy if exists elite_checkins_coach_write on public.elite_checkins;
create policy elite_checkins_coach_write on public.elite_checkins
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());

-- 3) notify the coach's roster is unaffected; check-in feedback fires a
--    player-facing notification (inserted from application code).
