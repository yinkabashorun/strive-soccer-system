-- =====================================================================
-- Strive Elite - native push tokens (the App Store app)
-- =====================================================================
-- Web Push (024) cannot reach a phone inside the native iPhone shell:
-- Apple only delivers there through its own push service, to a device
-- token the shell hands the site after the member allows notifications.
-- One row per device. A token names a phone, not a person, so it is
-- unique on its own: when a different player signs in on the same phone
-- the row moves to them (the save is an upsert on token).
-- A token Apple reports dead is deleted on the next send (lib/elite/apns.ts).
-- =====================================================================

create table if not exists public.elite_native_push_tokens (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.elite_players(id) on delete cascade,
  token        text not null unique,
  platform     text not null default 'ios' check (platform in ('ios', 'android')),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists elite_native_push_tokens_player_idx
  on public.elite_native_push_tokens(player_id);

alter table public.elite_native_push_tokens enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_native_push_tokens'
      and policyname = 'elite_native_push_owner'
  ) then
    create policy elite_native_push_owner on public.elite_native_push_tokens
      for all using (public.elite_owns_player(player_id))
      with check (public.elite_owns_player(player_id));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_native_push_tokens'
      and policyname = 'elite_native_push_coach_read'
  ) then
    create policy elite_native_push_coach_read on public.elite_native_push_tokens
      for select using (public.elite_is_coach());
  end if;
end $$;
