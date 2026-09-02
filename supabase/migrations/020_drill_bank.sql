-- =====================================================================
-- Strive Elite - the coach's drill bank
-- =====================================================================
-- Every drill the AI is allowed to prescribe lives here, owned and
-- edited by the coach at /coach/drills. Generation COMPOSES weeks from
-- these rows (reps/minutes may be adapted per player); it never invents
-- drills. Seeded from the built-in Strive method library.
--
-- Coach-only: players never read this table (published plans copy the
-- drill text into elite_homework).
-- =====================================================================

create table if not exists public.elite_drills (
  id         uuid primary key default gen_random_uuid(),
  pillar     text not null check (pillar in ('Ball Mastery','Weak Foot','Passing','Scanning','Decision Making','Confidence','Speed')),
  title      text not null,
  how        text not null default '',
  reps       text not null default '',
  minutes    int  not null default 10 check (minutes between 3 and 30),
  cues       text not null default '',
  needs_wall boolean not null default false,
  active     boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists elite_drills_pillar_idx on public.elite_drills(pillar, sort);

alter table public.elite_drills enable row level security;

drop policy if exists elite_drills_coach_all on public.elite_drills;
create policy elite_drills_coach_all on public.elite_drills
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());

-- Seed once: only when the bank is empty, so re-running never duplicates.
insert into public.elite_drills (pillar, title, how, reps, minutes, cues, needs_wall, sort)
select * from ( values
  ('Ball Mastery', 'Inside-outside cone weave', 'Line of 5 cones a yard apart. Weave through with inside and outside of the foot only, tight touches', '6 x 45 sec on, 45 sec off', 9, 'Small touches, ball close, eyes up between gates', false, 10),
    ('Ball Mastery', 'La Croqueta cone weave', 'Line of 5 cones a yard apart. La croqueta at every cone: quick shift foot to foot, glide past. Both directions', '5 x 45 sec on, 45 sec off', 8, 'Quick shift, stay low, accelerate out', false, 20),
    ('Ball Mastery', '8-cone freestyle', '8 cones scattered in a box. Free dribble, every surface of both feet, one skill move at each cone you pass', '5 x 60 sec on, 45 sec off', 9, 'Never the same move twice, change direction, head up', false, 30),
    ('Ball Mastery', 'Ronaldinho drill', 'Ball at your feet, small space. Inside-touch inside-touch between the feet, then a sole roll to reset. Steady rhythm', '4 x 60 sec on, 30 sec off', 8, 'Rhythm over speed, soft touches, eyes up on the last 10', false, 40),
    ('Ball Mastery', 'Figure-8 dribble', 'Two cones two yards apart. Tight figure-8 through them, close touches both feet', '6 x 45 sec on, 45 sec off', 9, 'Ball glued to the foot, head up on the straights', false, 50),
    ('Ball Mastery', 'Foundations + sole rolls', 'Ball at your feet, small space. Foundations into sole rolls, both feet', '6 x 60 sec on, 40 sec off', 10, 'Eyes up the whole set, quick feet, stay on your toes', false, 60),
    ('Weak Foot', 'Weak-foot patterns', 'Line of cones or shoes. Dribble patterns through them, weak foot only', '6 x 45 sec weak foot only, 45 sec off', 9, 'Slow is fine, clean is required, every surface of the foot', false, 70),
    ('Weak Foot', 'Weak-foot push-pulls', 'Ball at your feet, small space. Push-pulls and toe-taps, weak foot only', '4 x 40, rest 30 sec', 8, 'Sole to inside, steady rhythm, eyes up on the last five', false, 80),
    ('Weak Foot', 'Weak-foot rebounds', 'Stand 5 yards from your wall: garage door, brick wall, or fence. Rebound passes, weak side only', '4 x 20, rest 45 sec', 9, 'Cushion the return, firm pass back, ankle locked', true, 90),
    ('Weak Foot', 'Weak-foot strikes', 'Set a target 10 yards out: a cone, a shoe, a fence post. Strikes with the weak foot, laces only', '4 x 10, collect and reset between sets', 9, 'Plant foot beside the ball, laces, follow through at the target', false, 100),
    ('Passing', 'Rebound passing', 'Stand 5 yards from your wall: garage door, brick wall, or fence. Firm two-touch passes, both feet', '5 x 20 two-touch, rest 40 sec', 10, 'Scan before the ball arrives, firm pass, first touch out of your feet', true, 110),
    ('Passing', 'Rebound rhythm', 'Close to the wall, 3 yards. One-touch returns, keep the rally alive', '5 x 45 sec one-touch, 45 sec off', 8, 'On your toes, ankle locked, scan between reps', true, 120),
    ('Passing', 'Pass, turn, pass', '5 yards off the wall. Pass with the right, receive on the half-turn, two touches away, pass back with the left. Alternate every rep', '5 x 12, rest 40 sec', 10, 'Scan before the ball comes back, back-foot receive, both feet equal', true, 130),
    ('Passing', 'Driven wall passes', 'Back up to 15 yards from the wall. Driven passes with pace, control the return before it stops, reset and go again. Both feet', '4 x 10 each foot, rest 40 sec', 10, 'Strike through the ball, kill the return with one touch', true, 140),
    ('Scanning', 'Scan + touch', 'Ball at your feet, open space. Shoulder-check before every touch in a dribble pattern', '5 x 45 sec on, 45 sec off', 8, 'Check both shoulders, say what you saw out loud', false, 150),
    ('Scanning', 'Number-call scanning', 'A parent or sibling stands behind you holding up fingers mid-drill. Read the number before your next touch', '4 x 20 touches, rest 30 sec', 8, 'Scan first, touch second, never guess', false, 160),
    ('Scanning', 'Half-turn receives', 'Roll the ball out in front of you. Receive on the half-turn away from imagined pressure, first touch out of your feet into space', '3 x 15, reset after every receive', 10, 'Shoulder-check before the ball arrives, open your hips, touch into space', false, 170),
    ('Decision Making', 'Two-gate finish', 'Two gates of cones or shoes, 5 yards apart. Attack the middle, pick one gate late, and explode through it', '5 x 8, walk-back reset each rep', 10, 'Decide late, commit fully, burst through the gate', false, 180),
    ('Decision Making', '1v1 shadow', 'One cone as the defender. Dribble at it, commit it with a move, then decide: exit left, exit right, or stop and shield', '4 x 10, rest 40 sec', 9, 'Sell the move, decide on the way in, never the same exit twice', false, 190),
    ('Decision Making', 'Clip study', 'Pull up a full match or extended highlights of a pro in your position. Watch them off the ball, note three decisions they made early', '10 focused minutes, 3 takeaways written down', 10, 'Watch the player, not the ball, steal one habit tomorrow', false, 200),
    ('Confidence', 'Move of the day', 'One cone as the defender, 10 yards of run-up. Pick one move (Stepover, Body Feint, Neymar Feint, Maradona...), dribble at the cone, hit the move right at it, burst two steps past. Slow until clean, then full speed', '3 x 12 each side, slow then full speed', 9, 'Sell the fake, drop the shoulder, explode out', false, 210),
    ('Confidence', 'Chain two moves', 'Two cones 5 yards apart. Dribble at the first, hit move one, attack the second, hit move two: stepover into the chop, body feint into la croqueta', '4 x 10 full speed, rest 40 sec', 9, 'Defenders stop one move, not two, accelerate between cones', false, 220),
    ('Confidence', '1v1 freestyle', 'One cone as the defender, full run-up. Dribble at it with speed, sell any move from the library right at the cone, explode past', '5 x 8 full speed, walk-back reset', 10, 'No hesitation, no repeats back to back, game speed only', false, 230),
    ('Confidence', 'Juggling record', 'Just you and the ball. Beat yesterday''s best number, any surface counts', '6 record attempts, rest as needed', 8, 'Soft touches, knees bent, reset calmly after a drop', false, 240),
    ('Speed', 'Quick feet', 'Any line on the ground. Fast feet over and back, minimal ground contact', '8 x 20 sec on, 40 sec off', 8, 'Think hot floor, stay on the balls of your feet, arms pumping', false, 250),
    ('Speed', 'Acceleration starts', 'Two markers 5 yards apart. Explode from a standstill to the far marker, walk back', '8 sprints, walk back for full recovery', 10, 'Low first step, drive the arms, full recovery every rep', false, 260),
    ('Speed', 'Reaction starts', 'Athletic stance, 10 yards of space. Sprint on a visual cue: a parent''s hand drop or a tossed ball hitting the ground', '6 starts, full recovery between', 8, 'React, don''t guess, first step forward never up', false, 270)
) as seed(pillar, title, how, reps, minutes, cues, needs_wall, sort)
where not exists (select 1 from public.elite_drills);
