// All Strive Dribbling System ad copy in one typed module.
// Drives the /admin/course-ads library page. Edit here, ship instantly.

export type UGCAngle = {
  id: string;
  number: number;
  title: string;
  description: string;
};

export type Hook = { id: string; number: number; text: string };

export type UGCScript = {
  id: string;
  number: number;
  title: string;
  body: string;
};

export type Caption = { id: string; number: number; text: string };

export type ParentAd = {
  id: string;
  number: number;
  title: string;
  body: string;
};

export type PlayerAd = {
  id: string;
  number: number;
  title: string;
  body: string;
};

export type RetargetingAd = {
  id: string;
  number: number;
  title: string;
  body: string;
};

export const UGC_ANGLES: UGCAngle[] = [
  {
    id: "angle-1",
    number: 1,
    title: "The Panic Player",
    description:
      "Before/after contrast — player who freezes under pressure discovers ball mastery and transforms.",
  },
  {
    id: "angle-2",
    number: 2,
    title: "The Parent Who Noticed",
    description:
      "Parent tells the story of watching their kid lose confidence and finding what finally worked.",
  },
  {
    id: "angle-3",
    number: 3,
    title: "Why Drills Don't Work",
    description:
      "The gap between drill performance and game performance, and ball mastery as the actual fix.",
  },
  {
    id: "angle-4",
    number: 4,
    title: "The Confidence Transfer",
    description:
      "Mastery builds real confidence that shows up everywhere, not just on the soccer field.",
  },
  {
    id: "angle-5",
    number: 5,
    title: "The Elite Secret",
    description:
      "Academy players pay thousands for this training. Here it is for $97.",
  },
  {
    id: "angle-6",
    number: 6,
    title: "30 Minutes a Day",
    description:
      "Real training session in a backyard — simple, doable, surprisingly powerful.",
  },
  {
    id: "angle-7",
    number: 7,
    title: "The Player Who Was Almost Benched",
    description:
      "Near-quit story: player lost minutes, found the system, earned the spot back.",
  },
  {
    id: "angle-8",
    number: 8,
    title: "What Defenders Fear",
    description:
      "Told from a defender's perspective facing a player with real mastery.",
  },
  {
    id: "angle-9",
    number: 9,
    title: "The Comparison Problem",
    description:
      "Empathetic parent angle — watching their kid next to more confident players.",
  },
  {
    id: "angle-10",
    number: 10,
    title: "The 14-Day Challenge",
    description:
      "Try it for 14 days, see improvement, or get every dollar back.",
  },
];

export const HOOKS: Hook[] = [
  {
    id: "hook-1",
    number: 1,
    text: "Your kid has been practicing for years. Why do they still panic on the ball?",
  },
  {
    id: "hook-2",
    number: 2,
    text: "The reason your player keeps losing the ball under pressure has nothing to do with talent.",
  },
  {
    id: "hook-3",
    number: 3,
    text: "Academy coaches don't drill their players. They do this instead.",
  },
  {
    id: "hook-4",
    number: 4,
    text: "I've coached hundreds of youth players. The ones who break through all have one thing in common.",
  },
  {
    id: "hook-5",
    number: 5,
    text: "If your kid looks uncomfortable on the ball in games, this is why.",
  },
  {
    id: "hook-6",
    number: 6,
    text: "Stop drilling moves. Start building mastery. Here's the difference.",
  },
  {
    id: "hook-7",
    number: 7,
    text: "The best young players aren't faster or stronger. They're calmer.",
  },
  {
    id: "hook-8",
    number: 8,
    text: "Your kid can do the move in practice but freezes in games. I can fix that in 14 days.",
  },
  {
    id: "hook-9",
    number: 9,
    text: "A $97 course changed how my player sees the game. No, really.",
  },
  {
    id: "hook-10",
    number: 10,
    text: "Most soccer training is building the wrong thing.",
  },
  {
    id: "hook-11",
    number: 11,
    text: "You can feel the moment a player truly has the ball under control. It's unmistakable.",
  },
  {
    id: "hook-12",
    number: 12,
    text: "The real reason defenders get frozen isn't the move. It's the player's confidence.",
  },
  {
    id: "hook-13",
    number: 13,
    text: "Ball mastery is a skill. It can be trained. Most coaches just don't know how.",
  },
  {
    id: "hook-14",
    number: 14,
    text: "Watching your kid give the ball away every time there's pressure? This is the fix.",
  },
  {
    id: "hook-15",
    number: 15,
    text: "I built this for the players nobody thinks are talented yet.",
  },
  {
    id: "hook-16",
    number: 16,
    text: "What does a player who's in full control of the ball actually look like? I'll show you.",
  },
  {
    id: "hook-17",
    number: 17,
    text: "Every great dribbler has one thing in common. It's not quick feet.",
  },
  {
    id: "hook-18",
    number: 18,
    text: "This is the training your coach wishes they had time to teach.",
  },
  {
    id: "hook-19",
    number: 19,
    text: "If your player is still looking down at the ball in games, they haven't built mastery yet.",
  },
  {
    id: "hook-20",
    number: 20,
    text: "30 minutes a day. 14 days. I'll show you what's possible.",
  },
];

