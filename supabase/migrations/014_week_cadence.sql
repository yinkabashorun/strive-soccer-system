-- =====================================================================
-- Strive Elite — real-time weekly cadence (America/New_York)
-- =====================================================================
-- Weeks now run Monday→Sunday in Virginia time. Publishing a plan
-- SCHEDULES it (unlocks_at = next Monday morning); a player's first week
-- unlocks immediately so onboarding never dead-ends. The app processes
-- due unlocks on load (lazy, idempotent) — no cron dependency.
--
--  - elite_players.week1_monday: the NY Monday their program started.
--    current_week is now derived from real time, never from click count.
--  - elite_weekly_plans.unlocks_at / notified: schedule + exactly-once
--    "week is ready" notification at UNLOCK time, not publish time.
--  - The 009 publish-time notify trigger is removed (it fired on insert,
--    which would leak "new week ready" before Monday).
-- =====================================================================

alter table public.elite_players
  add column if not exists week1_monday date;

alter table public.elite_weekly_plans
  add column if not exists unlocks_at timestamptz,
  add column if not exists notified boolean not null default true;

-- Existing rows predate scheduling: treat them as already live + notified.
update public.elite_weekly_plans set unlocks_at = created_at where unlocks_at is null;

drop trigger if exists elite_notify_new_week_trg on public.elite_weekly_plans;
drop function if exists public.elite_notify_new_week();

create index if not exists elite_weekly_plans_due_idx
  on public.elite_weekly_plans(notified, unlocks_at);
