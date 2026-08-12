-- =====================================================================
-- Strive Elite — backend hardening
-- =====================================================================
-- Priority 1: a player must never be able to set their own role to
--   'coach' (elite_profiles.role) or their membership to 'active'
--   (elite_players.subscription_status). Enforced server-side with
--   BEFORE UPDATE triggers, not just RLS / client code.
-- Priority 3: least privilege on SECURITY DEFINER helper/trigger
--   functions — revoke EXECUTE from public/anon.
-- =====================================================================

-- (a) remove the escalation-prone self-update policy on profiles
drop policy if exists elite_profiles_update_self on public.elite_profiles;

-- (b) profile.role is immutable except via the service role
create or replace function public.elite_guard_profile_role()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return NEW;
  end if;
  if NEW.role is distinct from OLD.role then
    raise exception 'not authorized to change role';
  end if;
  return NEW;
end $$;
drop trigger if exists elite_guard_profile_role_trg on public.elite_profiles;
create trigger elite_guard_profile_role_trg
  before update on public.elite_profiles
  for each row execute function public.elite_guard_profile_role();

-- (c) membership + ownership on players changeable only by the service
--     role or a coach (never by a plain player)
create or replace function public.elite_guard_player_privilege()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return NEW;
  end if;
  if (NEW.subscription_status is distinct from OLD.subscription_status
      or NEW.coach_id is distinct from OLD.coach_id
      or NEW.profile_id is distinct from OLD.profile_id)
     and not public.elite_is_coach() then
    raise exception 'not authorized to change membership or ownership';
  end if;
  return NEW;
end $$;
drop trigger if exists elite_guard_player_privilege_trg on public.elite_players;
create trigger elite_guard_player_privilege_trg
  before update on public.elite_players
  for each row execute function public.elite_guard_player_privilege();

-- (d) least privilege on SECURITY DEFINER functions. Keep EXECUTE for
--     `authenticated` (RLS evaluates these) + `service_role`; drop it for
--     public/anon so they are not callable via /rest/v1/rpc.
revoke execute on function public.elite_is_coach() from public, anon;
revoke execute on function public.elite_owns_player(uuid) from public, anon;
grant execute on function public.elite_is_coach() to authenticated, service_role;
grant execute on function public.elite_owns_player(uuid) to authenticated, service_role;

revoke execute on function public.handle_new_elite_user() from public, anon;
do $$
begin
  begin grant execute on function public.handle_new_elite_user() to supabase_auth_admin; exception when undefined_object then null; end;
  begin grant execute on function public.handle_new_elite_user() to service_role; exception when undefined_object then null; end;
end $$;
