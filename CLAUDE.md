# Strive Soccer — Business Facts (Coach Yinka)

Address the user as "Coach Yinka". These are confirmed facts; never invent
prices, dates, or numbers not listed here. Flag anything unconfirmed.

## Open items (living list, keep this current)

Read this every session. Update it the moment something here gets done or a
new open item comes up, don't let it go stale. When Coach Yinka asks "where
are we," this list IS the answer.

- [ ] Waiver form in GHL - real liability gap, top priority
- [ ] Get Gary's one-pager signed
- [ ] Announce Strive Elite app publicly - don't wait on Gonz's quote
- [ ] Stamp Gary's $80-session split (suggested $40/$40)
- [ ] Stamp referral program $25 credit
- [ ] Add referred / referred_by fields in GHL
- [ ] Confirm PWC field permit is actually granted, not just requested
- [ ] Migrate the remaining 13 Manus-hosted drill videos to Strive's own
      storage (Neymar Feint done Sept 16, re-trimmed from raw footage)
- [ ] FOUND + FIXED Sept 29 2026, then made permanent same day (Coach
      Yinka: "i need never again"): elite_homework.video_url was copied in
      once at publish time from whatever the bank had THEN - a video added
      to the bank later never reached an already-published week on its
      own. Real impact: this week's homework for actual players (Abdul
      Rahim confirmed, likely others) had zero videos even though the
      matching bank drills now have them, since the drill-video migration
      is ongoing and plans got published before some videos landed. First
      pass backfilled 19 stuck rows via SQL and added an auto-heal step to
      the Sunday cron matched by drill TITLE TEXT - still fragile, would
      silently stop working the moment the AI's generated title ever
      drifted from the bank's. Coach Yinka said that wasn't good enough,
      so it's now architectural: migration 028 adds elite_homework.drill_id
      (real FK to elite_drills), set at publish time in coach-actions.ts
      alongside video_url. backfillHomeworkVideos (lib/elite/data.ts) is
      now two passes - (1) any row already linked by drill_id gets its
      video re-synced from that drill by id, no text matching at all, so
      once linked a row can never drift again; (2) legacy/unlinked rows
      still get one title-match attempt, and if it hits, that row sets
      drill_id and graduates onto the permanent id-based path for good.
      Runs on the Sunday cron AND immediately whenever a coach saves a
      drill with a video (saveDrill in drill-actions.ts), so a newly
      uploaded video reaches waiting homework the same minute, not next
      Sunday. Also ran the full historical backfill directly via SQL:
      131 of 156 existing homework rows now carry a real drill_id, 79 have
      a video. The remaining 25 unlinked rows have no bank-title match at
      all (old/renamed drills, not fixable by matching - would need a
      coach to manually relink if ever noticed) and the remaining 77
      no-video rows are linked correctly but the bank genuinely has no
      video for that drill yet - both will resolve on their own as the
      Manus video migration continues, no further engineering needed.