export const UGC_SCRIPTS: UGCScript[] = [
  {
    id: "script-1",
    number: 1,
    title: "Panic Problem",
    body: "If your kid panics every time a defender runs at them, it's not a confidence problem. It's a training problem. They've never been taught to handle real pressure — just controlled drills. The Strive dribbling system teaches ball mastery in actual pressure situations so that in games, everything slows down. Link in bio. First 14 days, full refund if it doesn't work.",
  },
  {
    id: "script-2",
    number: 2,
    title: "Parent Perspective",
    body: "My kid was getting to practice early, staying late, and still looking the same in games. Then we found Strive. Six weeks later — different player. Head up, taking people on, actually having fun. It's $97. It's 30 minutes a day. And honestly it's the best money I've spent on their soccer. Link in bio.",
  },
  {
    id: "script-3",
    number: 3,
    title: "Move vs Mastery",
    body: "Everyone teaches moves. Nobody teaches mastery. A move is something you memorize. Mastery is when your body just knows. When you have mastery, the ball stays close, defenders can't predict you, and pressure doesn't freeze you. That's what Strive teaches. $97. Lifetime access. Link in bio.",
  },
  {
    id: "script-4",
    number: 4,
    title: "30 Minutes",
    body: "You don't need to be at the field six days a week. You need 30 focused minutes of the right training. The Strive dribbling course is built specifically for solo training — backyard, driveway, park — and it builds real skill fast. $97, money-back guarantee, link in bio.",
  },
  {
    id: "script-5",
    number: 5,
    title: "Player Direct",
    body: "You want to be the player everyone watches. The one who breaks ankles, slows the game down, and makes it look effortless. That isn't luck. That's mastery. And mastery is trainable. Strive's dribbling course is the system. $97. 14-day guarantee. Come build something real.",
  },
  {
    id: "script-6",
    number: 6,
    title: "Confidence Transfer",
    body: "Ball mastery changes more than your feet. When a player truly controls the ball, they walk different, react different, compete different. Coaches see it. Teammates feel it. Opponents dread it. That's what we build inside the Strive dribbling course. Link in bio.",
  },
  {
    id: "script-7",
    number: 7,
    title: "Benched Player",
    body: "One of my players was about to lose his starting spot. In eight weeks of this system, he went from the most hesitant player on his team to the one coaches specifically asked to take on defenders. $97, 30 minutes a day, link in bio.",
  },
  {
    id: "script-8",
    number: 8,
    title: "Comparison",
    body: "You've seen that player — the one who just looks different on the ball. Comfortable, creative, unguardable. That isn't a gift. That's ball mastery. And your player can build it. The Strive dribbling course. $97. Link in bio.",
  },
  {
    id: "script-9",
    number: 9,
    title: "Skeptic Flip",
    body: "I know what you're thinking — another soccer course, another set of drills. This isn't that. This is the specific training framework that builds feel, not patterns. If you don't see real improvement in 14 days, I'll give you your $97 back. That's how confident I am. Link in bio.",
  },
  {
    id: "script-10",
    number: 10,
    title: "Urgency",
    body: "I've kept this at $97 because I want it accessible. But I'm raising the price when I add the next module. If you're watching this, you're seeing the lowest price this will ever be. Link in bio. Get in now.",
  },
];

