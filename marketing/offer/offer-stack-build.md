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

### Decisions (Coach Yinka, Oct 12 2026: "1 yes 2 just skill 3 idk what
### you mean. 4. Coach drills")
1. Templates REPLACE AI composition for few-yards players.
2. A template is SKILL DRILLS ONLY; the system adds the plyo warm-up and,
   when the injury rule requires it, the strengthening finisher.
3. Explained and defaulted: with fewer templates than sessions in the
   week the least recently used one repeats and the Plan builder card
   shows a line until enough exist. He can overrule.
4. Editor lives at /coach/drills, above the bank.

### SHIPPED Oct 12 2026 (verify green; migration 035 applied to prod)
- Migration 035: elite_session_templates, elite_session_template_drills
  (coach-only RLS like the bank), a trigger that marks a placed drill
  small_space, elite_homework.template_id (drives rotation, history).
- bank-conform.ts templateSessions() + the tight-space branch at the top
  of conformSessionsToBank, so BOTH gates (generation and publish) turn a
  few-yards player's week into templates. Rotation: never used first,
  then oldest last-used; never twice in a week while enough exist;
  repeats flagged. Wall drills a player can't do are dropped and the
  session is filled from the few-yards pool; inactive templates and
  unfilmed drills never reach a player; no usable template = normal
  composition (audited).
- data.ts getSessionTemplates() / loadTemplateContext(); ai-coach passes
  the context through sanitize and the fallback and tells the AI the
  sessions are fixed; coach-actions publish loads it itself and writes
  template_id on every row; auto-plan and the studio route load it.
- health.ts auditTemplateRows(): "no few-yards sessions built yet" and
  "only N built, week repeats one", on the dashboard card like every
  other audit line.
- /coach/drills: Few-yards sessions editor (name, pick filmed skill
  drills in order, reorder, on/off, delete, count vs what the roster
  needs). tests/templates.test.ts (11 tests).

## Item 5, first half: Send a clip (Coach Yinka, Oct 13 2026: "Set it up";
## the Strive-standard checklist half is parked)

### What it is to the family
- On any skill drill, "Send a clip". The player films themselves doing
  it, it lands in their chat with the coach, and the coach answers by
  text in the same thread. The drill it shows is labelled on the
  message. Nothing to install, nothing to text to a number.

### How it fits the system
1. Storage: the elite-film bucket (005) was readable and writable by
   any signed-in user, open since Sept 26. Migration 036 scopes it: a
   family writes to and reads from clips/<player_id>/... only
   (elite_owns_clip_path, database-side), the coach reads everything,
   the bucket stays private and the app serves clips through one-hour
   signed URLs. Same path convention in lib/elite/clips.ts, unit-tested.
2. Messages: elite_messages gets clip_path and clip_label. A clip is an
   ordinary player message: same RLS, same unread count on the coach
   dashboard, same reply, same thread on both sides. The thread renders
   the video inside the bubble.
