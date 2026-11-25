-- =====================================================================
-- 089: THE TRAINING CLOCK (Nov 25 2026)
-- =====================================================================
-- Coach Yinka: "How could we keep it so people can't just lie. Maybe a
-- pic when they arrive then when they dip?" In the free app a player now
-- takes a photo to start training and a photo to finish; the time between
-- the two is the time trained (lib/elite/training-clock.ts).
--
-- 1) elite_training_logs.proof: how an entry's time is known.
--      before   logged before the clock existed (every row there is
--               today). Still counts everywhere: history is not rewritten.
--      typed    the player said how long. Their own week only: it counts
--               on no board, club, matchup, level or teammate count.
--      clock    the time between a start photo and a finish photo.
--      session  a finished Strive Pro session, timed drill by drill.
--    The default is 'before' on purpose: until the new server is live the
--    old one keeps writing rows without this column, and those must keep
--    counting exactly as they do today. The new server names the proof on
--    every row it writes (a test holds that).
--
-- 2) A clock entry carries when it started and ended and its start photo
--    (the finish photo is the post's own photo_path). Held here: a clock
--    entry has both times in order, and never counts more than 150
--    minutes (his number), whatever the server is told.
--
-- 3) elite_training_clocks: the start of a running clock, as the server
--    heard of it. One row per player. It is how the server knows how much
--    time really went by, so changing a phone's clock between the two
--    photos gains nothing. Written by the server only; row security on,
--    one coach read policy.
--
-- Additive. No row is changed (the new column takes its default), nothing
-- is dropped. Safe to run twice. UNTIL THIS IS APPLIED the new server
-- cannot read or write an entry, so apply it BEFORE the code goes live.
-- NOT APPLIED until Coach Yinka's word.
-- =====================================================================

set lock_timeout = '8s';

alter table public.elite_training_logs
  add column if not exists proof text not null default 'before',
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists start_photo_path text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'elite_training_logs_proof_check') then
    alter table public.elite_training_logs
      add constraint elite_training_logs_proof_check
      check (proof in ('before', 'typed', 'clock', 'session'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'elite_training_logs_clock_check') then
    alter table public.elite_training_logs
      add constraint elite_training_logs_clock_check
      check (
        proof <> 'clock'
        or (started_at is not null and ended_at is not null and ended_at > started_at and minutes <= 150)
      );
  end if;
end $$;

-- one player's timed sessions in order, for the "already timed for then" check
create index if not exists elite_training_logs_clock_idx
  on public.elite_training_logs (profile_id, started_at)
  where proof = 'clock';

create table if not exists public.elite_training_clocks (
  profile_id       uuid primary key references public.elite_trackers(profile_id) on delete cascade,
  phone_started_ms bigint not null check (phone_started_ms > 0),
  ago_seconds      integer not null check (ago_seconds >= 0),
  seen_at          timestamptz not null default now()
);

alter table public.elite_training_clocks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'elite_training_clocks' and policyname = 'elite_training_clocks_coach_read') then
    create policy elite_training_clocks_coach_read on public.elite_training_clocks
      for select using (public.elite_is_coach());
  end if;
end $$;