export const CAPTIONS: Caption[] = [
  {
    id: "caption-1",
    number: 1,
    text: "The difference between a good player and a great one isn't talent — it's what they do with the ball when it gets hard. Build mastery. Link in bio.",
  },
  {
    id: "caption-2",
    number: 2,
    text: "Your player has been working hard. Now let's make sure they're working on the right thing. Strive Dribbling Course — $97, lifetime access, 14-day guarantee.",
  },
  {
    id: "caption-3",
    number: 3,
    text: "Ball mastery changes everything. The touch, the confidence, the way the game slows down. This is what we teach. Link in bio.",
  },
  {
    id: "caption-4",
    number: 4,
    text: "30 minutes a day. Real training. Real results. The Strive Dribbling System is open. $97, link in bio.",
  },
  {
    id: "caption-5",
    number: 5,
    text: "Drills build robots. Mastery builds players. Come learn the difference. Link in bio.",
  },
  {
    id: "caption-6",
    number: 6,
    text: "They don't panic anymore. They don't give the ball away under pressure. They play free. That's mastery. That's what we build.",
  },
  {
    id: "caption-7",
    number: 7,
    text: "This is for the player who wants to be unguardable. Not just better — genuinely hard to stop. $97, link in bio.",
  },
  {
    id: "caption-8",
    number: 8,
    text: "Most soccer training skips the most important part: what happens inside the player's body under pressure. We don't skip that. Link in bio.",
  },
  {
    id: "caption-9",
    number: 9,
    text: "If you've spent hundreds on cleats, training fees, and tournaments — this $97 investment will do more for your player's development than almost anything else.",
  },
  {
    id: "caption-10",
    number: 10,
    text: "Creative players aren't born. They're built. Here's the system. Link in bio.",
  },
];

export const PARENT_ADS: ParentAd[] = [
  {
    id: "parent-1",
    number: 1,
    title: "Investment Reframe",
    body: "You've already invested in your player — cleats, tournaments, club fees, private training. But if they still look uncertain on the ball in games, the investment isn't producing what you need. The Strive Dribbling Course is $97. Built specifically to fix the comfort-under-pressure problem. 14-day money-back guarantee.",
  },
  {
    id: "parent-2",
    number: 2,
    title: "Sideline Parent",
    body: "You know that feeling — standing on the sideline watching your kid hesitate, rush a touch, give the ball away when a defender closes them down. You want to help but you don't know what to say. The answer isn't more practice. It's the right kind of practice. Strive teaches ball mastery. Your kid will feel the difference in two weeks.",
  },
  {
    id: "parent-3",
    number: 3,
    title: "Confidence Beyond Soccer",
    body: "Something changes in a kid when they truly trust themselves with the ball. It's not just how they play — it's how they carry themselves. More confident. Less anxious. More willing to take risks and recover when they fail. That's what ball mastery does. The Strive Dribbling Course builds that. $97. Lifetime access.",
  },
  {
    id: "parent-4",
    number: 4,
    title: "Comparison Problem",
    body: "You've watched other kids on the field — the ones who look different. Comfortable, creative, in control. Your player can develop that. It's not genetics. It's a specific kind of training that most coaches don't have time to give. We built it into a 30-minute-a-day home system. $97. See results in 14 days or your money back.",
  },
  {
    id: "parent-5",
    number: 5,
    title: "Direct Parent CTA",
    body: "Parents: if your player is 9-18 and wants to genuinely improve their ball control, 1v1 ability, and confidence under pressure — this course was built for them. $97, trains at home in 30 minutes, backed by a 14-day refund guarantee. This is the thing that actually makes the difference.",
  },
];

export const PLAYER_ADS: PlayerAd[] = [
  {
    id: "player-1",
    number: 1,
    title: "Unguardable",
    body: "You want to be the player nobody wants to mark. The one where defenders back off before you even touch the ball. That's not speed. That's not size. That's mastery. And I'll teach you the exact system to build it. $97. Let's go.",
  },
  {
    id: "player-2",
    number: 2,
    title: "1v1 Closer",
    body: "1v1s are won before the move. They're won the moment a defender looks at you and either believes you or doesn't. When you have real ball mastery, they hesitate. That hesitation is your opening. Learn to create it — Strive Dribbling Course, $97.",
  },
  {
    id: "player-3",
    number: 3,
    title: "Player Aspiration",
    body: "The players you look up to — the ones who make it look slow, play with creativity, never seem rattled — they trained a specific way. Not more drills. Better training. The Strive Dribbling Course gives you that system. 30 minutes a day. $97.",
  },
  {
    id: "player-4",
    number: 4,
    title: "Direct Challenge",
    body: "You say you want to be better. So train better. Not more laps, not the same cone drills — actual ball mastery training that builds feel, control, and confidence under real pressure. 14 days. Let's see what you're made of. $97.",
  },
  {
    id: "player-5",
    number: 5,
    title: "Game Speed",
    body: "If the game feels too fast, your training is too slow. Strive's dribbling system trains you in simulated pressure so that real defenders feel like they're moving in slow motion. That's the shift. $97. Money-back if it doesn't work.",
  },
];