3. Upload: straight from the phone into the bucket (browser client,
   RLS-gated, same as the coach's drill uploads), 150MB cap, then the
   sendClip server action verifies the path is the player's own and the
   drill is on their plan, writes the message, and emails the coach
   (event player_clip, same channel as a chat message).
4. Player UI: a "Send a clip" button under every skill drill on Today's
   session and the week list (not warm-ups, not finishers); states
   Sending / Clip sent. Copy never says AI.
5. Guards: storage RLS (the database refuses a write outside the
   family's own folder), ownsClipPath in the action, tests/clips.test.ts.

### Decisions
- Who answers and the response window stay open (intake file). Today it
  is Coach Yinka in the thread, like every message.
- The checklist half is parked (Oct 13).

## Item 7: Bi-weekly progress video (Coach Yinka, Oct 13 2026: "Go")

### What it is to the family
- Every second week (weeks 2, 4, 6...) the app asks the player to film
  ONE drill, the same one every time. The parent gets the link by text
  in Coach Yinka's voice, with the clip from two weeks ago next to it,
  so the change is theirs to see. The family ticks whether the clip may
  be shared in the Strive community; the coach posts it only on a yes.

### How it fits the system
1. Migration 037: elite_players.benchmark_drill_id (coach's pick) and
   elite_progress_videos (one row per player per week by unique
   constraint: drill, clip path, share_ok, parent_sent_at, posted_at).
   Coach full access; family reads and inserts its own. The 036 storage
   ownership function now also accepts progress/<player_id>/<week>/...
2. The benchmark: the coach's pick on the player page; until set, the
   first SKILL drill the player ever completed (pure, unit-tested;
   history never changes so it stays the same drill).
3. Cadence: isProgressVideoWeek (even weeks from 2), due once per week,
   never while on a break, never before the week exists. Pure, tested.
4. Upload: the same browser-to-bucket helper as Send a clip (036), path
   progress/<player_id>/<week>/<ts>.<ext>; submitProgressVideo verifies
   the path, the week and that it is due, writes the row, texts the
   parent (30-day signed links, event progress_video, no sign-off,
   forward-looking close, no exclamation), emails the coach.
5. Player UI: a gold Progress video card on the home screen during a
   due week: the drill, its demo, the clip from two weeks ago, the
   community consent tick (unchecked by default), Film it and send.
6. Coach UI: Progress videos panel on the player page: benchmark picker
   (filmed skill drills), every clip by week with OK to share / Private
   and Parent texted / not, Download, Mark posted to the community
   (allowed only when share_ok; posting to Skool is by hand).
7. Guards: storage RLS, unique (player, week), the action's week / path
   / due checks, tests/progress-video.test.ts.

### Decisions (defaults, Coach Yinka can overrule)
- One benchmark drill per player, coach-set, app fallback as above.
- Consent is per clip, asked at upload, unchecked by default. Nothing
  is posted without it.
- Posting to Skool stays manual (no API); the panel tracks it.

### Item 7, REVISED Oct 14 2026 (Coach Yinka): the first clip is filmed
### on day one
- Cadence is now week 1 (first clip, before the first session) then
  every second week (2, 4, 6...). Two weeks after the first clip the
  family watches the two side by side.
- Default drill for everyone: 8-cone freestyle, the coach can override
  per player. Fallback if that drill is ever unfilmed or inactive: the
  first skill drill the player completed.
- The 2-Week Proof Guarantee (guarantee-deep-dive.md) is built on these
  two clips but is NOT in the app: no tracker, no refund wording, nothing
  a player sees. Player copy is "Your first clip" / "Week N clip" only.

## Item 9, first course: Keep It Up, the Courses tab, and the player
## tier formula (Coach Yinka, Oct 23 2026, via quiz)

### SUPERSEDED Oct 23 2026, SHIPPED Oct 24 (Coach Yinka: "Actually ...
### Just make it an option for me to toggle to offer juggling drills
### then select the ones you can choose from for the player")
No leagues, no tiers, no formula. Migration 040: elite_drills.opt_in
(a course drill, never in a week on its own), elite_players.
offer_opt_in + opt_in_drill_ids (the coach's switch and picks; the 008
privilege guard extended so a player cannot set them; a deleted drill
is pruned from every player's picks by trigger). One rule in
bank-conform.ts, drillFitsPlayer + offeredBank, read by the AI menu,
the fallback, the publish gate, Extra Work and the few-yards templates.
Coach UI: OfferedDrillsPanel on the player page under Intake (switch
"Offered in the week" / "Not offered", then a tick per course drill);
/coach/drills has a "Course drill" tick and badge. The 14 Keep It Up
rows are opt_in + active. tests/opt-in.test.ts (12). Everything below
this line is the earlier design and is kept as the record of what was
considered; the Courses tab as a library for everyone is still open.

### Where it stands today
- Keep It Up is 14 filmed bank drills ("Juggling: ..." under Ball
  Mastery, sorts 300 to 410, all INACTIVE), a preview page, and the
  copy rule from his Oct 23 pass. It has no home in the app.
- Onboarding already captures age, position, club (free text),
  dominant foot and a self-picked level (Developing / Competitive /
  Advanced / Elite). The self-pick is unreliable (Remi 13 "Elite",
  Abdul at Virginia Phoenix Elite "Developing"). Only the AI prompt
  reads it, as one line.
- No drill in the bank says who it is for. The builder cannot tell a
  beginner's week from an Elite player's beyond the wall and space
  flags.

### His decisions (quiz answers, Oct 23 2026)
1. League options in the app = the GHL survey's four: REC, Travel,
   ECNL RL / MLS Next 2, ECNL / MLS Next.
2. "The league itself is the level." No separate level words.
3. The player's tier comes from league and age automatically, Coach
   Yinka overrides. 7 to 10 year olds drop one.
4. "They never need to see their league band at all, it's just our
   backend formula."
5. Courses get THEIR OWN TAB in the app. The tab is a LIBRARY: nothing
   tracked there. Everyone sees it.
6. The course drills live in the bank, and the formula decides which
   players are "at such a low level where they need the juggling
   drills" in their WEEK. Younger / beginner players get them.
7. Progressive overload: the band rises on his word. A beginner's week
   draws from beginner drills; when he moves the player up on the
   Intake panel, the next week draws from the next tier. He advances
   players, never the app.

### What it is to the family
- A Courses tab next to Week, Progress, Film and Messages. Open it and
  Keep It Up is there: seven levels, every drill video, the cue, the
  pass mark on the beginners. Watch, go train, nothing to tick. More
  courses appear as they are filmed.
- Nothing about leagues or tiers anywhere on their screens. The week
  just fits them better.

### How it fits the system
1. Migration 040, elite_players: `league` text check in
   ('rec','travel','ecnl_rl','ecnl'), nullable (existing players);
   `tier_override` smallint 1..3 nullable. The self-picked `level`
   column stays for the record but the onboarding step that asks it is
   REPLACED by the league pick ("Which league does your player play
   in?", the four GHL options, same words). The privilege guard (008)
   extended: a player can set league at onboarding, never tier_override.
2. lib/elite/tier.ts, pure, unit-tested: playerTier({league, age,
   tier_override}) = override if set, else rec/travel -> 1, ecnl_rl ->
   2, ecnl -> 3, minus 1 when age is 7 to 10 (floor 1); null league ->
   null (no filtering, today's behaviour, so nothing changes for a
   player until Coach Yinka sets a league). Tier words in coach-only
   UI: 1 Beginner, 2 Intermediate, 3 Advanced. Never rendered in the
   player app, never in any text or email.
3. Migration 040, elite_drills: `tier` smallint 1..3 nullable. Null =
   for everyone (every drill today). Set at /coach/drills next to the
   few-yards tick ("Who is it for: everyone / beginner / intermediate /
   advanced"). The Keep It Up rows get tiers on his word (proposal:
   Levels 1 to 4 tier 1, Levels 5 to 7 tier 2) and are flipped ACTIVE
   so the builder can use them.
4. bank-conform drillFitsPlayer gains the tier rule next to wall and
   space: a drill with a tier fits only a player of that tier; an
   untiered drill fits everyone; a player with no tier gets everything
   (unchanged). Used at BOTH gates (generation and publish), so no
   hand-edited plan can give an ECNL player beginner juggling or a REC
   player an untiered-but-advanced pattern he later tiers. The
   methodology prompt marks tiered drills ([beginner]) and carries the
   player's tier as a line the AI sees and the family never does.
   Thin tier pools are audited like thin few-yards pools: "only N
   beginner drills in the bank" on the dashboard card, never an
   invented drill.
5. Progressive overload = the tier rule plus his hand: the Intake panel
   shows "Tier: Beginner (Travel, age 12, formula)" with an override
   select; changing it takes effect at the next build (Sunday, or
   "Build missing weeks"). Week history keeps the tier it was built
   under (no column needed: the rows are the record).
6. Courses, library only. Migration 040: elite_courses (id, slug, name,
   subtitle, intro, active, sort) and elite_course_steps (course_id,
   level_no, level_name, tag 'beginner'|'advanced', drill_id FK ->
   elite_drills on delete restrict, cue, pass_mark text nullable, sort).
   Coach-only write RLS like the bank; read for any signed-in member.
   The step's video, title and reps come FROM the drill row by id (one
   source; rename a drill, the course follows). Coach editor at
   /coach/drills, "Courses" above the few-yards editor: name, levels,
   pick filmed bank drills, tag, cue, pass mark, reorder, on/off. Keep
   It Up is seeded by migration from the 14 rows exactly as the
   preview page reads today.
7. Player tab: app/(player)/courses (list) and /courses/[slug] (the
   ladder: level cards, drill tiles with the bank video, tag, title, one
   cue, pass mark on beginners only; the preview page's layout in the
   app's components, dark, Barlow). AppNav gets "Courses". No ticks, no
   time trained, no Send a clip on these tiles (his "library only").
   Demo mode shows the real courses like it shows the real bank.
8. Guards: tests for the tier formula (every league x age band,
   override wins, null league = null), the tier rule in bank-conform at
   both gates, the course route rendering from bank rows only, and the
   031 trigger unchanged (course steps never write homework). CI and
   the Vercel buildCommand run them.

### Still his, before code
- DECIDED Oct 23 (Coach Yinka: "Just give the beginner ones to the
  beginners and advanced to the advanced"): a course drill's tier IS
  its tag. Every "catch" drill (tagged Beginner) is tier 1, every
  "keep it up" drill (tagged Advanced) is tier 2. Tier 3 (ECNL / MLS
  Next) gets no juggling drills in the week, matching his "juggling
  drills will mostly be for beginners / intermediate". The Courses
  tab itself still shows everyone everything.
- League for the 7 existing players, from their club text: Elias "VSA
  N1 premier red", Bryan "VSA u15", Abdul "Virginia phoenix elite fc",
  Mason "St. James MLS Next U13", Tim "PPA MLS NEXT AD", Remi "VDA",
  Yinka "Nova Fc". Until set, their weeks do not change.
- Whether the onboarding self-pick (Developing / Competitive / Advanced
  / Elite) is removed outright (proposed) or kept as a second question.
- The pass-mark number for beginners (10 in a row is mine).

## Item 9, the course roadmap (Coach Yinka, Oct 25 2026: "We are going
## to Make a shooting course, & full weak foot course, then strength
## course, then agility course, then recruiting course like making a
## csv / highlight tape and how to reach out")

Five courses in his order. Nothing built yet; this is the scope and what
each one needs. The Oct 12 launch rule holds: a course is announced only
when it is filmed and in the app, never as an "included" claim before.

### Where it stands today (the bank, from the record)
| Course | Filmed in the bank today | Pillar | Fits the slot? |
|---|---|---|---|
| Shooting | 0 drills. No Shooting pillar exists; drills have no "needs a goal" flag (players have has_goal since 019) | needs a new pillar | yes, once the pillar exists |
| Weak foot | 8 (4 wall, sorts 300 to 330; 4 no-wall, sorts 100 to 130) | Weak Foot, a rated metric | these are skill drills already in weeks; the course is the ladder, not a slot |
| Strength | 13 finishers; 11 from the Oct 7 list unfilmed | Strengthening | already finishers in weeks; the course is the progression |
| Agility | 0. Speed pillar has zero drills; 7 plyos are the nearest | Speed | yes, after the plyos, which is where agility belongs |
| Recruiting | nothing, and it is not drills: CV, highlight tape, reaching out | none | no. Lessons, not bank rows |

### Two kinds of course, one primitive
1. A DRILL course (shooting, weak foot, strength, agility, Keep It Up):
   ordered steps, each step a bank drill by id. The video, title and
   reps come from the drill row (rename a drill, the course follows).
   Whether a step's drill also enters the WEEK is a separate setting on
   the drill, not the course: opt_in drills go in the slot after the
   warm-up for players the coach offers them to (040); ordinary drills
   (weak foot, finishers) are already in weeks through the pillar rules.
   Putting a weak foot drill in a course must never pull it out of the
   builder, so the course never changes opt_in.
2. A LESSON course (recruiting): ordered steps, each step a page with a
   title, body in Coach Yinka's and Gary's voice, an optional video and
   an optional download (the CV template). No bank row, no homework
   row, nothing tracked; the 031 guard is never touched because a
   lesson never writes homework.
Both live in the same tables so the Courses tab is one screen:
elite_courses (slug, name, subtitle, intro, kind drill|lesson, active,
sort) and elite_course_steps (course_id, level_no, level_name, tag
beginner|advanced|null, drill_id nullable FK on delete restrict, title,
body, video_url, download_url, cue, pass_mark, sort). A step is EITHER a
drill_id OR a lesson body, enforced by a check constraint. Coach-only
write RLS like the bank; read for any signed-in member. Coach editor at
/coach/drills; player tab app/(player)/courses and /courses/[slug],
library only (his Oct 23 call), everyone sees every active course.

### What each course needs before it exists
- Shooting: migration 041 adds the Shooting pillar (the 032 pattern) and
  elite_drills.needs_goal; drillFitsPlayer gains the goal rule next to
  the wall rule (no goal on the player = never a goal drill) so the
  prompt's "strikes go at a cone" line is enforced on the output, not
  advised. Then his clips. The Shooting pillar is NOT a rated metric
  unless he says so (the seven pillars are fixed in the app).
- Weak foot: the 8 filmed drills ordered into a ladder by him, plus
  whatever he films to fill it (the Oct 7 list had the no-wall half;
  shipped Oct 21). Nothing to build beyond the course tables.
- Strength: 13 finishers ordered into a progression by him, plus the 11
  unfilmed. Nothing to build beyond the course tables.
- Agility: his clips, saved under Speed with opt_in on, offered per
  player like juggling. The slot after the plyos is exactly where they
  land. Nothing new to build beyond the course tables.
- Recruiting: the outline from him and Gary (what goes in a soccer CV,
  the highlight tape rules, the outreach message, who to send it to,
  when). Gary's overseas path is the natural second half. Alumni names
  in a member-only course are a lower bar than public, but each family
  still gets a heads-up before being named (Sept 29 rule). This
  supersedes the Sept 30 "no course modules to start" for Complete,
  since Complete is retired and this is Elite content.

### Lesson from Keep It Up, applied to every filming run
Send each clip with its pattern name and its tag (beginner / advanced)
in the same message. I read clips only for cut points, never to name
the pattern; the Oct 22 sort was wrong on six of twelve clips because I
guessed.

### Build order (proposed)
1. The course tables, the coach editor and the Courses tab, seeded with
   Keep It Up as the preview page reads today. One build, every course
   after it is data.
2. Shooting pillar + needs_goal (migration 041) so his first shooting
   clips have a home in the bank the day they arrive.
3. Weak foot and Strength assembled from filmed drills the moment he
   orders them: two courses live with zero new filming.
4. Agility and Shooting as the clips land. Recruiting when the outline
   is written.
Decision needed from him before step 1: confirm library only (no ticks,
no time trained, no Send a clip on course tiles) still stands.

### Added Oct 25 2026 (Coach Yinka: "after we add the nutrition bundle
### too"): a sixth course, Nutrition
A LESSON course like recruiting: pages, not drills (what to eat on a
training day, match day, the night before, hydration, what a 13 year
old's plate looks like, what to skip). Fits the same tables with kind
= lesson. Two flags before it is written: (1) nutrition guidance to
minors is a different exposure than a drill video; keep it to general
food guidance a coach can stand behind, no calorie targets, no
supplements, no weight goals, and a plain line that a doctor or
dietitian decides anything medical; (2) the privacy policy and terms
may need a sentence saying the course is general guidance, not medical
advice (lawyer not yet involved, see Sept 26). Where it lands in his
order: sixth, after recruiting. Announced only when written and in the
app, like every course.
