-- 078: MY DRILLS IN THE FREE APP, AND A REMINDER AT THE MEMBER'S USUAL TIME
-- (Nov 22 2026).
--
-- MY DRILLS. Coach Yinka: a free player names their own drill ("Weak foot
-- juggles", "Rabona") and films TAKES of it whenever they want, up to 20
-- seconds each, then sees the change: two takes side by side (Then and
-- now) and every take in a row (the progress reel). Completely optional,
-- and PRIVATE: only the player and the coaches can play a take. Takes are
-- never in the friends feed and never on anyone's profile.
--
--   elite_tracker_drills   one row per drill: its name and the take the
--                          player set as the start (null = the first)
--   elite_tracker_takes    one row per take: where the video is, the
--                          optional count, its length
--
-- Written by the server only (service role, after the ownership check),
-- like every free table (069); the coaches read. The caps hold in the
-- database under a lock, like 071: 20 drills a player, 50 takes a drill.
--
-- The video lives in the player's own folder of the private tracker-posts
-- bucket (069), flat beside their photos: <profile id>/take-<take id>.<ext>.
-- The bucket now takes video, 60 MB a file (the photo route keeps its own
-- 3 MB cap on the server). A player may WRITE a take, and only a take, into
-- their own folder (so a 60 MB video goes up in resumable pieces straight
-- from the phone); nobody but the coaches may read there, and the player
-- plays their own takes through short-lived signed addresses the server
-- makes for them alone. Deleting the account removes the folder
-- (removeTrackerFiles) and the rows (on delete cascade).
--
-- THE REMINDER. One push a day at most, at the member's usual training
-- hour, Monday to Saturday. Claimed first here (player + New York date) so
-- a second cron instance or a retry sends nothing.
--
-- Idempotent: every statement can run twice.

-- 1) The drills.
create table if not exists public.elite_tracker_drills (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.elite_profiles(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 40),
  start_take_id uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists elite_tracker_drills_profile_idx
  on public.elite_tracker_drills (profile_id, created_at);

-- 2) The takes. The id is made on the phone (it names the file before the
--    upload), checked by the server against the path.
create table if not exists public.elite_tracker_takes (
  id          uuid primary key,
  drill_id    uuid not null references public.elite_tracker_drills(id) on delete cascade,
  profile_id  uuid not null references public.elite_profiles(id) on delete cascade,
  clip_path   text not null unique
    check (clip_path ~ '^[0-9a-f-]{36}/take-[0-9a-f-]{36}\.(mp4|mov|webm|m4v)$'),
  count       integer check (count is null or count between 0 and 999),
  seconds     numeric(5, 2) check (seconds is null or (seconds >= 0 and seconds <= 25)),
  created_at  timestamptz not null default now()
);

create index if not exists elite_tracker_takes_drill_idx
  on public.elite_tracker_takes (drill_id, created_at);
create index if not exists elite_tracker_takes_profile_idx
  on public.elite_tracker_takes (profile_id);

-- The starting take must be a take of the same drill; deleting it puts
-- the start back on the first take (null).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'elite_tracker_drills_start_take_fk') then
    alter table public.elite_tracker_drills
      add constraint elite_tracker_drills_start_take_fk
      foreign key (start_take_id) references public.elite_tracker_takes(id) on delete set null;
  end if;
end $$;

create or replace function public.elite_tracker_start_take_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.start_take_id is not null and not exists (
    select 1 from public.elite_tracker_takes where id = new.start_take_id and drill_id = new.id
  ) then
    raise exception 'start_take_other_drill';
  end if;
  return new;
end $$;

drop trigger if exists elite_tracker_start_take_guard_trg on public.elite_tracker_drills;
create trigger elite_tracker_start_take_guard_trg
  before insert or update of start_take_id on public.elite_tracker_drills
  for each row execute function public.elite_tracker_start_take_guard();

-- 3) The caps, under a lock so two requests at once cannot both get past.
create or replace function public.elite_tracker_drill_cap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('drills:' || new.profile_id::text));
  if (select count(*) from public.elite_tracker_drills where profile_id = new.profile_id) >= 20 then
    raise exception 'drill_cap';
  end if;
  return new;
end $$;

drop trigger if exists elite_tracker_drill_cap_trg on public.elite_tracker_drills;
create trigger elite_tracker_drill_cap_trg
  before insert on public.elite_tracker_drills
  for each row execute function public.elite_tracker_drill_cap();

create or replace function public.elite_tracker_take_cap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('takes:' || new.drill_id::text));
  if not exists (select 1 from public.elite_tracker_drills
                 where id = new.drill_id and profile_id = new.profile_id) then
    raise exception 'take_other_player';
  end if;
  if (select count(*) from public.elite_tracker_takes where drill_id = new.drill_id) >= 50 then
    raise exception 'take_cap';
  end if;
  return new;
end $$;