export const RETARGETING_ADS: RetargetingAd[] = [
  {
    id: "retarget-1",
    number: 1,
    title: "Simple Re-Ask",
    body: "You watched the video. Something in there made sense to you. The only reason not to move forward is doubt — and the 14-day guarantee removes that entirely. $97. Full refund if it doesn't work. What's actually stopping you?",
  },
  {
    id: "retarget-2",
    number: 2,
    title: "Objection Crusher",
    body: "Still thinking about it? Here's the math: one private training session costs $60-$100. One session. The Strive Dribbling Course is $97 and it's a complete system — lifetime access, every module, every drill. No comparison.",
  },
  {
    id: "retarget-3",
    number: 3,
    title: "Guarantee Emphasis",
    body: "I know $97 is a real number. That's why the guarantee exists. Go through the first module. Train for 14 days. If you don't see real improvement in your ball control and confidence, email me and I'll refund every dollar. You're not risking $97. You're just deciding whether you want to try.",
  },
  {
    id: "retarget-4",
    number: 4,
    title: "Urgency Return",
    body: "I'm not going to keep this at $97. As I add the advanced module and the pressure training expansion, the price goes up. You've already seen what the course is. Now's the time.",
  },
  {
    id: "retarget-5",
    number: 5,
    title: "Player Vision",
    body: "Picture your player in six months. Head up. Comfortable on the ball. Taking people on and winning. Coaches watching. The investment to get there is $97. You already know this is right. Click the link.",
  },
];

// Course modules — used by the VSL.
export type CourseModule = {
  number: number;
  title: string;
  description: string;
  duration: string;
};

export const COURSE_MODULES: CourseModule[] = [
  {
    number: 1,
    title: "Ball Mastery Foundation",
    description:
      "Touches, patterns, movement mechanics that build feel and control. Immediate improvement in first touch and body positioning.",
    duration: "~30 min/session",
  },
  {
    number: 2,
    title: "1v1 Domination",
    description:
      "Moves, feints, weight shifts, body mechanics for unpredictable direct duels. Open space first, tight pressure next.",
    duration: "~30 min/session",
  },
  {
    number: 3,
    title: "Pressure Training",
    description:
      "Simulated pressure environments. Players describe the game as slowing down.",
    duration: "~30 min/session",
  },
  {
    number: 4,
    title: "Creative Play Unlocked",
    description:
      "Reading space, combining moves, improvising. Where players stop executing and start creating.",
    duration: "~30 min/session",
  },
];

export const SOCIAL_PROOF_QUOTES: string[] = [
  "Different player in 6 weeks.",
  "Finally looks comfortable on the ball.",
  "Went from losing his spot to being the coach's first call.",
  "My daughter plays free now. Totally different energy.",
];

export const FAQS: { q: string; a: string }[] = [
  {
    q: "Is this right for my player's age and level?",
    a: "Ages 9-18, all levels. Every drill has progressions so a 9-year-old just starting out and a 16-year-old club player are both training at the right intensity.",
  },
  {
    q: "My kid is on a club team. Do they still need this?",
    a: "Yes — even more so. Club is team-focused. This fills the individual mastery gap clubs assume gets done at home and rarely actually does.",
  },
  {
    q: "How much time does this take?",
    a: "30 minutes per session, 3-5 times per week. Most players start asking to do it once they feel the difference in their touch.",
  },
  {
    q: "What if it doesn't work?",
    a: "14-day full refund. No questions, no friction. Email us and you get every dollar back.",
  },
  {
    q: "Why $97?",
    a: "One private training session costs $60-$120. This is lifetime access to a complete 4-module system. It's the lowest the price will be — when the next module launches it goes up.",
  },
  {
    q: "Can this really be done at home?",
    a: "Yes. All you need is a ball and a small open space. Backyard, driveway, park — even a hallway works for the early modules.",
  },
];
