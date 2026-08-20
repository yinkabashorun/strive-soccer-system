# Strive Soccer FC — Training Methodology

This is the human-readable version of Strive's training methodology. The
machine-readable single source of truth lives in
[`lib/elite/methodology.ts`](../lib/elite/methodology.ts) and drives every
AI-generated weekly plan. **Edit that file to change how the whole system
coaches** — this doc explains the "why" behind it.

---

## The week

Every player's week is **four training sessions**, roughly **40 minutes each**,
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
2. Turns the notes into a four-session week, two skill drills per session,
   drawing from the pillar drill libraries and adapting to the player.
3. The system then **guarantees** the plyometric warm-up on the front of every
   session server-side, so the plyo-first rule holds no matter what the notes
   or the AI return.

Because the methodology is stored in one file, tightening the philosophy,
adding a drill, or changing the weekly structure changes every future plan the
system produces.
