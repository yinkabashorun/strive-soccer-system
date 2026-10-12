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

## Item 8: Progress counts time trained. A break never costs anything.

### What it is to the family
- Progress is time on the ball. The player's home screen and progress
  page show hours trained, sessions done and weeks trained, plus minutes
  by pillar. Nothing on the player's side shows a completion percentage,
  a streak, or anything that counts what was missed.
- A break is a date, not a penalty. Going away? The family sets the day
  they are back (from the app or by telling the coach). The app shows
  "On a break until Oct 20. Your training picks up right where you left
  off." While they are away nothing new is built, no texts go out, the
  coach's dashboard says "on a break" instead of "stale week". The day
  they are back (or when they tap "I'm back early") the program clock
  moves so the week they come back to is the week they left: the week
  they were in if it still had work in it, otherwise the next one. The
  hourly builder gives them that week within the hour.
- The coach's rating of the seven pillars stays, under its own name
  ("Coach's rating"): the ads and the demo page show the development
  score, so it is kept, not renamed into the time model.

### How it fits the system
1. elite_homework.pillar (migration 034): the drill's pillar copied onto
   the homework row, because players cannot read elite_drills under RLS
   and minutes-by-pillar is a player-facing number. Filled by a BEFORE
   INSERT OR UPDATE trigger from drill_id, so every writer, present and
   future (publish, Extra Work, clone-week, backfill), carries it with
   no code path to forget. One SQL backfill for existing linked rows.
2. elite_training_breaks (same migration): one row per break
   (player_id, since, until, note, created_by player|coach, resumed_at).
   History is never deleted, so the recap and the coach can always see
   when a player was away. RLS: coach reads/writes all, a family reads
   its own; a family's own writes go through the service client after
   the ownership check, the same as Extra Work and onboarding.
3. lib/elite/time-trained.ts: one pure calculator (unit-tested) for
   minutes trained, sessions done, weeks trained and minutes by pillar.
   The rules are the ones computeSummary already uses (a session is done
   when every drill in it is checked, a drill with no minutes counts 15),
   so the coach's numbers and the family's numbers never disagree. A
   gap of any length changes none of these numbers.
4. lib/elite/breaks.ts: currentBreak() and resumeAnchor() are pure and
   unit-tested. resumeAnchor only ever moves week1_monday LATER, by
   whole weeks, and only when the calendar ran ahead of the player
   during a break. settleBreaks() applies it once per break (resumed_at
   stamps it) from the two places a return is noticed first: the hourly
   builder and the family opening the app.
5. Every automatic process respects a break through the same rows: the
   hourly builder skips the player ("on a break until X"), the live-week
   audit skips them (no false "no plan" alarm), unlockDueWeeks holds the
   Monday unlock and its texts until they are back, the parent recap
   returns null during a break, the daily digest leaves them out of
   "plans to build" and "quiet 5+ days". The membership gate is not
   touched: a break is not a pause of the membership.
6. Player UI: the home screen loses the streak flame and the completion
   tile; the strip reads Time trained / Sessions done / Weeks trained.
   The week-complete card shows this week's minutes and the all-time
   total. The progress page leads with time (total, sessions, weeks,
   minutes by pillar) and keeps the pillar ratings as "Coach's rating".
   A Break card on the home screen sets or ends a break.
7. Coach UI: a Break control on the player page (set a return date, end
   early, see history); the roster card shows "On a break until X"
   instead of a red stale-week chip; the Plan builder card does not
   count a player on a break as behind.
8. Achievements: "7-Day Streak" (the only badge that punished a gap) is
   replaced by "10 Sessions". Badges already earned stay.
9. Coach-only numbers (streak, homework % on the roster and player page)
   are unchanged: they are the coach's accountability view and never
   reach the family.

### Decisions (Coach Yinka, Oct 12 2026: "Go")
- Progress = time trained, sessions, weeks, minutes by pillar. Coach's
  rating stays as a separate, named block.
- A break re-anchors the program clock on return so the player resumes
  the week they left (if it still had work) or the next one. Weeks are
  never skipped or shown as missed.
- A break can be set by the family or the coach, and ended early by
  either. Maximum 90 days per break; the coach can set another.
- No texts of any kind go to a family while they are on a break.
- Zero disruption: nothing changes for a player with no break row; the
  new column is filled by the database; no existing row is rewritten
  except to fill pillar from the drill it already links.

### SHIPPED Oct 12 2026 (verify green: typecheck, lint, 62 tests, build,
### cron + library checks; migration 034 applied to prod statement by
### statement after the one-shot apply timed out through the MCP: pillar
### column, fill trigger, backfill 433 of 433 linked rows, index, breaks
### table with RLS and both policies)

### Not in this item
- A "vacation plan" (lighter week while away). A break is a stop.
- Any change to the page copy (phase C).

## Item 3b: Few-yards template sessions (Coach Yinka, Oct 12 2026:
## "I want there to be template sessions for if you just have a few
## yards. I'll hand select the drills for that")

### Where it stands today
- A player on the "A ball and a few yards" setting gets a week composed
  the normal way, filtered to drills ticked "Works in a few yards".
  Zero drills are ticked (checked Oct 12: 35 active drills, 0 ticked;
  16 skill drills need no wall), so a tight-space player today would get
  warm-ups only and the audit would flag a thin week.

### What it is to the family
- A player with a ball and a few yards gets real, complete sessions that
  Coach Yinka built by hand for exactly that space. Same app, same week
  shape, every drill filmed, nothing improvised.

### How it fits the system (proposal)
1. elite_session_templates (migration 035): id, title, space ('tight'
   now; 'open' possible later), sort, active, created_at; plus
   elite_session_template_drills (template_id, drill_id FK to
   elite_drills, sort). Coach-only RLS like elite_drills. A template is
   an ordered list of FILMED bank drills, chosen by hand.
2. Placing a drill in a tight template marks it "Works in a few yards"
   (small_space = true), so the drill-level flag stays the single truth
   Extra Work and the prompt already read. No second flag.
3. The week for a tight-space player is TEMPLATES, not AI composition:
   conformSessionsToBank gets a template branch at BOTH gates
   (generation and publish), so whatever the AI or the studio wrote is
   replaced by N template sessions (N from the player's load). Rotation:
   least recently assigned to this player first, never the same template
   twice in a week while enough exist. The AI still writes the weekly
   focus, parent text and player summary from the sessions actually
   chosen. The 031 guard and the pillar trigger apply unchanged.
4. Extra Work for a tight-space player draws from template drills (the
   small_space flag already does this once rule 2 is in).
5. Coach UI: a "Few-yards sessions" section at /coach/drills: new
   template, name it, pick drills from the filmed bank in order, reorder,
   deactivate. Count shown against what the roster needs (4 In-Season, 6
   Off-Season).
6. Guards: unit tests (tight player gets only template drills, rotation,
   never twice in a week, falls back to repeats only when templates are
   short), audit line when a tight-space player's week had to repeat a
   template, the no-library check unchanged (templates live in the DB).

### Decisions needed before building
1. Templates REPLACE AI composition for tight-space players (recommended),
   or the AI picks among templates?
2. A template is the whole session, warm-up included, hand-picked
   (recommended), or skill drills only with the system adding the plyo
   warm-up as today? Either way a strengthening finisher is still added
   when the injury rule requires it.
3. Fewer templates than sessions in a week (under 4, or under 6 for an
   Off-Season player): repeat the least recent template and flag it on
   the dashboard (recommended), or hold the week until enough exist?
4. Build the template editor at /coach/drills (recommended) or its own
   page?
