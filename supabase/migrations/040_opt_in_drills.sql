-- =====================================================================
-- Strive Elite - course drills, offered per player (Oct 23 2026)
-- =====================================================================
-- Coach Yinka: "Just make it an option for me to toggle to offer juggling
-- drills then select the ones you can choose from for the player."
--
-- A bank drill can be marked opt_in: it never enters anyone's week on its
-- own. The coach switches a player on (offer_opt_in) and ticks which
-- opt-in drills the builder may use for them (opt_in_drill_ids). Both
-- gates (generation and publish) and Extra Work read these through
-- drillFitsPlayer / offeredBank in lib/elite/bank-conform.ts.
--
-- Every default reproduces today's behaviour: no drill is opt_in, no
-- player is offered anything, nothing changes for anyone until the coach
-- acts. The Keep It Up juggling rows are flipped opt_in + active by hand
-- after this applies (see CLAUDE.md RECORD).
-- =====================================================================

alter table public.elite_drills
  add column if not exists opt_in boolean not null default false;

alter table public.elite_players
  add column if not exists offer_opt_in boolean not null default false,
  add column if not exists opt_in_drill_ids uuid[] not null default '{}';

-- A player must never offer themselves drills (008 guard, extended as 029 did).
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
      or NEW.opt_in_drill_ids is distinct from OLD.opt_in_drill_ids)
     and not public.elite_is_coach() then
    raise exception 'not authorized to change membership or ownership';
  end if;
  return NEW;
end $$;

-- A deleted drill leaves no stale id behind in any player's picks.
create or replace function public.elite_prune_opt_in_drill()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.elite_players
     set opt_in_drill_ids = array_remove(opt_in_drill_ids, OLD.id)
   where OLD.id = any(opt_in_drill_ids);
  return OLD;
end $$;

create trigger elite_prune_opt_in_drill_trg
  after delete on public.elite_drills
  for each row execute function public.elite_prune_opt_in_drill();
