-- Player's own phone, distinct from parent_phone (025) - needed once a
-- player is old enough to text directly, and to match inbound GHL SMS
-- replies back to the right player/role instead of assuming every reply
-- is from the parent.
alter table public.elite_players add column if not exists player_phone text;
