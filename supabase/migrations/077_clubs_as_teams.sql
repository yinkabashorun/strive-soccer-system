-- =====================================================================
-- 077: CLUBS AS TEAMS (Nov 22 2026)
-- =====================================================================
-- Coach Yinka: "make your team and hold your spot for the biggest strive
-- events and plan pickup games vs other clubs in your area". The owner's
-- rules for how: "the whole point of the free version is to work at
-- scale", so nothing here waits on a Strive coach or a Strive event to
-- work; and the liability is carried by the way it is built, the way
-- Strava and Meetup do it, plus the Terms:
--
--   - CLOSED GROUPS ONLY. A club training session is seen by that club's
--     members; a game is club against club and seen by the two clubs'
--     members. Nobody else can see or join either. No public games.
--   - NOT THE ORGANIZER. Every session and game is organized by a club,
--     and says so. Strive does not run, supervise or insure them. A
--     captain accepts that once before planning anything; a player
--     accepts once before their first "I'm in". Both are recorded below.
--   - No messaging between clubs, no direct messages at all. A session or
--     game can be reported into the coach queue so a coach CAN act, but
--     nothing waits on a coach: results confirm themselves.
--
-- What it adds:
--   1. A club's county (a fixed list in code, lib/elite/club-teams.ts)
--      and "Open to games", off until its captain (or, for a club a coach
--      made, a coach) turns it on.
--   2. Plans, captain only: club training (members only), or a game
--      against another club, which that club's captain accepts or passes.
--      A typed place: a public field or park, never a home (the server
--      refuses anything that looks like a street address).
--   3. "I'm in" on a session or a game.
--   4. A game's result: either captain enters the score after the start;
--      the other captain confirms it or says it is not right. No answer in
--      24 hours counts as confirmed. Not right: the game counts on neither
--      record.
--   5. Strive events (an optional extra a coach makes): a captain enters
--      the club with a roster; each player says "I'm in", which accepts the
--      event's waiver (recorded); a coach marks the entry paid.
--   6. Trained together: a player tags club teammates on a post about
--      training already done; each taps to add the same time to their week.
--
-- Every table is written by the server only (service role, after it has
-- checked who is asking). Row security is on everywhere; the only
-- policies are coach reads, the same as 069. Nobody writes directly.
--
-- Written so each statement can be run on its own, in this order. No
-- DROP of anything that holds data. Safe to run twice. NOT APPLIED until
-- Coach Yinka's word.
-- =====================================================================

set lock_timeout = '8s';

-- 1) A club's county and its switch. The county is an id from the list in
--    lib/elite/club-teams.ts ("va-prince-william", "md-baltimore-city",
--    "dc-washington"); the shape is held here, the list in code. A club
--    cannot be open to games without a county.
alter table public.elite_tracker_clubs
  add column if not exists county text,
  add column if not exists open_to_games boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'elite_tracker_clubs_county_shape') then
    alter table public.elite_tracker_clubs
      add constraint elite_tracker_clubs_county_shape
      check (county is null or county ~ '^(dc|md|va)-[a-z0-9-]{2,40}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'elite_tracker_clubs_open_needs_county') then
    alter table public.elite_tracker_clubs
      add constraint elite_tracker_clubs_open_needs_county
      check (not open_to_games or county is not null);
  end if;
end $$;

create index if not exists elite_tracker_clubs_open_county_idx
  on public.elite_tracker_clubs (county)
  where open_to_games and archived_at is null;

-- 2) Plans: a club's training session, or a game between two clubs.
--    club_id is the club that organized it; opponent_id is the other club
--    of a game (null for training). status:
--      pending   a game sent, waiting on the other captain
--      on        on the calendar of the club(s) involved
--      passed    the other captain said no
--      cancelled a captain or a coach called it off
--    place is the typed name of a public field or park (60 letters; the
--    server refuses a street address, a link, or a run of digits).
--    The result of a game: the club that entered the score, the two
--    scores, and the other captain's answer ('confirmed' or 'disputed').
--    No answer for 24 hours after entry counts as confirmed, worked out
--    when it is read (lib/elite/club-teams.ts resultState): no job needed.
create table if not exists public.elite_club_plans (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('training', 'game')),
  club_id          uuid not null references public.elite_tracker_clubs(id) on delete cascade,
  opponent_id      uuid references public.elite_tracker_clubs(id) on delete cascade,
  title            text check (title is null or char_length(title) between 1 and 40),
  starts_at        timestamptz not null,
  minutes          smallint not null check (minutes between 15 and 240),
  place            text not null check (char_length(place) between 2 and 60),
  status           text not null check (status in ('pending', 'on', 'passed', 'cancelled')),
  created_by       uuid references public.elite_trackers(profile_id) on delete set null,
  created_at       timestamptz not null default now(),
  answered_by      uuid references public.elite_trackers(profile_id) on delete set null,
  answered_at      timestamptz,
  cancelled_by     uuid references public.elite_profiles(id) on delete set null,
  cancelled_at     timestamptz,
  score_by_club    uuid references public.elite_tracker_clubs(id) on delete set null,
  score_club       smallint check (score_club is null or score_club between 0 and 99),
  score_opponent   smallint check (score_opponent is null or score_opponent between 0 and 99),
  score_entered_by uuid references public.elite_trackers(profile_id) on delete set null,
  score_entered_at timestamptz,
  score_answer     text check (score_answer is null or score_answer in ('confirmed', 'disputed')),
  score_answered_at timestamptz,
  check ((kind = 'training') = (opponent_id is null)),
  check (opponent_id is null or opponent_id <> club_id),
  check (kind = 'game' or status in ('on', 'cancelled')),
  check (kind = 'game' or score_entered_at is null),
  check ((score_entered_at is null) = (score_club is null) and (score_club is null) = (score_opponent is null))
);

