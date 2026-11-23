-- 073: clubs by request (Coach Yinka, Nov 20 2026, "clubs, yes"). A club's
-- link no longer puts a player on the club and friends them with every
-- member: it sends a request, and the club's captain (or the coaches, for a
-- club a coach made) lets them in. Written only by our server.

create table if not exists public.elite_tracker_club_requests (
  club_id    uuid not null references public.elite_tracker_clubs(id) on delete cascade,
  profile_id uuid not null references public.elite_trackers(profile_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (club_id, profile_id)
);

create index if not exists elite_tracker_club_requests_profile_idx
  on public.elite_tracker_club_requests (profile_id);

alter table public.elite_tracker_club_requests enable row level security;
