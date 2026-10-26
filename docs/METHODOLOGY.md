# Strive Soccer FC — Training Methodology

This is the human-readable version of Strive's training methodology. The
machine-readable single source of truth lives in
[`lib/elite/methodology.ts`](../lib/elite/methodology.ts) and drives every
AI-generated weekly plan. **Edit that file to change how the whole system
coaches** — this doc explains the "why" behind it.

---

## The week

Every player's week is **four training sessions** on the In-Season plan or
**six** on the Off-Season plan (the family picks at onboarding, the coach can
override), roughly **40 minutes each**,
built to be done **at home — in a room or a yard**. No pitch, no partner, no
equipment beyond **a ball and a small space** — a wall, goal, rebounder, or
partner is only ever prescribed if the coach's notes say the player has one.

Every single session **opens with a room plyometric warm-up (~10 minutes)**.
This is non-negotiable and is added to every session automatically by the
system. Explosive plyometrics are what turn technical training into
on-field results — they build the fast-twitch power behind the first step,
the change of direction, the spring.

After the warm-up, each session is **exactly three focused skill drills**
(~10 minutes each), done with intent. The three drills plus the warm-up
fill the ~40 minutes.

## A ball and a few yards

A player on the few-yards space setting does not get a composed week. Their
week is the coach's **hand-built few-yards sessions** (`/coach/drills`,
"Few-yards sessions"), rotated least recently used first and never the same
one twice in a week while enough exist. Each template is skill drills only;
the system adds the plyo warm-up and, when a note calls for it, the
strengthening finisher, exactly as for every session. Placing a drill in a
template marks it "works in a few yards", so Extra Work for those players
draws from the same drills. With fewer templates than sessions in the week,
the least recent one repeats and the live-week audit says so.

## Send a clip

Every skill drill card has **Send a clip**: the player films themselves doing
the drill, it lands in their chat with the coach (private storage, their own
folder only), and the coach answers by text in the same thread.

## Progress video

Every second week the player films **the same drill** (the coach's pick, or
the first skill drill they ever completed). The parent gets the link by text
with the clip from two weeks ago beside it. The family says per clip whether
it may be shared in the Strive community; nothing is posted without that.

## Progress and breaks

Progress, as the family sees it, is **time trained**: minutes, sessions
done, weeks trained, and minutes by pillar. Nothing on the player's side
shows a completion percentage or a streak, and a gap of any length takes
nothing away. The coach's rating of the seven pillars stays as its own
block. A **break** is a date range the family or the coach sets: nothing is
built or sent until the return date, and on return the program clock moves
so the player resumes the week they left (`lib/elite/breaks.ts`).

## The principles

1. **Creative, intelligent football over robotic drills.**
2. **Touches before tricks** — master the basics or get exposed.
3. **The fastest player is the one who decides fastest**, not who runs most.
4. **Composure is taught. So is panic. We teach composure.**
5. **Scan before you receive** — see the picture before the ball arrives.
6. **Every session starts with explosive plyometrics in the room** — this is
   what turns training into results.
7. **Five focused minutes a day compounds.** Consistency beats intensity.
8. **Fewer, deeper reps done with intent** beat a long list rushed.

## The seven development pillars

Every player is developed and rated across the same seven pillars. Each has a
coaching lens and a starter library of room/yard-friendly drills the AI draws
from, adapted to the player's focus and level.

| Pillar | The lens |
| --- | --- |
| **Ball Mastery** | The ball is an extension of the foot. Manipulate, don't kick. |
| **Weak Foot** | Two-footed players are twice the problem. Force the weak side. |
| **Passing** | Weight, accuracy, and a scan before every pass. |
| **Scanning** | Two shoulder checks before every touch — make it automatic. |
| **Decision Making** | Right choice, right time. Read the cue, then act. |
| **Confidence** | Bravery on the ball is trained. Reps remove fear. |
| **Speed** | Explosive first steps and quick feet, not just top speed. |

The full drill libraries for each pillar live in `METHOD_PILLARS` in
[`lib/elite/methodology.ts`](../lib/elite/methodology.ts).

## The weekly cadence

A new week is only released when the **coach builds it** (Saturday night or
Sunday). Players are never told "next week is ready" just because they
finished the current one — the alert fires when the coach actually creates the
new plan. This keeps the mentorship personal and the progression coach-led.

## How the AI uses this

When a coach types raw session notes, the AI plan generator:

1. Reads the methodology above as its system prompt (from
   `methodologyContext()`).
