-- 071: the free app's limits, held by the database (security review, Nov 20 2026).
--
-- (1) Taking a friend off sticks: the player who was removed cannot use the
--     remover's link to come straight back. The remover can still add them
--     again from the other player's link, which clears the record.
-- (2) A captain who removes a member from a club removes them for good:
--     the club's link will not let them back in.
-- (3) The caps are in the database, not only in the code: a player is on 3
--     clubs at most, a club holds 20, and two requests at the same moment
--     cannot both get through (one lock per club and one per player).
-- (4) A day holds 480 minutes at most (training and gym together), so a
--     script cannot fill a week or a club's ranking with made-up hours.

create table if not exists public.elite_tracker_unfriends (
  remover    uuid not null references public.elite_trackers(profile_id) on delete cascade,
  removed    uuid not null references public.elite_trackers(profile_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (remover, removed)
);
alter table public.elite_tracker_unfriends enable row level security;

create table if not exists public.elite_tracker_club_bans (
  club_id    uuid not null references public.elite_tracker_clubs(id) on delete cascade,
  profile_id uuid not null references public.elite_trackers(profile_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (club_id, profile_id)
);
alter table public.elite_tracker_club_bans enable row level security;

create or replace function public.elite_tracker_club_join_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('club:' || new.club_id::text));
  perform pg_advisory_xact_lock(hashtext('player-clubs:' || new.profile_id::text));
  if exists (select 1 from public.elite_tracker_club_bans
             where club_id = new.club_id and profile_id = new.profile_id) then
    raise exception 'club_removed';
  end if;
  if (select count(*) from public.elite_tracker_club_members where profile_id = new.profile_id) >= 3 then
    raise exception 'club_too_many';
  end if;
  if (select count(*) from public.elite_tracker_club_members where club_id = new.club_id) >= 20 then
    raise exception 'club_full';
  end if;
  return new;
end $$;

drop trigger if exists elite_tracker_club_join_guard_trg on public.elite_tracker_club_members;
create trigger elite_tracker_club_join_guard_trg
  before insert on public.elite_tracker_club_members
  for each row execute function public.elite_tracker_club_join_guard();

create or replace function public.elite_tracker_day_cap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('day:' || new.profile_id::text));
  if coalesce((select sum(minutes) from public.elite_training_logs
               where profile_id = new.profile_id and trained_on = new.trained_on), 0)
     + new.minutes > 480 then
    raise exception 'day_cap';
  end if;
  return new;
end $$;

drop trigger if exists elite_tracker_day_cap_trg on public.elite_training_logs;
create trigger elite_tracker_day_cap_trg
  before insert on public.elite_training_logs
  for each row execute function public.elite_tracker_day_cap();

revoke all on function public.elite_tracker_club_join_guard() from public, anon, authenticated;
revoke all on function public.elite_tracker_day_cap() from public, anon, authenticated;
