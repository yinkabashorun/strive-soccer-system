-- =====================================================================
-- Strive Elite - progress counts time trained; a break never costs anything
-- =====================================================================
-- Offer stack item 8 (Oct 12 2026). Two additions, both zero-disruption:
-- a player with no break row sees exactly today's week, and the new
-- homework column is filled by the database from the drill the row
-- already links.
--
--   elite_homework.pillar        the bank drill's pillar, copied onto the
--                                row by trigger (players cannot read
--                                elite_drills under RLS, and minutes by
--                                pillar is a player-facing number)
--   elite_training_breaks        one row per break: since / until dates,
--                                who set it, when the program clock was
--                                moved on return (resumed_at). History
--                                is never deleted.
-- =====================================================================

-- 1) pillar on homework ------------------------------------------------
alter table public.elite_homework
  add column if not exists pillar text;

-- Filled from the linked drill on every insert, whenever the link
-- changes, and whenever the column is still empty - so no writer
-- (publish, Extra Work, clone-week, backfill, anything written later)
-- can leave it blank while drill_id is set.
create or replace function public.elite_fill_homework_pillar()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.drill_id is not null
     and (tg_op = 'INSERT'
          or new.drill_id is distinct from old.drill_id
          or new.pillar is null) then
    select d.pillar into new.pillar
    from public.elite_drills d
    where d.id = new.drill_id;
  end if;
  return new;
end $$;

drop trigger if exists elite_homework_fill_pillar on public.elite_homework;
create trigger elite_homework_fill_pillar
  before insert or update on public.elite_homework
  for each row execute function public.elite_fill_homework_pillar();

-- One-time fill for every row already linked to a drill.
update public.elite_homework h
set pillar = d.pillar
from public.elite_drills d
where h.drill_id = d.id and h.pillar is null;

create index if not exists elite_homework_player_pillar_idx
  on public.elite_homework(player_id, pillar);

-- 2) training breaks ---------------------------------------------------
create table if not exists public.elite_training_breaks (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.elite_players(id) on delete cascade,
  since       date not null,
  until       date not null,
  note        text not null default '',
  created_by  text not null default 'player' check (created_by in ('player', 'coach')),
  resumed_at  timestamptz,
  created_at  timestamptz not null default now(),
  constraint elite_training_breaks_window check (until >= since)
);
create index if not exists elite_training_breaks_player_idx
  on public.elite_training_breaks(player_id, until desc);

alter table public.elite_training_breaks enable row level security;

-- A family reads its own breaks; the coach reads and writes every one.
-- A family's own writes go through the service client after the
-- ownership check (lib/elite/break-actions.ts), the same pattern as
-- Extra Work and onboarding, so no player write policy exists here.
drop policy if exists elite_training_breaks_read on public.elite_training_breaks;
create policy elite_training_breaks_read on public.elite_training_breaks
  for select using (public.elite_is_coach() or public.elite_owns_player(player_id));

drop policy if exists elite_training_breaks_coach_write on public.elite_training_breaks;
create policy elite_training_breaks_coach_write on public.elite_training_breaks
  for all using (public.elite_is_coach())
  with check (public.elite_is_coach());
