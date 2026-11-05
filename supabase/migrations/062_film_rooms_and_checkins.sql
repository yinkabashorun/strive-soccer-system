-- =====================================================================
-- Strive Elite - weekly Film Room and monthly check-in calls
-- =====================================================================
-- Coach Yinka, Nov 5 2026: "a page for the zoom calls ... on a weekly
-- basis Coach Gary and I pick a day ... we'll send you the Zoom link and
-- you'll upload it into the weekly film rooms ... a few days each month
-- where we'll do the one-on-one monthly check-in calls ... the morning of
-- the 15th, 9 through 12, 30-minute calls ... notifications that go out
-- when we announce the weekly film rooms ... where they should upload
-- three to five clips for us to review."
-- Answered: Film Room Sundays 7pm ET (clips due Saturday 9pm ET); players
-- pick one open slot a month on the days the coaches publish.
--
--   elite_film_rooms          one row per weekly Zoom (time, link, topic,
--                             clips due, announced_at)
--   elite_film_room_clips     a member's clips for one room, 5 at most
--                             (database trigger), stored under
--                             filmroom/<player_id>/<room_id>/<file>
--   elite_checkin_days        a day the coaches publish for check-ins
--   elite_checkin_slots       the 30-minute slots of that day; a booked
--                             slot also writes an elite_coaching_calls row
--                             (029) so the dashboard card and the post-call
--                             note that steers the plan keep working
--
-- Pages and actions read and write with the service client after their own
-- checks (players cannot read other members' rows); the policies below are
-- the floor under that.
-- =====================================================================

create table if not exists public.elite_film_rooms (
  id uuid primary key default gen_random_uuid(),
  scheduled_at timestamptz not null,
  clips_due_at timestamptz not null,
  zoom_url text not null default '',
  topic text not null default '',
  announced_at timestamptz,
  created_by uuid references public.elite_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists elite_film_rooms_when on public.elite_film_rooms(scheduled_at);

create table if not exists public.elite_film_room_clips (
  id uuid primary key default gen_random_uuid(),
  film_room_id uuid not null references public.elite_film_rooms(id) on delete cascade,
  player_id uuid not null references public.elite_players(id) on delete cascade,
  clip_path text not null,
  created_at timestamptz not null default now(),
  unique (film_room_id, clip_path)
);
create index if not exists elite_film_room_clips_room on public.elite_film_room_clips(film_room_id, player_id);

create table if not exists public.elite_checkin_days (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  slot_minutes int not null default 30 check (slot_minutes between 10 and 120),
  zoom_url text not null default '',
  coach_name text not null default '',
  announced_at timestamptz,
  created_by uuid references public.elite_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.elite_checkin_slots (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.elite_checkin_days(id) on delete cascade,
  starts_at timestamptz not null,
  player_id uuid references public.elite_players(id) on delete set null,
  booked_at timestamptz,
  month_key text,
  call_id uuid references public.elite_coaching_calls(id) on delete set null,
  unique (day_id, starts_at)
);
create index if not exists elite_checkin_slots_day on public.elite_checkin_slots(day_id, starts_at);
-- One check-in a month per player, held by the database.
create unique index if not exists elite_checkin_slots_one_per_month
  on public.elite_checkin_slots(player_id, month_key) where player_id is not null;

alter table public.elite_film_rooms enable row level security;
alter table public.elite_film_room_clips enable row level security;
alter table public.elite_checkin_days enable row level security;
alter table public.elite_checkin_slots enable row level security;

create policy elite_film_rooms_coach_all on public.elite_film_rooms
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());
create policy elite_film_rooms_member_read on public.elite_film_rooms
  for select using (announced_at is not null);

create policy elite_film_room_clips_coach_all on public.elite_film_room_clips
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());
create policy elite_film_room_clips_owner_read on public.elite_film_room_clips
  for select using (public.elite_owns_player(player_id));
create policy elite_film_room_clips_owner_insert on public.elite_film_room_clips
  for insert with check (public.elite_owns_player(player_id) and public.elite_owns_clip_path(clip_path));
create policy elite_film_room_clips_owner_delete on public.elite_film_room_clips
  for delete using (public.elite_owns_player(player_id));

create policy elite_checkin_days_coach_all on public.elite_checkin_days
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());
create policy elite_checkin_slots_coach_all on public.elite_checkin_slots
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());
create policy elite_checkin_slots_owner_read on public.elite_checkin_slots
  for select using (player_id is not null and public.elite_owns_player(player_id));

-- Five clips at most per member per room, by the database.
create or replace function public.elite_film_room_clip_cap()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.elite_film_room_clips
       where film_room_id = new.film_room_id and player_id = new.player_id) >= 5 then
    raise exception 'film room clip limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists elite_film_room_clip_cap on public.elite_film_room_clips;
create trigger elite_film_room_clip_cap
  before insert on public.elite_film_room_clips
  for each row execute function public.elite_film_room_clip_cap();

-- Storage ownership (036, 037) now also covers a Film Room clip:
--   clips/<player_id>/<homework_id>/<file>    Send a clip
--   progress/<player_id>/<week>/<file>        progress video
--   filmroom/<player_id>/<room_id>/<file>     Film Room clip
create or replace function public.elite_owns_clip_path(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select split_part(p_name, '/', 1) in ('clips', 'progress', 'filmroom')
     and split_part(p_name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and public.elite_owns_player(split_part(p_name, '/', 2)::uuid);
$$;
