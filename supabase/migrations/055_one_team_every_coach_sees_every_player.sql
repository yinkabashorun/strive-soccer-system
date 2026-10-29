-- =====================================================================
-- Strive Elite - one team: every coach sees every player (Oct 29 2026)
-- =====================================================================
-- Coach Yinka: "make sure gary can see all players on the roster".
--
-- 013 made the model multi-coach: a plain 'coach' saw only players whose
-- coach_id was theirs, an 'admin' saw everyone. Strive is one team. Every
-- player's coach_id is Coach Yinka's, so Coach Gary's coach login (054)
-- would have opened on an empty roster and been refused every player
-- page, message, plan and clip. From here a coach profile manages every
-- player exactly as the admin does; coach_id stays as the label of who
-- invited the player (and who gets that player's coach pings), not as a
-- visibility fence.
--
-- One function carries the rule for every per-player table (013 named it
-- in each policy), so redefining it is the whole change for those; the
-- two elite_players policies and the roster RPC named coach_id directly
-- and are rewritten in place (ALTER POLICY, never DROP, so the apply
-- cannot hang on a lock). Admin keeps everything it had.
-- =====================================================================

create or replace function public.elite_coach_manages(p_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.elite_is_coach();
$$;

alter policy elite_players_read on public.elite_players
  using (public.elite_is_coach() or profile_id = auth.uid());

alter policy elite_players_coach_write on public.elite_players
  using (public.elite_is_coach())
  with check (public.elite_is_coach());

create or replace function public.elite_coach_roster()
returns table (
  player_id           uuid,
  full_name           text,
  avatar_color        text,
  current_week        int,
  subscription_status strive_sub_status,
  last_active         timestamptz,
  current_streak      int,
  homework_pct        int,
  training_minutes    int,
  sessions_completed  int
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.elite_is_coach() then
    raise exception 'not authorized';
  end if;

  return query
  select
    p.id, p.full_name, p.avatar_color, p.current_week, p.subscription_status,
    s.last_active, s.current_streak, s.homework_pct, s.training_minutes,
    s.sessions_completed
  from public.elite_players p
  left join lateral public.elite_player_summary(p.id) s on true
  order by p.full_name;
end $$;
