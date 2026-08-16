-- =====================================================================
-- Strive Elite — progress history
-- =====================================================================
-- elite_progress keeps only the current + previous rating per pillar. To
-- make long-term progress real (and chartable), append every rating to a
-- history table each time the coach applies a session plan.
-- =====================================================================

create table if not exists public.elite_progress_history (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.elite_players(id) on delete cascade,
  metric     text not null,
  value      int not null check (value between 0 and 100),
  week       int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists elite_progress_history_idx
  on public.elite_progress_history(player_id, metric, created_at);

alter table public.elite_progress_history enable row level security;

drop policy if exists elite_progress_history_read on public.elite_progress_history;
create policy elite_progress_history_read on public.elite_progress_history
  for select using (public.elite_is_coach() or public.elite_owns_player(player_id));
drop policy if exists elite_progress_history_coach_write on public.elite_progress_history;
create policy elite_progress_history_coach_write on public.elite_progress_history
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());
