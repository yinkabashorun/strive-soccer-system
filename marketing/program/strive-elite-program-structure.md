# Strive Elite: the 3-month program structure (design, not built)

Source: Coach Yinka, Nov 11 2026. His own comeback from a 6-month hip tear:
one focus at a time, the rest kept alive, harder as it goes. This file is
the working design. Nothing here is in the app yet. Category and pillar
names are a DRAFT he approved in spirit ("That's amazing tbh"); he and
Coach Gary rename anything.

## The shape of a program

- 3 months = 3 BLOCKS. Each block has 2 FOCUS PILLARS, one per half-month.
- In every session the focus gets 2 of the 3 skill drills. The third is
  maintenance, drawn from the player's other pillars (his call, Nov 11).
- THREADS run beside the focuses, for one, two or all three months (his
  call, Nov 11: "maybe this player needs strengthening all 3 months ...
  and the other is speed"). A thread never takes a skill-drill slot. It
  lives in a slot the session already has:
  - Strength, core, mobility thread: the finisher, every session.
  - Speed or power thread: the slot after the warm-up, every session.
  - Conditioning thread: a weekly target outside the session (his example:
    5 miles a week), ticked off by the player.
- Harder over time: harder drills as the fortnight goes, and a "make it
  harder" line on the drill (his examples: eyes closed, weak foot only).
- Coach Yinka picks the focuses and threads. The quiz below drafts them;
  he edits and confirms. For an injured player a block opens only when
  the family has set the clearance stage that block needs.

## Categories and pillars (draft) against the bank today

Counts are active filmed drills, read from the bank Nov 11. Which drill
sits under which pillar is my read and needs his confirmation.

| Category | Pillar | Have | Note |
|---|---|---|---|
| 1 Ball control | First touch on the ground | 5 | in-place patterns |
| | First touch out of the air | 3 | plus 14 juggling course drills |
| | Weak foot | 8 | 4 wall, 4 no wall |
| 2 Dribbling and 1v1 | Close control | 3 | figure-8, two cone weaves |
| | 1v1 moves | 8 | 7 moves, 1v1 freestyle |
| | Running with the ball | 0 | gap |
| 3 Passing | Short and combination | 8 | every one needs a wall |
| | Long and driven | 0 | gap |
| | Passing in the air | 0 | gap |
| 4 Shooting and finishing | (left out for now, Coach Yinka, Nov 11) | 0 | not on the menu, not on the film list |
| 5 Speed and agility | Acceleration | 5 | course-only today |
| | Top speed | 3 | course-only today |
| | Change of direction | 3 | course-only today |
| 6 Strength and power | Power and jumps | 7 | the plyos |
| | Core and stability | 8 | |
| | Hips, legs, mobility | 5 | no mobility or stretch filmed |
| 7 Conditioning | Aerobic base | 0 | a weekly target, not a drill |
| | Soccer fitness | 0 | gap |
| 8 Game intelligence | Scanning | 2 | thin |
| | Decision making | 0 | gap |
| | Position breakdowns | 0 | see below |

## The film list

Rule from Keep It Up: every clip arrives with its name and a beginner or
advanced tag. Target per pillar is MY number, his to change: 6 drills, two
easy, two medium, two hard, so a focus fortnight can get harder without
leaving the pillar.

Film first (zero today, and the offer post already names them):
1. Passing in the air: 6
2. Long and driven passing (low, mid, ping): 6
3. Running with the ball: 6
4. Decision making: 4 to 6
(Shooting and finishing are left out for now, his call Nov 11.)

Fill next (thin):
7. First touch out of the air, not juggling: 3 more
8. Scanning: 4 more
9. Short passing WITHOUT a wall: 4 (today a player with no wall has no
   passing at all)
10. Close control: 3 more
11. Mobility and stretch (the unfilmed Oct 7 list: hip flexor stretch,
    90/90, hip flexor march and the rest)
12. Soccer fitness with a ball: 4

Already enough: weak foot, 1v1 moves, core, power, the sprint drills.

## Position breakdowns (game intelligence)

Practical version, mine: one breakdown per position, filmed once by the
coaches and reused for every player in that position (what the position's
job is, the three things a coach watches for). The player's own Film Room
clips are then reviewed against that position's list, and the monthly
call checks it. Not practical: a private video breakdown per player every
week. Flag: use the coaches' own footage or a tactics board; broadcast
footage of pro games is not ours to republish.

## The onboarding quiz (what it has to capture)

1. Who and when: age, position, level, team situation, the date that
   matters (tryout, preseason, return).
2. Injury: area, what they are cleared for today (touches, running,
   plyos and cutting, contact), what they are waiting on.
3. Limiters: the top three things holding them back, ranked; what their
   coach says.
4. Needs that run all the way through: strength, speed, fitness, and for
   how many of the three months each.
5. Setup: wall, goal, space, days a week.
6. Fitness baseline: can they run today, how far.
7. Goal: what they want to be known for in three months.

Output: three blocks, two focus pillars each, the threads per month, the
maintenance pool, and for an injured player the stage each block waits on.
Coach Yinka edits and confirms before anything is built for the player.

## How it fits what the app already does (read from the code, Nov 11)

One function decides every week: conformSessionsToBank in
lib/elite/bank-conform.ts. It runs when a plan is generated and again when
it is published, and it already builds a session in four parts: warm-up,
the slot after the warm-up, three skill drills, finisher. The program is
one more input to that function, the way the few-yards templates are:

| Program piece | Where it lands | New or existing |
|---|---|---|
| Focus pillar, 2 of 3 skill drills | the three skill drills | new rule in the same function |
| Maintenance, 1 of 3 | the three skill drills | new rule, drawn from the player's other pillars |
| Strength thread | the finisher, every session | EXISTING ("required" mode, today switched on by an injury note) |
| Speed or power thread | the slot after the warm-up | EXISTING slot (today it carries juggling); speed drills allowed in for a player whose program names speed (his OK, Nov 11) |
| Conditioning thread | a weekly target the player ticks | NEW (a run is not a drill; the database refuses a homework row without a video) |
| Harder over the fortnight | which drills are picked | NEW: a level on each drill, easier first |
| Clearance stage | which drills may be picked at all | NEW: the parked injury mode |

What does NOT change:
- The existing pillars (Ball Mastery, Weak Foot, Passing and the rest)
  stay exactly as they are. They carry the ratings, the development score
  the ads show, and time trained by pillar. The new pillar is a second
  tag on the drill, beside the old one.
- A player with no program builds exactly as today. Every earlier change
  to the builder was made this way: the default reproduces today's week.
- A week already built is never rewritten. A program starts at the next
  Monday build after Coach Yinka confirms it.
- The hourly builder, the Sunday rule, breaks, the audit, the filmed
  guard, Extra Work, the progress clip, Film Room: untouched.

The roster today (read-only, Nov 11): seven active profiles, two of them
Coach Yinka's own test profiles. Mason Jhaveri is on week 11, Abdul Rahim
8, Bryan 4, Mason Rawat 3, Tim Kovalev 1 (restarted Nov 9, cleared for
plyos and running, not long balls or shots). Nobody is moved onto a
program without his word, one player at a time.

Open fit questions:
- Length: three blocks of four weeks is 12 weeks; 90 days is nearly 13.
  Proposed: week 13 is a re-film and review week.
- After week 12 or 13: a new quiz and a new three months, or back to the
  ordinary week. His call.
- A few-yards player's week is his hand-built sessions today; a program
  for that player comes after the open-space build.
- Members already in: start a program from where they are, or leave them
  on the ordinary week. His call, per player.

## Still his to decide

- The category and pillar names.
- DECIDED Nov 11: a program may pull speed drills into the week when speed
  is that player's focus or thread.
- The promise wording and terms (do the work, not satisfied, money back).
- Where the quiz lives: in the app is fine with him, once the fit above
  is agreed.
