-- =====================================================================
-- 090: THE DOOR, AND CHAMPS OF THE WEEK (Nov 26 2026)
-- =====================================================================
-- Coach Yinka, on what to sharpen before the App Store: "yes 1 is great"
-- (the short road in), yes to "clubs at the door", and on a club winning
-- its week: "YES but your club won the week need to be hype like. (CLUB
-- NAME IS STRIVE CHAMPS OF THE WEEK)".
--
-- 1) elite_trackers.quiz_later_at: THE DOOR (lib/elite/free-door.ts).
--    A new free account in the iPhone app is asked once, right after its
--    photo, "Have a code from a teammate or a club?". A real code sends
--    the teammate a friend request (072) or asks the club's captain (073),
--    and the player goes straight to the free app: no quiz, no offer, no
--    week set-up. This column is the mark that says so. It is written by
--    the server only, in the same call that accepted the code
--    (lib/elite/free-door-server.ts); no other call sets it. The quiz and
--    the offer then wait behind the one upgrade card on Week.
--    Null for everyone else, which is every account there is today.
--
-- 2) elite_champs_notices: the lock that makes "once" true for the one
--    notification a winning club's players get (lib/elite/notices.ts
--    clubChampsNotice), the same claim-first pattern as
--    elite_week_announcements (066), elite_free_notices (078) and
--    elite_plan_notices (087). Before the notice is sent to a player the
--    server inserts (week_monday, club_id, profile_id) here; only the
--    caller whose insert succeeds may send. A second run that hour, a
--    retry, or a later hour hits the key and sends nothing. A table that
--    cannot be written sends nothing either.
--    Written by the server only (service role). Row security is on; the
--    only policy is a coach read.
--
-- Additive. No row is changed, nothing is dropped. Safe to run twice.
-- UNTIL THIS IS APPLIED: a code at the door still asks (the friend
-- request, the club request) and nobody skips the quiz; no champs
-- notification is sent at all (the gold mark in the app needs nothing
-- from here: it is read from the matchup's own stored result, 083).
-- NOT APPLIED until Coach Yinka's word.
-- =====================================================================

set lock_timeout = '8s';

alter table public.elite_trackers
  add column if not exists quiz_later_at timestamptz;

create table if not exists public.elite_champs_notices (
  week_monday date not null,
  club_id     uuid not null references public.elite_tracker_clubs(id) on delete cascade,
  profile_id  uuid not null references public.elite_profiles(id) on delete cascade,
  sent_at     timestamptz not null default now(),
  primary key (week_monday, club_id, profile_id),
  check (extract(isodow from week_monday) = 1)
);

alter table public.elite_champs_notices enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'elite_champs_notices' and policyname = 'elite_champs_notices_coach_read') then
    create policy elite_champs_notices_coach_read on public.elite_champs_notices
      for select using (public.elite_is_coach());
  end if;
end $$;
