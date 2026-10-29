-- =====================================================================
-- Strive Elite - coach invite codes (Oct 29 2026)
-- =====================================================================
-- Coach Yinka: "make invite code for coach gary ... he is a coach".
--
-- Until now every invite code redeemed as a PLAYER (profile role player,
-- an elite_players row, the membership gate) and the only way to a coach
-- login was the STRIVE_COACH_EMAILS allowlist in Vercel, which makes an
-- email ADMIN. A code now carries the role it creates: 'player' (the
-- default, every existing row) or 'coach'. A coach code is generated only
-- by an admin (lib/elite/invite-actions.ts) and redeems as a coach
-- profile with no player row (app/api/elite/auth/redeem/route.ts).
--
-- Every existing code keeps 'player', so nothing changes for any family.
-- =====================================================================

alter table public.elite_invite_codes
  add column if not exists role text not null default 'player';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'elite_invite_codes_role_check'
      and conrelid = 'public.elite_invite_codes'::regclass
  ) then
    alter table public.elite_invite_codes
      add constraint elite_invite_codes_role_check check (role in ('player', 'coach'));
  end if;
end $$;
