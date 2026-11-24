-- =====================================================================
-- 088: NOTICES (Nov 24 2026, Coach Yinka: "make sure we have no more
-- nonsense notifications. Remake them to match the app structure and also
-- the app vibe and standard.")
-- =====================================================================
-- Every notification is now one notice from one catalogue
-- (lib/elite/notices.ts), sent by one sender (lib/elite/notify.ts). This
-- file gives the database what that needs:
--
-- 1) elite_notifications.url          where a bell row opens: a path on our
--                                     own site, never another address. Old
--                                     rows keep NULL and stay plain text.
-- 2) elite_notifications.dedupe_key   the notice's key ("new_week:8",
--                                     "earned:First Session",
--                                     "film_room:<id>"), with ONE ROW PER
--                                     PLAYER PER KEY held by a unique
--                                     index. The insert is the claim: a
--                                     repeat of the same notice is refused
--                                     by the database, whatever code sends
--                                     it. (Production holds 95 copies of
--                                     "Week 8 is ready" for one profile and
--                                     84 of "Week 12 is ready" for another,
--                                     left by a since-fixed bug.) Old rows
--                                     keep NULL keys, so the index builds
--                                     cleanly over those repeats; nothing
--                                     is deleted, and the bell shows them
--                                     once (lib/elite/bell.ts).
-- 3) elite_profiles.notify_off        the topics a person turned off in
--                                     Account, Notifications: any of
--                                     'week', 'coach', 'friends', 'clubs'.
--                                     Empty means everything is on.
-- 4) elite_players.reminder_hour      the hour (New York, 5 to 21) a member
--                                     chose for the daily reminder ("When
--                                     do you usually train?"). NULL: the
--                                     hour they are learned to train at is
--                                     used (lib/elite/reminders.ts).
-- 5) elite_players.reminders_paused_at  when the "Reminders are paused"
--                                     notice was sent, after five reminders
--                                     in a row with no drill ticked off.
--                                     Reminders stay off until a drill is
--                                     ticked off after this time. It has to
--                                     be stored: the ledger of reminder
--                                     days (elite_training_reminders) is
--                                     cleaned after 60 days, and the pause
--                                     must outlive it.
--
-- WHO WRITES WHAT. No new policy and no change to a guard:
--   - elite_profiles has had no self-update policy since 008 (a browser
--     writes nothing there); notify_off is written by the server with the
--     service role, for the signed-in person's own row only
--     (lib/elite/notice-prefs-server.ts).
--   - elite_players has only the coach write policy (005, 013, 055); a
--     member's own reminder_hour is written the same way, by the server
--     after it has checked who is signed in. The 008 privilege guard
--     (elite_guard_player_privilege) lets the service role through and
--     names neither new column, so it is unchanged.
--   - the bell rows are written by the server (service role); the existing
--     policies on elite_notifications are unchanged.
--
-- THE CODE RUNS WITH OR WITHOUT THIS FILE, in either order: an insert the
-- database refuses for a column it does not have falls back to the row as
-- it always was, a choice or an hour that cannot be read is "nothing
-- turned off" and "no hour chosen", and without reminders_paused_at the
-- count of unanswered reminders holds the pause.
--
-- Safe to run twice. No DROP. No existing row is changed. Each statement
-- can be run on its own.
-- =====================================================================

set lock_timeout = '8s';

-- 1) and 2) the bell row: where it opens, and its key
alter table public.elite_notifications add column if not exists url text;
alter table public.elite_notifications add column if not exists dedupe_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'elite_notifications_url_own_path'
      and conrelid = 'public.elite_notifications'::regclass
  ) then
    -- the shape lib/elite/notices.ts cleanNoticePath allows: one leading
    -- slash, no "//", no scheme, no backslash
    alter table public.elite_notifications add constraint elite_notifications_url_own_path
      check (
        url is null or (
          url ~ '^/[A-Za-z0-9._~/?#=&%+@-]*$'
          and position('//' in url) = 0
          and char_length(url) <= 300
        )
      );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'elite_notifications_dedupe_key_shape'
      and conrelid = 'public.elite_notifications'::regclass
  ) then
    alter table public.elite_notifications add constraint elite_notifications_dedupe_key_shape
      check (dedupe_key is null or char_length(dedupe_key) between 1 and 120);
  end if;
end $$;

-- one row per player per key, ever
create unique index if not exists elite_notifications_player_key
  on public.elite_notifications (player_id, dedupe_key)
  where dedupe_key is not null;

-- 3) the topics a person turned off
alter table public.elite_profiles
  add column if not exists notify_off text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'elite_profiles_notify_off_topics'
      and conrelid = 'public.elite_profiles'::regclass
  ) then
    alter table public.elite_profiles add constraint elite_profiles_notify_off_topics
      check (notify_off <@ array['week', 'coach', 'friends', 'clubs']::text[]);
  end if;
end $$;

-- 4) and 5) the reminder: the member's own hour, and the pause
alter table public.elite_players add column if not exists reminder_hour smallint;
alter table public.elite_players add column if not exists reminders_paused_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'elite_players_reminder_hour_range'
      and conrelid = 'public.elite_players'::regclass
  ) then
    alter table public.elite_players add constraint elite_players_reminder_hour_range
      check (reminder_hour is null or reminder_hour between 5 and 21);
  end if;
end $$;
