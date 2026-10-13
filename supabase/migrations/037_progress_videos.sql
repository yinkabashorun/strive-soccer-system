-- =====================================================================
-- Strive Elite - bi-weekly progress video (offer stack item 7)
-- =====================================================================
-- Coach Yinka, Oct 12 2026: "every two weeks the player films the same
-- drill, we send that video to the parent so they see progress, and
-- post it in the Skool community."
--
--   elite_players.benchmark_drill_id   the one drill this player films
--                                      every second week (coach-set; the
--                                      app falls back to the first skill
--                                      drill they ever completed)
--   elite_progress_videos              one row per player per even week:
--                                      the clip, the drill it shows, the
--                                      family's yes/no to sharing it in
--                                      the community, when the parent got
--                                      the link, when the coach posted it
--
-- Clips live in the private elite-film bucket under
-- progress/<player_id>/<week>/<file>; the same ownership function that
-- scopes Send a clip (036) now accepts that prefix too.
-- =====================================================================

alter table public.elite_players
  add column if not exists benchmark_drill_id uuid references public.elite_drills(id) on delete set null;

create table if not exists public.elite_progress_videos (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.elite_players(id) on delete cascade,
  week           int  not null check (week >= 1),
  drill_id       uuid references public.elite_drills(id) on delete set null,
  drill_title    text not null default '',
  clip_path      text not null,
  share_ok       boolean not null default false,
  parent_sent_at timestamptz,
  posted_at      timestamptz,
  created_at     timestamptz not null default now(),
  unique (player_id, week)
);
create index if not exists elite_progress_videos_player_idx
  on public.elite_progress_videos(player_id, week desc);

alter table public.elite_progress_videos enable row level security;

-- Coach full access; a family reads and adds its own (one per week, by
-- the unique constraint), never edits or deletes.
create policy elite_progress_videos_coach_all on public.elite_progress_videos
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());
create policy elite_progress_videos_owner_read on public.elite_progress_videos
  for select using (public.elite_owns_player(player_id));
create policy elite_progress_videos_owner_insert on public.elite_progress_videos
  for insert with check (public.elite_owns_player(player_id));

-- Storage ownership (036) now covers both clip kinds:
--   clips/<player_id>/<homework_id>/<file>   Send a clip
--   progress/<player_id>/<week>/<file>       progress video
create or replace function public.elite_owns_clip_path(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select split_part(p_name, '/', 1) in ('clips', 'progress')
     and split_part(p_name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and public.elite_owns_player(split_part(p_name, '/', 2)::uuid);
$$;