2. Turns the notes into the player's week (four or six sessions by load),
   three skill drills per session, drawing only from the coach's filmed
   drill bank and adapting to the player (wall, space, injury note).
3. The system then **guarantees** the plyometric warm-up on the front of every
   session server-side, so the plyo-first rule holds no matter what the notes
   or the AI return.

Because the methodology is stored in one file, tightening the philosophy,
adding a drill, or changing the weekly structure changes every future plan the
system produces.

## Extra Work (Oct 2026)

A player can add an Extra Work session any day: one plyo warm-up plus three
skill drills from one shelf (Ball Mastery, Wall Work, 1v1 Skills), composed
from the filmed bank, never a drill they have already completed, then never
one from the current week, then the least recently done. One open extra at
a time. Same wall and space rules, same filmed-only guard at the database.

## Space (Oct 2026)

"A ball and a few yards" is a player setting. On it, only bank drills the
coach ticked as **small space** are ever assigned; plyo warm-ups and
strengthening finishers are room work and always fit.

## Course drills, offered per player (Oct 2026)

A bank drill can be marked a course drill (`opt_in`). It never enters a
week on its own. On the player page the coach switches the player on
("Offered in the week") and ticks which course drills the next week may
use for them. The rule lives in one place, `drillFitsPlayer` and
`offeredBank` in lib/elite/bank-conform.ts, and every path reads it:
the AI's drill menu, the deterministic fallback, the publish gate (so a
hand-edited studio plan naming an unoffered course drill gets a
replacement, not a link), Extra Work and the few-yards templates. Off
keeps the picks; nothing changes in the week already built. The first
course drills are the fourteen Keep It Up juggling rows.

Where they go (Oct 24 2026, Coach Yinka: "when you add them add them
after plyometrics with the warm up. Keep all other drills"): a course
drill is a slot, not a skill drill. Every session reads plyo warm-up,
then one offered course drill, then the three skill drills, then any
finisher. The slot rotates through the ticked drills in bank order (the
ladder, easiest first) across the sessions of the week and wraps when
fewer are ticked than there are sessions. Course drills never count
toward the three skill drills, are never on the AI's menu (the system
places them, like plyos and finishers), never go in an Extra Work shelf
or a few-yards template, and a course drill the AI or the studio writes
as a skill drill is routed to the slot (offered) or dropped (not
offered) with the session filled back to three skill drills. One per
session is the default, `COURSE_SLOTS_PER_SESSION` in bank-conform.ts.

## The Shooting pillar and the goal rule (Oct 2026)

"Shooting" is a bank pillar (migration 042), the first course on Coach
Yinka's roadmap. It is not a rated metric. A Shooting drill is a skill
drill for the builder; a drill ticked "Needs a goal" fits only a player
whose profile says they have one (`drillFitsPlayer` in bank-conform.ts,
the same gate as needs_wall / has_wall, applied at both gates, in Extra
Work and in the templates). The prompt marks such drills [goal] and
tells the AI they go only to players with a goal; the output gate
replaces one given to anyone else. Whether a shooting drill is a course
drill (slot only, offered per player) is the drill's own course tick,
unchanged.

## Courses, the library tab (Oct 2026)

A course is a named ladder of steps grouped into levels, shown to every
member on the Courses tab (Coach Yinka, Oct 23 2026: "a library,
nothing tracked"). Two kinds on one primitive (migration 041,
`elite_courses` + `elite_course_steps`): a DRILL course's steps are bank
drills by id, so the video, the bank title and the reps follow the
drill (rename or re-film a drill and the course updates); a LESSON
course's steps are pages (title, body, optional video and download) for
recruiting and the General Nutrition Guide. One step is one or the
other, enforced by a check constraint. A drill in a course cannot be
hard-deleted from the bank (on delete restrict); a paused or unfilmed
drill step is hidden from the tab, never shown broken. A course never
changes anyone's week: whether a drill enters a week is the drill's own
course tick plus the player's picks (040), untouched by the course.
Rules in `lib/elite/courses.ts` (levels, the drill's own name shown
without the bank's label prefix, step shape, what members see),
unit-tested. Coach editor at /coach/drills ("Courses" above the
few-yards sessions): name, subtitle, intro lines, kind, steps with
level, tag, cue, pass mark, up/down, on/off. Player pages /courses and
/courses/[slug]. Keep It Up is seeded by the migration exactly as the
preview page read on Oct 25 2026: seven levels, fourteen drills, pass
marks on the beginner drills only.
