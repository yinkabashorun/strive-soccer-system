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
      business context below, this is a real open security gap.
- [ ] Check the current real players' (Elias, Keith Mauck jr, Mason
      Jhaveri, Remi Bashorun) parent_name field on their profiles - a bug
      just fixed meant it may have defaulted to the player's own name,
      breaking the "Hey [Parent]," greeting for them specifically.
- [ ] From the Sept 26 audit, not yet built - Coach Yinka to prioritize:
      no privacy policy/ToS anywhere despite collecting minors' phone
      numbers/self-assessments/film links; no rate limiting anywhere
      (invite codes are ~16.7M combinations and brute-forceable against
      /api/elite/auth/redeem); no error tracking (Sentry or similar) or
      custom error/loading pages, so a future silent failure like the
      parent-report one above has no way to surface short of a parent
      complaining; the elite-film Storage bucket policy (migration
      005) is open to any authenticated user with no per-player scoping
      (currently unused by any real upload flow, but live and insecure by
      default); the weekly-plans/digest crons will silently shift an hour
      when DST ends ~Nov 1 2026 (vercel.json is fixed UTC, no TZ support).

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
- App: thestriveapp.com (this repo). Supabase project qjiloadpfeqxxyfozsje.
  Demo tour: login -> "See the app as a player".
- Weekly plan generation is fully automated (shipped Sept 19 2026, but was a
  complete silent no-op until fixed Sept 26 - the cron looked up a
  role='coach' profile to attribute plans to, and the only real account is
  role='admin', so it matched nobody and quietly did nothing every single
  run; real players got zero automated plans between Sept 19 and 26,
  confirmed via direct DB query). Fixed now: a cron builds every active
  player's new week Sunday 3pm ET and it publishes immediately (no Monday
  hold), using the player's own homework completion + self-checkin as the
  "notes" input in place of a coach typing them. Coach Yinka no longer
  needs to review or approve plans for them to go out. Cron fires at a
  fixed UTC hour with no DST awareness - correct now (EDT), will read as
  2pm once DST ends around Nov 1 2026 unless the schedule is bumped an
  hour. The "I build every plan, I review every plan" copy promise is
  unchanged per the personalization policy above - this is a backend change
  only, never say "AI" or "automated" anywhere player/parent-facing.
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