- [ ] SHIPPED Sept 29 2026 (Coach Yinka: "ONLY ASSIGN DRILLS FROM THE
      DRILL BANK THAT HAVE VIDEO!"): everything above fixes a video
      reaching homework AFTER a drill gets assigned - this closes the
      other side, never assigning a video-less drill to a real player in
      the first place. getDrillBank() (lib/elite/data.ts) now takes an
      optional onlyWithVideo flag; both places that actually compose a
      player's week - the Sunday auto-plan cron (auto-plan.ts) and the
      coach's manual session-notes AI generator
      (app/api/elite/ai/session-notes/route.ts) - now call it with
      onlyWithVideo: true, so a drill a coach just added but hasn't
      filmed yet can never be drafted into a real plan, whether by the AI
      or by its deterministic fallback (both draw from the same bank
      array). The coach's own /coach/drills management page still calls
      getDrillBank() unfiltered, on purpose - the coach needs to see and
      edit video-less drills to actually add their videos. Currently a
      no-op in practice (all 35 active drills already have videos,
      confirmed via direct DB query the same day), this is purely
      preventive for the next drill a coach adds before filming it.
- [ ] RECURRENCE, FOUND + FIXED FOR REAL Oct 1 2026 (Coach Yinka, with a
      real player's DM: "I only managed to see the Maradona... I see
      Ronaldinho drill. And that's it" - two filmed drills in a 16-drill
      week; "I thought this was fixed!"): the Sept 29 fix above
      constrained what the AI is SHOWN, not what it OUTPUTS. Three ways an
      unfilmed drill still reached a player: (1) every live week had been
      generated BEFORE Sept 29 and was never repaired - the no-video rows
      were the 20 inactive bank drills (Foundations + sole rolls, Weak-foot
      strikes, Driven wall passes...), linked by id by the backfill but
      never filmed; (2) the plyo warm-ups "Pogo & Tuck / Lateral Power /
      Quick Feet / Explosive" are NOT bank drills - they're
      lib/elite/training.ts PLYO_WARMUPS, a built-in list that became the
      warm-up whenever bank plyos weren't passed through; (3) nothing ever
      checked the AI's drill titles against the bank - a paraphrase, a pad
      like "Apply under pressure"/"Focus block", or a title typed by hand in
      the studio all published with no video. THE FIX is on the OUTPUT, in
      one module, lib/elite/bank-conform.ts: conformSessionsToBank() maps
      every drill to a filmed bank drill by exact-or-clear-fuzzy title
      (taking the bank's exact title so the id link always hits) or
      REPLACES it with a filmed bank drill of the right pillar (wall rule
      respected, no repeats in a session, pillars with no filmed drills -
      Scanning, Decision Making, Speed - fall to Ball Mastery/Confidence).
      It runs at TWO gates: ai-coach.ts sanitize() for every generated
      plan (AI or fallback), and coach-actions.ts applyGeneratedPlanCore
      at publish time against the video-only bank, so a hand-edited plan
      can't bypass it. buildSessions no longer prepends a built-in plyo
      when a bank exists (two bank plyos, one, or none - never a library
      one), and the methodology prompt now says titles are copied
      character-for-character. LIVE WEEKS REPAIRED directly via SQL the
      same day, previewed row by row first: 46 rows across Abdul Rahim wk
      1, Elias wk 6, Mason Jhaveri wk 4, Yinka Bash wk 2 - every live week
      now reads 0 unfilmed / 0 unlinked / 0 inactive (Remi's test week was
      already clean). completed flags were left as they were.
- [ ] DONE Oct 1 2026 (Coach Yinka: "DELETE ALL DRILLS YOU HAVE THAT DONT
      HAVE VIDEO"): hard-deleted every drill in elite_drills with no
      video_url - 22 rows, all of them already inactive (Foundations +
      sole rolls, Weak-foot patterns / push-pulls / rebounds / strikes,
      Rebound passing / rhythm, Check and turn, Pass turn pass, Driven
      wall passes, Scan + touch, Number-call scanning, Half-turn receives,
      Two-gate finish, 1v1 shadow, Clip study, Move of the day, Chain two
      moves, Juggling record, Quick feet, Acceleration starts, Reaction
      starts). They are GONE, not paused - if any of these ever get
      filmed, the coach re-adds them from /coach/drills as new drills. The
      bank is now 36 drills, every one with a video (35 active, 1 inactive
      but filmed). The homework FK is on delete set null, so the delete
      could only affect rows linked to those drills: verified after the
      fact that all 5 live weeks (Abdul Rahim wk 1, Elias wk 6, Mason
      Jhaveri wk 4, Yinka Bash wk 2, Remi wk 1) still read 0 unlinked /
      0 no-video. The 31 unlinked rows left in the whole table are in old,
      already-finished weeks only - nothing a player is training on. The
      earlier "20 inactive drills" wording above is obsolete; there are no
      unfilmed drills in the bank for the AI, the fallback, or a coach to
      pick anymore, so the onlyWithVideo filter and bank-conform are now
      pure insurance for the next drill added before it's filmed.
- [ ] FOUND + FIXED FOR REAL Oct 1-2 2026 (Coach Yinka: "Why don't you
      fix those errors then? Why ask me first, I already told you my
      standard"): players were training a STALE week - on Oct 1 Elias was
      on wk 6 of a clock on wk 7, Mason 4 of 5, Abdul 1 of 2. First read
      was wrong ("the Sept 27 cron didn't run"). It DID run, 3:32pm ET
      Sept 27, and built Elias wk 6, Mason wk 4, Abdul wk 1, Yinka wk 2.
      THE REAL BUG was the targeting rule: applyGeneratedPlanCore's
      catch-up branch ("live week has no plan -> build the live week, go
      live now") applied on SUNDAYS too, so the Sunday cron "caught up"
      the week that had hours left and never built the week starting
      Monday. Anyone ever behind stayed exactly one week behind forever -
      and Oct 4 would have done the same thing again. Three structural
      fixes, all shipped: (1) Sunday is the eve of a new week, never a
      catch-up day - a plan published on a Sunday (cron OR coach studio)
      always targets next week, held to Monday 6am ET; a first week
      published on a Sunday anchors week1_monday to NEXT Monday so week 1
      is never a one-day week (that's how Abdul ended up on "wk 1 of 2").
      (2) The cron is now HOURLY (vercel.json "0 * * * *") and decides in
      NY time what to do: Sunday before 3pm nothing; Sunday 3pm+ build
      every player's next week; Mon-Sat every hour catch-up only (a player
      whose live week has no plan gets it within the hour; nothing is
      pre-built mid-week; a player with no first week gets week 1 on the
      next run, any day). A failed Sunday run now self-heals Monday
      morning instead of costing seven days. It also runs unlockDueWeeks()
      every hour, so the Monday 6am unlock + "week N is live" texts no
      longer depend on someone opening the app. Hourly + NY-hour check
      also makes it DST-proof (digest likewise: scheduled 22 AND 23 UTC,
      sends only at 6pm ET). (3) It can never be silent again: migration
      030 elite_cron_runs logs every run (built / skipped / errors /
      whether CRON_SECRET matched), a PlanBuilderStatus card at the top of
      the coach dashboard shows the latest run and goes RED if the last
      run is >3h old (cron dead), had errors, ran unauthenticated (=
      CRON_SECRET unset in Vercel - this answers that open item on sight),
      or any player is training a stale week - with a "Build missing
      weeks" button that runs the exact same builder on demand
      (lib/elite/plan-builder-actions.ts). A run with errors, or one that
      can't run at all, texts Coach Yinka (+15712856635, override with
      COACH_ALERT_PHONE) and emails via the coach digest channel.
      SECOND BUG found on the way, worse: all three elite cron routes
      (weekly-plans, digest, onboarding-reminders) were being prerendered
      as STATIC by Next (build output "○", a frozen .body file). Their
      only dynamic access was req.headers.get() inside "if (secret &&
      ...)", so with CRON_SECRET unset the handler ran ONCE at build time
      and every cron hit afterwards got the cached JSON back with nothing
      executing. All three now export dynamic = "force-dynamic" (build
      output "ƒ", verified). The fact that Sept 27 built plans at runtime
      is circumstantial evidence CRON_SECRET IS set in Vercel; the
      dashboard card now says so definitively after the first cron run.
      CATCH-UP: the first hourly run after this deploys builds Elias wk 7,
      Mason wk 5, Abdul wk 2 (and the two test profiles) as live weeks,
      or Coach Yinka taps "Build missing weeks" on /coach to do it this
      minute. Behaviour change to know: the cron no longer publishes next
      week on Sunday afternoon with "week N just went live" texts while
      the app still shows week N-1 until Monday - it holds to Monday 6am
      and the texts go out when the week is actually visible. Not
      independently verified yet: the first real hourly run and the first
      Monday unlock - check the dashboard card Monday Oct 5 morning.
- [ ] THE ACTUAL ROOT CAUSE, FOUND + FIXED Oct 2 2026 (Coach Yinka: "a
      system that runs by itself consistently... the app should never
      regress again. Everything permanent."): the first hourly run of the
      new builder (10:01am ET Oct 2) built Elias wk 7 with 16 of 16
      drills UNFILMED and logged no run row. Diagnosis: elite_drills is
      coach-only under RLS (migration 020) and getDrillBank() read it with
      the cookie client - the cron has no login, got ZERO rows, and fell
      through to the built-in starter library (lib/elite/data.ts
      libraryDrills, no videos). Every cron-built week since Sept 19 was
      composed from that library; the Sept 29 onlyWithVideo filter and the
      Oct 1 bank-conform gates were real but had an EMPTY bank to enforce
      against (onlyWithVideo filtered the library to nothing, conform is a
      no-op on an empty bank). Manual studio publishes were always fine
      because the coach is logged in. That is why "I thought this was
      fixed" kept being true for the studio and false for the cron.
      Elias wk 7 repaired in place via SQL (16/16 filmed, no-wall drills
      since has_wall is null). THE SYSTEM NOW, each layer independent of
      the others so no single future edit can silently undo it:
      (1) getDrillBank reads with the service client by default and takes
      an explicit client; onlyWithVideo NEVER returns the library
      (filmedBankOnly, unit-tested). (2) applyGeneratedPlanCore THROWS when
      the filmed bank is empty instead of "publishing without a drill
      link" - a loud failure, logged + texted, before any row is written.
      (3) Migration 031: a BEFORE INSERT/UPDATE trigger on elite_homework
      rejects any row without drill_id + video_url - the database itself
      refuses an unfilmed drill from any code path, present or future.
      FULLY APPLIED TO PROD: the two elite_cron_runs columns, the guard
      function, and the trigger on Oct 2 11:10am ET via the Supabase MCP;
      the elite_duplicate_week replacement (copies drill_id so clone-week
      inserts pass the guard) on Oct 3 ~6pm ET, pasted by Coach Yinka
      himself from his phone into the Supabase SQL editor after that one
      statement timed out five times through the MCP. Verified Oct 3:
      pg_get_functiondef contains drill_id, trigger present, columns
      present. Nothing left to apply for 031. (4) Every builder run logs a row at START and
      updates it per player and at the end (elite_cron_runs.finished) - a
      crash or Vercel timeout shows as "started, never finished" instead
      of nothing; that is almost certainly what the 10am run did after
      Elias (Mason/Abdul/test profiles were never reached, no row).
      (5) lib/elite/health.ts auditLiveWeeks runs after EVERY build (cron
      or coach button): every active player has a plan for their live
      week, every drill in it is linked, filmed, and still active. Issues
      land on the run row, on the dashboard card in red, and text Coach
      Yinka - only when the issue set CHANGED vs the previous run, so a
      standing problem is one text, not one an hour. (6) The daily digest
      cron is a second, independent watchdog: it adds a line if the
      builder has never run, has been silent >3h, never finished, or has
      open problems - the builder cannot report its own absence, this can.
      (7) CI (.github/workflows/ci.yml, `npm run verify`): typecheck,
      lint, 23 unit tests (week targeting incl. the Sunday rule, bank
      conformance, the SMS sentence rule, live-week audit, filmed-bank
      rule), production build, and a check that no cron route was
      prerendered static. (8) vercel.json buildCommand runs the same
      typecheck + tests + build + cron check, so a red build CANNOT
      deploy to production, independent of GitHub settings. ONE MANUAL
      STEP for Coach Yinka (one-time, GitHub > Settings > Branches >
      main): require the "verify" status check before merging. WHAT HAPPENED Oct 2 after deploy: the 10:02am ET hourly run was
      still the OLD build (Vercel hadn't finished deploying) - it built
      Mason wk 5 and Abdul wk 2 from the unfilmed library (13 and 12
      no-video rows) and did log a row. The 11:00am run was the NEW
      build: "5 already built · audit: 4 issues" - the audit caught
      exactly those two weeks (its SMS alert to Coach Yinka should have
      fired; not independently confirmed). Both weeks repaired via SQL
      11:15am ET, row by row to filmed bank drills (both players have a
      wall, so wall drills were allowed): every live week now reads
      0 no-video / 0 unlinked / 0 inactive for all 5 players. The
      12:00pm run should read "audit clean" with no new text (alerts
      fire only when the issue set changes). VERIFY
      ON MONDAY Oct 5: /coach Plan builder card should read "audit clean",
      Sunday Oct 4 3pm+ runs built everyone's wk N+1, Monday 6am unlock
      fired (plan rows notified:true, new_week notifications at ~6am).
- [ ] DELETED Oct 2 2026 (Coach Yinka: "I told you to delete any drills
      that do not have a vid attached. This is the root of the problems"
      - he was right, and the earlier wording "fell back to the starter
      library" buried it): the app carried a SECOND set of drills, in
      CODE, not in the database - lib/elite/methodology.ts METHOD_PILLARS
      had 7 pillars x ~4 "starter library" drills (Foundations + sole
      rolls, Driven wall passes, Weak-foot strikes, Scan + touch...),
      lib/elite/training.ts had four PLYO_WARMUPS circuits (Pogo & Tuck,
      Lateral Power, Quick Feet, Explosive), ai-coach.ts buildSessions
      invented padding rows ("Apply under pressure", "Perfect the detail",
      "Focus block"), and data.ts libraryDrills() turned the whole list
      into fake bank rows whenever the real bank was unreachable or empty.
      None of it had a video; none of it was in elite_drills, so the Oct 1
      hard delete could not touch it; and every "fallback" path reached
      for it - the AI prompt listed it as the drill menu, fallbackPlan
      composed from it, buildSessions prepended its plyos. Every unfilmed
      drill a real player ever saw came from this list. ALL OF IT IS
      DELETED from the code: METHOD_PILLARS is pillar + coaching lens
      only (type has no drills field); training.ts exports only
      SESSIONS_PER_WEEK and the Drill shape; getDrillBank returns an
      empty list when the bank is unreachable; methodologyContext and
      fallbackPlan THROW EmptyBankError with no filmed skill drills (no
      bank = no plan, logged + texted, never an invented one); buildSessions
      adds no padding and no built-in warm-up (two bank plyos, one, or
      none); thin sessions are filled to three skill drills FROM THE BANK
      by conformSessionsToBank. GUARDS so it cannot come back: tests/
      no-library.test.ts (METHOD_PILLARS has no drills, empty bank throws,
      prompt lists only bank titles, thin sessions fill from bank) and
      scripts/check-no-library-drills.sh (greps the Elite app for the
      old identifiers/titles in code, comments ignored) - both run in CI
      and in the Vercel buildCommand, so a build that reintroduces any
      built-in drill cannot deploy. Demo mode with no Supabase now shows
      an empty drill bank instead of fake drills; production demo reads
      the real bank. Total unit tests: 27.
- [ ] FOUND + FIXED Sept 30 2026 (reported directly by Coach Yinka via a
      real screenshot to his own phone - this is a RECURRENCE, he'd
      already flagged something in this family before and been told it
      was fixed when it wasn't): the new_week SMS read "This week is
      built around Lock in the first touch and force the right foot to
      earn its keep.." - a run-on with a double period and a capital
      letter mid-sentence. Root cause: ai-coach.ts's schema tells the AI
      weekly_focus is "one sentence" (a complete, capitalized, own-period
      sentence), but three SMS templates (coach-actions.ts's two
      new_week branches, unlock.ts's new_week) spliced it into a
      lowercase noun-phrase slot - "This week is built around X." /
      "This week's focus is X." - with their own hardcoded trailing
      period. Any weekly_focus longer than a short phrase broke this
      every time, not occasionally - the email templates never had this
      bug because they already used a colon ("This week's focus: X"),
      which accepts a full sentence with no grammar clash. Fixed at both
      the template AND the source, not just the one broken line, since
      Coach Yinka was explicit that a one-off patch isn't good enough
      anymore: all three SMS templates now use the same colon
      construction the emails already used ("This week: X Let's
      have..."), AND ai-coach.ts's sanitize() now runs every weekly_focus
      through a new ensureSentence() helper that guarantees trailing
      punctuation, so any OTHER template written later that continues
      the sentence starts from a well-formed one instead of whatever the
      AI happened to output. Verified against the actual reported string
      plus a focus with no trailing period - both render clean, single
      period, no capitalization break. tsc/lint/build all clean.
- [ ] Strive Complete Pathway - DECIDED Sept 30 2026, Coach Yinka's own
      calls, supersedes the Sept 29 "group calls standard / 1:1 upsell"
      and "Gary builds a course" plan: NO course modules to start. The
      program is weekly 1:1 Zoom calls where Coach Yinka and Gary give
      lessons and guidance; group calls come later once there are enough
      families. Publicly announced Sept 29 at $1,000/mo as the lead offer,
      Elite ($249 founding) the downsell. Tier boundary, stated plainly:
      Strive Elite is the APP ONLY (weekly plans, drill videos, chat,
      progress) - Elite members never had film breakdowns. Film Room,
      monthly private breakdown, weekly parent report, and the coaching
      calls are Complete. Gary does NOT get an app login yet - Coach Yinka
      logs every call note himself for now. Open: Gary's revenue-share %
      (model decided, number isn't), and Coach Yinka's own weekly Zoom
      slots for these calls (assessment windows are Wed/Thu 6-9pm, Sat
      eve, Sun afternoon - coaching calls need their own time).
- [ ] SHIPPED Sept 30 2026 - Complete Pathway in the app. The app had a
      single membership tier (StatusControl.tsx: "Active (full access) or
      not"), so an Elite member could upload film and got the weekly
      parent report exactly like a Complete member. Migration 029 (applied
      to production the same day): elite_players.tier (elite | complete,
      default elite), the 008 privilege guard extended so a player can't
      flip their own tier, and elite_coaching_calls (scheduled_at,
      join_url, coach_name, notes) with coach-write / owner-read RLS.
      Gates: buildParentRecap (parent-recap.ts) returns null for tier
      'elite' - the ONE gate both senders go through; the player Film tab
      shows a Complete Pathway line instead of the timeline for Elite.
      Coach side: TierControl next to the Active/Paused toggle, a
      CoachingCallsPanel (add a call with date/Zoom link/Coach Yinka or
      Gary, then a post-call note) shown only for Complete players, and
      a "Complete" chip on roster cards. Player side: a coaching-call card
      on the dashboard (next call + Join on Zoom) for Complete only. The
      post-call note feeds the plan builder in BOTH paths - memory.ts for
      the coach's manual generator and auto-plan.ts for the Sunday cron -
      weighted like the coach memory note. Scheduling stays on Calendly.
      STATE AFTER MIGRATION: all 5 rows (Abdul Rahim, Elias, Mason
      Jhaveri, plus Coach Yinka's two test profiles) are tier 'elite', so
      nobody gets film / parent report / calls until Coach Yinka flips
      them on their player page - correct per his own rule that Elite
      never had film. ACTION for Coach Yinka: flip any family that is
      actually on Complete. Gary has no login yet; Coach Yinka logs every
      call note himself (the coach picker on a call is just a label).
- [ ] Sign Teo's Ashburn memo
- [ ] Set up Skool community (DECIDED Sept 15, refined Sept 15): community
      only, $9/mo Hobby plan, pinned link to thestriveapp.com for actual
      training. Skool is not the course, never move training there. Access
      is OPEN past current paying members: invite old/lapsed clients back
      in too, it doubles as a reactivation + marketing/proof engine for
      prospects. Academy's $500 exclusivity stays in its own perks (private
      monthly breakdown, cap, priority), not in community access.
- [ ] Get Gonz's quote for the announcement, low-pressure follow-up only
- [ ] Stamp Hybrid ($400->$500) and 1:1 Monthly ($280->$320) raises, announce
      alongside the ladder once the founding window closes Oct 1
- [ ] Confirm CRON_SECRET and GHL_WEBHOOK_SECRET are actually set in
      Vercel, then flip weekly-plans/digest/onboarding-reminders/
      autopilot/sync-contacts/ghl-webhook to fail CLOSED (reject) when
      their secret is unset instead of accepting any caller - see
      business context below, this is a real open security gap. As of
      Oct 2 the coach dashboard's Plan builder card says outright whether
      the last cron run carried a matching CRON_SECRET - if it doesn't
      warn, CRON_SECRET is set and the flip is safe for the cron routes.
- [ ] CHECKED Sept 26 2026 via direct DB query: 3 of 4 real players
      (Keith Mauck jr, Elias, Mason Jhaveri) already have correct, distinct
      parent_name values - they weren't hit by the bug above. Only "Remi
      Bashorun" shows parent_name = the player's own name, and that
      profile hasn't finished onboarding yet, so it'll self-correct now
      that the field is required. Nothing further to check here.
- [ ] BIGGER GAP found in that same check: none of the 3 real client
      families (Keith Mauck jr, Elias, Mason Jhaveri) have a parent_phone
      on file at all. The only phone number in the whole table is Coach
      Yinka's own (+15712856635, from testing). The entire SMS system
      works, but has never actually reached a real family - add their
      numbers via each profile's Intake panel.
- [ ] From the Sept 26 audit, not yet built - Coach Yinka to prioritize:
      no error tracking (Sentry or similar) or custom error/loading pages,
      so a future silent failure like the parent-report one above has no
      way to surface short of a parent complaining; the elite-film Storage
      bucket policy (migration 005) is open to any authenticated user with
      no per-player scoping (currently unused by any real upload flow, but
      live and insecure by default). (The DST drift on the weekly-plans
      and digest crons is fixed as of Oct 2 - both decide in NY time now;
      only onboarding-reminders still shifts an hour, harmless.)

## Growth target (stamped Sept 19, Coach Yinka's own call)

By Oct 31 2026: 20+ fully remote on MRR, 35-40 in-person on MRR, 8-10
hybrid. Pace to get there: +3-4/month remote, +3-4/month hybrid, +6-7/month
in-person. UNCONFIRMED whether "fully remote" includes Remote Academy
(hard capped at 15 members) or means App-tier only - if Academy counts
toward the 20+, that only works with 5+ of them on App ($249 founding
rate - the Oct 31 deadline falls before the Nov 1 founding window closes,
so every member counted here is still at $249, not the $350 post-window
price), not Academy. When Coach Yinka asks about progress toward this,
check current member counts against this pace.

## Weekly schedule (field time)

| Day | What | Times |
|---|---|---|
| Sunday | Drop-ins | 5-6, 6-7, 7-8pm · **Makeup Session 6pm @ Gainesville Middle** · Assessment calls in the afternoon (before 5pm) |
| Monday | 1-on-1s | 9-10am, 10-11am, 3-4pm (Catharpin Park), 5-6pm, 7-8pm (Catharpin) |
| Tuesday | 1-on-1s | same as Monday |
| Wednesday | OFF FIELD | **Assessment calls 6-9pm** |
| Thursday | OFF FIELD | **Assessment calls 6-9pm** |
| Friday | Group sessions | HS comp 5pm · MS comp 6pm · MS/ES regular 7pm |
| Saturday | Drop-ins | 8-9, 9-10, 10-11, 11-12am · Assessment calls in the evening |

Assessment call windows: Wed/Thu 6-9pm, Sat evenings (~5-8pm), Sun afternoons
(~1-4pm). 15-min slots, 15-min buffer, max 4/day, 3h notice.

## Confirmed prices

- 1:1 Drop-in: $80 (raised from $75, Sept 2026) · Starter 4 sessions: $280 · Development 8: $520 · Elite Season 12: $720
- 1:1 Monthly: $280/mo — weekly fixed 1:1 slot, reschedule within the week via
  Carla, no month-to-month rollover. Sits under Hybrid (pitch Hybrid first;
  the $120 gap = app + film). Counts against the same scarce 1:1 slots.
- Duo (2 players, semi-private, same hour): drop-in $120 · 4-pack $440 · 8-pack $800 · Duo Hybrid $650/mo (weekly duo session + both on app). Quoted live Sept 2026.
- Group drop-in: $50 (raised from $45, Sept 2026) · Small Group monthly: $148
  (groups of 10, assistant coach)
- App-only (Strive Elite): $350/mo for new members from Nov 2 (raised from
  $300 on Sept 24, Coach Yinka's own call, same day as the founding-rate
  raise below - lands right at the top real local comp, FVA Union
  ~$354/mo, so it holds up as a real ongoing price, not just an anchor;
  pushed from Oct 20 on Sept 24 to extend the founding-window runway; NOT
  yet announced publicly - announce before charging). Founding members and
  anyone quoted $249 who joins by Nov 1 keep $249 locked for life (raised
  from $199 on Sept 24 - at $199 the locked-for-life price was too cheap
  relative to the value delivered, risking real long-term revenue given
  every founding member keeps this rate forever).
- Remote Academy: $600/mo (raised from $500 on Sept 24, same day - hard
  capped at 15 seats regardless of price, so raising it costs zero volume,
  and comparable online coaching runs ~$1k/mo with less structure than
  Academy delivers, so $600 is still a clean ~40% discount to that
  market). HARD CAP 15 members (say the cap publicly). App + weekly Film
  Room + monthly private film breakdown + weekly parent report. Call-close
  only; pitch Academy first on remote calls, downsell to App (currently
  $249 founding rate through Nov 1, $350/mo after).
- Hybrid: $400/mo (PROPOSED raise to $500 alongside ladder, unconfirmed)
- 1:1 Monthly: PROPOSED raise $280 -> $320 to match $80 rate, unconfirmed
- Founding window perk: rate locked for life + first film breakdown free;
  closes Nov 1 (this line was stale at "September... closes Sept 30" -
  synced here to match the Nov 1 date above, flag if that's not right).
- Camps: ~$3k profit each, quarterly · Youth pickup: $15 entry, monthly

## Policies

- Makeup: miss Friday group -> Sunday 6pm makeup at Gainesville Middle, included,
  1/month per player, same-or-next week, claimed through Carla. Never a free or
  discounted 1:1.
- Sales process (stamped Sept 16, replaces the old $75-assessment system):
  first text qualifies in-person vs online. Both paths then get the same 3
  questions: current stage/pain point, future goal, then the coach diagnoses
  the gap out loud. In-person -> GHL booking form -> book an Assessment
  Session at the real rate (1:1 $80 or Group Drop-in $50, no special
  discount) -> book a follow-up call for right after. Choosing a bundle
  instead skips the single-session charge entirely, they just pay the
  discounted bundle rate. Online -> landing page (thestriveapp.com/demo) ->
  short GHL intake form (same shape as the in-person form) -> team reaches
  out to get a call booked, Coach Yinka closes it personally from there.
  No self-serve checkout - the app's signup is invite-code gated and Stripe
  checkout doesn't provision accounts yet, so payment-first isn't wired up
  and isn't worth rushing. Layup sale exception: a lead
  already ready to buy skips straight to the registration/payment link,
  never made to wait through the 3 questions; anyone who needs more gets the
  normal flow.
- Invite redemption stamps a new player at subscription_status "none", NOT
  "active" (fixed Sept 26 - it was auto-granting full paid access to
  anyone with a code regardless of payment). Onboarding/intake still works
  at "none"; the app's membership gate shows "reach out to your coach" for
  anything but that unlocks it. Roster cards already show this at a
  glance (dim gray dot for "none" vs gold for "active").
- Refunds: same-day, gracious, always.
- Registration = payment. Public scarcity numbers must be real.
- No em dashes in any player/parent-facing copy or scripts.
- Never announce that a testimonial/message is "real" or "verified" (no
  "real text from...", no authenticity badges/labels). Just show the
  message. Calling out realness reads as insecure, not premium - not the
  vibe.
- Personalization framing: all player/parent/prospect-facing copy (site,
  app, ads, scripts) must read as Coach Yinka personally building and
  reviewing every plan - "I build every plan," "I review every plan,"
  never "AI," "automated," or "algorithm." This holds even as more of the
  pipeline gets automated behind the scenes (planned) - the backend can
  change, the copy promise doesn't. AI/automation language is fine ONLY in
  coach-only tooling (drill bank, session notes studio) that players and
  parents never see.
- Referral program (PROPOSED Sept 14, unconfirmed - say "stamp it" to lock):
  referring family gets $25 account credit, any tier, no limit on referrals,
  credited once the referred family makes their first payment. No cash
  payouts, credit only. The app surfaces the ask automatically in the
  parent weekly recap on a full (4/4) week only - the highest-trust moment,
  never mixed into the accountability text itself. Track in GHL with a
  "referred" tag + a "referred_by" text field (not yet added - build this).

## Coach Yinka's voice (app engagement notifications, stamped Sept 26 2026)

Scope: this governs the AI/automated player-parent engagement copy on the
APP only (new week live, coach messages, weekly parent report,
onboarding-incomplete nudges) - only when actually necessary, not spammy.
In-person scheduling/logistics is NOT app territory, that all stays on GHL.

- Greeting varies by situation, not fixed: good news opens with
  "Hey [Parent name],"; a nudge goes straight into the point, no greeting.
- No sign-off, ever - no name, no "- Coach Yinka." Instead close with a
  short forward-looking line ("Let's keep him dialed in," "let's keep the
  momentum" style) - this is a real recurring habit, not a one-off.
- Full sentences, proper periods, no fragments, no ALL CAPS. No emojis,
  ever, in any player/parent text.
- Exclamation points are rare - only for real, earned excitement (e.g. a
  fully completed week), never routine.
- Length flexes: short when there's not much to say, longer when there's
  real substance.
- First name only, no nicknames ("champ," "boss," etc. are not his style).
- More formal/polished with brand-new parents; loosens up over time with
  long-time ones.
- Good-news tone: NEVER claims to have watched live - for app/homework
  weeks Coach Yinka is not physically present, so it's framed as
  consistency/programming, not eyewitness praise. Real example given:
  "Marcus is killing it with his consistency! This week's sessions were
  focused on [X], today's session will help him improve [X] over time.
  Let's keep him dialed in."
- Nudge tone: soft and encouraging, names the gap plainly but frames the
  fix as consistency, never shames the kid. Real example given: "Marcus
  missed his homework this week. Let's get him back on track, consistency
  is what builds this."
- SHIPPED Sept 26 2026: new_week (coach-actions.ts + unlock.ts) and
  onboarding_incomplete SMS rewritten to this voice, with a real dashboard
  link instead of a bare "open the app" line. parent_weekly_report's
  Claude prompt (lib/elite/parent-recap.ts) rewritten with this full guide
  - "Hey [Parent]," opener, no sign-off, forward-looking close,
  rare/earned exclamation points.
- Player gender (boy/girl) field SHIPPED Sept 26 2026 (migration 027) -
  required at onboarding going forward, coach-editable for existing
  players from the Intake panel. parent_weekly_report's AI prompt now
  uses correct he/she pronouns when gender is set, falls back to
  repeating the player's first name when it isn't (old players who
  haven't had it added yet).

## People

- Carla: co-founder/girlfriend, runs DMs + booking + follow-up ladder (day 1h/2/3/7).
  Her metric: calls booked per week (target 4+).
- Mateo ("Teo"): Ashburn territory partner, old teammate. Strive gets 30% of all
  Ashburn gross (group/privates/app); sponsors 100% Strive; runs on Strive app +
  CRM; posts content for Strive IG. One-page memo drafted, get it signed.
- Gary Grigoryan: partner coach (1:1s, group, content, promotion), announced
  Sept 2026. Resume: Armenia U19 NT (UEFA U19 qualifiers), SC Fortuna Koln U19
  (U19 Bundesliga), Armenia U16/17 NT, Captain of VDA, 2x Mid-Atlantic
  All-Conference First Team. Split negotiated at $75 sessions (Gary $40 /
  Strive $35); UNCONFIRMED how the $80 raise splits. One-pager unsigned.
- Gary is the Friday group assistant coach. There is no separate assistant
  coach hire needed or planned.

## Player alumni credentials (confirmed Sept 29 2026, Coach Yinka's own list)

Real, named proof of what Strive coaching has actually produced - use this,
not vague language like "countless" (that reads as unverifiable marketing
filler, not proof). Scope as Coach Yinka defined it: NOT for public use (no
website, no ads, no public IG) - sales calls and the VSL only, since that's
a materially lower bar than public marketing. Before featuring any one of
these more prominently or with personal story detail (beyond just naming
their school/program), a quick heads-up to that family is still worth it
out of respect, even on a private/gated call or VSL.

~11 D1 college players: Sammie Walker (West Virginia), Drew Goodrich
(Lafayette), Marko Mihajlovic (College of Charleston; Pipeline ECNL),
Jason Broome (Harvard), Amanueil Mequaint (George Mason), Damen Burney
(William & Mary), John Balkey (George Mason; 5A District/Region/All-Met
POY), Reggie Gainer (Syracuse; also DC United Academy), Lucas Lourenço
(Longwood), Tomiwa Adewumi (Marquette; made his professional debut),
Nziza Siibo (Penn State).

~6 pro academy signings: Marco Vita (DC United Academy), Dominic Igot
(Inter Miami Academy), Ada Karatepe (Galatasaray Academy), Oluwatose
Adewumi (Sporting Kansas City Academy), Bence Buri (Colorado Rapids
Academy), Reggie Gainer (DC United Academy, also above).

The headline for the overseas-pathway pitch specifically: Teymour Mohammed
- Montpellier FC (pro) + Tunisian National Team. A real Strive player who
did exactly what Gary's course promises to teach - not borrowed
credibility, an actual outcome. Ada Karatepe (Galatasaray Academy) is the
next-strongest for that same angle.

Other real honors: Mikey Azzara (First Team All-ECNL), Matthew Carlin (6A
District POY, Battlefield HS), Ryan Lucero (Regional/District POY), Benji
Velasquez (3x First Team All-American), Kevin Polanco (ECNL Selection
Game), Angel Romero (ECNL All-American).

## Business context

- Parent-customer market research (Perplexity Deep Research, Sept 14 2026):
  research/parent-customer-research-2026-09-14.md. Rigorously sourced, marks
  supported facts vs anecdotes vs hypotheses. Key corrections to earlier
  assumptions: the "70% of kids quit by 13" stat is DEBUNKED (traced by USA
  Today to weak sourcing) - never use it. National coach satisfaction is
  actually high (77.6% satisfied/very satisfied) - do not position Strive as
  "your club/coach failed you," position as a trusted complement. Real local
  cost benchmarks: FVA Union ~$4,245/yr, FC Dulles travel ~$1,550/yr or
  $75-195/season recreational. Contains a "Copy Gold" section of real public
  quotes (NOT Strive testimonials, do not imply they are - use as inspiration
  for original paraphrased copy only) and a feature-to-objection-to-proof
  table mapped to Strive's actual features. Read before writing any new VSL,
  ad, or DM script copy.
- All clients come from Instagram (~230k views/month, posts daily). Trigger words:
  FALL (group), PRIVATE (1:1s), APP (program). Large training-clip library exists.
- Events arm: monthly elite pickup runs (50+ players, last event 86k views,
  reposted by @yslofficial), cash-prize events, Thanksgiving 11v11 tournament
  planned (~$700 buy-in; prize must be % of entries or sponsor-covered, never
  guaranteed beyond receipts). Sponsor tiers: title $1.5-2.5k, supporting
  $500-750, vendor $200-300.
- GHL: pipeline "Strive Members" (New Lead 10% -> Demo Sent 25% -> Call Booked
  45% -> Call Done 60% -> Closed Unpaid 85% -> Active 100% -> Warming 15% ->
  Reopened 30% -> Lost 0%). Custom fields incl. player_age_years. Tags:
  summer-100, founding-family, film-friday, old-client, sibling, nova-local,
  remote, warming.
- Insurance: general liability purchased. PWC field permit requested (Fri 5-8pm,
  Aug 27 2026 - Jan 27 2027). Waiver form still to build in GHL.
- Studio: Strive backdrop + Blue Yeti (talk into side, cardioid) + Heyday light/
  webcam kit; phone-as-webcam via Camo preferred for calls.
- Player highlight series (social graphics) visual identity - confirmed Sept
  30 2026 by digging up the actual past "Player Spotlight Cover" artifact
  (published Sept 14 2026, referenced again in "Strive Soccer Testimonial
  Cover" Sept 18 2026): near-black #0d0d0d background, white text, Barlow /
  Barlow Condensed uppercase with tracked letter-spacing on eyebrow labels
  (roughly 0.1-0.3em), a stacked two-line all-caps headline (that one read
  "PLAYER" / "SPOTLIGHT"). MEASURED Sept 30 2026 off a real Player
  Highlight post Coach Yinka sent, pixel-sampled, not eyeballed: 9:16
  story, black letterbox bars (~26% top, ~17% bottom), photo band between;
  "@STRIVESOCCERFC" top-left in WHITE with a thin muted-gold underline
  (#c8a858); the real logo (public/strive-logo-512.png, knocked out
  white-on-transparent) top-right inside a thin dotted ring; bottom-left a
  small muted-gold tracked eyebrow "STRIVE SOCCER" then the stacked white
  headline. Gold is ONLY the underline and the eyebrow - never headline or
  handle text, no accent shapes, no bright yellow. Text on the photo band,
  never on the black bars. No placeholder text ever on a finished graphic.
  Earlier posts this session (Strive Elite / Strive Offers) used a brighter
  gold on text - that was an invention, not brand; fix if reused.
- The real logo file is already in this repo - public/strive-logo-512.png
  (black ball-with-swoosh + stacked "STRIVE SOCCER" wordmark on white).
  For a dark-background graphic (the highlight series above, any social
  post), invert it (CSS filter: invert(1)) to get the white-on-dark
  version those actually use. Found this Sept 30 2026 after wrongly
  reaching for an external CDN URL from a different project first - check
  this repo's own public/ folder before assuming a brand asset needs to
  come from somewhere else.
- App: thestriveapp.com (this repo). Supabase project qjiloadpfeqxxyfozsje.
  Demo tour: login -> "See the app as a player".
- Weekly plan generation is fully automated (shipped Sept 19 2026, silent
  no-op until Sept 26 - the cron looked up a role='coach' profile and the
  only real account is role='admin'; then a stale-week bug until Oct 1 -
  see the open-items entry). CURRENT MODEL (Oct 2 2026): an HOURLY cron
  (/api/elite/cron/weekly-plans, lib/elite/auto-plan.ts runPlanBuilder)
  builds every active player's NEXT week on Sunday from 3pm ET, held to
  Monday 6am ET; Mon-Sat it only catches up a player whose live week has
  no plan, and gives a brand-new onboarded player week 1 within the hour.
  Notes input = the player's own homework completion + self-checkin (+
  Complete Pathway call notes). Coach Yinka never has to approve a plan.
  Every run is logged (elite_cron_runs) and shown on the coach dashboard;
  errors text him. The "I build every plan, I review every plan" copy
  promise is unchanged per the personalization policy above - this is a
  backend change only, never say "AI" or "automated" anywhere
  player/parent-facing.
- Real push notifications shipped Sept 26 2026 (Web Push/VAPID, not a
  native app - no app store needed). Covers new-week-live and coach
  messages so far; everything before this was in-app only, meaning a
  player who didn't open the app never found out about anything. Needs
  NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY set in the deploy
  environment to actually send - confirm these are set, otherwise it's
  silently a no-op same as email with no RESEND_API_KEY/GHL webhook.
- SMS (new week, coach message, parent weekly report, onboarding-incomplete)
  is LIVE and confirmed working (Sept 26 2026, real test text delivered).
  Goes straight through the GHL API (contacts/upsert then
  conversations/messages, lib/elite/sms.ts) using GHL_API_KEY, which was
  already set in Vercel for the Social Planner - no separate GHL workflow
  needed. Best-effort/no-op-safe like every other channel here.
- Players now have their own optional player_phone (026, Sept 26 2026),
  separate from parent_phone (025) - captured at signup (optional) or
  added later by the coach from the player's Intake panel. Lets a player
  text directly instead of only through a parent.
- Inbound SMS replies land in GHL's Conversations inbox by default (GHL
  owns the sending number, the app never sees a reply on its own). Built
  a receiver for it (/api/ghl/sms-inbound) that matches the reply's phone
  against parent_phone/player_phone and threads it straight into that
  player's existing chat in the app (shows as "[Parent's first name]
  (Parent)" or the player's own name), plus pings the coach the same way
  a normal player message does. GHL workflow (Customer Replied -> Webhook
  -> /api/ghl/sms-inbound) built by Coach Yinka Sept 26 2026 - the full
  inbound loop is now live end to end.
- Email (new week, coach message, parent weekly report, plus coach-facing
  events) is separate and still UNCONFIRMED/likely dead - it only sends if
  RESEND_API_KEY or a GHL_WEBHOOK_URL* is set in the deploy environment
  (lib/elite/email.ts), and neither was part of the SMS setup above. Worth
  checking if Coach Yinka wants parent email too.
- FOUND + FIXED Sept 26 2026 (proactive audit): the parent_weekly_report
  send (email + SMS) had been completely dead for every player on the
  automated Sunday cron since the Sept 26 cron fix itself - the cron
  always takes applyGeneratedPlanCore's publishNow path, which writes the
  new plan row already notified:true, so unlockDueWeeks() (the ONLY place
  that called buildParentRecap) never saw it as "due" and never sent it.
  Silent - no error anywhere, just a real marketed feature (Remote
  Academy's weekly parent report) going dark the exact day the plan cron
  itself got fixed. Fixed by calling buildParentRecap directly inside
  applyGeneratedPlanCore's goesLiveNow branch (coach-actions.ts) instead
  of relying only on the Monday-unlock path. No independent verification
  yet that a real recap has gone out since the fix - worth confirming on
  the next Sunday cron run or a manual publish.
- FOUND + FIXED Sept 26 2026 (same audit): parent_name was defaulting to
  the PLAYER's own name at signup (redeem/route.ts set parent_name:
  fullName, but that field is labeled "Player name" on the signup form),
  and completeOnboarding() had no guard against a blank onboarding field
  wiping it to empty (parent_phone already had this guard, parent_name
  didn't). Net effect: "Hey [Parent]," greetings were addressing players
  by their own name for anyone who signed up before this fix or skipped
  the onboarding field. Fixed: signup no longer sets a placeholder
  parent_name, onboarding's "Parent or guardian name" is now required,
  and completeOnboarding won't blank a real name with an empty submit.
  Existing players (the current real 4) should have their parent_name
  checked/corrected on their profile if it looks wrong.
- Cron/webhook auth pattern audit finding (Sept 26 2026, NOT yet fixed):
  every secret check in this codebase (CRON_SECRET on the weekly-plans,
  digest, onboarding-reminders, autopilot, sync-contacts routes;
  GHL_WEBHOOK_SECRET on /api/ghl/webhook) fails OPEN if the env var is
  unset - "if (secret && ...)" instead of "if (!secret || ...)". Fixed
  this pattern for SMS_INBOUND_SECRET only (confirmed set in Vercel, so
  safe to flip). The others were deliberately left alone because flipping
  them blind, without confirming CRON_SECRET/GHL_WEBHOOK_SECRET are
  actually set in Vercel, risks silently breaking the weekly-plan cron
  entirely (it would reject Vercel's own real invocation too). Confirm
  those are set first, then flip the same fail-closed fix everywhere.
- SHIPPED Sept 26 2026 (same audit, the two items with real exposure):
  real Privacy Policy (/privacy) and Terms of Service (/terms) pages,
  linked from the signup form footer - drafted honestly, including
  disclosing that automated tools assist parts of plan generation under
  Coach Yinka's direction (a privacy policy has different legal
  obligations than marketing copy, so this deliberately does NOT follow
  the "never say AI" personalization rule above - that rule still governs
  all player/parent-facing marketing/app copy). NOT reviewed by a lawyer -
  flag this to Coach Yinka before relying on it, especially given minors'
  data (COPPA-adjacent) is involved. Also added basic rate limiting
  (lib/rate-limit.ts, in-memory/per-instance) on /api/elite/auth/redeem -
  10 attempts per 10 minutes per IP, since invite codes were previously
  unthrottled and guessable at scale (~16.7M combinations).
- FOUND + FIXED Sept 26 2026 (reported directly by Coach Yinka): deleting a
  player from the coach dashboard only removed the elite_players row and
  deliberately left the login account alive (old comment: "sign back in,
  re-onboard as a fresh player") - so the family's email stayed registered
  forever, and redeeming a NEW invite code with that same email failed
  with "already exists." Not what delete means to a coach or a parent.
  Fixed: deletePlayer now deletes the actual auth.users account, which
  cascades through elite_profiles -> elite_players -> every dependent
  table (migration 005's FKs already supported this, the code just wasn't
  using it). Also found and cleaned up 5 already-orphaned accounts stuck
  in exactly this state from before the fix (mostly Coach Yinka's own
  test/family signups - freed their emails via direct DB delete).
- FOUND + FIXED Sept 27 2026 (reported directly by Coach Yinka): the
  weekly-plan AI (lib/elite/ai-coach.ts) had zero voice guidance on
  next_week_objectives, unlike parent_update/player_summary which were
  carefully specified - so it defaulted to robotic performance-metric
  phrasing ("90% one-touch accuracy at 3 yards"), and parent-recap.ts was
  feeding that straight into the weekly SMS as "Coming up next: ...",
  quoting it near-verbatim into a text meant to sound like Coach Yinka.
  Fixed both ends: next_week_objectives now must be plain coach language,
  no percentages/measurements/stat-line jargon (ai-coach.ts's schema +
  rules), and parent-recap.ts no longer feeds next_focus into the recap
  at all - the forward-looking close is a natural line, not a recitation
  of next week's technical objectives. Also added an explicit "no stat
  lines" rule to the recap's own system prompt as a backstop.
- FOUND + FIXED Sept 27 2026 (same report, Coach Yinka caught a second
  issue in the same message): the recap AI had also invented a detail
  with zero data behind it - "let's keep him locked in and chasing that
  starting spot." Nothing in the schema tracks team situation, starting
  spot, tryouts, or player motivation, so that was pure invention, not
  drawn from any real fact. "Use ONLY the facts provided" had only been
  scoped to results/drills/progress, not to narrative assumptions like
  this. Added an explicit rule to BOTH AI prompts (ai-coach.ts's
  parent_update/player_summary, and parent-recap.ts): never invent or
  assume anything about the player's team situation, starting spot,
  tryouts, teammates, rivals, competition, or motivation - stick to the
  training itself, nothing about their life outside it.
- Skool: DECIDED Sept 15, community layer only, $9/mo Hobby plan (no Skool
  payments processed, so the 10% transaction fee never applies). Pinned
  post links to thestriveapp.com, the app remains the only place training
  actually happens, AI plans/drill bank/recaps/referral all stay there.
  Skool gives community, leaderboard, and native push notifications for
  free. Access is OPEN, not gated to current payers: old/lapsed clients get
  invited back in specifically so the community doubles as a marketing and
  reactivation tool, current members seeing/posting real proof is what a
  prospect sees. Academy's premium feel is protected by its own perks
  (private breakdown, cap, priority), not by excluding others from Skool.
