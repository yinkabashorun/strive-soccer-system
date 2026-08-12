-- =====================================================================
-- Strive Elite — RLS end-to-end verification (safe: rolls back)
-- =====================================================================
-- Simulates a signed-in player and the coach inside one transaction using
-- request.jwt.claims + SET LOCAL ROLE authenticated, then ROLLBACKs so no
-- test data persists. Run in the Supabase SQL Editor and read the final
-- result table.
--
-- Expected results:
--   player_sees_players            = 1   (only their own row)
--   player_sees_homework           = 1   (only their own)
--   player_selfpromote_role_rows   = 0   (RLS blocks the update; neutralized)
--   player_selfactivate_rows       = 0   (RLS blocks the update; neutralized)
--   coach_sees_players             >= 2  (full roster)
--   coach_change_status_rows       = 1   (coach may change membership)
-- =====================================================================

begin;

create temp table _rls(step text, result text);
grant all on _rls to authenticated;

-- Fixtures (created as the admin connection; cleaned up by ROLLBACK) -------
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls1@test.local', now(), now(), '{}','{}'),
 ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls2@test.local', now(), now(), '{}','{}');

insert into public.elite_profiles (id, role, full_name, email) values
 ('11111111-1111-1111-1111-111111111111','player','RLS One','rls1@test.local'),
 ('22222222-2222-2222-2222-222222222222','player','RLS Two','rls2@test.local');

insert into public.elite_players (profile_id, coach_id, full_name, subscription_status) values
 ('11111111-1111-1111-1111-111111111111','fde46d29-f9d9-419e-b95d-d82003f888f4','RLS One','active'),
 ('22222222-2222-2222-2222-222222222222','fde46d29-f9d9-419e-b95d-d82003f888f4','RLS Two','active');

insert into public.elite_homework (player_id, title)
 select id, 'hw for one' from public.elite_players
 where profile_id = '11111111-1111-1111-1111-111111111111';

-- ===== Simulate PLAYER ONE ==========================================
select set_config('request.jwt.claims',
  json_build_object('sub','11111111-1111-1111-1111-111111111111','role','authenticated')::text, true);
set local role authenticated;

insert into _rls select 'player_sees_players', count(*)::text from public.elite_players;
insert into _rls select 'player_sees_homework', count(*)::text from public.elite_homework;

do $$ declare c int; begin
  update public.elite_profiles set role = 'coach'
    where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics c = row_count;
  insert into _rls values ('player_selfpromote_role_rows', c::text);
exception when others then
  insert into _rls values ('player_selfpromote_role', 'BLOCKED: ' || SQLERRM);
end $$;

do $$ declare c int; begin
  update public.elite_players set subscription_status = 'active'
    where profile_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics c = row_count;
  insert into _rls values ('player_selfactivate_rows', c::text);
exception when others then
  insert into _rls values ('player_selfactivate', 'BLOCKED: ' || SQLERRM);
end $$;

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ===== Simulate COACH ===============================================
select set_config('request.jwt.claims',
  json_build_object('sub','fde46d29-f9d9-419e-b95d-d82003f888f4','role','authenticated')::text, true);
set local role authenticated;

insert into _rls select 'coach_sees_players', count(*)::text from public.elite_players;

do $$ declare c int; begin
  update public.elite_players set subscription_status = 'trialing'
    where profile_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics c = row_count;
  insert into _rls values ('coach_change_status_rows', c::text);
exception when others then
  insert into _rls values ('coach_change_status', 'ERROR: ' || SQLERRM);
end $$;

reset role;
select set_config('request.jwt.claims', NULL, true);

-- Results, then discard everything -----------------------------------
select * from _rls order by step;

rollback;
