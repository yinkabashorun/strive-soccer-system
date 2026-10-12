# Strive Elite offer stack: build designs

One section per stack item, written before building, approved by Coach
Yinka before a line of code. Every design fits the existing system:
the filmed bank, drill_id links, conformSessionsToBank at both gates,
the 031 database guard, the live-week audit, the hourly builder, the
parent text. Nothing temporary.

## Item 1: Load plans, space setting, Extra Work (with stack item 3)

### What it is to the family
- In-Season plan: 4 sessions x 40 minutes a week. Today's program. For
  the player already training 3 to 4 times a week with a team.
- Off-Season plan: 6 sessions x 40 minutes a week. Same shape, more
  days. For the player with more in the tank or no team load.
- Extra Work: any day, "I've got more today" gives a 20-minute block,
  one pillar, three filmed drills. Counts toward the week. Never needs
  rebuilding because it's assembled from the bank each time.
- Ball and a few yards: a space setting. A player with no wall, no
  cones and a tight space still gets a full week, every drill doable in
  the space they have.

### How it fits the system (nothing new outside the bank)
1. elite_players.training_load: 'in_season' (default) | 'off_season'.
   Migration 033 with a check constraint, privilege guard extended (a
   player can change their own load; the coach can override). Set at
   onboarding ("what does your week look like?") and editable from the
   player page Intake panel and the player's own settings.
2. elite_players.space: 'open' (default) | 'tight'. Same migration.
   'tight' means ball plus a few yards: no wall, no cone layouts longer
   than a few yards.
3. elite_drills.small_space (boolean, default false, same migration):
   the coach ticks it on each bank drill that works in a few yards. The
   builder and conformSessionsToBank filter the pool by it when
   space='tight', exactly the way needs_wall / has_wall works today.
   Prompt gets a TRAINING ENVIRONMENT line for it. If the tight pool is
   too small for a full week, the builder uses what exists and the
   audit flags it to the coach (no invented drills, ever).
4. SESSIONS_PER_WEEK stops being a constant: sessionsFor(load) = 4 or
   6. buildSessions, conformSessionsToBank, the fallback plan, the
   audit, the parent text ("six sessions this week") and the player UI
   read it from the player. Unit tests for both loads.
5. Extra Work: a server action buildExtraSession(playerId, pillar?)
   that composes three filmed skill drills (plus one strengthening
   finisher when the player's note requires it) through
   conformSessionsToBank, writes them as elite_homework rows in the
   current week with session = next number and a new column
   is_extra = true (migration 033). The 031 guard applies unchanged.
   The audit ignores extras for "is the week complete" and counts them
   for "what was done". The parent text mentions extras when they
   happened. Player UI: an "Extra Work" button on the week screen,
   pillar picker or "coach's pick" (the lagging pillar).
6. Progress: extras count toward time trained (item 8 lands the time
   model; until then they count like any session).

### Decisions (Coach Yinka, Oct 12 2026: "oh no yes I like it", plus
### "just make sure it doesn't disrupt players... extra work is structured
### and makes sense and is never a drill the player has already done.
### maybe they can choose between ball mastery, wall work, and 1:1 skills")
- Off-Season = 6 x 40. No under-13 cap given, none built.
- Family picks at onboarding, coach overrides on the player page.
- Extra Work: on demand from the bank. Three shelves: Ball Mastery,
  Wall Work (only shown with a wall on the profile), 1v1 Skills
  (Confidence pillar). Structured like a real session: one plyo
  warm-up, three skill drills, a strengthening finisher when the note
  requires one. HARD RULE: never a drill the player has already
  completed, any week; then never one from this week; then, only when
  every drill they can do is done, the least recently done. One open
  extra at a time.
- Load switch: manual only.
- Zero disruption: every default (in_season, open, small_space false,
  is_extra false) reproduces today's week exactly; all six current
  players verified in_season / open after the migration; tonight's
  Sunday build and tomorrow's unlock are untouched.
- Name for the ball-and-a-few-yards mode: later, Hormozi pass.

### SHIPPED Oct 12 2026 (verify green: typecheck, lint, 46 tests, build,
### cron + library checks; migration 033 applied to prod)

### Not in this item
- The time-trained progress model (item 8).
- Any change to the page copy (phase C).
