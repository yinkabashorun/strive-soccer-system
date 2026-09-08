-- =====================================================================
-- Strive Elite - drill video storage (the one home for all drill clips)
-- =====================================================================
-- A public-read bucket owned by the project: anyone with a link can
-- stream (that's how the in-app player works), only coaches can write.
-- Uploads happen straight from the Drill bank page in the coach's
-- browser session.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('drill-videos', 'drill-videos', true)
on conflict (id) do update set public = true;

drop policy if exists "drill videos public read" on storage.objects;
create policy "drill videos public read" on storage.objects
  for select using (bucket_id = 'drill-videos');

drop policy if exists "drill videos coach insert" on storage.objects;
create policy "drill videos coach insert" on storage.objects
  for insert with check (bucket_id = 'drill-videos' and public.elite_is_coach());

drop policy if exists "drill videos coach update" on storage.objects;
create policy "drill videos coach update" on storage.objects
  for update using (bucket_id = 'drill-videos' and public.elite_is_coach())
  with check (bucket_id = 'drill-videos' and public.elite_is_coach());

drop policy if exists "drill videos coach delete" on storage.objects;
create policy "drill videos coach delete" on storage.objects
  for delete using (bucket_id = 'drill-videos' and public.elite_is_coach());