drop trigger if exists elite_tracker_take_cap_trg on public.elite_tracker_takes;
create trigger elite_tracker_take_cap_trg
  before insert on public.elite_tracker_takes
  for each row execute function public.elite_tracker_take_cap();

revoke all on function public.elite_tracker_start_take_guard() from public, anon, authenticated;
revoke all on function public.elite_tracker_drill_cap() from public, anon, authenticated;
revoke all on function public.elite_tracker_take_cap() from public, anon, authenticated;

-- 4) Row security: on, the coaches read, nobody else (the server writes).
alter table public.elite_tracker_drills enable row level security;
alter table public.elite_tracker_takes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['elite_tracker_drills', 'elite_tracker_takes'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public'
        and tablename = t and policyname = t || '_coach_read') then
      execute format('create policy %I on public.%I for select using (public.elite_is_coach())', t || '_coach_read', t);
    end if;
  end loop;
end $$;

-- 5) The bucket takes the videos.
update storage.buckets
   set file_size_limit = 60000000,
       allowed_mime_types = array['image/jpeg', 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
 where id = 'tracker-posts';

-- A player may write a take, and only a take, into their own folder. No
-- read, no list, no replace: reads are signed by the server.
create or replace function public.elite_owns_take_path(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and p_name ~ '^[0-9a-f-]{36}/take-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|mov|webm|m4v)$'
     and split_part(p_name, '/', 1) = auth.uid()::text;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'tracker_takes_owner_insert'
  ) then
    create policy tracker_takes_owner_insert on storage.objects
      for insert with check (bucket_id = 'tracker-posts' and public.elite_owns_take_path(name));
  end if;
end $$;

-- 6) Every share is an invite: where a free account came from ("share"
--    for a link in a card or video another player shared), for the
--    coaches' list. Written once at sign-up, best effort.
alter table public.elite_trackers
  add column if not exists source text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'elite_trackers_source_shape') then
    alter table public.elite_trackers
      add constraint elite_trackers_source_shape check (source is null or source ~ '^[a-z0-9_-]{1,40}$');
  end if;
end $$;

-- 7) THE DAILY PULL: free accounts get notifications. Their devices are
--    on file in the same two tables as a member's, by profile instead of
--    by player (a free account has no player row). Exactly one of the two
--    on every row; a member's rows are unchanged.
alter table public.elite_push_subscriptions
  add column if not exists profile_id uuid references public.elite_profiles(id) on delete cascade;
alter table public.elite_push_subscriptions alter column player_id drop not null;
alter table public.elite_native_push_tokens
  add column if not exists profile_id uuid references public.elite_profiles(id) on delete cascade;
alter table public.elite_native_push_tokens alter column player_id drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'elite_push_subscriptions_one_owner') then
    alter table public.elite_push_subscriptions
      add constraint elite_push_subscriptions_one_owner check (num_nonnulls(player_id, profile_id) = 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'elite_native_push_tokens_one_owner') then
    alter table public.elite_native_push_tokens
      add constraint elite_native_push_tokens_one_owner check (num_nonnulls(player_id, profile_id) = 1);
  end if;
end $$;

-- the upsert key for a free account's browser (a member's stays
-- (player_id, endpoint); nulls never collide)
create unique index if not exists elite_push_subscriptions_profile_endpoint_idx
  on public.elite_push_subscriptions (profile_id, endpoint);
create index if not exists elite_native_push_tokens_profile_idx
  on public.elite_native_push_tokens (profile_id);

-- The free notices ledger: one row per notice, claimed before sending.
--   friend_post: (profile, today, '') so one a day whoever posted
--   props:       (profile, the post's day, the post's id) so one a post;
--                sent_on counts the three a day
create table if not exists public.elite_free_notices (
  profile_id uuid not null references public.elite_profiles(id) on delete cascade,
  kind       text not null check (kind in ('friend_post', 'props')),
  ny_date    date not null,
  ref        text not null default '',
  sent_on    date not null,
  sent_at    timestamptz not null default now(),
  primary key (profile_id, kind, ny_date, ref)
);

create index if not exists elite_free_notices_day_idx
  on public.elite_free_notices (profile_id, kind, sent_on);

alter table public.elite_free_notices enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'elite_free_notices' and policyname = 'elite_free_notices_coach_read') then
    create policy elite_free_notices_coach_read on public.elite_free_notices
      for select using (public.elite_is_coach());
  end if;
end $$;

-- 8) The reminder ledger: one row per member per New York date. Only the
--    caller whose insert succeeds may send. Rows older than 60 days are
--    cleaned by the hourly cron.
create table if not exists public.elite_training_reminders (
  player_id uuid not null references public.elite_players(id) on delete cascade,
  ny_date   date not null,
  sent_at   timestamptz not null default now(),
  primary key (player_id, ny_date)
);

alter table public.elite_training_reminders enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'elite_training_reminders' and policyname = 'elite_training_reminders_coach_read') then
    create policy elite_training_reminders_coach_read on public.elite_training_reminders
      for select using (public.elite_is_coach());
  end if;
end $$;
