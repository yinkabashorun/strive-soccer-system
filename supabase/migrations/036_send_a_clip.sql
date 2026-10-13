-- =====================================================================
-- Strive Elite - Send a clip (offer stack item 5, first half)
-- =====================================================================
-- A player films themselves doing a drill and sends it from the drill
-- card straight into their chat with the coach; the coach answers by
-- text in the same thread. Two changes:
--
-- 1) The elite-film storage bucket (005) was readable AND writable by
--    ANY signed-in user with no per-player scoping - open since Sept 26
--    2026. It is now scoped: a family can only write to and read from
--    its own folder (clips/<player_id>/...), the coach reads everything.
--    The bucket stays private; the app serves clips through short-lived
--    signed URLs.
-- 2) elite_messages carries the clip: clip_path (the storage object)
--    and clip_label (the drill it shows). Everything else about a clip
--    message is an ordinary player message: same RLS, same unread
--    count on the coach dashboard, same reply flow.
-- =====================================================================

-- Does the signed-in family own the clip at this storage path?
-- Path convention: clips/<player_id>/<homework_id>/<file>. Anything that
-- does not match the convention is nobody's.
create or replace function public.elite_owns_clip_path(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select split_part(p_name, '/', 1) = 'clips'
     and split_part(p_name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and public.elite_owns_player(split_part(p_name, '/', 2)::uuid);
$$;

drop policy if exists elite_film_read on storage.objects;
create policy elite_film_read on storage.objects
  for select using (
    bucket_id = 'elite-film'
    and (public.elite_is_coach() or public.elite_owns_clip_path(name))
  );

drop policy if exists elite_film_write on storage.objects;
create policy elite_film_write on storage.objects
  for insert with check (
    bucket_id = 'elite-film'
    and (public.elite_is_coach() or public.elite_owns_clip_path(name))
  );

alter table public.elite_messages
  add column if not exists clip_path text,
  add column if not exists clip_label text not null default '';
