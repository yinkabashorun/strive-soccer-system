-- =====================================================================
-- Strive Elite - training load plans, training space, Extra Work
-- =====================================================================
-- Offer stack item 1 (Oct 12 2026). Every default reproduces today's
-- behaviour exactly: in_season = the four-session week every player is
-- on now, open space = no new filtering, small_space false = no drill is
-- excluded for anyone, is_extra false = every existing homework row is a
-- normal session row. Existing players and tonight's Sunday build are
-- untouched by applying this.
--
--   elite_players.training_load  in_season (4 x 40) | off_season (6 x 40)
--   elite_players.space          open | tight ("a ball and a few yards")
--   elite_drills.small_space     coach-ticked: works in a few yards
--   elite_homework.is_extra      an Extra Work session the player added
-- =====================================================================

alter table public.elite_players
  add column if not exists training_load text not null default 'in_season'
    check (training_load in ('in_season', 'off_season')),
  add column if not exists space text not null default 'open'
    check (space in ('open', 'tight'));

alter table public.elite_drills
  add column if not exists small_space boolean not null default false;

alter table public.elite_homework
  add column if not exists is_extra boolean not null default false;
