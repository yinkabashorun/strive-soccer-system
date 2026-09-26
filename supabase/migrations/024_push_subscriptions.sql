-- =====================================================================
-- Strive Elite - real push notifications (Web Push)
-- =====================================================================
-- Every player-facing "notification" before this migration was an
-- elite_notifications row shown only inside the app - a player who
-- doesn't open the app never learns a new week dropped, a coach messaged
-- them, or anything else. This table stores each device's Web Push
-- subscription so the server can actually push to it. One player can
-- have several rows (phone + laptop, etc.); a dead/expired endpoint gets
-- deleted the next time a send to it 404s/410s.
-- =====================================================================

create table if not exists public.elite_push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.elite_players(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  unique (player_id, endpoint)
);
create index if not exists elite_push_subscriptions_player_idx
  on public.elite_push_subscriptions(player_id);

alter table public.elite_push_subscriptions enable row level security;

drop policy if exists elite_push_subs_owner on public.elite_push_subscriptions;
create policy elite_push_subs_owner on public.elite_push_subscriptions
  for all using (public.elite_owns_player(player_id))
  with check (public.elite_owns_player(player_id));

drop policy if exists elite_push_subs_coach_read on public.elite_push_subscriptions;
create policy elite_push_subs_coach_read on public.elite_push_subscriptions
  for select using (public.elite_is_coach());
