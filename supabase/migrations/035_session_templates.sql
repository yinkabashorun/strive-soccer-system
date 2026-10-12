-- =====================================================================
-- Strive Elite - few-yards template sessions (offer stack item 3b)
-- =====================================================================
-- Coach Yinka, Oct 12 2026: "I want there to be template sessions for if
-- you just have a few yards. I'll hand select the drills for that."
--
-- A template is an ordered, hand-picked list of filmed bank drills. A
-- player on the "a ball and a few yards" setting gets their week FROM
-- these templates (rotated, least recently used first), not from AI
-- composition. The system still adds the plyo warm-up and, when the
-- injury rule requires it, the strengthening finisher.
--
--   elite_session_templates         title, space, sort, active
--   elite_session_template_drills   ordered drills in a template
--   elite_homework.template_id      which template a row came from
--                                   (drives the rotation; history)
--
-- Placing a drill in a tight template marks it "Works in a few yards"
-- (elite_drills.small_space), so the drill-level flag that Extra Work
-- and the prompt already read stays the single truth. No second flag.
-- Zero disruption: no template rows exist until the coach builds one,
-- and open-space players never read this table.
-- =====================================================================

create table if not exists public.elite_session_templates (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  space      text not null default 'tight' check (space in ('tight', 'open')),
  sort       int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.elite_session_template_drills (
  template_id uuid not null references public.elite_session_templates(id) on delete cascade,
  drill_id    uuid not null references public.elite_drills(id) on delete cascade,
  sort        int  not null default 0,
  primary key (template_id, drill_id)
);
create index if not exists elite_session_template_drills_template_idx
  on public.elite_session_template_drills(template_id, sort);

alter table public.elite_session_templates enable row level security;
alter table public.elite_session_template_drills enable row level security;

-- Coach-only, exactly like elite_drills (020): players never read these;
-- published plans copy the drill text into elite_homework.
drop policy if exists elite_session_templates_coach_all on public.elite_session_templates;
create policy elite_session_templates_coach_all on public.elite_session_templates
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());

drop policy if exists elite_session_template_drills_coach_all on public.elite_session_template_drills;
create policy elite_session_template_drills_coach_all on public.elite_session_template_drills
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());

-- A drill placed in a tight-space template works in a few yards, by the
-- coach's own hand. The flag is set by the database so no code path can
-- forget it.
create or replace function public.elite_mark_template_drill_small_space()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.elite_drills d
  set small_space = true
  where d.id = new.drill_id
    and d.small_space = false
    and exists (
      select 1 from public.elite_session_templates t
      where t.id = new.template_id and t.space = 'tight'
    );
  return new;
end $$;

drop trigger if exists elite_session_template_drills_small_space on public.elite_session_template_drills;
create trigger elite_session_template_drills_small_space
  after insert on public.elite_session_template_drills
  for each row execute function public.elite_mark_template_drill_small_space();

-- Which template a homework row came from: the rotation reads this per
-- player (least recently used first). Null for every composed row.
alter table public.elite_homework
  add column if not exists template_id uuid references public.elite_session_templates(id) on delete set null;
