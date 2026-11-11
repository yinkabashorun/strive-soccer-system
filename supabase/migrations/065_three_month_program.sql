-- =====================================================================
-- Strive Elite - the 3-month program
-- =====================================================================
-- Coach Yinka, Nov 11 2026, the structure he used to come back from a
-- 6-month hip tear: "each month kind of has a main specific focus ... the
-- first 2 weeks will give most of the attention to the weak foot, the
-- second 2 weeks most of the attention to the first touch out the air,
-- but also doing other things"; "Me, two of 3"; "maybe this player needs
-- strengthening all 3 months or 2/3 months and the other is speed";
-- "starting next week we structure their 3 months after I take the quiz
-- on the players".
--
--   elite_drills.focus_pillar   the program pillar a half-month focus
--                               draws this drill from (keys live in
--                               lib/elite/program.ts); null = not in a
--                               focus pool. The old pillar column is
--                               untouched: it still carries the ratings
--                               and time trained.
--   elite_drills.level          1 easier, 2 standard, 3 harder inside the
--                               pillar. The second week of a focus leads
--                               with the harder drills.
--   elite_drills.harder         the coach's "make it harder" line, shown
--                               with the cue (eyes closed, weak foot only).
--   elite_programs              one row per player program: the week it
--                               starts on (the player's own week number,
--                               so a break moves the program with them),
--                               six focus pillars (three blocks of two
--                               halves), the threads (strength, speed)
--                               with the months each runs, and the quiz
--                               answers the coach gave. One active
--                               program per player, by a unique index.
--
-- Every default reproduces today's week: a drill with no focus_pillar is
-- in no focus pool, and a player with no program builds exactly as
-- before. No player row is touched here.
-- =====================================================================

alter table public.elite_drills
  add column if not exists focus_pillar text,
  add column if not exists level smallint,
  add column if not exists harder text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'elite_drills_focus_pillar_check') then
    alter table public.elite_drills add constraint elite_drills_focus_pillar_check
      check (focus_pillar is null or focus_pillar in (
        'first_touch_ground', 'first_touch_air', 'weak_foot',
        'close_control', 'one_v_one', 'running_with_ball',
        'passing_short', 'passing_long', 'passing_air',
        'speed_technique', 'acceleration', 'top_speed', 'explosiveness',
        'scanning', 'decision_making'
      ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'elite_drills_level_check') then
    alter table public.elite_drills add constraint elite_drills_level_check
      check (level is null or level between 1 and 3);
  end if;
end $$;

create table if not exists public.elite_programs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.elite_players(id) on delete cascade,
  start_week int not null check (start_week >= 1),
  weeks int not null default 12 check (weeks = 12),
  status text not null default 'active' check (status in ('active', 'ended')),
  focuses jsonb not null check (jsonb_typeof(focuses) = 'array' and jsonb_array_length(focuses) = 6),
  threads jsonb not null default '[]'::jsonb check (jsonb_typeof(threads) = 'array'),
  quiz jsonb not null default '{}'::jsonb,
  created_by uuid references public.elite_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists elite_programs_one_active
  on public.elite_programs(player_id) where status = 'active';

alter table public.elite_programs enable row level security;

create policy elite_programs_coach_all on public.elite_programs
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());
create policy elite_programs_owner_read on public.elite_programs
  for select using (public.elite_owns_player(player_id));

