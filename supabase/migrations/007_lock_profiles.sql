-- =====================================================================
-- Strive Elite — lock down profile role changes
-- =====================================================================
-- The original self-update policy let a signed-in user PATCH their own
-- elite_profiles row, including `role` — a privilege-escalation path
-- (a player could make themselves a coach and read the whole roster).
-- The app never edits profiles from the client, so remove that policy.
-- Roles are managed only by the service role (coach bootstrap / admin).
-- =====================================================================

drop policy if exists elite_profiles_update_self on public.elite_profiles;
