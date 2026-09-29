-- Links each homework row to its actual bank drill by id instead of only
-- by matching title text. Text matching alone breaks the moment the AI's
-- title drifts even slightly from the bank's; an id, once set, survives
-- that forever - a video added to the bank later always finds its way to
-- every homework row already linked to that drill, no text matching
-- involved at all.
alter table public.elite_homework
  add column if not exists drill_id uuid references public.elite_drills(id) on delete set null;
create index if not exists elite_homework_drill_id_idx on public.elite_homework(drill_id);
