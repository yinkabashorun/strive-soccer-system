-- =====================================================================
-- 083: THE WEEKLY CLUB MATCHUP (Nov 24 2026)
-- =====================================================================
-- Every Monday each club is matched with another club. All week both
-- clubs train. After Sunday ends in New York, the club with more training
-- time PER PLAYER wins the week. It needs no field and no coach.
--
-- One table, one row for each club for each week:
--   week_monday  the Monday the week starts on (New York)
--   club_id      the club this row is for
--   opponent_id  the club it plays that week; NULL when the club was
--                there on Monday and no other club was left to play
--   roster       the club's players AT THE MOMENT IT WAS MATCHED. The
--                score counts these players and nobody else, so adding or
--                removing a player mid-week changes nothing; a player who
--                joins mid-week counts from the next Monday.
--   minutes      the club's training minutes that week (gym never counts),
--                written once, when the week is decided
--   players      how many players it was divided by (the stored list)
--   result       'win', 'loss' or 'draw' (equal to the whole minute per
--                player), written once, after Sunday, never worked out
--                again (the server's update only lands on a row with no
--                decided_at)
--   decided_at   when that was
--
-- The key is (week_monday, club_id): a club has one matchup a week, and
-- the hourly run that makes them can run twice and change nothing.
--
-- A club's matchup record is its own: it is read from this table only.
-- The games record (077) and the county ranking are untouched.
--
-- Written by the server only (service role, from the hourly run). Row
-- security is on; the only policy is a coach read. Nobody writes directly.
--
-- Safe to run twice. No DROP. UNTIL THIS IS APPLIED nothing changes: the
-- app reads no matchup, draws no card and writes nothing
-- (lib/elite/club-matchups-server.ts). NOT APPLIED until Coach Yinka's
-- word.
-- =====================================================================

set lock_timeout = '8s';

create table if not exists public.elite_club_matchups (
  week_monday date not null,
  club_id     uuid not null references public.elite_tracker_clubs(id) on delete cascade,
  opponent_id uuid references public.elite_tracker_clubs(id) on delete cascade,
  roster      uuid[] not null default '{}',
  minutes     integer check (minutes is null or minutes >= 0),
  players     smallint check (players is null or players >= 0),
  result      text check (result is null or result in ('win', 'loss', 'draw')),
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  primary key (week_monday, club_id),
  -- a week starts on a Monday
  check (extract(isodow from week_monday) = 1),
  check (opponent_id is null or opponent_id <> club_id),
  -- a result is stored whole (the minutes, the players, the result and
  -- when), and only for a club that had somebody to play
  check ((decided_at is null) = (result is null)),
  check ((decided_at is null) = (minutes is null)),
  check ((decided_at is null) = (players is null)),
  check (result is null or opponent_id is not null)
);

-- the weeks waiting to be decided, for the hourly run
create index if not exists elite_club_matchups_open_idx
  on public.elite_club_matchups (week_monday)
  where decided_at is null and opponent_id is not null;

-- a club's own rows, newest first (its page and its record)
create index if not exists elite_club_matchups_club_idx
  on public.elite_club_matchups (club_id, week_monday desc);

alter table public.elite_club_matchups enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'elite_club_matchups' and policyname = 'elite_club_matchups_coach_read') then
    create policy elite_club_matchups_coach_read on public.elite_club_matchups
      for select using (public.elite_is_coach());
  end if;
end $$;
