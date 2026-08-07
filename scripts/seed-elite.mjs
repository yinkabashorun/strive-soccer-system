// Strive Elite — production seed script.
//
// Creates a coach + five demo players as real Supabase auth users and
// inserts their goals, homework, progress, film, notes, messages, and
// achievements. Run AFTER applying supabase/migrations/005_strive_elite.sql.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/seed-elite.mjs
//
// Idempotent-ish: re-running deletes and recreates the demo players by
// email. Demo password for every account: "StriveElite!25".

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
  );
  process.exit(1);
}

const PASSWORD = "StriveElite!25";
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const METRICS = [
  "Ball Mastery",
  "Weak Foot",
  "Passing",
  "Scanning",
  "Decision Making",
  "Confidence",
  "Speed",
];

const COACH = {
  email: "coach@strivesoccerfc.com",
  full_name: "Coach Ramella",
  avatar_color: "#E5FF3D",
};

const PLAYERS = [
  {
    email: "marcus@strivedemo.com",
    full_name: "Marcus Bello",
    avatar_color: "#E5FF3D",
    age: 13,
    position: "Attacking Midfield",
    level: "Advanced",
    current_week: 7,
    today_focus: "Scan before you receive — two looks minimum",
    goals: ["Make the regional development squad", "Two-footed under pressure", "Full game with composure"],
    strengths: ["Close control", "Vision", "Work rate"],
    weaknesses: ["Weak foot finishing", "Slows under a press", "Heading"],
    parent_name: "Adeola Bello",
    subscription_status: "active",
    progress: [82, 54, 78, 71, 69, 80, 73],
    prev: [74, 48, 72, 58, 61, 70, 70],
    homework: [
      ["Wall pass mastery", "Two-touch wall passes, alternating feet", "200", true],
      ["Scanning under pressure", "Rondo — two shoulder checks per touch", "3 x 5 min", true],
      ["Weak-foot finishing", "Left-foot finishes from the box", "50", false],
      ["Watch & note", "Study Rodri's body shape. Note 3 moments.", "1 clip", false],
    ],
    message: "Loved your work rate. This week is all about the weak foot — send me 5 clips by Friday.",
    achievement: ["Homework Hero", "100% completion, 3 weeks running", "CheckCircle2"],
  },
  {
    email: "sofia@strivedemo.com",
    full_name: "Sofia Marín",
    avatar_color: "#7CC7FF",
    age: 12,
    position: "Winger",
    level: "Competitive",
    current_week: 5,
    today_focus: "First touch out of your feet, into space",
    goals: ["Beat a defender 1v1", "Sharper first touch at speed", "Score with both feet"],
    strengths: ["Acceleration", "Fearless 1v1", "Left foot"],
    weaknesses: ["First touch under pressure", "Final-third decisions", "Right foot"],
    parent_name: "Elena Marín",
    subscription_status: "active",
    progress: [68, 45, 62, 55, 58, 74, 86],
    prev: [60, 40, 58, 47, 50, 66, 82],
    homework: [
      ["First touch into space", "Receive, first touch across body into a gate", "120", true],
      ["1v1 acceleration", "Cone 1v1 — explode past on second touch", "4 x 8", false],
      ["Right-foot reps", "Weak-foot toe-taps and push-pulls", "5 min", false],
    ],
    message: "Your acceleration is unfair. Let's make that first touch just as scary.",
    achievement: ["Speed Demon", "Fastest 1v1 acceleration in the group", "Zap"],
  },
  {
    email: "diego@strivedemo.com",
    full_name: "Diego Santos",
    avatar_color: "#FF9F7C",
    age: 15,
    position: "Centre Back",
    level: "Elite",
    current_week: 11,
    today_focus: "Body shape when defending the half-turn",
    goals: ["Sign with an academy", "Command the back line", "Cleaner progressive passing"],
    strengths: ["Aerial dominance", "Positioning", "Composure"],
    weaknesses: ["Turning speed", "Passing under pressure", "Recovery pace"],
    parent_name: "Marisol Santos",
    subscription_status: "active",
    progress: [79, 70, 84, 88, 86, 90, 66],
    prev: [76, 64, 77, 80, 79, 85, 63],
    homework: [
      ["Defensive body shape", "Half-turn defending — open hips", "3 x 6 min", true],
      ["Progressive passing", "Long diagonal switches, both feet", "60", true],
      ["Turning speed", "180° turn drills off a trigger", "4 x 10", false],
    ],
    message: "Academy scout was impressed. Keep commanding that back line.",
    achievement: ["Aerial King", "Won 9 of 10 aerial duels in his trial", "Trophy"],
  },
  {
    email: "aisha@strivedemo.com",
    full_name: "Aisha Kone",
    avatar_color: "#C9A7FF",
    age: 11,
    position: "Striker",
    level: "Developing",
    current_week: 3,
    today_focus: "Finish first-time — don't take the extra touch",
    goals: ["Shoot with laces cleanly", "Stop drifting out of games", "Build confidence"],
    strengths: ["Movement in the box", "Bravery", "Speed"],
    weaknesses: ["Shooting technique", "Confidence", "Ball mastery"],
    parent_name: "Fatou Kone",
    subscription_status: "trialing",
    progress: [42, 30, 48, 40, 44, 52, 80],
    prev: [34, 26, 44, 33, 38, 40, 78],
    homework: [
      ["Laces finishing", "Strike a stationary ball into an open net", "40", false],
      ["Ball mastery base", "Toe taps, foundations, sole rolls", "5 min", true],
      ["Confidence reps", "Take a player on, no fear, film one", "10", false],
    ],
    message: "You were braver in the box last session — I saw it. Keep finishing first-time.",
    achievement: ["First Steps", "Completed her first full week of homework", "Sparkles"],
  },
  {
    email: "liam@strivedemo.com",
    full_name: "Liam O'Connor",
    avatar_color: "#8FE3B0",
    age: 14,
    position: "Full Back",
    level: "Competitive",
    current_week: 6,
    today_focus: "Overlap timing — arrive as the ball is played",
    goals: ["Become a threat going forward", "Sharper 1v1 defending", "Consistent cross"],
    strengths: ["Stamina", "1v1 defending", "Attitude"],
    weaknesses: ["Crossing", "Weak foot", "Attacking decisions"],
    parent_name: "Sean O'Connor",
    subscription_status: "active",
    progress: [64, 50, 70, 67, 63, 72, 77],
    prev: [60, 43, 65, 60, 57, 68, 74],
    homework: [
      ["Crossing repetition", "Whipped crosses to the penalty spot", "50", true],
      ["Overlap timing", "Shadow overlaps — arrive on release", "3 x 8", false],
      ["Weak-foot passing", "Left-foot driven passes over 20 yards", "60", false],
    ],
    message: "Your crossing is getting sharp. This week we time the overlaps.",
    achievement: ["Engine", "Highest work-rate score in the squad", "Flame"],
  },
];

