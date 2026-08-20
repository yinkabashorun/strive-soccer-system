-- =====================================================================
-- Strive Elite — game schedule ("Coach at your game")
-- =====================================================================
-- Players post their upcoming games; the coach sees them per player and
-- can mark attendance (Northern Virginia games especially) — the player
-- is notified that Coach is coming.
-- =====================================================================

create table if not exists public.elite_games (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references public.elite_players(id) on delete cascade,
  game_date       date not null,
  kickoff         text not null default '',
  opponent        text not null default '',
  location        text not null default '',
  notes           text not null default '',
  coach_attending boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists elite_games_player_idx
  on public.elite_games(player_id, game_date);

alter table public.elite_games enable row level security;

drop policy if exists elite_games_read on public.elite_games;
create policy elite_games_read on public.elite_games
  for select using (public.elite_coach_manages(player_id) or public.elite_owns_player(player_id));

drop policy if exists elite_games_player_insert on public.elite_games;
create policy elite_games_player_insert on public.elite_games
  for insert with check (public.elite_owns_player(player_id));

drop policy if exists elite_games_player_delete on public.elite_games;
create policy elite_games_player_delete on public.elite_games
  for delete using (public.elite_owns_player(player_id));

drop policy if exists elite_games_coach_write on public.elite_games;
create policy elite_games_coach_write on public.elite_games
  for all using (public.elite_coach_manages(player_id))
  with check (public.elite_coach_manages(player_id));
