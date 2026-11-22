-- =====================================================================
-- Strive Elite - a player's first week is built by one caller at a time
-- =====================================================================
-- Nov 22 2026, the building screen (a member's first week is built the
-- moment they finish the quiz, lib/elite/first-week-actions.ts).
--
-- Two builds of the same first week can now overlap: the member reloads
-- the building screen while the first build is still running, or the
-- hourly builder reaches the same just-onboarded player in the same
-- minute. A build replaces the week's drills (delete, then insert), so two
-- interleaved builds could leave week 1 with every drill twice, and the
-- announcement ledger (066) only protects a week after it is announced.
--
-- This table is the lock, held in the database: one row per player. The
-- builder that inserts the row builds; any other caller sees the conflict
-- and builds nothing. finished_at is stamped when the build ends (built or
-- not), so a later retry may take the row over; a claim left with no
-- finished_at for more than five minutes (a crash, a timeout) may be taken
-- over too, by a conditional update on the started_at it read. The rule
-- is lib/elite/first-week-claim.ts.
--
-- Idempotent: safe to run again. No DROP statements.
-- =====================================================================

create table if not exists public.elite_first_week_builds (
  player_id   uuid primary key references public.elite_players(id) on delete cascade,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);

-- Written only by the server (service role). Coaches can read it.
alter table public.elite_first_week_builds enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'elite_first_week_builds'
      and policyname = 'first week builds: coach read'
  ) then
    create policy "first week builds: coach read" on public.elite_first_week_builds
      for select using (public.elite_is_coach());
  end if;
end
$$;
