-- =====================================================================
-- Strive Complete Pathway - membership tiers + coaching calls
-- =====================================================================
-- Until now the app had ONE tier: an active member got everything. But
-- the offers are sold as two: Strive Elite (the app only - weekly plans,
-- drill videos, chat, progress) and Strive Complete Pathway (the app plus
-- Film Room, the monthly private breakdown, the weekly parent report, and
-- weekly 1:1 coaching calls). This adds the tier and the calls.
-- =====================================================================

-- 1) tier -------------------------------------------------------------
alter table public.elite_players
  add column if not exists tier text not null default 'elite'
  check (tier in ('elite', 'complete'));

-- A plain player must never be able to move themselves to 'complete'.
-- Same guard as subscription_status (008): only the service role or a
-- coach may change it.
create or replace function public.elite_guard_player_privilege()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return NEW;
  end if;
  if (NEW.subscription_status is distinct from OLD.subscription_status
      or NEW.tier is distinct from OLD.tier
      or NEW.coach_id is distinct from OLD.coach_id
      or NEW.profile_id is distinct from OLD.profile_id)
     and not public.elite_is_coach() then
    raise exception 'not authorized to change membership or ownership';
  end if;
  return NEW;
end $$;

-- 2) coaching calls ---------------------------------------------------
-- One row per scheduled 1:1 call. Scheduling itself lives on Calendly;
-- the app records when the call is, where to join, and the coach's
-- post-call note, which is fed into the player's next weekly plan.
create table if not exists public.elite_coaching_calls (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.elite_players(id) on delete cascade,
  scheduled_at timestamptz not null,
  join_url     text not null default '',
  coach_name   text not null default '',
  notes        text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists elite_coaching_calls_player_idx
  on public.elite_coaching_calls(player_id, scheduled_at desc);

alter table public.elite_coaching_calls enable row level security;

drop policy if exists elite_coaching_calls_read on public.elite_coaching_calls;
create policy elite_coaching_calls_read on public.elite_coaching_calls
  for select using (public.elite_is_coach() or public.elite_owns_player(player_id));

drop policy if exists elite_coaching_calls_coach_write on public.elite_coaching_calls;
create policy elite_coaching_calls_coach_write on public.elite_coaching_calls
  for all using (public.elite_is_coach())
  with check (public.elite_is_coach());
