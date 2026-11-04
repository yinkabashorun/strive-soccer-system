# Top-funnel reels, Nov 2 2026

Five reels cut from the drill bank (public/drills, Strive's own filmed
clips, nothing of the coach's on them), built with the strive-reel skill
through `montage_reel.py`: hook on screen from frame one, the 01 / 02 /
03 list building up as each clip lands, the STRIVE ELITE watermark, the
2.4 s DM "ELITE" end card. 1080x1920, 30 fps. Sent to Coach Yinka, not
posted. REBUILT Nov 4 2026 on his two asks: the reels carry the clips'
ORIGINAL SOUND (the bank files stay muted under the Oct 25 rule; the
builder pulls each clip from git commit 36849aa, the last before the
mute) and every overlay sits inside the Instagram / TikTok safe zones
(x 60 to 920, y 270 to 1360: clear of the top bar, the icon column and
the caption area; watermark bottom-left above the caption). Trending
audio still goes on top IN THE INSTAGRAM APP when posting (never a
claimed song, Oct 7 rule); the clip sound is the bed under it.

## Sound, reel by reel

| Reel | Original sound |
| --- | --- |
| Weak foot | all 4 clips (quiet driveway recordings, lifted up to +18 dB) |
| Juggling ladder | all 7 clips |
| Speed | NONE: the five sprint clips were encoded silent the day they arrived (Oct 27), no copy with sound exists in the repo. Silent track until the end swish; add audio in the app, or send the original phone files and it rebuilds with them |
| Explosive | all 5 clips (gym sound) |
| Ball mastery | 3 of 5: the two-touch pair and L turn; Neymar feint and juggle-and-catch were silent at source |

## What the research said (Nov 2 2026)

Vendor blogs, no soccer-specific data; treat as rules of thumb and judge
by our own retention curve.

- The hook lands in the first 1 to 1.5 s, on screen as text, because
  most Reels are watched on mute. Instagram measures at the 3 s mark.
- Number and list promises ("5 drills...", "4 fixes...") and a
  specific outcome ("faster first step") hold better than a generic
  reveal. The biggest soccer tutorial account found (Alex Ramos, reels
  reported in the tens of millions) runs exactly this: "5 Skills You
  Will See in 2026", "4 Fixes to Hit the Perfect Long Ball".
- Something changes on screen every 2 to 3 s; one new clip per list
  item does that. Under 30 s.
- A question in the caption or the hook drives comments, which the
  algorithm reads as a signal.
- Sources: socialmon.ai hook library 2026, creatorhouse.app reel hooks
  2026, socialpilot.co reels trends 2026, quso.ai reels best practices
  2026, ugccopilot.ai hook framework 2026, framesurfer.com reels tips
  2026, motionapp.com and socialpruf.com pages on @alexramostraining.

## The five

| Reel | File | Length | Hook on screen | List |
| --- | --- | --- | --- | --- |
| Weak foot | weak-foot/strive-weak-foot-4-drills.mp4 | 20.4 s | NO WALL NEEDED / 4 WEAK FOOT DRILLS FOR YOUR DRIVEWAY | Tap pull push; Outside pull inside pull; Pop and settle; Pop and juggle |
| Juggling ladder | juggling-ladder/strive-juggling-ladder-7-levels.mp4 | 24.1 s | THE JUGGLING LADDER / CAN YOUR PLAYER PASS LEVEL 7? | One touch; Two touches each foot; One, two; Laces, inside; Thigh; Thighs, laces; Head it up |
| Speed | speed/strive-speed-5-drills.mp4 | 22.2 s | SPEED / 5 DRILLS FOR A FASTER FIRST STEP | Kneel and drive; Push-up start; Drop shuffle sprint; Zigzag sprint; The cross |
| Explosive | explosive/strive-explosive-5-jumps.mp4 | 22.4 s | EXPLOSIVE FIRST STEP / 5 JUMPS. NO GYM. | Pogo; Lateral hops; Broad jumps; Squat jumps; Bulgarian split jumps |
| Ball mastery | ball-mastery/strive-ball-mastery-few-yards.mp4 | 22.9 s | NO FIELD NEEDED / BALL MASTERY IN A FEW YARDS | Two touch v1; Two touch v2; L turn roll touch; Neymar feint; Juggle and catch |

Flag on Explosive: the clips were filmed in a gym, and the hook says
"no gym". The jumps need no equipment, which is the point, but if the
contrast reads wrong, change the hook to "5 JUMPS. NO EQUIPMENT." in
explosive/plan.json and rebuild (one minute).

## Captions (Coach Yinka's voice, paste as written or edit)

Weak foot
```
Four weak foot drills your player can do in the driveway tonight. No wall, no partner, a ball and a few yards.

Tap, pull, push. Outside pull, inside pull. Pop and settle. Pop and juggle. Three rounds of a minute each, rest thirty seconds.

Which foot does your player avoid in games? Tell me below.

Every drill here is in the Strive Elite week. DM ELITE and I build one around your player.
```

Juggling ladder
```
Seven levels. Most players stall at level 3.

One touch. Two touches each foot. One, two. Laces, inside. Thigh. Thighs, laces. Head it up. Pass the catch version, then keep it up, then move up a level.

Comment the level your player is on right now.

The full ladder, every level filmed, is inside Strive Elite. DM ELITE.
```

Speed
```
A faster first step is not about running more. It is five patterns, done right, with full rest between reps.

Kneel and drive. Push-up start. Drop, shuffle, sprint. Zigzag sprint. The cross.

Save this for your player's next session.

The whole Speed course, 17 drills in five levels, is in Strive Elite. DM ELITE.
```

Explosive
```
Five jumps that build an explosive first step. No weights, no gym membership, a few yards of ground.

Pogo jumps. Lateral hops. Broad jumps. Squat jumps. Bulgarian split jumps. Land soft, leave fast.

Tag a player who needs this.

These run as the warm-up in every Strive Elite session. DM ELITE.
```

Ball mastery
```
No field, no problem. Five ball mastery patterns in a few yards.

Two touch, variation 1. Two touch, variation 2. L turn, roll, touch. Neymar feint. Juggle and catch. Three rounds of a minute each.

Which one is your player trying first? Comment below.

A week built around your player, every drill on video. DM ELITE.
```

## Rebuild

From each reel folder: `python3 ../../../../.claude/skills/strive-reel/montage_reel.py plan.json`.
Edit the hook lines, the list names or the clip cuts in plan.json. The
folder keeps plan.json, spec.json, faces.json, the two .ass files and
the final MP4; source.mp4 and the audio/ folder are scratch, rebuilt
from the bank and from git every time (both gitignored). To give a
segment sound from a file he sends, add `"audio": "path"` to that
segment in plan.json.