create index if not exists elite_club_plans_club_idx on public.elite_club_plans (club_id, starts_at);
create index if not exists elite_club_plans_opponent_idx on public.elite_club_plans (opponent_id, starts_at);

alter table public.elite_club_plans enable row level security;

-- A club has 3 game requests waiting on other captains at most (one lock
-- per club), the same number as lib/elite/club-teams.ts PENDING_GAMES_MAX.
create or replace function public.elite_club_plans_pending_cap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind <> 'game' or new.status <> 'pending' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('club-games:' || new.club_id::text));
  if (select count(*) from public.elite_club_plans
      where club_id = new.club_id and kind = 'game' and status = 'pending') >= 3 then
    raise exception 'games_pending_full';
  end if;
  return new;
end $$;

drop trigger if exists elite_club_plans_pending_cap_trg on public.elite_club_plans;
create trigger elite_club_plans_pending_cap_trg
  before insert on public.elite_club_plans
  for each row execute function public.elite_club_plans_pending_cap();

-- 3) "I'm in": one row per player per plan, with the club they are in it
--    for (a player on both clubs of a game counts once, on their side).
create table if not exists public.elite_plan_ins (
  plan_id    uuid not null references public.elite_club_plans(id) on delete cascade,
  profile_id uuid not null references public.elite_trackers(profile_id) on delete cascade,
  club_id    uuid not null references public.elite_tracker_clubs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plan_id, profile_id)
);

create index if not exists elite_plan_ins_profile_idx on public.elite_plan_ins (profile_id);

alter table public.elite_plan_ins enable row level security;

-- 4) The two one-time acceptances, with the wording's version:
--      organizer  a captain, before planning anything: "You're organizing
--                 this, not Strive."
--      player     a player, before their first "I'm in": "organized by
--                 players, not by Strive, and you play at your own risk."
--    Append-only: the server inserts, never changes a row. They leave with
--    the account, like everything else of the player's.
create table if not exists public.elite_play_acceptances (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.elite_trackers(profile_id) on delete cascade,
  kind        text not null check (kind in ('organizer', 'player')),
  version     text not null check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  accepted_at timestamptz not null default now(),
  unique (profile_id, kind, version)
);

alter table public.elite_play_acceptances enable row level security;

-- 5) A session or game reported by a player who can see it. It waits in
--    the coach queue at /coach/free (cancel it, or no action), but nothing
--    in the app waits on it.
create table if not exists public.elite_plan_reports (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.elite_club_plans(id) on delete cascade,
  reporter_id uuid not null references public.elite_trackers(profile_id) on delete cascade,
  reason      text not null check (reason in ('place', 'inappropriate', 'bullying', 'other')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.elite_profiles(id) on delete set null,
  action      text check (action is null or action in ('cancelled', 'none')),
  unique (plan_id, reporter_id)
);

create index if not exists elite_plan_reports_open_idx
  on public.elite_plan_reports (created_at) where resolved_at is null;

alter table public.elite_plan_reports enable row level security;

-- 6) Strive events, an optional extra a coach makes at /coach/free. An
--    event can be open for entries only with an https payment link AND an
--    https waiver link: entering means every player accepts that waiver.
create table if not exists public.elite_strive_events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  starts_at   timestamptz not null,
  venue       text not null check (char_length(venue) between 1 and 80),
  price_text  text not null check (char_length(price_text) between 1 and 80),
  roster_max  smallint not null check (roster_max between 1 and 30),
  max_age     smallint not null check (max_age between 8 and 99),
  payment_url text not null check (payment_url ~ '^https://' and char_length(payment_url) <= 300),
  waiver_url  text check (waiver_url is null or (waiver_url ~ '^https://' and char_length(waiver_url) <= 300)),
  open        boolean not null default false,
  created_by  uuid references public.elite_profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (not open or waiver_url is not null)
);

create index if not exists elite_strive_events_starts_idx on public.elite_strive_events (starts_at);

alter table public.elite_strive_events enable row level security;

