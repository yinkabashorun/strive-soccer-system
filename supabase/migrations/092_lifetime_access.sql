-- =====================================================================
-- 092: LIFETIME ACCESS (Nov 26 2026)
-- =====================================================================
-- Coach Yinka, on the coaching families moving into the app: "For now,
-- give them lifetime access."
--
-- elite_players.lifetime_access: this member keeps the app for life and is
-- never charged for it. It is a promise made to a family, so it is written
-- on the member's own row where the coaches can see it, and the code holds
-- it (lib/elite/lifetime.ts): a payment event can never switch a lifetime
-- member off, and the app never offers them a prize that is a month of
-- what they already have.
--
-- Only a coach sets it (the player page). The privilege guard (008, 029,
-- 040) is extended so a player can never give it to themselves: the same
-- function, with one more column named.
--
-- Additive. Default false, so no existing row changes meaning. Nothing is
-- dropped. Safe to run twice. Each statement can be run on its own.
-- =====================================================================

set lock_timeout = '8s';

alter table public.elite_players
  add column if not exists lifetime_access boolean not null default false;

create or replace function public.elite_guard_player_privilege()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return NEW;
  end if;
  if (NEW.subscription_status is distinct from OLD.subscription_status
      or NEW.tier is distinct from OLD.tier
      or NEW.coach_id is distinct from OLD.coach_id
      or NEW.profile_id is distinct from OLD.profile_id
      or NEW.offer_opt_in is distinct from OLD.offer_opt_in
      or NEW.opt_in_drill_ids is distinct from OLD.opt_in_drill_ids
      or NEW.lifetime_access is distinct from OLD.lifetime_access)
     and not public.elite_is_coach() then
    raise exception 'not authorized to change membership or ownership';
  end if;
  return NEW;
end $$;