-- The bank today, tagged by title. Which drill sits under which pillar
-- and at which level is a first read for Coach Yinka to correct in the
-- drill bank; only drills with no tag yet are touched, so his edits are
-- never overwritten by a re-run.
update public.elite_drills d
   set focus_pillar = v.pillar, level = v.level
  from (values
    ('2 touch ball mastery variation 1', 'first_touch_ground', 1),
    ('2 touch ball mastery variation 2', 'first_touch_ground', 2),
    ('L turn, roll, touch', 'first_touch_ground', 2),
    ('L turn, pullback, chop', 'first_touch_ground', 2),
    ('Push pull, fake roll, roll across', 'first_touch_ground', 3),
    ('Wall juggles', 'first_touch_air', 2),
    ('Juggling: one touch, catch', 'first_touch_air', 1),
    ('Juggling: one touch, keep it up', 'first_touch_air', 1),
    ('Juggling: two touches each foot, catch', 'first_touch_air', 1),
    ('Juggling: two touches each foot, keep it up', 'first_touch_air', 2),
    ('Juggling: one, two, catch', 'first_touch_air', 1),
    ('Juggling: one, two, keep it up', 'first_touch_air', 2),
    ('Juggling: laces, inside, catch', 'first_touch_air', 2),
    ('Juggling: laces, inside, keep it up', 'first_touch_air', 2),
    ('Juggling: drop, thigh, catch', 'first_touch_air', 2),
    ('Juggling: thighs high, keep it up', 'first_touch_air', 3),
    ('Juggling: thighs, laces, catch', 'first_touch_air', 3),
    ('Juggling: laces, thigh, catch', 'first_touch_air', 3),
    ('Juggling: thighs, laces, keep it up', 'first_touch_air', 3),
    ('Juggling: head it up', 'first_touch_air', 3),
    ('Weak foot tap, pull, push', 'weak_foot', 1),
    ('Weak foot pop and settle', 'weak_foot', 1),
    ('Weak foot outside pull, inside pull', 'weak_foot', 2),
    ('Weak foot pop and juggle', 'weak_foot', 2),
    ('Wall pass, touch, stepover', 'weak_foot', 2),
    ('Wall pass, touch, scissor', 'weak_foot', 2),
    ('Wall pass, touch behind the leg', 'weak_foot', 3),
    ('Wall pass, touch, L turn', 'weak_foot', 3),
    ('Figure-8 dribble', 'close_control', 1),
    ('Inside-outside cone weave', 'close_control', 1),
    ('La Croqueta cone weave', 'close_control', 2),
    ('Body Feint', 'one_v_one', 1),
    ('Neymar Feint', 'one_v_one', 1),
    ('La Croqueta', 'one_v_one', 2),
    ('Mbappe Chop', 'one_v_one', 2),
    ('Maradona', 'one_v_one', 2),
    ('Elastico', 'one_v_one', 3),
    ('Reverse Elastico', 'one_v_one', 3),
    ('1v1 freestyle', 'one_v_one', 3),
    ('Two touch passing', 'passing_short', 1),
    ('Two touch passing, outside touch', 'passing_short', 2),
    ('3 cone passing drill, inside touch', 'passing_short', 2),
    ('3 cone passing drill, outside touch', 'passing_short', 2),
    ('3 cone turning drill', 'passing_short', 2),
    ('3 cone turning drill, outside touch', 'passing_short', 3),
    ('Pass, touch past, Cruyff turn', 'passing_short', 3),
    ('Pass, touch past, Cruyff turn, outside touch', 'passing_short', 3),
    ('Freestyle dribbling with head up', 'scanning', 2),
    ('Juggling and scanning', 'scanning', 2),
    ('Speed: Stop and go', 'speed_technique', 1),
    ('Speed: 50%, 100%, 25%', 'speed_technique', 2),
    ('Speed: Sprint around the cones', 'speed_technique', 2),
    ('Speed: Kneel and drive', 'acceleration', 1),
    ('Speed: 15 yard sprint', 'acceleration', 2),
    ('Speed: Drop, shuffle in place, sprint', 'acceleration', 2),
    ('Speed: Drop, shuffle forward and back, sprint', 'acceleration', 3),
    ('Speed: Drop, shuffle sideways, sprint', 'acceleration', 3),
    ('Speed: Zigzag sprint', 'top_speed', 2),
    ('Speed: Zigzag sprint and backpedal', 'top_speed', 2),
    ('Speed: The cross', 'top_speed', 3),
    ('Speed: Push-up start sprint', 'explosiveness', 2),
    ('Speed: Long jumps', 'explosiveness', 2),
    ('Speed: Side bounds', 'explosiveness', 2)
  ) as v(title, pillar, level)
 where d.title = v.title and d.focus_pillar is null;