-- A club's entry, one per club per event. sent_at: every player on the
-- roster said "I'm in", so it went to the coaches for payment. paid_at: a
-- coach marked it paid; only then is the spot held (registration =
-- payment).
create table if not exists public.elite_event_entries (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.elite_strive_events(id) on delete cascade,
  club_id    uuid not null references public.elite_tracker_clubs(id) on delete cascade,
  entered_by uuid references public.elite_trackers(profile_id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  paid_at    timestamptz,
  paid_by    uuid references public.elite_profiles(id) on delete set null,
  unique (event_id, club_id)
);

create index if not exists elite_event_entries_club_idx on public.elite_event_entries (club_id);

alter table public.elite_event_entries enable row level security;

-- The roster of an entry. A player is on one roster per event (the unique
-- key holds it even when two captains pick them at the same moment).
create table if not exists public.elite_event_roster (
  entry_id   uuid not null references public.elite_event_entries(id) on delete cascade,
  event_id   uuid not null references public.elite_strive_events(id) on delete cascade,
  profile_id uuid not null references public.elite_trackers(profile_id) on delete cascade,
  added_at   timestamptz not null default now(),
  in_at      timestamptz,
  primary key (entry_id, profile_id),
  unique (event_id, profile_id)
);

create index if not exists elite_event_roster_profile_idx on public.elite_event_roster (profile_id);

alter table public.elite_event_roster enable row level security;

create or replace function public.elite_event_roster_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cap smallint;
begin
  perform pg_advisory_xact_lock(hashtext('roster:' || new.entry_id::text));
  select e.roster_max into cap from public.elite_strive_events e where e.id = new.event_id;
  if (select count(*) from public.elite_event_roster where entry_id = new.entry_id) >= coalesce(cap, 0) then
    raise exception 'roster_full';
  end if;
  return new;
end $$;

drop trigger if exists elite_event_roster_cap_trg on public.elite_event_roster;
create trigger elite_event_roster_cap_trg
  before insert on public.elite_event_roster
  for each row execute function public.elite_event_roster_cap();

-- Every "I'm in" on an event roster: who, when, for which event and club,
-- and the exact waiver link accepted. Append-only. Kept while the event
-- exists (an event with acceptances cannot be deleted, only closed).
create table if not exists public.elite_event_waivers (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.elite_strive_events(id) on delete restrict,
  entry_id    uuid references public.elite_event_entries(id) on delete set null,
  club_id     uuid references public.elite_tracker_clubs(id) on delete set null,
  profile_id  uuid not null references public.elite_trackers(profile_id) on delete cascade,
  waiver_url  text not null check (waiver_url ~ '^https://'),
  under_18    boolean not null,
  accepted_at timestamptz not null default now()
);

create index if not exists elite_event_waivers_event_idx on public.elite_event_waivers (event_id);

alter table public.elite_event_waivers enable row level security;

-- 7) Trained together. One row per teammate tagged on a post. answer:
--    'added' (added_log_id is the entry it made in their own week) or
--    'declined'. At most 8 a post.
create table if not exists public.elite_trained_together (
  log_id       uuid not null references public.elite_training_logs(id) on delete cascade,
  tagged       uuid not null references public.elite_trackers(profile_id) on delete cascade,
  tagger       uuid not null references public.elite_trackers(profile_id) on delete cascade,
  created_at   timestamptz not null default now(),
  answer       text check (answer is null or answer in ('added', 'declined')),
  answered_at  timestamptz,
  added_log_id uuid references public.elite_training_logs(id) on delete set null,
  primary key (log_id, tagged),
  check (tagged <> tagger)
);

create index if not exists elite_trained_together_tagged_idx
  on public.elite_trained_together (tagged) where answer is null;

alter table public.elite_trained_together enable row level security;

create or replace function public.elite_trained_together_cap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('together:' || new.log_id::text));
  if (select count(*) from public.elite_trained_together where log_id = new.log_id) >= 8 then
    raise exception 'together_full';
  end if;
  return new;
end $$;

drop trigger if exists elite_trained_together_cap_trg on public.elite_trained_together;
create trigger elite_trained_together_cap_trg
  before insert on public.elite_trained_together
  for each row execute function public.elite_trained_together_cap();

revoke all on function public.elite_club_plans_pending_cap() from public, anon, authenticated;
revoke all on function public.elite_event_roster_cap() from public, anon, authenticated;
revoke all on function public.elite_trained_together_cap() from public, anon, authenticated;

-- 8) Coach reads, the same as every free table (069). No write policy on
--    any of these: only our server writes.
do $$
declare
  t text;
begin
  foreach t in array array[
    'elite_club_plans', 'elite_plan_ins', 'elite_play_acceptances', 'elite_plan_reports',
    'elite_strive_events', 'elite_event_entries', 'elite_event_roster', 'elite_event_waivers',
    'elite_trained_together'
  ] loop
    if not exists (select 1 from pg_policies where schemaname = 'public'
        and tablename = t and policyname = t || '_coach_read') then
      execute format('create policy %I on public.%I for select using (public.elite_is_coach())', t || '_coach_read', t);
    end if;
  end loop;
end $$;