async function findUserByEmail(email) {
  // paginate through users (fine for a demo-sized project)
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function upsertUser(email, meta) {
  const existing = await findUserByEmail(email);
  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      user_metadata: meta,
    });
    return existing.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: meta,
  });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  console.log("Seeding Strive Elite…");

  const coachId = await upsertUser(COACH.email, {
    role: "coach",
    full_name: COACH.full_name,
    avatar_color: COACH.avatar_color,
  });
  await supabase.from("elite_profiles").upsert({
    id: coachId,
    role: "coach",
    full_name: COACH.full_name,
    email: COACH.email,
    avatar_color: COACH.avatar_color,
  });
  console.log("✓ Coach ready:", COACH.email);

  for (const p of PLAYERS) {
    const profileId = await upsertUser(p.email, {
      role: "player",
      full_name: p.full_name,
      avatar_color: p.avatar_color,
    });
    await supabase.from("elite_profiles").upsert({
      id: profileId,
      role: "player",
      full_name: p.full_name,
      email: p.email,
      avatar_color: p.avatar_color,
    });

    // remove any prior player row for a clean reseed
    await supabase.from("elite_players").delete().eq("profile_id", profileId);

    const { data: playerRow, error: perr } = await supabase
      .from("elite_players")
      .insert({
        profile_id: profileId,
        coach_id: coachId,
        full_name: p.full_name,
        avatar_color: p.avatar_color,
        age: p.age,
        position: p.position,
        level: p.level,
        current_week: p.current_week,
        today_focus: p.today_focus,
        goals: p.goals,
        strengths: p.strengths,
        weaknesses: p.weaknesses,
        parent_name: p.parent_name,
        parent_email: p.email,
        subscription_status: p.subscription_status,
      })
      .select("id")
      .single();
    if (perr) throw perr;
    const playerId = playerRow.id;

    await supabase.from("elite_progress").insert(
      METRICS.map((metric, i) => ({
        player_id: playerId,
        metric,
        value: p.progress[i],
        prev_value: p.prev[i],
      }))
    );

    await supabase.from("elite_homework").insert(
      p.homework.map(([title, exercise, reps, completed], i) => ({
        player_id: playerId,
        week: p.current_week,
        title,
        exercise,
        reps,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        sort: i,
      }))
    );

    await supabase.from("elite_messages").insert({
      player_id: playerId,
      from_role: "coach",
      from_name: COACH.full_name,
      body: p.message,
    });

    await supabase.from("elite_achievements").insert({
      player_id: playerId,
      title: p.achievement[0],
      detail: p.achievement[1],
      icon: p.achievement[2],
    });

    console.log("✓ Player ready:", p.email);
  }

  console.log("\nDone. Demo password for every account: " + PASSWORD);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
