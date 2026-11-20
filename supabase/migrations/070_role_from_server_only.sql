-- 070: an account's role can only come from our own server.
--
-- handle_new_elite_user (005) read the role off raw_user_meta_data, which
-- the person signing up writes themselves: a public sign-up with
-- { data: { role: "admin" } } would have made an admin profile. The role
-- now comes from raw_app_meta_data, which only the service role can set
-- (the invite and free sign-up routes pass app_metadata.role, and upsert
-- the profile row after). Anything else starts as a player. Existing
-- profiles are untouched.

create or replace function public.handle_new_elite_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.elite_profiles (id, role, full_name, email, avatar_color)
  values (
    new.id,
    case
      when new.raw_app_meta_data->>'role' in ('player', 'coach', 'admin')
        then (new.raw_app_meta_data->>'role')::strive_role
      else 'player'::strive_role
    end,
    left(coalesce(new.raw_user_meta_data->>'full_name', ''), 80),
    coalesce(new.email, ''),
    '#E5FF3D'
  )
  on conflict (id) do nothing;
  return new;
end $$;
