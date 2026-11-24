-- 084: a drill's minutes are never a made-up figure (Nov 24 2026, Coach
-- Yinka: "the tracking of sessions needs to be absolutely and utterly on
-- point. No placeholders").
--
-- elite_homework.duration_min is what time trained, the finish screen, the
-- medals and the coach's numbers are all added up from. Since 009 the column
-- has had a default of 15, so any write that left the minutes out was
-- quietly credited as a 15 minute drill. No row in production carries that
-- default today (checked Nov 24: 1,436 rows, 4 to 14 minutes, none at 15),
-- and the code now refuses a drill with no minutes at every writer (the
-- publish gate, extra work). This makes the database refuse it too:
--
--   no default   a write that leaves the minutes out fails, loudly
--   a check      the minutes are a real figure, 1 to 120
--
-- Idempotent. No row is changed.
alter table public.elite_homework alter column duration_min drop default;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'elite_homework_minutes_real' and conrelid = 'public.elite_homework'::regclass
  ) then
    alter table public.elite_homework
      add constraint elite_homework_minutes_real check (duration_min between 1 and 120);
  end if;
end $$;
