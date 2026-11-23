-- 081: a profile photo and an @username on every account (Nov 23 2026,
-- Coach Yinka: "we need to copy the onboarding system of instagram style";
-- "players should MAKE A USERNAME during onboarding"; then: the photo is
-- REQUIRED, not optional).
--
-- WRITTEN, NOT APPLIED. Until it is applied the app asks for neither and
-- refuses nothing (lib/elite/account-profile.ts: the columns are not on
-- the profile row, so setup.available is false), and a free account's
-- photo keeps living in elite_trackers.avatar_path as before.
--
-- 1) elite_profiles.avatar_path: the one profile photo of an account,
--    member or free, in the account's own folder of the private
--    tracker-posts bucket (<profile id>/avatar-<id>.jpg). The same shape
--    the free app has used since 069; the folder must be the account's own.
-- 2) elite_profiles.username: one namespace for every account. Lowercase
--    letters, numbers, dot and underscore, 3 to 20, no dot at either end
--    or two in a row, at least one letter (lib/elite/username.ts holds the
--    same rule, plus the reserved words and the word filter, which the
--    server checks before it writes). Unique ignoring case.
-- 3) The free app's existing photos are copied onto the profile row.
--    elite_trackers.avatar_path is left in place (no DROP through the MCP)
--    and is no longer read once this is applied.
--
-- No new policies: nothing in a browser writes elite_profiles (008 took the
-- self-update policy away); the server writes with the service role after
-- checking who is signed in. The existing read policy (own row, coaches)
-- is unchanged.

set lock_timeout = '8s';

alter table public.elite_profiles add column if not exists avatar_path text;
alter table public.elite_profiles add column if not exists username text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'elite_profiles_avatar_path_check'
      and conrelid = 'public.elite_profiles'::regclass
  ) then
    alter table public.elite_profiles add constraint elite_profiles_avatar_path_check
      check (avatar_path is null or (
        avatar_path ~ '^[0-9a-f-]{36}/avatar-[0-9a-f-]{36}\.jpg$'
        and split_part(avatar_path, '/', 1) = id::text
      ));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'elite_profiles_username_check'
      and conrelid = 'public.elite_profiles'::regclass
  ) then
    alter table public.elite_profiles add constraint elite_profiles_username_check
      check (
        username is null or (
          username ~ '^[a-z0-9._]{3,20}$'
          and username !~ '^\.'
          and username !~ '\.$'
          and position('..' in username) = 0
          and username ~ '[a-z]'
        )
      );
  end if;
end $$;

-- One username per account, whatever the case (the check above already
-- keeps them lowercase; the index holds even if that ever changed).
create unique index if not exists elite_profiles_username_lower_key
  on public.elite_profiles (lower(username))
  where username is not null;

-- The free app's photos, onto the profile row.
update public.elite_profiles p
   set avatar_path = t.avatar_path
  from public.elite_trackers t
 where t.profile_id = p.id
   and t.avatar_path is not null
   and p.avatar_path is null
   and t.avatar_path like (p.id::text || '/avatar-%');
